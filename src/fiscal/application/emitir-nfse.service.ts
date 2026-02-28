import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { FiscalProvider } from '../domain/fiscal-provider.interface';
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types';
import type { EmitirNfseResult } from '../domain/types/emitir-nfse.result';
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository';
import { EmpresasService } from '../../modules/empresas/empresas.service';
import { TomadoresService } from '../../modules/tomadores/tomadores.service';

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

function calculateValorIss(input: EmitirNfseInput): number | undefined {
  const valor = normalizeNumber(input.servico?.valor);
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
  ) {}

  async execute(input: EmitirNfseInput): Promise<{
    emissionId: string;
    result: EmitirNfseResult;
    idempotentReplay: boolean;
  }> {
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
    await this.assertPrestadorHasCertificate(input.prestador.cnpj);
    const bi = this.buildBiSnapshot(input);

    if (idempotencyKey) {
      const existing = await this.repository.findByReference(
        this.provider.providerName,
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

    let emission;
    try {
      emission = await this.repository.create({
        provider: this.provider.providerName,
        payload: input,
        biSnapshot: bi.biSnapshot,
        empresaCnpj: bi.empresaCnpj,
        tomadorCpfCnpj: bi.tomadorCpfCnpj,
        tomadorRazaoSocial: bi.tomadorRazaoSocial,
        descricaoServico: bi.descricaoServico,
        codigoServico: bi.codigoServico,
        valorServico: bi.valorServico,
        aliquotaIss: bi.aliquotaIss,
        valorIss: bi.valorIss,
        idempotencyKey,
        status: NfseEmissionStatus.PENDING,
      });
    } catch (error: any) {
      if (idempotencyKey && isMongoDuplicateKeyError(error)) {
        const existing = await this.repository.findByReference(
          this.provider.providerName,
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

    try {
      await this.upsertTomadorFromEmission(input);
      const result = await this.provider.emitirNfse(input);

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
      const msg = error instanceof Error ? error.message : String(error);
      await this.repository.updateEmission(emission._id.toString(), {
        status: NfseEmissionStatus.ERROR,
        error: msg,
      });

      const status = error?.status;
      const body = error?.body;

      if (typeof status === 'number' && status >= 400 && status < 500) {
        throw new BadRequestException({
          message: `${this.provider.providerName} rejected the request`,
          provider: body ?? null,
        });
      }

      throw error;
    }
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
    descricaoServico?: string;
    codigoServico?: string;
    valorServico?: number;
    aliquotaIss?: number;
    valorIss?: number;
  } {
    const empresaCnpj = onlyDigits(input.prestador?.cnpj);
    const tomadorCpfCnpj = onlyDigits(input.tomador?.cpfCnpj);
    const valorServico = normalizeNumber(input.servico?.valor);
    const aliquotaIss = normalizeNumber(input.servico?.iss?.aliquota);
    const valorIss = calculateValorIss(input);

    const biSnapshot = {
      referenciaExterna: input.referenciaExterna,
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
      servico: {
        codigoNacional: input.servico?.codigoNacional,
        codigoMunicipal: input.servico?.codigoMunicipal,
        codigoTributacao: input.servico?.codigoTributacao,
        descricao: input.servico?.descricao,
        valor: valorServico,
        iss: input.servico?.iss,
        tributacaoTotal: input.servico?.tributacaoTotal,
      },
      metricas: {
        valorServico,
        aliquotaIss,
        valorIss,
        issRetido: input.servico?.iss?.retido ?? false,
      },
    };

    return {
      biSnapshot,
      empresaCnpj: empresaCnpj || undefined,
      tomadorCpfCnpj: tomadorCpfCnpj || undefined,
      tomadorRazaoSocial: input.tomador?.razaoSocial,
      descricaoServico: input.servico?.descricao,
      codigoServico: input.servico?.codigoNacional ?? input.servico?.codigoMunicipal,
      valorServico,
      aliquotaIss,
      valorIss,
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
      });
    } catch (error) {
      // Emissão não deve falhar por falha de atualização de cadastro analítico.
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao sincronizar tomador a partir da emissão: ${errorMessage}`);
    }
  }
}
