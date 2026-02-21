import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import type { File as MulterFile } from 'multer';
import { Model } from 'mongoose';
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api';
import { BrasilApiCnpjApi } from './brasilapi-cnpj.api';
import { CreateEmpresaDto } from './dtos/create-empresa.dto';
import { UpdateEmpresaDto } from './dtos/update-empresa.dto';
import { Empresa, EmpresaDocument } from './schemas/empresa.schema';

@Injectable()
export class EmpresasService {
  constructor(
    @InjectModel(Empresa.name) private readonly empresaModel: Model<EmpresaDocument>,
    private readonly brasilApiCnpjApi: BrasilApiCnpjApi,
    private readonly plugNotasCnpjApi: PlugNotasCnpjApi,
  ) {}

  async createFromCnpj(cnpj: string, payload?: Partial<CreateEmpresaDto>) {
    const normalized = this.onlyDigits(cnpj);
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido');
    }
    const overrides = this.pickEmpresaOverrides(payload);

    const existingWithCert = await this.empresaModel
      .findOne({ cnpj: normalized })
      .select('+certificado.pfxBase64');

    if (existingWithCert?.razaoSocial) {
      if (Object.keys(overrides).length === 0) {
        return this.empresaModel.findById(existingWithCert._id);
      }
      return this.empresaModel.findByIdAndUpdate(existingWithCert._id, overrides, {
        new: true,
      });
    }

    if (!existingWithCert?.certificado?.pfxBase64) {
      throw new BadRequestException({
        code: 'CERTIFICADO_REQUIRED',
        message: 'Importe o certificado digital (.pfx/.p12) antes de cadastrar a empresa',
      });
    }

    const { data } = await this.fetchProviderData(normalized);
    const mapped = this.mapProviderData(normalized, data);
    const updateData = { ...mapped, ...overrides };

    try {
      return await this.empresaModel.findByIdAndUpdate(existingWithCert._id, updateData, {
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

  async list(filters?: { q?: string; limit?: number }) {
    const q = String(filters?.q ?? '').trim();
    const limit = this.normalizeLimit(filters?.limit, q.length > 0);
    const searchConditions: Record<string, unknown>[] = [];
    const qDigits = this.onlyDigits(q);
    const hasSearch = q.length > 0;

    if (qDigits.length > 0) {
      searchConditions.push({ cnpj: { $regex: this.escapeRegex(qDigits), $options: 'i' } });
      searchConditions.push({ cpf_cnpj: { $regex: this.escapeRegex(qDigits), $options: 'i' } });
    }
    if (q.length > 0) {
      searchConditions.push({ razaoSocial: { $regex: this.escapeRegex(q), $options: 'i' } });
      searchConditions.push({ nome_razao_social: { $regex: this.escapeRegex(q), $options: 'i' } });
      searchConditions.push({ nomeFantasia: { $regex: this.escapeRegex(q), $options: 'i' } });
      searchConditions.push({ nome_fantasia: { $regex: this.escapeRegex(q), $options: 'i' } });
    }

    const query = searchConditions.length > 0 ? { $or: searchConditions } : {};
    const listQuery = this.empresaModel.find(query).sort({ createdAt: -1 });
    if (hasSearch) {
      listQuery.select({
        _id: 1,
        cnpj: 1,
        cpf_cnpj: 1,
        razaoSocial: 1,
        nome_razao_social: 1,
        nomeFantasia: 1,
        nome_fantasia: 1,
        inscricaoMunicipal: 1,
        inscricao_municipal: 1,
        email: 1,
        fone: 1,
        endereco: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    }
    if (limit) {
      listQuery.limit(limit);
    }
    const docs = await listQuery.lean();
    return docs.map((doc) =>
      this.normalizeEmpresaOutput(doc as unknown as Record<string, unknown>),
    );
  }

  getById(id: string) {
    return this.empresaModel.findById(id);
  }

  async getByCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj);
    return this.empresaModel.findOne({
      $or: [{ cnpj: normalized }, { cpf_cnpj: normalized }],
    } as any);
  }

  async getByCnpjNormalized(cnpj: string) {
    const doc = await this.getByCnpj(cnpj);
    if (!doc) return null;
    return this.normalizeEmpresaOutput(
      doc.toObject() as unknown as Record<string, unknown>,
    );
  }

  async findFirstWithCertificate() {
    return this.empresaModel
      .findOne({ 'certificado.uploadedAt': { $exists: true } })
      .sort({ updatedAt: -1, createdAt: -1 });
  }

  async update(id: string, data: Partial<UpdateEmpresaDto>) {
    const patch = this.pickEmpresaOverrides(data);
    return this.empresaModel.findByIdAndUpdate(id, patch, { new: true });
  }

  async remove(id: string) {
    const doc = await this.empresaModel.findByIdAndDelete(id);
    return { deleted: Boolean(doc) };
  }

  private async fetchProviderData(cnpj: string) {
    let brasilApiError: { status: number | null; body: unknown } | null = null;
    let plugNotasError: { status: number | null; body: unknown } | null = null;

    try {
      const data = await this.brasilApiCnpjApi.consultarCnpj(cnpj);
      return { data, source: 'brasilapi' as const };
    } catch (e: any) {
      brasilApiError = {
        status: typeof e?.status === 'number' ? e.status : null,
        body: e?.body ?? e?.message ?? null,
      };
    }

    try {
      const data = await this.plugNotasCnpjApi.consultarCnpj(cnpj);
      return { data, source: 'plugnotas' as const };
    } catch (e: any) {
      plugNotasError = {
        status: typeof e?.status === 'number' ? e.status : null,
        body: e?.body ?? e?.message ?? null,
      };
    }

    throw new BadRequestException({
      code: 'CNPJ_LOOKUP_FAILED',
      message: 'Falha ao consultar CNPJ nos provedores disponíveis',
      details: {
        cnpj,
        brasilapi: brasilApiError,
        plugnotas: plugNotasError,
      },
    });
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
    const atividadePrincipal = Array.isArray(safeProviderData?.atividade_principal)
      ? safeProviderData.atividade_principal[0]
      : undefined;

    return {
      cnpj,
      razaoSocial: pick(safeProviderData, [
        'nome_razao_social',
        'razao_social',
        'razaoSocial',
        'nomeRazaoSocial',
      ]),
      nomeFantasia: pick(safeProviderData, ['nome_fantasia', 'nomeFantasia', 'fantasia']),
      inscricaoMunicipal: pick(safeProviderData, [
        'inscricao_municipal',
        'inscricaoMunicipal',
        'im',
      ]),
      situacaoCadastral: pick(safeProviderData, [
        'situacao_cadastral',
        'situacaoCadastral',
        'descricao_situacao_cadastral',
      ]),
      dataSituacaoCadastral: this.toDateOrUndefined(
        pick(safeProviderData, ['data_situacao_cadastral', 'dataSituacaoCadastral']),
      ),
      dataInicioAtividade: this.toDateOrUndefined(
        pick(safeProviderData, ['data_inicio_atividade', 'dataInicioAtividade']),
      ),
      cnaeFiscal: this.toStringOrUndefined(pick(safeProviderData, ['cnae_fiscal', 'cnaeFiscal'])),
      cnaeFiscalDescricao:
        pick(safeProviderData, ['cnae_fiscal_descricao', 'cnaeFiscalDescricao']) ??
        (atividadePrincipal?.descricao as string | undefined),
      porte: pick(safeProviderData, ['porte', 'descricao_porte', 'porte_empresa']),
      naturezaJuridica: pick(safeProviderData, ['natureza_juridica', 'naturezaJuridica']),
      capitalSocial: this.toNumberOrUndefined(
        pick(safeProviderData, ['capital_social', 'capitalSocial']),
      ),
      opcaoPeloSimples: this.toBooleanOrUndefined(
        pick(safeProviderData, ['opcao_pelo_simples', 'opcaoPeloSimples']),
      ),
      dataOpcaoPeloSimples: this.toDateOrUndefined(
        pick(safeProviderData, ['data_opcao_pelo_simples', 'dataOpcaoPeloSimples']),
      ),
      dataExclusaoDoSimples: this.toDateOrUndefined(
        pick(safeProviderData, ['data_exclusao_do_simples', 'dataExclusaoDoSimples']),
      ),
      opcaoPeloMei: this.toBooleanOrUndefined(
        pick(safeProviderData, ['opcao_pelo_mei', 'opcaoPeloMei']),
      ),
      email: pick(safeProviderData, ['email', 'email_contato', 'emailContato']),
      fone: pick(safeProviderData, [
        'fone',
        'telefone',
        'telefone1',
        'telefone_principal',
        'ddd_telefone_1',
      ]),
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
    const atividadePrincipal = Array.isArray(data?.atividade_principal)
      ? data.atividade_principal[0]
      : undefined;

    return {
      cnpj: data?.cnpj,
      razao_social: data?.razao_social ?? data?.nome_razao_social,
      nome_fantasia: data?.nome_fantasia,
      data_inicio_atividade: data?.data_inicio_atividade,
      matriz: data?.matriz,
      natureza_juridica: data?.natureza_juridica,
      capital_social: data?.capital_social,
      porte: data?.porte,
      descricao_porte: data?.descricao_porte,
      situacao_cadastral: data?.situacao_cadastral,
      data_situacao_cadastral: data?.data_situacao_cadastral,
      atividade_principal: data?.atividade_principal,
      cnae_fiscal_descricao: data?.cnae_fiscal_descricao ?? atividadePrincipal?.descricao,
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

  private pickEmpresaOverrides(
    payload?: Partial<CreateEmpresaDto & UpdateEmpresaDto>,
  ): Partial<Empresa> {
    if (!payload) return {};
    const endereco = payload.endereco
      ? this.compactObject({
          logradouro: payload.endereco.logradouro,
          numero: payload.endereco.numero,
          complemento: payload.endereco.complemento,
          bairro: payload.endereco.bairro,
          codigoMunicipio: payload.endereco.codigoMunicipio,
          cidade: payload.endereco.cidade,
          uf: payload.endereco.uf,
          codigoPais: payload.endereco.codigoPais,
          pais: payload.endereco.pais,
          cep: payload.endereco.cep,
        })
      : undefined;

    return this.compactObject({
      razaoSocial: payload.razaoSocial,
      nomeFantasia: payload.nomeFantasia,
      inscricaoMunicipal: payload.inscricaoMunicipal,
      situacaoCadastral: payload.situacaoCadastral,
      dataSituacaoCadastral: this.toDateOrUndefined(payload.dataSituacaoCadastral),
      dataInicioAtividade: this.toDateOrUndefined(payload.dataInicioAtividade),
      cnaeFiscal: this.toStringOrUndefined(payload.cnaeFiscal),
      cnaeFiscalDescricao: payload.cnaeFiscalDescricao,
      porte: payload.porte,
      naturezaJuridica: payload.naturezaJuridica,
      capitalSocial: this.toNumberOrUndefined(payload.capitalSocial),
      opcaoPeloSimples: this.toBooleanOrUndefined(payload.opcaoPeloSimples),
      dataOpcaoPeloSimples: this.toDateOrUndefined(payload.dataOpcaoPeloSimples),
      dataExclusaoDoSimples: this.toDateOrUndefined(payload.dataExclusaoDoSimples),
      opcaoPeloMei: this.toBooleanOrUndefined(payload.opcaoPeloMei),
      email: payload.email,
      fone: payload.fone,
      endereco: Object.keys(endereco ?? {}).length > 0 ? endereco : undefined,
    });
  }

  private toDateOrUndefined(value: unknown): Date | undefined {
    if (!value) return undefined;
    const normalized = this.normalizeDateString(String(value));
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private normalizeDateString(value: string): string {
    const trimmed = value.trim();
    const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
    if (brDate) {
      return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
    }
    return trimmed;
  }

  private toStringOrUndefined(value: unknown): string | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    return String(value);
  }

  private toNumberOrUndefined(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private toBooleanOrUndefined(value: unknown): boolean | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }

  private normalizeLimit(value?: number, hasSearch = false): number | undefined {
    if (value === undefined || value === null) {
      return hasSearch ? 50 : undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return hasSearch ? 50 : undefined;
    return Math.min(parsed, 100);
  }

  private normalizeEmpresaOutput(raw: Record<string, unknown>): Record<string, unknown> {
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        const value = raw[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };

    const enderecoRaw = (raw.endereco as Record<string, unknown> | undefined) ?? {};
    const endereco = this.compactObject({
      logradouro: enderecoRaw.logradouro,
      numero: enderecoRaw.numero,
      complemento: enderecoRaw.complemento,
      bairro: enderecoRaw.bairro,
      codigoMunicipio: enderecoRaw.codigoMunicipio ?? enderecoRaw.codigo_municipio,
      cidade: enderecoRaw.cidade ?? enderecoRaw.municipio,
      uf: enderecoRaw.uf ?? enderecoRaw.estado,
      codigoPais: enderecoRaw.codigoPais ?? enderecoRaw.codigo_pais,
      pais: enderecoRaw.pais,
      cep: enderecoRaw.cep,
    });

    const id = String(raw._id ?? raw.id ?? '');
    return this.compactObject({
      ...raw,
      id,
      _id: id || undefined,
      cnpj: pick('cnpj', 'cpf_cnpj'),
      razaoSocial: pick('razaoSocial', 'nome_razao_social'),
      nomeFantasia: pick('nomeFantasia', 'nome_fantasia'),
      inscricaoMunicipal: pick('inscricaoMunicipal', 'inscricao_municipal'),
      endereco: Object.keys(endereco).length > 0 ? endereco : undefined,
    });
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private compactObject<T extends Record<string, unknown>>(input: T): Partial<T> {
    const out: Partial<T> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null || value === '') continue;
      out[key as keyof T] = value as T[keyof T];
    }
    return out;
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
