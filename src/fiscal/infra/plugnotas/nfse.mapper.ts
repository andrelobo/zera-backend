import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status'

function normalizeStatus(value?: string): string {
  return (value ?? '').toLowerCase()
}

export function mapPlugNotasStatusToDomain(status?: string): NfseEmissionStatus {
  const s = normalizeStatus(status)

  if (s.includes('conclu')) return NfseEmissionStatus.AUTHORIZED
  if (s.includes('autoriz')) return NfseEmissionStatus.AUTHORIZED
  if (s.includes('rejeit') || s.includes('negad')) return NfseEmissionStatus.REJECTED
  if (s.includes('cancel')) return NfseEmissionStatus.CANCELED
  if (s.includes('erro') || s.includes('falh')) return NfseEmissionStatus.ERROR

  return NfseEmissionStatus.PENDING
}

export function extractPlugNotasStatus(response: Record<string, any>): string | undefined {
  return (
    response?.retorno?.situacao ??
    response?.retorno?.status ??
    response?.status ??
    response?.situacao ??
    response?.statusNota ??
    response?.statusNfse ??
    response?.situacaoNota ??
    response?.situacaoRps
  )
}
