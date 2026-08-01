import { Injectable, Logger } from '@nestjs/common';
import { EmpresasService } from '../../../modules/empresas/empresas.service';
import type { FiscalProvider } from '../../domain/fiscal-provider.interface';
import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import type { EmitirNfseInput } from '../../domain/types/emitir-nfse.types';
import type { EmitirNfseResult } from '../../domain/types/emitir-nfse.result';
import { NfseEmissionRepository } from '../mongo/repositories/nfse-emission.repository';
import { buildDps, type DpsBuilderOptions } from './dps-builder';
import { extractDpsId, extractKeyAndCert, signDps, type DpsCertMaterialPem } from './dps-signer';
import {
  looksLikeDpsId,
  looksLikeNfseChave,
  mapSefinNfseResponse,
  type SefinNfseParsed,
} from './sefin-mapper';
import { SefinMtlsHttp } from './sefin-mtls.http';
import { getSefinConfig } from './sefin.config';

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

@Injectable()
export class SefinNfseProvider implements FiscalProvider {
  readonly providerName = 'SEFIN';
  private readonly logger = new Logger(SefinNfseProvider.name);

  constructor(
    private readonly empresasService: EmpresasService,
    private readonly http: SefinMtlsHttp,
    private readonly repository: NfseEmissionRepository,
  ) {}

  private throwError(code: string, message: string, extra?: Record<string, unknown>): never {
    const err: Record<string, unknown> = { code, message, ...extra };
    throw Object.assign(new Error(message), err);
  }

  private toProviderResponse(parsed: SefinNfseParsed, chaveAcesso?: string): Record<string, any> {
    return {
      cStat: parsed.cStat,
      xMotivo: parsed.xMotivo,
      dhProc: parsed.dhProc,
      nDFSe: parsed.nDFSe,
      nNFSe: parsed.nNFSe,
      chaveAcesso: parsed.chaveAcesso ?? chaveAcesso,
      idNota: parsed.chaveAcesso ?? chaveAcesso,
      xml: parsed.xml,
    };
  }

  private async requireCertForEmission(externalId: string): Promise<DpsCertMaterialPem> {
    const emission = await this.repository.findByExternalId(externalId);
    const cnpj = emission?.empresaCnpj;
    const material = cnpj ? await this.empresasService.obterMaterialCertificado(cnpj) : null;
    if (!material) {
      return this.throwError(
        'SEFIN_CERT_NOT_FOUND',
        `Certificado digital não encontrado para reconciliar ${externalId}`,
        { externalId },
      );
    }
    try {
      return extractKeyAndCert(material);
    } catch (error) {
      return this.throwError(
        'SEFIN_CERT_PARSE_FAILED',
        `Falha ao extrair chave/certificado do PFX para ${externalId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { externalId },
      );
    }
  }

  private async recuperarChavePorDps(
    dpsId: string,
    cert: DpsCertMaterialPem,
  ): Promise<string | undefined> {
    try {
      const response = await this.http.request({ method: 'GET', path: `/dps/${dpsId}`, cert });
      const parsed = mapSefinNfseResponse({ text: response.text, json: response.json });
      return parsed.chaveAcesso;
    } catch (error: any) {
      if (error?.status === 404) return undefined;
      throw error;
    }
  }

  private async resolveChaveAcesso(externalId: string, cert: DpsCertMaterialPem): Promise<string> {
    let chave = externalId;
    if (looksLikeDpsId(externalId)) {
      const resolved = await this.recuperarChavePorDps(externalId, cert);
      if (resolved) chave = resolved;
    }
    if (!looksLikeNfseChave(chave)) {
      return this.throwError(
        'SEFIN_CHAVE_NAO_ENCONTRADA',
        `Chave de acesso da NFS-e não encontrada a partir de ${externalId}`,
        { externalId },
      );
    }
    return chave;
  }

  async emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult> {
    const cfg = getSefinConfig();
    const cnpj = onlyDigits(input.prestador.cnpj);
    if (cnpj.length !== 14) {
      return this.throwError('PRESTADOR_CNPJ_INVALID', 'prestador.cnpj deve conter 14 dígitos');
    }

    const material = await this.empresasService.obterMaterialCertificado(cnpj);
    if (!material) {
      return this.throwError(
        'SEFIN_CERT_NOT_FOUND',
        'Empresa não possui certificado digital A1 com material local para mTLS',
        { prestadorCnpj: cnpj },
      );
    }

    let pem: DpsCertMaterialPem;
    try {
      pem = extractKeyAndCert(material);
    } catch (error) {
      return this.throwError(
        'SEFIN_CERT_PARSE_FAILED',
        `Falha ao extrair chave/certificado do PFX: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { prestadorCnpj: cnpj },
      );
    }

    const numeracao = await this.empresasService.reservarNumeracaoDps(cnpj);
    const options: DpsBuilderOptions = {
      serie: numeracao.serie,
      nDPS: numeracao.nDPS,
      cLocEmi: cfg.cLocEmi,
      tpAmb: cfg.tpAmb,
      verAplic: cfg.verAplic,
      codigoTributacaoNacional: cfg.codigoTributacaoNacional,
    };
    const dpsXml = buildDps(input, options);
    const signedDps = signDps(dpsXml, pem);
    const dpsId = extractDpsId(signedDps);

    const body = cfg.nfseEnvelope === 'json' ? JSON.stringify({ dps: signedDps }) : signedDps;
    const contentType = cfg.nfseEnvelope === 'json' ? 'application/json' : 'application/xml';

    this.logger.log('Emitindo NFS-e via SEFIN (Ambiente Nacional)', {
      prestador: cnpj,
      dpsId,
      serie: numeracao.serie,
      nDPS: numeracao.nDPS,
      ambiente: cfg.environment,
    });

    let response;
    try {
      response = await this.http.request({
        method: 'POST',
        path: '/nfse',
        cert: pem,
        body,
        contentType,
      });
    } catch (error: any) {
      if (error?.code === 'SEFIN_REQUEST_TIMEOUT') {
        this.logger.warn(
          `SEFIN POST /nfse timed out; dpsId=${dpsId}; reconciliação via GET /dps (D5)`,
        );
        return {
          status: NfseEmissionStatus.PENDING,
          provider: this.providerName,
          externalId: dpsId,
          providerResponse: {
            dpsId,
            transmitidoSemConfirmacao: true,
            motivo: 'SEFIN_REQUEST_TIMEOUT',
          },
          providerRequest: { dpsXml: signedDps },
        };
      }

      if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
        const text =
          typeof error.body === 'string'
            ? error.body
            : error.body && typeof error.body === 'object'
              ? JSON.stringify(error.body)
              : '';
        const parsed = mapSefinNfseResponse({ text, json: error.body });
        if (parsed.cStat || parsed.xMotivo || parsed.chaveAcesso) {
          const chaveAcesso = parsed.chaveAcesso ?? dpsId;
          return {
            status: parsed.status,
            provider: this.providerName,
            externalId: chaveAcesso,
            providerResponse: {
              ...this.toProviderResponse(parsed, chaveAcesso),
              httpStatus: error.status,
            },
            providerRequest: { dpsXml: signedDps },
          };
        }
      }

      if (error && typeof error === 'object') {
        Object.assign(error, {
          providerRequest: { dpsXml: signedDps },
          providerResponse: error.body ?? null,
        });
      }
      throw error;
    }

    const parsed = mapSefinNfseResponse({ text: response.text, json: response.json });
    const chaveAcesso = parsed.chaveAcesso ?? dpsId;

    return {
      status: parsed.status,
      provider: this.providerName,
      externalId: chaveAcesso,
      providerResponse: this.toProviderResponse(parsed, chaveAcesso),
      providerRequest: { dpsXml: signedDps },
    };
  }

  async consultarNfse(externalId: string): Promise<{
    status: NfseEmissionStatus;
    providerResponse: any;
  }> {
    const cert = await this.requireCertForEmission(externalId);

    let chave = externalId;
    if (looksLikeDpsId(externalId)) {
      const resolved = await this.recuperarChavePorDps(externalId, cert);
      if (!resolved) {
        return {
          status: NfseEmissionStatus.PENDING,
          providerResponse: { dpsId: externalId, notFound: true },
        };
      }
      chave = resolved;
    }

    if (!looksLikeNfseChave(chave)) {
      return {
        status: NfseEmissionStatus.PENDING,
        providerResponse: { externalId, chaveInvalida: true },
      };
    }

    let response;
    try {
      response = await this.http.request({ method: 'GET', path: `/nfse/${chave}`, cert });
    } catch (error: any) {
      if (error?.status === 404) {
        return {
          status: NfseEmissionStatus.PENDING,
          providerResponse: { chaveAcesso: chave, notFound: true },
        };
      }
      throw error;
    }

    const parsed = mapSefinNfseResponse({ text: response.text, json: response.json });
    return {
      status: parsed.status,
      providerResponse: this.toProviderResponse(parsed, chave),
    };
  }

  async baixarXmlNfse(externalId: string): Promise<Uint8Array> {
    const cert = await this.requireCertForEmission(externalId);
    const chave = await this.resolveChaveAcesso(externalId, cert);
    const response = await this.http.request({ method: 'GET', path: `/nfse/${chave}`, cert });
    return response.body;
  }

  async baixarPdfNfse(
    externalId: string,
    _query?: { logotipo?: boolean; mensagem_rodape?: string },
  ): Promise<Uint8Array> {
    this.logger.warn(
      `DANFSE/PDF não é gerado pela API SEFIN neste escopo (Slice 7); retornando vazio para não quebrar o sync de artifacts (externalId=${externalId})`,
    );
    return new Uint8Array(0);
  }

  async solicitarCancelamentoNfse(
    idNota: string,
    input?: { codigo?: string; motivo?: string },
  ): Promise<{ protocol: string | null; providerResponse: any }> {
    return this.throwError(
      'SEFIN_EVENTO_NOT_IMPLEMENTED',
      'Cancelamento no Ambiente Nacional será via API Eventos (POST /nfse/{chave}/eventos) no Slice 7',
      { idNota, codigo: input?.codigo, motivo: input?.motivo },
    );
  }

  async consultarSolicitacaoCancelamentoNfse(cancellationProtocol: string): Promise<{
    status: string | undefined;
    providerResponse: any;
  }> {
    return this.throwError(
      'SEFIN_EVENTO_NOT_IMPLEMENTED',
      'Consulta de cancelamento no Ambiente Nacional será via API Eventos (GET /nfse/{chave}/eventos) no Slice 7',
      { cancellationProtocol },
    );
  }
}
