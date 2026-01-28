import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api'
import { Empresa, EmpresaDocument } from './schemas/empresa.schema'

@Injectable()
export class EmpresasService {
  constructor(
    @InjectModel(Empresa.name) private readonly empresaModel: Model<EmpresaDocument>,
    private readonly cnpjApi: PlugNotasCnpjApi,
  ) {}

  async createFromCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj)
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido')
    }

    const existing = await this.empresaModel.findOne({ cnpj: normalized })
    if (existing) {
      return existing
    }

    const { data } = await this.fetchProviderData(normalized)
    const mapped = this.mapProviderData(normalized, data)

    try {
      return await this.empresaModel.create(mapped)
    } catch (e: any) {
      throw new BadRequestException({
        message: 'Não foi possível cadastrar a empresa',
        error: e?.message ?? null,
      })
    }
  }

  async previewFromCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj)
    if (!normalized) {
      throw new BadRequestException('CNPJ inválido')
    }

    const { data } = await this.fetchProviderData(normalized)
    return this.mapProviderData(normalized, data)
  }

  list() {
    return this.empresaModel.find().sort({ createdAt: -1 })
  }

  getById(id: string) {
    return this.empresaModel.findById(id)
  }

  async getByCnpj(cnpj: string) {
    const normalized = this.onlyDigits(cnpj)
    return this.empresaModel.findOne({ cnpj: normalized })
  }

  async update(id: string, data: Partial<Empresa>) {
    return this.empresaModel.findByIdAndUpdate(id, data, { new: true })
  }

  async remove(id: string) {
    const doc = await this.empresaModel.findByIdAndDelete(id)
    return { deleted: Boolean(doc) }
  }

  private async fetchProviderData(cnpj: string) {
    try {
      const data = await this.cnpjApi.consultarCnpj(cnpj)
      return { data }
    } catch (e: any) {
      const providerStatus = e?.status
      const providerBody = e?.body
      throw new BadRequestException({
        message: 'Falha ao consultar CNPJ na PlugNotas',
        providerStatus: providerStatus ?? null,
        providerError: providerBody ?? null,
      })
    }
  }

  private mapProviderData(cnpj: string, data: Record<string, any>): Partial<Empresa> {
    const safeProviderData = this.sanitizeProviderData(data)
    const trimmedProviderData = this.trimProviderData(safeProviderData)

    const pick = (obj: any, keys: string[]) => {
      for (const key of keys) {
        const value = obj?.[key]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return undefined
    }

    const normalizeString = (value: any): string | undefined => {
      if (typeof value === 'string') return value
      if (value && typeof value === 'object') {
        return (
          value.descricao ??
          value.nome ??
          value.nome_municipio ??
          value.nomeMunicipio ??
          value.nome_pais ??
          value.nomePais
        )
      }
      return undefined
    }

    const enderecoSrc =
      safeProviderData?.endereco ??
      safeProviderData?.endereco_empresa ??
      safeProviderData?.estabelecimento?.endereco ??
      safeProviderData?.estabelecimento ??
      safeProviderData?.localizacao ??
      safeProviderData

    const cidadeRaw = pick(enderecoSrc, ['cidade', 'municipio', 'nome_municipio'])
    const paisRaw = pick(enderecoSrc, ['pais', 'nome_pais'])

    return {
      cnpj,
      razaoSocial: pick(safeProviderData, ['nome_razao_social', 'razao_social', 'razaoSocial', 'nomeRazaoSocial']),
      nomeFantasia: pick(safeProviderData, ['nome_fantasia', 'nomeFantasia']),
      inscricaoMunicipal: pick(safeProviderData, ['inscricao_municipal', 'inscricaoMunicipal', 'im']),
      email: pick(safeProviderData, ['email', 'email_contato', 'emailContato']),
      fone: pick(safeProviderData, ['fone', 'telefone', 'telefone1', 'telefone_principal']),
      endereco: {
        logradouro: pick(enderecoSrc, ['logradouro', 'logradouro_endereco', 'logradouroEndereco']),
        numero: pick(enderecoSrc, ['numero', 'numero_endereco', 'numeroEndereco']),
        complemento: pick(enderecoSrc, ['complemento']),
        bairro: pick(enderecoSrc, ['bairro']),
        codigoMunicipio: pick(enderecoSrc, ['codigo_municipio', 'codigoMunicipio', 'municipio_codigo', 'codigo_ibge']),
        cidade: normalizeString(cidadeRaw),
        uf: pick(enderecoSrc, ['uf', 'estado', 'sigla_uf', 'siglaEstado']),
        codigoPais: pick(enderecoSrc, ['codigo_pais', 'codigoPais', 'pais_codigo']),
        pais: normalizeString(paisRaw),
        cep: pick(enderecoSrc, ['cep']),
      },
      providerData: trimmedProviderData,
    }
  }

  private trimProviderData(data: Record<string, any>): Record<string, any> {
    const endereco = data?.endereco ?? data?.estabelecimento?.endereco ?? undefined
    const municipio = endereco?.municipio

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
    }
  }

  private sanitizeProviderData(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeProviderData(item))
    }

    if (value && typeof value === 'object') {
      const out: Record<string, any> = {}
      for (const [key, val] of Object.entries(value)) {
        if (key.startsWith('$') || key.includes('.')) continue
        out[key] = this.sanitizeProviderData(val)
      }
      return out
    }

    return value
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '')
  }
}
