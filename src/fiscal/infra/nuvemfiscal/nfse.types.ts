export type NuvemFiscalAmbiente = 'homologacao' | 'producao'

export type NfseDpsRequest = {
  ambiente: NuvemFiscalAmbiente
  referencia?: string
  prestador: unknown
  tomador?: unknown
  servico: unknown
  valores?: unknown
  intermediario?: unknown
  obra?: unknown
  informacoes_complementares?: string
}

export type NfseResponse = {
  id: string
  ambiente?: NuvemFiscalAmbiente
  referencia?: string
  status?: string
  created_at?: string
  updated_at?: string
  dados?: unknown
}

export type NfseConsultaResponse = NfseResponse
