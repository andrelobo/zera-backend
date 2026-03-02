import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createCipheriv, createHash, randomBytes } from 'crypto';
import type { File as MulterFile } from 'multer';
import { Model } from 'mongoose';
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api';
import { BrasilApiCnpjApi } from './brasilapi-cnpj.api';
import { CnpjaCnpjApi } from './cnpja-cnpj.api';
import { ReceitaWsCnpjApi } from './receitaws-cnpj.api';
import { CreateEmpresaDto } from './dtos/create-empresa.dto';
import { UpdateEmpresaDto } from './dtos/update-empresa.dto';
import { Empresa, EmpresaDocument } from './schemas/empresa.schema';

type CadastroStatus = 'PENDENTE' | 'COMPLETO';

export interface EmpresaCadastroResumo {
  statusCadastro: CadastroStatus;
  prontoParaEmitir: boolean;
  percentualCompletude: number;
  camposFaltantes: string[];
  camposFaltantesEmissao: string[];
}

@Injectable()
export class EmpresasService {
  constructor(
    @InjectModel(Empresa.name) private readonly empresaModel: Model<EmpresaDocument>,
    private readonly cnpjaCnpjApi: CnpjaCnpjApi,
    private readonly brasilApiCnpjApi: BrasilApiCnpjApi,
    private readonly receitaWsCnpjApi: ReceitaWsCnpjApi,
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
        const doc = await this.empresaModel.findById(existingWithCert._id);
        return this.toNormalizedFromDoc(doc);
      }
      const doc = await this.empresaModel.findByIdAndUpdate(existingWithCert._id, overrides, {
        new: true,
      });
      return this.toNormalizedFromDoc(doc);
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
      const doc = await this.empresaModel.findByIdAndUpdate(existingWithCert._id, updateData, {
        new: true,
      });
      return this.toNormalizedFromDoc(doc);
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

  async listMunicipiosByUf(ufRaw: string) {
    const uf = String(ufRaw ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) {
      throw new BadRequestException({
        code: 'UF_INVALID',
        message: 'UF deve conter 2 letras',
      });
    }

    const data = await this.fetchJson<unknown[]>(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
      'MUNICIPIOS_LOOKUP_FAILED',
      'Falha ao consultar municípios por UF',
    );

    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        const row = item as Record<string, unknown>;
        const id = Number(row.id);
        const nome = typeof row.nome === 'string' ? row.nome : '';
        if (!Number.isFinite(id) || !nome.trim()) return null;
        return { id, nome, uf };
      })
      .filter((row): row is { id: number; nome: string; uf: string } => Boolean(row))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async lookupCep(cepRaw: string) {
    const cep = this.onlyDigits(String(cepRaw ?? ''));
    if (cep.length !== 8) {
      throw new BadRequestException({
        code: 'CEP_INVALID',
        message: 'CEP deve conter 8 dígitos',
      });
    }

    const data = await this.fetchJson<Record<string, unknown>>(
      `https://viacep.com.br/ws/${cep}/json/`,
      'CEP_LOOKUP_FAILED',
      'Falha ao consultar CEP',
    );

    if (data?.erro === true) {
      throw new BadRequestException({
        code: 'CEP_NOT_FOUND',
        message: 'CEP não encontrado',
      });
    }

    return {
      cep: this.onlyDigits(String(data?.cep ?? cep)),
      logradouro: String(data?.logradouro ?? ''),
      bairro: String(data?.bairro ?? ''),
      cidade: String(data?.localidade ?? ''),
      uf: String(data?.uf ?? '').toUpperCase(),
      complemento: String(data?.complemento ?? ''),
    };
  }

  getById(id: string) {
    return this.empresaModel.findById(id);
  }

  async getByIdNormalized(id: string) {
    const doc = await this.getById(id);
    return this.toNormalizedFromDoc(doc);
  }

  async getByCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj);
    return this.empresaModel.findOne({
      $or: [{ cnpj: normalized }, { cpf_cnpj: normalized }],
    } as any);
  }

  async getByCnpjNormalized(cnpj: string) {
    const doc = await this.getByCnpj(cnpj);
    return this.toNormalizedFromDoc(doc);
  }

  async findFirstWithCertificate() {
    return this.empresaModel
      .findOne({ 'certificado.uploadedAt': { $exists: true } })
      .sort({ updatedAt: -1, createdAt: -1 });
  }

  async update(id: string, data: Partial<UpdateEmpresaDto>) {
    const patch = this.pickEmpresaOverrides(data);
    const doc = await this.empresaModel.findByIdAndUpdate(id, patch, { new: true });
    return this.toNormalizedFromDoc(doc);
  }

  async remove(id: string) {
    const doc = await this.empresaModel.findByIdAndDelete(id);
    return { deleted: Boolean(doc) };
  }

  private async fetchProviderData(cnpj: string) {
    let cnpjaError: { status: number | null; body: unknown } | null = null;
    let brasilApiError: { status: number | null; body: unknown } | null = null;
    let receitaWsError: { status: number | null; body: unknown } | null = null;
    let plugNotasError: { status: number | null; body: unknown } | null = null;
    let cnpjaData: Record<string, unknown> | null = null;
    let brasilApiData: Record<string, unknown> | null = null;
    let receitaWsData: Record<string, unknown> | null = null;

    try {
      cnpjaData = await this.cnpjaCnpjApi.consultarCnpj(cnpj);
    } catch (e: any) {
      cnpjaError = {
        status: typeof e?.status === 'number' ? e.status : null,
        body: e?.body ?? e?.message ?? null,
      };
    }

    if (cnpjaData) {
      return { data: cnpjaData, source: 'cnpja' as const };
    }

    try {
      brasilApiData = await this.brasilApiCnpjApi.consultarCnpj(cnpj);
    } catch (e: any) {
      brasilApiError = {
        status: typeof e?.status === 'number' ? e.status : null,
        body: e?.body ?? e?.message ?? null,
      };
    }

    try {
      receitaWsData = await this.receitaWsCnpjApi.consultarCnpj(cnpj);
    } catch (e: any) {
      receitaWsError = {
        status: typeof e?.status === 'number' ? e.status : null,
        body: e?.body ?? e?.message ?? null,
      };
    }

    if (brasilApiData && receitaWsData) {
      return {
        data: this.mergeProviderData(brasilApiData, receitaWsData),
        source: 'brasilapi+receitaws' as const,
      };
    }
    if (brasilApiData) {
      return { data: brasilApiData, source: 'brasilapi' as const };
    }
    if (receitaWsData) {
      return { data: receitaWsData, source: 'receitaws' as const };
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
      message: 'Falha ao consultar CNPJ em CNPJA e provedores de fallback',
      details: {
        cnpj,
        cnpja: cnpjaError,
        brasilapi: brasilApiError,
        receitaws: receitaWsError,
        plugnotas: plugNotasError,
      },
    });
  }

  private mapProviderData(cnpj: string, data: Record<string, any>): Partial<Empresa> {
    const safeProviderData = this.sanitizeProviderData(data);
    const trimmedProviderData = this.trimProviderData(safeProviderData);
    const cnpjaRegistrations = this.extractRegistrationNumbers(safeProviderData);
    const cnpjaSuframaNumber = this.extractFirstSuframaNumber(safeProviderData);

    const getByPath = (obj: any, path: string) =>
      path.split('.').reduce((acc: any, key) => (acc == null ? undefined : acc[key]), obj);

    const pick = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = getByPath(obj, key);
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
      safeProviderData?.address ??
      safeProviderData?.endereco_empresa ??
      safeProviderData?.estabelecimento?.endereco ??
      safeProviderData?.estabelecimento ??
      safeProviderData?.localizacao ??
      safeProviderData;

    const cidadeRaw = pick(enderecoSrc, ['cidade', 'city', 'municipio', 'nome_municipio']);
    const paisRaw = pick(enderecoSrc, ['pais', 'country', 'nome_pais']);
    const atividadePrincipal = Array.isArray(safeProviderData?.atividade_principal)
      ? safeProviderData.atividade_principal[0]
      : undefined;
    const atividadePrincipalCodigo =
      atividadePrincipal && typeof atividadePrincipal === 'object'
        ? (atividadePrincipal.code ?? atividadePrincipal.codigo)
        : undefined;

    return {
      cnpj,
      razaoSocial: pick(safeProviderData, [
        'company.name',
        'nome',
        'nome_razao_social',
        'razao_social',
        'razaoSocial',
        'nomeRazaoSocial',
      ]),
      nomeFantasia: pick(safeProviderData, ['alias', 'nome_fantasia', 'nomeFantasia', 'fantasia']),
      inscricaoMunicipal:
        pick(safeProviderData, [
          'inscricao_municipal',
          'inscricaoMunicipal',
          'municipalRegistration',
          'municipal_registration',
          'im',
        ]) ?? cnpjaRegistrations.municipal,
      inscricaoEstadual:
        this.toScalarStringOrUndefined(
          pick(safeProviderData, ['inscricao_estadual', 'inscricaoEstadual', 'ie']),
        ) ?? cnpjaRegistrations.estadual,
      suframa:
        this.toScalarStringOrUndefined(pick(safeProviderData, ['suframa'])) ?? cnpjaSuframaNumber,
      situacaoCadastral: pick(safeProviderData, [
        'situacao_cadastral',
        'situacaoCadastral',
        'situacao',
        'descricao_situacao_cadastral',
      ]),
      dataSituacaoCadastral: this.toDateOrUndefined(
        pick(safeProviderData, [
          'data_situacao_cadastral',
          'dataSituacaoCadastral',
          'data_situacao',
        ]),
      ),
      dataInicioAtividade: this.toDateOrUndefined(
        pick(safeProviderData, [
          'founded',
          'data_inicio_atividade',
          'dataInicioAtividade',
          'abertura',
        ]),
      ),
      cnaeFiscal: this.toStringOrUndefined(
        pick(safeProviderData, ['cnae_fiscal', 'cnaeFiscal']) ?? atividadePrincipalCodigo,
      ),
      cnaeFiscalDescricao:
        pick(safeProviderData, ['cnae_fiscal_descricao', 'cnaeFiscalDescricao']) ??
        (atividadePrincipal?.descricao as string | undefined),
      porte: pick(safeProviderData, ['porte', 'descricao_porte', 'porte_empresa']),
      naturezaJuridica: pick(safeProviderData, ['natureza_juridica', 'naturezaJuridica']),
      capitalSocial: this.toNumberOrUndefined(
        pick(safeProviderData, ['company.equity', 'capital_social', 'capitalSocial']),
      ),
      opcaoPeloSimples: this.toBooleanOrUndefined(
        pick(safeProviderData, [
          'company.simples.optant',
          'opcao_pelo_simples',
          'opcaoPeloSimples',
          'simples.optante',
          'simples.simples',
        ]),
      ),
      dataOpcaoPeloSimples: this.toDateOrUndefined(
        pick(safeProviderData, [
          'company.simples.since',
          'data_opcao_pelo_simples',
          'dataOpcaoPeloSimples',
          'simples.data_opcao',
        ]),
      ),
      dataExclusaoDoSimples: this.toDateOrUndefined(
        pick(safeProviderData, [
          'data_exclusao_do_simples',
          'dataExclusaoDoSimples',
          'simples.data_exclusao',
        ]),
      ),
      opcaoPeloMei: this.toBooleanOrUndefined(
        pick(safeProviderData, [
          'company.simei.optant',
          'opcao_pelo_mei',
          'opcaoPeloMei',
          'simei.optante',
          'simples.mei',
        ]),
      ),
      email: pick(safeProviderData, ['email', 'email_contato', 'emailContato']),
      fone: pick(safeProviderData, [
        'fone',
        'telefone',
        'telefone1',
        'telefone_principal',
        'ddd_telefone_1',
      ]),
      whatsapp: pick(safeProviderData, ['whatsapp', 'telefone', 'fone', 'ddd_telefone_1']),
      endereco: {
        logradouro: pick(enderecoSrc, [
          'logradouro',
          'street',
          'logradouro_endereco',
          'logradouroEndereco',
        ]),
        numero: pick(enderecoSrc, ['numero', 'number', 'numero_endereco', 'numeroEndereco']),
        complemento: pick(enderecoSrc, ['complemento', 'details']),
        bairro: pick(enderecoSrc, ['bairro', 'district']),
        codigoMunicipio: pick(enderecoSrc, [
          'municipality',
          'codigo_municipio',
          'codigoMunicipio',
          'municipio_codigo',
          'codigo_ibge',
        ]),
        cidade: normalizeString(cidadeRaw),
        uf: pick(enderecoSrc, ['uf', 'state', 'estado', 'sigla_uf', 'siglaEstado']),
        codigoPais: pick(enderecoSrc, ['codigo_pais', 'codigoPais', 'pais_codigo']),
        pais: normalizeString(paisRaw),
        cep: pick(enderecoSrc, ['cep', 'zip']),
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
    const registrations = Array.isArray(data?.registrations)
      ? data.registrations.slice(0, 3)
      : undefined;
    const suframaRaw = Array.isArray(data?.suframa) ? data.suframa.slice(0, 3) : data?.suframa;

    return {
      cnpj: data?.cnpj ?? data?.taxId,
      taxId: data?.taxId,
      alias: data?.alias,
      founded: data?.founded,
      updated: data?.updated,
      company: data?.company
        ? {
            id: data.company?.id,
            name: data.company?.name,
            equity: data.company?.equity,
            simples: data.company?.simples,
            simei: data.company?.simei,
          }
        : undefined,
      razao_social: data?.razao_social ?? data?.nome_razao_social,
      nome_fantasia: data?.nome_fantasia,
      situacao: data?.situacao,
      data_situacao: data?.data_situacao,
      abertura: data?.abertura,
      inscricao_estadual:
        data?.inscricao_estadual ?? data?.ie ?? this.extractRegistrationNumbers(data).estadual,
      inscricao_municipal:
        data?.inscricao_municipal ??
        data?.inscricaoMunicipal ??
        data?.im ??
        this.extractRegistrationNumbers(data).municipal,
      registrations,
      suframa: data?.suframa ?? this.extractFirstSuframaNumber(data),
      suframa_entries: suframaRaw,
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
      whatsapp: data?.whatsapp,
      simples: data?.simples,
      simei: data?.simei,
      opcao_pelo_simples: data?.opcao_pelo_simples ?? data?.simples?.optante,
      opcao_pelo_mei: data?.opcao_pelo_mei ?? data?.simei?.optante ?? data?.simples?.mei,
      data_opcao_pelo_simples: data?.data_opcao_pelo_simples ?? data?.simples?.data_opcao,
      data_exclusao_do_simples: data?.data_exclusao_do_simples ?? data?.simples?.data_exclusao,
    };
  }

  private extractRegistrationNumbers(data: Record<string, any>): {
    estadual?: string;
    municipal?: string;
  } {
    const registrations = data?.registrations;
    if (!Array.isArray(registrations)) return {};

    let firstAny: string | undefined;
    let estadual: string | undefined;
    let municipal: string | undefined;

    for (const entry of registrations) {
      const number = this.toScalarStringOrUndefined(
        entry?.number ?? entry?.registration ?? entry?.value,
      );
      if (!number) continue;
      if (!firstAny) firstAny = number;

      const typeText = String(
        entry?.type?.text ?? entry?.type?.name ?? entry?.kind ?? entry?.registrationType ?? '',
      ).toLowerCase();

      if (!municipal && (typeText.includes('municip') || typeText.includes('im'))) {
        municipal = number;
      }
      if (
        !estadual &&
        (typeText.includes('estad') ||
          typeText.includes('state') ||
          typeText.includes('ie') ||
          typeText.includes('sintegra') ||
          typeText.includes('ccc'))
      ) {
        estadual = number;
      }
    }

    return {
      estadual: estadual ?? firstAny,
      municipal,
    };
  }

  private extractFirstSuframaNumber(data: Record<string, any>): string | undefined {
    const value = data?.suframa;
    const scalar = this.toScalarStringOrUndefined(value);
    if (scalar) return scalar;
    if (!Array.isArray(value)) return undefined;
    for (const entry of value) {
      const number = this.toScalarStringOrUndefined(
        entry?.number ?? entry?.registration ?? entry?.value,
      );
      if (number) return number;
    }
    return undefined;
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
      inscricaoEstadual: payload.inscricaoEstadual,
      suframa: payload.suframa,
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
      whatsapp: payload.whatsapp,
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

  private toScalarStringOrUndefined(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
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
    const cadastroResumo = this.buildCadastroResumo(raw);
    return this.compactObject({
      ...raw,
      id,
      _id: id || undefined,
      cnpj: pick('cnpj', 'cpf_cnpj'),
      razaoSocial: pick('razaoSocial', 'nome_razao_social'),
      nomeFantasia: pick('nomeFantasia', 'nome_fantasia'),
      inscricaoMunicipal: pick('inscricaoMunicipal', 'inscricao_municipal'),
      inscricaoEstadual: pick('inscricaoEstadual', 'inscricao_estadual', 'ie'),
      suframa: pick('suframa'),
      whatsapp: pick('whatsapp', 'fone', 'telefone'),
      endereco: Object.keys(endereco).length > 0 ? endereco : undefined,
      statusCadastro: cadastroResumo.statusCadastro,
      prontoParaEmitir: cadastroResumo.prontoParaEmitir,
      percentualCompletude: cadastroResumo.percentualCompletude,
      camposFaltantes: cadastroResumo.camposFaltantes,
      camposFaltantesEmissao: cadastroResumo.camposFaltantesEmissao,
    });
  }

  async getCadastroResumoByCnpj(cnpj: string): Promise<EmpresaCadastroResumo | null> {
    const doc = await this.getByCnpj(cnpj);
    if (!doc) return null;
    return this.buildCadastroResumo(doc.toObject() as unknown as Record<string, unknown>);
  }

  private mergeProviderData(
    primary: Record<string, unknown>,
    secondary: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...secondary, ...primary };
    for (const [key, primaryValue] of Object.entries(primary)) {
      const secondaryValue = secondary[key];
      if (this.isPlainObject(primaryValue) && this.isPlainObject(secondaryValue)) {
        out[key] = this.mergeProviderData(
          primaryValue as Record<string, unknown>,
          secondaryValue as Record<string, unknown>,
        );
      }
    }
    return out;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  private toNormalizedFromDoc(doc: EmpresaDocument | null): Record<string, unknown> | null {
    if (!doc) return null;
    return this.normalizeEmpresaOutput(doc.toObject() as unknown as Record<string, unknown>);
  }

  private buildCadastroResumo(raw: Record<string, unknown>): EmpresaCadastroResumo {
    const enderecoRaw = ((raw.endereco as Record<string, unknown> | undefined) ??
      (raw.endereco_empresa as Record<string, unknown> | undefined) ??
      ((raw.estabelecimento as Record<string, unknown> | undefined)?.endereco as
        | Record<string, unknown>
        | undefined) ??
      (raw.localizacao as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;
    const regimeTributario = raw.regimeTributario ?? raw.regime_tributario;
    const opcaoPeloSimples = raw.opcaoPeloSimples ?? raw.opcao_pelo_simples;
    const aliquotaSN = raw.aliquotaSimplesNacional ?? raw.aliquota_simples_nacional;
    const apuracaoSN = raw.apuracaoSimplesNacional ?? raw.apuracao_simples_nacional;
    const certificadoRaw = ((raw.certificado as Record<string, unknown> | undefined) ??
      (raw.certificado_digital as Record<string, unknown> | undefined) ??
      (raw.certificadoDigital as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;
    const logradouro = enderecoRaw.logradouro ?? raw.endereco ?? raw.logradouro;
    const numero = enderecoRaw.numero ?? raw.numero;
    const bairro = enderecoRaw.bairro ?? raw.bairro;
    const cidade =
      enderecoRaw.cidade ??
      enderecoRaw.municipio ??
      enderecoRaw.localidade ??
      raw.cidade ??
      raw.municipio ??
      raw.localidade;
    const uf = enderecoRaw.uf ?? enderecoRaw.estado ?? raw.uf ?? raw.estado;
    const cep = enderecoRaw.cep ?? raw.cep;
    const hasCertificado =
      this.hasValue(certificadoRaw.uploadedAt) ||
      this.hasValue(certificadoRaw.filename) ||
      this.hasValue(certificadoRaw.sha256);

    const requiredForCadastro: Array<{ field: string; ok: boolean }> = [
      { field: 'razaoSocial', ok: this.hasValue(raw.razaoSocial ?? raw.nome_razao_social) },
      {
        field: 'inscricaoMunicipal',
        ok: this.hasValue(raw.inscricaoMunicipal ?? raw.inscricao_municipal),
      },
      { field: 'cnaeFiscal', ok: this.hasValue(raw.cnaeFiscal ?? raw.cnae_fiscal) },
      {
        field: 'cnaeFiscalDescricao',
        ok: this.hasValue(raw.cnaeFiscalDescricao ?? raw.cnae_fiscal_descricao),
      },
      {
        field: 'regimeTributario',
        ok: this.hasValue(regimeTributario) || this.hasValue(opcaoPeloSimples),
      },
      { field: 'apuracaoSimplesNacional', ok: this.hasValue(apuracaoSN) },
      { field: 'aliquotaSimplesNacional', ok: this.hasValue(aliquotaSN) },
      { field: 'endereco.logradouro', ok: this.hasValue(logradouro) },
      { field: 'endereco.numero', ok: this.hasValue(numero) },
      { field: 'endereco.bairro', ok: this.hasValue(bairro) },
      { field: 'endereco.cidade', ok: this.hasValue(cidade) },
      { field: 'endereco.uf', ok: this.hasValue(uf) },
      { field: 'endereco.cep', ok: this.hasValue(cep) },
      { field: 'certificado.uploadedAt', ok: hasCertificado },
    ];

    const requiredForEmissao: Array<{ field: string; ok: boolean }> = [
      { field: 'razaoSocial', ok: this.hasValue(raw.razaoSocial ?? raw.nome_razao_social) },
      {
        field: 'inscricaoMunicipal',
        ok: this.hasValue(raw.inscricaoMunicipal ?? raw.inscricao_municipal),
      },
      { field: 'endereco.logradouro', ok: this.hasValue(logradouro) },
      { field: 'endereco.numero', ok: this.hasValue(numero) },
      { field: 'endereco.bairro', ok: this.hasValue(bairro) },
      { field: 'endereco.cidade', ok: this.hasValue(cidade) },
      { field: 'endereco.uf', ok: this.hasValue(uf) },
      { field: 'endereco.cep', ok: this.hasValue(cep) },
      { field: 'certificado.uploadedAt', ok: hasCertificado },
    ];

    const camposFaltantes = requiredForCadastro
      .filter((item) => !item.ok)
      .map((item) => item.field);
    const camposFaltantesEmissao = requiredForEmissao
      .filter((item) => !item.ok)
      .map((item) => item.field);
    const preenchidos = requiredForCadastro.length - camposFaltantes.length;
    const percentualCompletude = Math.round((preenchidos / requiredForCadastro.length) * 100);
    const statusCadastro: CadastroStatus = camposFaltantes.length === 0 ? 'COMPLETO' : 'PENDENTE';
    const prontoParaEmitir = camposFaltantesEmissao.length === 0;

    return {
      statusCadastro,
      prontoParaEmitir,
      percentualCompletude,
      camposFaltantes,
      camposFaltantesEmissao,
    };
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'boolean') return true;
    if (value instanceof Date) return !Number.isNaN(value.getTime());
    return true;
  }

  private async fetchJson<T>(url: string, errorCode: string, message: string): Promise<T> {
    const timeoutMs = Number(process.env.EXTERNAL_LOOKUP_TIMEOUT_MS ?? 8000);
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadRequestException({
          code: errorCode,
          message,
          details: {
            status: response.status,
            statusText: response.statusText,
          },
        });
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      const e = error as { name?: string; message?: string };
      throw new BadRequestException({
        code: errorCode,
        message,
        details: {
          cause: e?.name ?? 'UnknownError',
          error: e?.message ?? null,
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
