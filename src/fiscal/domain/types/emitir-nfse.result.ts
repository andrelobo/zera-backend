import { NfseEmissionStatus } from './nfse-emission-status'

export type EmitirNfseResult = {
  status: NfseEmissionStatus
  provider: string
  externalId?: string
  providerResponse?: Record<string, any>
}
