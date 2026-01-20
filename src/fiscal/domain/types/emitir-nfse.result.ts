import type { NfseEmissionStatus } from './nfse-emission-status'

export type FiscalProviderName = 'PLUGNOTAS' | 'NUVEMFISCAL'

export type EmitirNfseResult = {
  status: NfseEmissionStatus
  provider: FiscalProviderName
  externalId?: string | null
}
