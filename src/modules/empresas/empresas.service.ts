import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import type { File as MulterFile } from 'multer';
import { Model } from 'mongoose';
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api';
import { Empresa, EmpresaDocument } from './schemas/empresa.schema';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectModel(Empresa.name) private readonly empresaModel: Model<EmpresaDocument>,
    private readonly cnpjApi: PlugNotasCnpjApi,
  ) {}

  async createFromCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj);
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido');
    }

    const existingWithCert = await this.empresaModel
      .findOne({ cnpj: normalized })
      .select('+certificado.pfxBase64');

    if (existingWithCert?.razaoSocial) {
      return this.empresaModel.findById(existingWithCert._id);
    }

    if (!existingWithCert?.certificado?.pfxBase64) {
      throw new BadRequestException({
        code: 'CERTIFICADO_REQUIRED',
        message: 'Importe o certificado digital (.pfx/.p12) antes de cadastrar a empresa',
      });
    }

    const { data } = await this.fetchProviderData(normalized);
    const mapped = this.mapProviderData(normalized, data);

    try {
      return await this.empresaModel.findByIdAndUpdate(existingWithCert._id, mapped, {
        new: true,
      });
    } catch (e: any) {
      throw new BadRequestException({
        message: 'Não foi possível cadastrar a empresa',
        error: e?.message ?? null,
      });
    }
  }

  async previewFromCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj);
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido');
    }

    const { data } = await this.fetchProviderData(normalized);
    return this.mapProviderData(normalized, data);
  }

  async importCertificado(cnpj: string, senhaCertificado: string, file: MulterFile) {
    const normalized = this.onlyDigits(cnpj);
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido');
    }

    const ext = this.extractFileExtension(file.originalname);
    if (!['pfx', 'p12'].includes(ext)) {
      throw new BadRequestException({
        code: 'CERT_FILE_INVALID_EXTENSION',
        message: 'Arquivo inválido. Use certificado .pfx ou .p12',
      });
    }

    if (!file.buffer?.length) {
      throw new BadRequestException({
        code: 'CERT_FILE_EMPTY',
        message: 'Arquivo de certificado vazio',
      });
    }

    const maxSize = Number(process.env.EMPRESA_CERT_MAX_SIZE_BYTES ?? 5_000_000);
    if (file.size > maxSize) {
      throw new BadRequestException({
        code: 'CERT_FILE_TOO_LARGE',
        message: `Arquivo excede o limite de ${maxSize} bytes`,
      });
    }

    const now = new Date();
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const encryptedPassword = this.encryptSecret(senhaCertificado);

    await this.empresaModel.updateOne(
      { cnpj: normalized },
      {
        $set: {
          certificado: {
            filename: file.originalname,
            mimeType: file.mimetype || 'application/x-pkcs12',
            size: file.size,
            sha256,
            uploadedAt: now,
            pfxBase64: file.buffer.toString('base64'),
            passwordEncrypted: encryptedPassword,
          },
        },
        $setOnInsert: { cnpj: normalized },
      },
      { upsert: true },
    );

    return {
      cnpj: normalized,
      certificado: {
        filename: file.originalname,
        mimeType: file.mimetype || 'application/x-pkcs12',
        size: file.size,
        sha256,
        uploadedAt: now.toISOString(),
      },
    };
  }

  list() {
    return this.empresaModel.find().sort({ createdAt: -1 });
  }

  getById(id: string) {
    return this.empresaModel.findById(id);
  }

  async getByCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj);
    return this.empresaModel.findOne({ cnpj: normalized });
  }

  async findFirstWithCertificate() {
    return this.empresaModel
      .findOne({ 'certificado.uploadedAt': { $exists: true } })
      .sort({ updatedAt: -1, createdAt: -1 });
  }

  async update(id: string, data: Partial<Empresa>) {
    return this.empresaModel.findByIdAndUpdate(id, data, { new: true });
  }

  async remove(id: string) {
    const doc = await this.empresaModel.findByIdAndDelete(id);
    return { deleted: Boolean(doc) };
  }

  private async fetchProviderData(cnpj: string) {
    try {
      const data = await this.cnpjApi.consultarCnpj(cnpj);
      return { data };
    } catch (e: any) {
      const providerStatus = e?.status;
      const providerBody = e?.body;
      throw new BadRequestException({
        message: 'Falha ao consultar CNPJ na PlugNotas',
        providerStatus: providerStatus ?? null,
        providerError: providerBody ?? null,
      });
    }
  }

  private mapProviderData(cnpj: string, data: Record<string, any>): Partial<Empresa> {
    const safeProviderData = this.sanitizeProviderData(data);
    const trimmedProviderData = this.trimProviderData(safeProviderData);

    const pick = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };

    const normalizeString = (value: any): string | undefined => {
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object') {
        return (
          value.descricao ??
          value.nome ??
          value.nome_municipio ??
          value.nomeMunicipio ??
          value.nome_pais ??
          value.nomePais
        );
      }
      return undefined;
    };

    const enderecoSrc =
      safeProviderData?.endereco ??
      safeProviderData?.endereco_empresa ??
      safeProviderData?.estabelecimento?.endereco ??
      safeProviderData?.estabelecimento ??
      safeProviderData?.localizacao ??
      safeProviderData;

    const cidadeRaw = pick(enderecoSrc, ['cidade', 'municipio', 'nome_municipio']);
    const paisRaw = pick(enderecoSrc, ['pais', 'nome_pais']);

    return {
      cnpj,
      razaoSocial: pick(safeProviderData, [
        'nome_razao_social',
        'razao_social',
        'razaoSocial',
        'nomeRazaoSocial',
      ]),
      nomeFantasia: pick(safeProviderData, ['nome_fantasia', 'nomeFantasia']),
      inscricaoMunicipal: pick(safeProviderData, [
        'inscricao_municipal',
        'inscricaoMunicipal',
        'im',
      ]),
      email: pick(safeProviderData, ['email', 'email_contato', 'emailContato']),
      fone: pick(safeProviderData, ['fone', 'telefone', 'telefone1', 'telefone_principal']),
      endereco: {
        logradouro: pick(enderecoSrc, ['logradouro', 'logradouro_endereco', 'logradouroEndereco']),
        numero: pick(enderecoSrc, ['numero', 'numero_endereco', 'numeroEndereco']),
        complemento: pick(enderecoSrc, ['complemento']),
        bairro: pick(enderecoSrc, ['bairro']),
        codigoMunicipio: pick(enderecoSrc, [
          'codigo_municipio',
          'codigoMunicipio',
          'municipio_codigo',
          'codigo_ibge',
        ]),
        cidade: normalizeString(cidadeRaw),
        uf: pick(enderecoSrc, ['uf', 'estado', 'sigla_uf', 'siglaEstado']),
        codigoPais: pick(enderecoSrc, ['codigo_pais', 'codigoPais', 'pais_codigo']),
        pais: normalizeString(paisRaw),
        cep: pick(enderecoSrc, ['cep']),
      },
      providerData: trimmedProviderData,
    };
  }

  private trimProviderData(data: Record<string, any>): Record<string, any> {
    const endereco = data?.endereco ?? data?.estabelecimento?.endereco ?? undefined;
    const municipio = endereco?.municipio;

    return {
      cnpj: data?.cnpj,
      razao_social: data?.razao_social ?? data?.nome_razao_social,
      nome_fantasia: data?.nome_fantasia,
      data_inicio_atividade: data?.data_inicio_atividade,
      matriz: data?.matriz,
      natureza_juridica: data?.natureza_juridica,
      capital_social: data?.capital_social,
      porte: data?.porte,
      situacao_cadastral: data?.situacao_cadastral,
      atividade_principal: data?.atividade_principal,
      atividades_secundarias: data?.atividades_secundarias,
      endereco: endereco
        ? {
            tipo_logradouro: endereco?.tipo_logradouro,
            logradouro: endereco?.logradouro,
            numero: endereco?.numero,
            complemento: endereco?.complemento,
            bairro: endereco?.bairro,
            cep: endereco?.cep,
            uf: endereco?.uf,
            municipio: municipio
              ? {
                  codigo_ibge: municipio?.codigo_ibge,
                  descricao: municipio?.descricao,
                }
              : undefined,
          }
        : undefined,
      telefones: data?.telefones,
      email: data?.email,
      simples: data?.simples,
      simei: data?.simei,
    };
  }

  private sanitizeProviderData(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeProviderData(item));
    }

    if (value && typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        if (key.startsWith('$') || key.includes('.')) continue;
        out[key] = this.sanitizeProviderData(val);
      }
      return out;
    }

    return value;
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }

  private extractFileExtension(name?: string) {
    const safe = (name ?? '').toLowerCase().trim();
    const idx = safe.lastIndexOf('.');
    return idx >= 0 ? safe.slice(idx + 1) : '';
  }

  private encryptSecret(value: string): string {
    const secret = process.env.EMPRESA_CERT_ENCRYPTION_KEY ?? process.env.JWT_SECRET;
    if (!secret?.trim()) {
      throw new BadRequestException({
        code: 'CERT_ENCRYPTION_KEY_REQUIRED',
        message: 'EMPRESA_CERT_ENCRYPTION_KEY ou JWT_SECRET é obrigatório para guardar certificado',
      });
    }

    const key = createHash('sha256').update(secret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }
}
