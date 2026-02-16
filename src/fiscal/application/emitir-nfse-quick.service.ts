import { BadRequestException, Injectable } from '@nestjs/common';
import { EmpresasService } from '../../modules/empresas/empresas.service';
import { EmitirNfseService } from './emitir-nfse.service';
import type { EmitirNfseInput } from '../domain/types/emitir-nfse.types';
import { ServicoCatalogService } from './servico-catalog.service';

function onlyDigits(value?: string) {
  return (value ?? '').replace(/\D+/g, '');
}

function requiredString(value: string | undefined, field: string): string {
  const normalized = (value ?? '').trim();
  if (!normalized) {
    throw new BadRequestException({
      code: 'QUICK_CONFIG_INCOMPLETE',
      message: `Campo obrigatório ausente para emissão rápida: ${field}`,
    });
  }
  return normalized;
}

@Injectable()
export class EmitirNfseQuickService {
  constructor(
    private readonly emitirNfseService: EmitirNfseService,
    private readonly empresasService: EmpresasService,
    private readonly servicoCatalog: ServicoCatalogService,
  ) {}

  async execute(input: { cpfTomador: string; valor: number; codigoServico?: string }) {
    const empresa = await this.resolveEmpresa();
    const payload = this.buildPayload(empresa, input);
    return this.emitirNfseService.execute(payload);
  }

  private async resolveEmpresa() {
    const configuredCnpj = onlyDigits(process.env.QUICK_NFSE_PRESTADOR_CNPJ);
    const empresa = configuredCnpj
      ? await this.empresasService.getByCnpj(configuredCnpj)
      : await this.empresasService.findFirstWithCertificate();

    if (!empresa) {
      throw new BadRequestException({
        code: 'QUICK_PRESTADOR_NOT_FOUND',
        message:
          'Nenhuma empresa apta para emissão rápida. Configure QUICK_NFSE_PRESTADOR_CNPJ ou cadastre uma empresa com certificado.',
      });
    }

    if (!empresa.certificado?.uploadedAt) {
      throw new BadRequestException({
        code: 'QUICK_PRESTADOR_NO_CERT',
        message: 'A empresa selecionada não possui certificado digital importado.',
      });
    }

    return empresa;
  }

  private buildPayload(
    empresa: {
      cnpj: string;
      razaoSocial?: string;
      inscricaoMunicipal?: string;
      endereco?: {
        logradouro?: string;
        numero?: string;
        complemento?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
        cep?: string;
      };
    },
    input: { cpfTomador: string; valor: number; codigoServico?: string },
  ): EmitirNfseInput {
    const prestadorEndereco = empresa.endereco ?? {};
    const cidade = requiredString(prestadorEndereco.cidade, 'empresa.endereco.cidade');
    const uf = requiredString(prestadorEndereco.uf, 'empresa.endereco.uf');
    const cep = requiredString(prestadorEndereco.cep, 'empresa.endereco.cep');

    const descricaoPadrao = process.env.QUICK_NFSE_DESCRICAO_PADRAO ?? 'Prestacao de servicos';
    const codigoNacionalPadrao = process.env.QUICK_NFSE_CODIGO_NACIONAL ?? '171901';
    const codigoTributacao = process.env.QUICK_NFSE_CODIGO_TRIBUTACAO ?? '100';
    const aliquotaRaw = process.env.QUICK_NFSE_ISS_ALIQUOTA;
    const aliquota = aliquotaRaw ? Number(aliquotaRaw) : undefined;

    const codigoServico = onlyDigits(input.codigoServico);
    const servicoCatalogo = codigoServico ? this.servicoCatalog.findByCodigo(codigoServico) : null;
    if (codigoServico && !servicoCatalogo) {
      throw new BadRequestException({
        code: 'QUICK_CODIGO_SERVICO_INVALIDO',
        message: 'codigoServico nao encontrado no catalogo nacional (LC116)',
      });
    }

    const codigoNacional = servicoCatalogo?.codigoNacional ?? codigoNacionalPadrao;
    const descricaoServico = servicoCatalogo?.descricao ?? descricaoPadrao;

    const referencia = this.generateReference(empresa.cnpj);
    const cpfTomador = onlyDigits(input.cpfTomador);
    if (cpfTomador.length !== 11) {
      throw new BadRequestException({
        code: 'QUICK_CPF_INVALID',
        message: 'cpfTomador deve conter 11 dígitos',
      });
    }

    return {
      prestador: {
        cnpj: onlyDigits(empresa.cnpj),
        inscricaoMunicipal: empresa.inscricaoMunicipal,
        razaoSocial: empresa.razaoSocial ?? 'PRESTADOR',
        endereco: {
          logradouro: requiredString(prestadorEndereco.logradouro, 'empresa.endereco.logradouro'),
          numero: requiredString(prestadorEndereco.numero, 'empresa.endereco.numero'),
          complemento: prestadorEndereco.complemento,
          bairro: requiredString(prestadorEndereco.bairro, 'empresa.endereco.bairro'),
          municipio: cidade,
          uf,
          cep: cep.replace(/\D+/g, ''),
        },
      },
      tomador: {
        cpfCnpj: cpfTomador,
        razaoSocial: process.env.QUICK_NFSE_TOMADOR_RAZAO_SOCIAL ?? 'CONSUMIDOR FINAL',
        endereco: {
          logradouro: process.env.QUICK_NFSE_TOMADOR_LOGRADOURO ?? 'NAO INFORMADO',
          numero: process.env.QUICK_NFSE_TOMADOR_NUMERO ?? 'S/N',
          complemento: process.env.QUICK_NFSE_TOMADOR_COMPLEMENTO,
          bairro: process.env.QUICK_NFSE_TOMADOR_BAIRRO ?? 'CENTRO',
          municipio: process.env.QUICK_NFSE_TOMADOR_MUNICIPIO ?? cidade,
          uf: process.env.QUICK_NFSE_TOMADOR_UF ?? uf,
          cep: (process.env.QUICK_NFSE_TOMADOR_CEP ?? cep).replace(/\D+/g, ''),
        },
      },
      servico: {
        codigoNacional,
        codigoTributacao,
        descricao: descricaoServico,
        valor: input.valor,
        iss: {
          aliquota: Number.isFinite(aliquota as number) ? aliquota : undefined,
        },
      },
      referenciaExterna: referencia,
    };
  }

  private generateReference(cnpj: string) {
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8);
    return `quick-${onlyDigits(cnpj).slice(-8)}-${stamp}-${random}`;
  }
}
