import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { FiscalProvider } from '../domain/fiscal-provider.interface';
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types';
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result';
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository';
import { EmpresasService } from '../../modules/empresas/empresas.service';
import { TomadoresService } from '../../modules/tomadores/tomadores.service';
import { FiscalProviderResolver } from './fiscal-provider.resolver';

function normalizeIdempotencyKey(value: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function isMongoDuplicateKeyError(error: any): boolean {
  return error?.code === 11000;
}

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalNumberFromEnv(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function booleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'sim', 's', 'yes', 'y', 'optante', 'ativo'].includes(normalized)) return true;
    if (['false', '0', 'nao', 'não', 'n', 'no', 'inativo'].includes(normalized)) return false;
  }
  return undefined;
}

function calculateValorIss(input: EmitirNfseInput): number | undefined {
  const valor =
    normalizeNumber(input.servico?.baseCalculo) ?? normalizeNumber(input.servico?.valor);
  const aliquota = normalizeNumber(input.servico?.iss?.aliquota);
  if (valor === undefined || aliquota === undefined) return undefined;
  return Number(((valor * aliquota) / 100).toFixed(2));
}

@Injectable()
export class EmitirNfseService {
  private readonly logger = new Logger(EmitirNfseService.name);

  constructor(
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
    private readonly repository: NfseEmissionRepository,
    private readonly empresasService: EmpresasService,
    private readonly tomadoresService: TomadoresService,
    @Optional() private readonly resolver?: FiscalProviderResolver,
  ) {}

  private providerFor(input: EmitirNfseInput, providerName?: string): FiscalProvider {
    if (providerName) {
      if (this.resolver) return this.resolver.byProviderName(providerName);
      if (this.provider.providerName === providerName) return this.provider;
      throw Object.assign(new Error(`FiscalProvider indisponivel: ${providerName}`), {
        code: 'FISCAL_PROVIDER_UNAVAILABLE',
      });
    }
    if (!this.resolver) return this.provider;
    return this.resolver.resolveProviderForCnpj(onlyDigits(input.prestador?.cnpj));
  }

  async execute(
    input: EmitirNfseInput,
    options?: { providerName?: string },
  ): Promise<{
    emissionId: string;
    result: EmitirNfseResult;
    idempotentReplay: boolean;
  }> {
    const enrichedInput = await this.enrichInputForProvider(input);
    const provider = this.providerFor(enrichedInput, options?.providerName);
    const tomadorEndereco = input?.tomador?.endereco;
    if (!tomadorEndereco) {
      throw new BadRequestException({
        message: 'tomador.endereco is required',
      });
    }

    const requiredTomadorEnderecoFields = [
      'logradouro',
      'numero',
      'bairro',
      'municipio',
      'uf',
      'cep',
    ] as const;
    const missingFields = requiredTomadorEnderecoFields.filter((field) => !tomadorEndereco[field]);
    if (missingFields.length > 0) {
      throw new BadRequestException({
        message: 'tomador.endereco is missing required fields',
        missingFields,
      });
    }

    const idempotencyKey = normalizeIdempotencyKey(input.referenciaExterna);
    await this.assertPrestadorHasCertificate(enrichedInput.prestador.cnpj);
    const bi = this.buildBiSnapshot(enrichedInput);

    if (idempotencyKey) {
      const existing = await this.repository.findByReference(provider.providerName, idempotencyKey);

      if (existing) {
        return {
          emissionId: existing._id.toString(),
          idempotentReplay: true,
          result: {
            status: existing.status,
            provider: existing.provider,
            externalId: existing.externalId,
            providerResponse: existing.providerResponse,
            providerRequest: existing.providerRequest,
          },
        };
      }
    }

    let emission;
    try {
      emission = await this.repository.create({
        provider: provider.providerName,
        payload: enrichedInput,
        biSnapshot: bi.biSnapshot,
        empresaCnpj: bi.empresaCnpj,
        tomadorCpfCnpj: bi.tomadorCpfCnpj,
        tomadorRazaoSocial: bi.tomadorRazaoSocial,
        tomadorInscricaoMunicipal: bi.tomadorInscricaoMunicipal,
        tomadorEmail: bi.tomadorEmail,
        tomadorMunicipio: bi.tomadorMunicipio,
        tomadorUf: bi.tomadorUf,
        descricaoServico: bi.descricaoServico,
        codigoServico: bi.codigoServico,
        servicoCodigoMunicipal: bi.servicoCodigoMunicipal,
        servicoCodigoNacional: bi.servicoCodigoNacional,
        localPrestacaoPais: bi.localPrestacaoPais,
        localPrestacaoUf: bi.localPrestacaoUf,
        localPrestacaoMunicipio: bi.localPrestacaoMunicipio,
        numeroNfse: bi.numeroNfse,
        competencia: bi.competencia,
        dataEmissao: bi.dataEmissao,
        valorServico: bi.valorServico,
        baseCalculo: bi.baseCalculo,
        desconto: bi.desconto,
        aliquotaIss: bi.aliquotaIss,
        valorIss: bi.valorIss,
        parametroIssAplicado: bi.parametroIssAplicado,
        retPis: bi.retPis,
        retCofins: bi.retCofins,
        retCsll: bi.retCsll,
        retIr: bi.retIr,
        retInss: bi.retInss,
        tributacaoTotalFederal: bi.tributacaoTotalFederal,
        tributacaoTotalEstadual: bi.tributacaoTotalEstadual,
        tributacaoTotalMunicipal: bi.tributacaoTotalMunicipal,
        idempotencyKey,
        status: NfseEmissionStatus.PENDING,
      });
    } catch (error: any) {
      if (idempotencyKey && isMongoDuplicateKeyError(error)) {
        const existing = await this.repository.findByReference(
          provider.providerName,
          idempotencyKey,
        );
        if (existing) {
          return {
            emissionId: existing._id.toString(),
            idempotentReplay: true,
            result: {
              status: existing.status,
              provider: existing.provider,
              externalId: existing.externalId,
              providerResponse: existing.providerResponse,
              providerRequest: existing.providerRequest,
            },
          };
        }
      }
      throw error;
    }

    let providerRequestForAudit: Record<string, any> | undefined;

    try {
      if (enrichedInput.syncTomadorCadastro !== false) {
        await this.upsertTomadorFromEmission(enrichedInput);
      }
      const {
        parametroIssAplicado: _parametroIssAplicado,
        syncTomadorCadastro: _syncTomadorCadastro,
        ...providerInput
      } = enrichedInput;
      providerRequestForAudit = { payload: [providerInput] };
      const result = await provider.emitirNfse(providerInput);

      await this.repository.updateEmission(emission._id.toString(), {
        provider: result.provider,
        status: result.status,
        externalId: result.externalId ?? undefined,
        providerResponse: result.providerResponse ?? undefined,
        providerRequest: result.providerRequest ?? undefined,
      });

      return {
        emissionId: emission._id.toString(),
        result,
        idempotentReplay: false,
      };
    } catch (error: any) {
      const msg = extractErrorMessage(error);
      const providerResponse = error?.providerResponse ?? error?.body ?? undefined;
      const providerRequest = error?.providerRequest ?? providerRequestForAudit;
      await this.repository.updateEmission(emission._id.toString(), {
        status: NfseEmissionStatus.ERROR,
        error: msg,
        providerRequest,
        providerResponse,
      });

      const status = error?.status;
      const body = error?.body;

      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw new BadRequestException({
          message: `${provider.providerName} rejected the request`,
          provider: body ?? null,
        });
      }

      throw error;
    }
  }

  private async enrichInputForProvider(input: EmitirNfseInput): Promise<EmitirNfseInput> {
    const cnpj = onlyDigits(input.prestador?.cnpj);
    if (cnpj.length !== 14) return input;

    const regime = input.prestador?.regimeTributarioSn;
    const tot = input.servico?.tributacaoTotal;
    const hasTotTribValues =
      tot?.federal?.valor !== undefined ||
      tot?.federal?.valorPercentual !== undefined ||
      tot?.estadual?.valor !== undefined ||
      tot?.estadual?.valorPercentual !== undefined ||
      tot?.municipal?.valor !== undefined ||
      tot?.municipal?.valorPercentual !== undefined ||
      tot?.pTotTribSN !== undefined;
    const isMeEpp = regime?.opSimpNac === 3;

    if (regime && (!isMeEpp || hasTotTribValues)) return input;

    const empresa = await this.empresasService.getByCnpj(cnpj);
    const empresaRecord = (empresa as Record<string, unknown> | null) ?? {};
    const providerData =
      (empresaRecord.providerData as Record<string, unknown> | undefined) ?? undefined;
    const simplesData = (providerData?.simples as Record<string, unknown> | undefined) ?? undefined;

    const optante =
      booleanLike(simplesData?.optante) ??
      booleanLike(simplesData?.optanteSimples) ??
      booleanLike(simplesData?.isOptante) ??
      booleanLike(simplesData);

    if (optante === false) return input;

    const simplesSnapshot =
      (empresaRecord.simplesSnapshot as Record<string, unknown> | undefined) ?? undefined;
    const aliquotaEfetiva = normalizeNumber(simplesSnapshot?.aliquotaEfetiva);
    const pTotTribSN =
      aliquotaEfetiva !== undefined ? Number((aliquotaEfetiva * 100).toFixed(2)) : undefined;

    return {
      ...input,
      prestador: {
        ...input.prestador,
        regimeTributarioSn: {
          opSimpNac:
            regime?.opSimpNac ?? optionalNumberFromEnv(process.env.QUICK_NFSE_OP_SIMP_NAC) ?? 3,
          regApTribSN:
            regime?.regApTribSN ??
            optionalNumberFromEnv(process.env.QUICK_NFSE_REG_AP_TRIB_SN) ??
            1,
          regEspTrib:
            regime?.regEspTrib ?? optionalNumberFromEnv(process.env.QUICK_NFSE_REG_ESP_TRIB) ?? 0,
        },
      },
      servico:
        pTotTribSN !== undefined
          ? {
              ...input.servico,
              tributacaoTotal: {
                ...(input.servico?.tributacaoTotal ?? {}),
                pTotTribSN,
              },
            }
          : input.servico,
    };
  }

  private async assertPrestadorHasCertificate(prestadorCnpj: string): Promise<void> {
    const cnpj = onlyDigits(prestadorCnpj);
    if (cnpj.length !== 14) {
      throw new BadRequestException({
        code: 'PRESTADOR_CNPJ_INVALID',
        message: 'prestador.cnpj deve conter 14 dígitos',
      });
    }

    const cadastroResumo = await this.empresasService.getCadastroResumoByCnpj(cnpj);
    if (!cadastroResumo) {
      throw new BadRequestException({
        code: 'PRESTADOR_NOT_FOUND',
        message: 'Empresa não encontrada para o CNPJ informado no prestador',
      });
    }

    if (!cadastroResumo.prontoParaEmitir) {
      throw new BadRequestException({
        code: 'PRESTADOR_INCOMPLETO',
        message: 'Cadastro do prestador está incompleto para emissão',
        details: {
          statusCadastro: cadastroResumo.statusCadastro,
          percentualCompletude: cadastroResumo.percentualCompletude,
          camposFaltantes: cadastroResumo.camposFaltantes,
          camposFaltantesEmissao: cadastroResumo.camposFaltantesEmissao,
        },
      });
    }
  }

  private buildBiSnapshot(input: EmitirNfseInput): {
    biSnapshot: Record<string, any>;
    empresaCnpj?: string;
    tomadorCpfCnpj?: string;
    tomadorRazaoSocial?: string;
    tomadorInscricaoMunicipal?: string;
    tomadorEmail?: string;
    tomadorMunicipio?: string;
    tomadorUf?: string;
    descricaoServico?: string;
    codigoServico?: string;
    servicoCodigoMunicipal?: string;
    servicoCodigoNacional?: string;
    localPrestacaoPais?: string;
    localPrestacaoUf?: string;
    localPrestacaoMunicipio?: string;
    numeroNfse?: string;
    competencia?: string;
    dataEmissao?: string;
    valorServico?: number;
    baseCalculo?: number;
    desconto?: number;
    aliquotaIss?: number;
    valorIss?: number;
    parametroIssAplicado?: string;
    retPis?: number;
    retCofins?: number;
    retCsll?: number;
    retIr?: number;
    retInss?: number;
    tributacaoTotalFederal?: number;
    tributacaoTotalEstadual?: number;
    tributacaoTotalMunicipal?: number;
  } {
    const empresaCnpj = onlyDigits(input.prestador?.cnpj);
    const tomadorCpfCnpj = onlyDigits(input.tomador?.cpfCnpj);
    const valorServico = normalizeNumber(input.servico?.valor);
    const baseCalculo =
      normalizeNumber(input.servico?.baseCalculo) ??
      (valorServico !== undefined
        ? Number((valorServico - (normalizeNumber(input.servico?.desconto) ?? 0)).toFixed(2))
        : undefined);
    const desconto = normalizeNumber(input.servico?.desconto);
    const aliquotaIss = normalizeNumber(input.servico?.iss?.aliquota);
    const valorIss = calculateValorIss(input);
    const parametroIssAplicado =
      typeof input.parametroIssAplicado === 'string'
        ? input.parametroIssAplicado.trim() || undefined
        : undefined;
    const retPis = normalizeNumber(input.servico?.retencoesFederais?.pis);
    const retCofins = normalizeNumber(input.servico?.retencoesFederais?.cofins);
    const retCsll = normalizeNumber(input.servico?.retencoesFederais?.csll);
    const retIr = normalizeNumber(input.servico?.retencoesFederais?.ir);
    const retInss = normalizeNumber(input.servico?.retencoesFederais?.inss);
    const tributacaoTotalFederal = normalizeNumber(input.servico?.tributacaoTotal?.federal?.valor);
    const tributacaoTotalEstadual = normalizeNumber(
      input.servico?.tributacaoTotal?.estadual?.valor,
    );
    const tributacaoTotalMunicipal = normalizeNumber(
      input.servico?.tributacaoTotal?.municipal?.valor,
    );

    const biSnapshot = {
      referenciaExterna: input.referenciaExterna,
      numeroNfse: input.numeroNfse,
      competencia: input.competencia,
      dataEmissao: input.dataEmissao,
      substituicao: input.substituicao ?? false,
      idNotaSubstituida: input.idNotaSubstituida,
      prestador: {
        cnpj: empresaCnpj || undefined,
        inscricaoMunicipal: input.prestador?.inscricaoMunicipal,
        razaoSocial: input.prestador?.razaoSocial,
      },
      tomador: {
        cpfCnpj: tomadorCpfCnpj || undefined,
        razaoSocial: input.tomador?.razaoSocial,
        inscricaoMunicipal: input.tomador?.inscricaoMunicipal,
        email: input.tomador?.email,
        endereco: input.tomador?.endereco,
      },
      localPrestacao: {
        pais: input.localPrestacao?.pais,
        uf: input.localPrestacao?.uf,
        municipio: input.localPrestacao?.municipio,
      },
      parametroIssAplicado,
      servico: {
        codigoNacional: input.servico?.codigoNacional,
        codigoMunicipal: input.servico?.codigoMunicipal,
        codigoTributacao: input.servico?.codigoTributacao,
        descricao: input.servico?.descricao,
        valor: valorServico,
        baseCalculo,
        desconto,
        retencoesFederais: {
          pis: retPis,
          cofins: retCofins,
          csll: retCsll,
          ir: retIr,
          inss: retInss,
        },
        iss: input.servico?.iss,
        tributacaoTotal: input.servico?.tributacaoTotal,
      },
      metricas: {
        valorServico,
        baseCalculo,
        desconto,
        aliquotaIss,
        valorIss,
        parametroIssAplicado,
        issRetido: input.servico?.iss?.retido ?? false,
        retPis,
        retCofins,
        retCsll,
        retIr,
        retInss,
        tributacaoTotalFederal,
        tributacaoTotalEstadual,
        tributacaoTotalMunicipal,
      },
    };

    return {
      biSnapshot,
      empresaCnpj: empresaCnpj || undefined,
      tomadorCpfCnpj: tomadorCpfCnpj || undefined,
      tomadorRazaoSocial: input.tomador?.razaoSocial,
      tomadorInscricaoMunicipal: input.tomador?.inscricaoMunicipal,
      tomadorEmail: input.tomador?.email,
      tomadorMunicipio: input.tomador?.endereco?.municipio,
      tomadorUf: input.tomador?.endereco?.uf,
      descricaoServico: input.servico?.descricao,
      codigoServico: input.servico?.codigoNacional ?? input.servico?.codigoMunicipal,
      servicoCodigoMunicipal: input.servico?.codigoMunicipal,
      servicoCodigoNacional: input.servico?.codigoNacional,
      localPrestacaoPais: input.localPrestacao?.pais,
      localPrestacaoUf: input.localPrestacao?.uf,
      localPrestacaoMunicipio: input.localPrestacao?.municipio,
      numeroNfse: input.numeroNfse,
      competencia: input.competencia,
      dataEmissao: input.dataEmissao,
      valorServico,
      baseCalculo,
      desconto,
      aliquotaIss,
      valorIss,
      parametroIssAplicado,
      retPis,
      retCofins,
      retCsll,
      retIr,
      retInss,
      tributacaoTotalFederal,
      tributacaoTotalEstadual,
      tributacaoTotalMunicipal,
    };
  }

  private async upsertTomadorFromEmission(input: EmitirNfseInput): Promise<void> {
    try {
      await this.tomadoresService.upsertFromEmission({
        empresaCnpj: input.prestador.cnpj,
        cpfCnpj: input.tomador.cpfCnpj,
        razaoSocial: input.tomador.razaoSocial,
        inscricaoMunicipal: input.tomador.inscricaoMunicipal,
        email: input.tomador.email,
        endereco: input.tomador.endereco,
        servico: {
          codigoServico: input.servico.codigoNacional ?? input.servico.codigoMunicipal,
          descricaoServico: input.servico.descricao,
        },
      });
    } catch (error) {
      // Emissão não deve falhar por falha de atualização de cadastro analítico.
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao sincronizar tomador a partir da emissão: ${errorMessage}`);
    }
  }
}
