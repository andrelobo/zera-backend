import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';

function normalizeStatus(value?: string): string {
  return (value ?? '').toLowerCase();
}

export function mapPlugNotasStatusToDomain(status?: string): NfseEmissionStatus {
  const s = normalizeStatus(status);

  if (s.includes('conclu')) return NfseEmissionStatus.AUTHORIZED;
  if (s.includes('autoriz')) return NfseEmissionStatus.AUTHORIZED;
  if (s.includes('rejeit') || s.includes('negad')) return NfseEmissionStatus.REJECTED;
  if (s.includes('cancel')) return NfseEmissionStatus.CANCELED;
  if (s.includes('erro') || s.includes('falh')) return NfseEmissionStatus.ERROR;

  return NfseEmissionStatus.PENDING;
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
  );
}

function first(value: unknown): Record<string, any> | undefined {
  if (Array.isArray(value)) {
    const item = value[0];
    return item && typeof item === 'object' ? (item as Record<string, any>) : undefined;
  }
  return value && typeof value === 'object' ? (value as Record<string, any>) : undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

export function extractPlugNotasDocumentIdentifiers(response: unknown): {
  numeroNfse?: string;
  dpsNum?: string;
  serieDpsNum?: string;
} {
  const root = first(response);
  const retorno = first(root?.retorno);
  const data = first(root?.data);
  const dps = first(root?.dps);
  const documento = first(root?.documento);
  const firstDocument = first(root?.documents);
  const nota = first(root?.nota);
  const rps = first(root?.rps);

  return {
    numeroNfse: toStringOrUndefined(
      retorno?.numeroNfse ??
      data?.numeroNfse ??
      documento?.numeroNfse ??
      nota?.numeroNfse ??
      root?.numeroNfse,
    ),
    dpsNum: toStringOrUndefined(
      dps?.numero ??
      retorno?.numeroDps ??
      retorno?.dpsNum ??
      data?.numeroDps ??
      data?.dpsNum ??
      documento?.numeroDps ??
      documento?.dpsNum ??
      firstDocument?.numeroDps ??
      firstDocument?.dpsNum ??
      nota?.numeroDps ??
      nota?.dpsNum ??
      rps?.numero ??
      rps?.numeroRps ??
      root?.numeroDps ??
      root?.dpsNum,
    ),
    serieDpsNum: toStringOrUndefined(
      dps?.serie ??
      retorno?.serieDps ??
      retorno?.serieDPS ??
      retorno?.serie_dps ??
      data?.serieDps ??
      data?.serieDPS ??
      data?.serie_dps ??
      documento?.serieDps ??
      documento?.serieDPS ??
      documento?.serie_dps ??
      firstDocument?.serieDps ??
      firstDocument?.serieDPS ??
      firstDocument?.serie_dps ??
      nota?.serieDps ??
      nota?.serieDPS ??
      nota?.serie_dps ??
      rps?.serie ??
      rps?.serieRps ??
      root?.serieDps ??
      root?.serieDPS ??
      root?.serie_dps,
    ),
  };
}
