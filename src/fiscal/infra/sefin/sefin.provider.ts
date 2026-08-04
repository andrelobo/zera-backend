import { Injectable, Logger } from '@nestjs/common';
import { EmpresasService } from '../../../modules/empresas/empresas.service';
import type { FiscalProvider } from '../../domain/fiscal-provider.interface';
import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import type { EmitirNfseInput } from '../../domain/types/emitir-nfse.types';
import type { EmitirNfseResult } from '../../domain/types/emitir-nfse.result';
import { NfseEmissionRepository } from '../mongo/repositories/nfse-emission.repository';
import { buildDps, type DpsBuilderOptions } from './dps-builder';
import { extractDpsId, extractKeyAndCert, signDps, type DpsCertMaterialPem } from './dps-signer';
import { EVENTO_CANCELAMENTO_TAG, buildPedidoCancelamentoAssinado } from './evento-builder';
import { xmlToGzipBase64 } from './sefin-codec';
import {
  looksLikeDpsId,
  looksLikeNfseChave,
  mapSefinEventoRegistroResponse,
  mapSefinNfseResponse,
  parseEventosConsulta,
  type SefinNfseParsed,
} from './sefin-mapper';
import { SefinMtlsHttp } from './sefin-mtls.http';
import { getSefinConfig } from './sefin.config';
import { gerarDanfsePdf } from './danfse';

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

@Injectable()
export class LobonotasProvider implements FiscalProvider {
  readonly providerName = 'LOBONOTAS';
  private readonly logger = new Logger(LobonotasProvider.name);

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
    const { cert } = await this.resolverMaterialEmitente(externalId);
    return cert;
  }

  private async resolverMaterialEmitente(externalId: string): Promise<{
    cert: DpsCertMaterialPem;
    cnpj?: string;
    nDFSe?: string;
  }> {
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
      const providerResponse = (emission?.providerResponse ?? {}) as Record<string, any>;
      return {
        cert: extractKeyAndCert(material),
        cnpj,
        nDFSe: typeof providerResponse.nDFSe === 'string' ? providerResponse.nDFSe : undefined,
      };
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

    const body =
      cfg.nfseEnvelope === 'json' ? JSON.stringify({ dps: xmlToGzipBase64(signedDps) }) : signedDps;
    const contentType = cfg.nfseEnvelope === 'json' ? 'application/json' : 'application/xml';

    this.logger.log('Emitindo NFS-e via LOBONOTAS (Ambiente Nacional)', {
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
          `LOBONOTAS POST /nfse timed out; dpsId=${dpsId}; reconciliação via GET /dps (D5)`,
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
    const cert = await this.requireCertForEmission(externalId);
    const chave = await this.resolveChaveAcesso(externalId, cert);
    const response = await this.http.request({ method: 'GET', path: `/nfse/${chave}`, cert });

    try {
      return await gerarDanfsePdf(response.text);
    } catch (error: any) {
      this.logger.error(`Falha ao gerar DANFSe da NFS-e ${chave}`, error?.stack);
      throw this.throwError('DANFSE_GERACAO_FALHOU', `Falha ao gerar DANFSe: ${error?.message}`, {
        chaveAcesso: chave,
      });
    }
  }

  async solicitarCancelamentoNfse(
    idNota: string,
    input?: { codigo?: string; motivo?: string },
  ): Promise<{ protocol: string | null; providerResponse: any }> {
    const { cert, cnpj, nDFSe } = await this.resolverMaterialEmitente(idNota);
    const chave = await this.resolveChaveAcesso(idNota, cert);
    const cfg = getSefinConfig();

    const motivo = input?.motivo?.trim() || 'Cancelamento a pedido do Prestador';
    const eventoXml = buildPedidoCancelamentoAssinado(
      {
        chave,
        motivo,
        tpAmb: cfg.tpAmb,
        verAplic: cfg.verAplic,
        cnpjAutor: cnpj,
        nDFSe,
      },
      cert,
    );

    this.logger.log('Solicitando cancelamento via API Eventos (Ambiente Nacional)', {
      chave,
      evento: EVENTO_CANCELAMENTO_TAG,
      ambiente: cfg.environment,
    });

    let response;
    try {
      response = await this.http.registrarEvento({ chave, body: eventoXml, cert });
    } catch (error: any) {
      if (error?.status === 404) {
        return {
          protocol: null,
          providerResponse: { chaveAcesso: chave, notFound: true },
        };
      }
      const parsed = mapSefinEventoRegistroResponse({
        text: typeof error?.body === 'string' ? error.body : '',
        json: error?.body,
      });
      if (parsed.cStat || parsed.xMotivo) {
        const aceito = parsed.cStat ? /^[12]\d{2}$/.test(parsed.cStat) : false;
        return {
          protocol: aceito ? chave : null,
          providerResponse: {
            ...parsed,
            chaveAcesso: chave,
            protocol: aceito ? chave : null,
            aceito,
            status: aceito ? NfseEmissionStatus.AUTHORIZED : NfseEmissionStatus.REJECTED,
          },
        };
      }
      throw error;
    }

    const parsed = mapSefinEventoRegistroResponse({ text: response.text, json: response.json });
    const aceito = parsed.cStat ? /^[12]\d{2}$/.test(parsed.cStat) : false;

    return {
      protocol: aceito ? chave : null,
      providerResponse: {
        ...parsed,
        chaveAcesso: chave,
        protocol: aceito ? chave : null,
        aceito,
      },
    };
  }

  async consultarSolicitacaoCancelamentoNfse(cancellationProtocol: string): Promise<{
    status: string | undefined;
    providerResponse: any;
  }> {
    const cert = await this.requireCertForEmission(cancellationProtocol);
    const chave = await this.resolveChaveAcesso(cancellationProtocol, cert);

    let response;
    try {
      response = await this.http.consultarEventos({ chave, cert });
    } catch (error: any) {
      if (error?.status === 404) {
        return {
          status: undefined,
          providerResponse: { chaveAcesso: chave, notFound: true },
        };
      }
      throw error;
    }

    const consulta = parseEventosConsulta({ text: response.text, json: response.json });

    return {
      status: consulta.status,
      providerResponse: {
        chaveAcesso: chave,
        cStat: consulta.cStat,
        xMotivo: consulta.xMotivo,
        eventos: consulta.eventos,
        xml: consulta.xml,
      },
    };
  }
}
