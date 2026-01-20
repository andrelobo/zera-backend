import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status'

export function mapNuvemFiscalStatusToDomain(status?: string): NfseEmissionStatus {
  const s = (status ?? '').toLowerCase()

  if (s.includes('autoriz')) return NfseEmissionStatus.AUTHORIZED
  if (s.includes('rejeit') || s.includes('negad')) return NfseEmissionStatus.REJECTED
  if (s.includes('cancel')) return NfseEmissionStatus.CANCELED
  if (s.includes('erro') || s.includes('falh')) return NfseEmissionStatus.ERROR

  return NfseEmissionStatus.PENDING
}
