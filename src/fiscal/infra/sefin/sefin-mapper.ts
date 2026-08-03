import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import {
  extractAllTags,
  extractElementId,
  extractIntTag,
  extractTag,
  hasElement,
} from './sefin-xml';

export const NFSE_CHAVE_PATTERN = /^NFS[0-9]{50}$/;
export const DPS_ID_PATTERN = /^DPS[0-9]{42}$/;
export const EVENTO_TAG_PATTERN = /^e\d{6}$/;
export const EVENTO_CANCELAMENTO_TAGS = ['e101101', 'e105102'];
export const EVENTO_CANCELAMENTO_TAG_REGEX = new RegExp(
  `\\b(?:${EVENTO_CANCELAMENTO_TAGS.join('|')}|evCancelamento)\\b`,
);

export type SefinNfseParsed = {
  status: NfseEmissionStatus;
  cStat?: string;
  xMotivo?: string;
  chaveAcesso?: string;
  dhProc?: string;
  nDFSe?: string;
  nNFSe?: string;
  xml?: string;
};

export type SefinEventoRegistrado = {
  tipoEvento?: string;
  cStat?: string;
  xMotivo?: string;
  nProt?: string;
  dhRecbto?: string;
  xml?: string;
};

export type SefinEventoConsulta = {
  status: NfseEmissionStatus;
  eventos: SefinEventoRegistrado[];
  cStat?: string;
  xMotivo?: string;
  xml?: string;
};

function looksLikeXml(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    (value.startsWith('<?xml') || value.includes('<NFSe') || value.includes('<DPS'))
  );
}

const CHAVE_KEYS = ['chaveAcesso', 'chave', 'chNFSe', 'idNFSe', 'chaveNfse', 'ChaveAcesso'];

const JSON_STATUS_KEYS = ['status', 'situacao', 'situacaoNfse', 'situacaoNota'];

const JSON_STATUS_TO_DOMAIN: Record<string, NfseEmissionStatus> = {
  AUTORIZADA: NfseEmissionStatus.AUTHORIZED,
  AUTORIZADO: NfseEmissionStatus.AUTHORIZED,
  AUTHORIZED: NfseEmissionStatus.AUTHORIZED,
  AUTORIZADA_EM_PROCESSAMENTO: NfseEmissionStatus.PENDING,
  EM_PROCESSAMENTO: NfseEmissionStatus.PENDING,
  PROCESSANDO: NfseEmissionStatus.PENDING,
  PENDING: NfseEmissionStatus.PENDING,
  REJEITADA: NfseEmissionStatus.REJECTED,
  REJEITADO: NfseEmissionStatus.REJECTED,
  REJECTED: NfseEmissionStatus.REJECTED,
  NEGADA: NfseEmissionStatus.REJECTED,
  CANCELADA: NfseEmissionStatus.CANCELED,
  CANCELADO: NfseEmissionStatus.CANCELED,
  CANCELED: NfseEmissionStatus.CANCELED,
};

function numericCStat(value: unknown): string | undefined {
  const s = typeof value === 'string' ? value : String(value);
  return /^\d{3}$/.test(s) ? s : undefined;
}

function findDeepStringKey(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && keys.includes(key)) {
      if (NFSE_CHAVE_PATTERN.test(value)) return value;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findDeepStringKey(value, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function findDeepStringValue(obj: any, keys: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && keys.includes(key)) {
      return value;
    }
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      const found = findDeepStringValue(value, keys);
      if (found) return found;
    }
  }
  return undefined;
}

function extractEmbeddedXml(json: any): string | undefined {
  if (!json || typeof json !== 'object') return undefined;
  const candidates: unknown[] = [];
  for (const value of Object.values(json)) {
    if (looksLikeXml(value)) return value as string;
    if (value && typeof value === 'object') candidates.push(value);
  }
  for (const nested of candidates) {
    const found = extractEmbeddedXml(nested);
    if (found) return found;
  }
  return undefined;
}

function parseXml(xml: string): SefinNfseParsed {
  const parsed: SefinNfseParsed = { status: NfseEmissionStatus.PENDING };
  if (EVENTO_CANCELAMENTO_TAG_REGEX.test(xml)) {
    parsed.status = NfseEmissionStatus.CANCELED;
  } else if (hasElement(xml, 'infNFSe')) {
    parsed.status = NfseEmissionStatus.AUTHORIZED;
  }
  parsed.cStat = extractIntTag(xml, 'cStat');
  parsed.xMotivo = extractTag(xml, 'xMotivo');
  parsed.chaveAcesso = extractElementId(xml, 'infNFSe', NFSE_CHAVE_PATTERN);
  parsed.dhProc = extractTag(xml, 'dhProc');
  parsed.nDFSe = extractIntTag(xml, 'nDFSe');
  parsed.nNFSe = extractIntTag(xml, 'nNFSe');
  return parsed;
}

function inferStatus(parsed: SefinNfseParsed): NfseEmissionStatus {
  if (parsed.status !== NfseEmissionStatus.PENDING) return parsed.status;

  const cStat = parsed.cStat;
  if (cStat) {
    if (/^[45]\d{2}$/.test(cStat)) return NfseEmissionStatus.REJECTED;
    if (/^[12]\d{2}$/.test(cStat)) return NfseEmissionStatus.PENDING;
  }

  if (parsed.xMotivo) return NfseEmissionStatus.REJECTED;
  return NfseEmissionStatus.PENDING;
}

export function mapSefinNfseResponse(input: { text: string; json?: any }): SefinNfseParsed {
  const embedded = extractEmbeddedXml(input.json);
  const xml = embedded ?? input.text;

  if (!xml?.trim()) {
    return { status: NfseEmissionStatus.PENDING };
  }

  const parsed = parseXml(xml);
  parsed.xml = xml;
  parsed.status = inferStatus(parsed);

  if (input.json && typeof input.json === 'object') {
    const statusLabel = findDeepStringValue(input.json, JSON_STATUS_KEYS);
    const mappedStatus = statusLabel ? JSON_STATUS_TO_DOMAIN[statusLabel.toUpperCase()] : undefined;
    parsed.cStat = numericCStat(input.json.cStat) ?? numericCStat(input.json.cstat) ?? parsed.cStat;
    parsed.xMotivo = input.json.xMotivo ?? input.json.motivo ?? parsed.xMotivo;
    parsed.chaveAcesso = findDeepStringKey(input.json, CHAVE_KEYS) ?? parsed.chaveAcesso;
    if (mappedStatus) {
      parsed.status = mappedStatus;
    } else {
      parsed.status = inferStatus(parsed);
    }
  }

  return parsed;
}

export function looksLikeNfseChave(value: string): boolean {
  return NFSE_CHAVE_PATTERN.test(value);
}

export function looksLikeDpsId(value: string): boolean {
  return DPS_ID_PATTERN.test(value);
}

function detectEventoTipo(xml: string): string | undefined {
  const match = /<[\w:]*\b(e\d{6})[\s>]/.exec(xml);
  return match?.[1] ?? undefined;
}

export function mapSefinEventoRegistroResponse(input: {
  text: string;
  json?: any;
}): SefinEventoRegistrado {
  const embedded = extractEmbeddedXml(input.json);
  const xml = embedded ?? input.text;
  const parsed: SefinEventoRegistrado = {};

  if (xml?.trim()) {
    parsed.tipoEvento = detectEventoTipo(xml);
    parsed.cStat = extractIntTag(xml, 'cStat');
    parsed.xMotivo = extractTag(xml, 'xMotivo');
    parsed.nProt = extractTag(xml, 'nProt');
    parsed.dhRecbto = extractTag(xml, 'dhRecbto');
    parsed.xml = xml;
  }

  if (input.json && typeof input.json === 'object') {
    parsed.cStat = numericCStat(input.json.cStat) ?? numericCStat(input.json.cstat) ?? parsed.cStat;
    parsed.xMotivo = input.json.xMotivo ?? input.json.motivo ?? parsed.xMotivo;
    parsed.nProt = input.json.nProt ?? parsed.nProt;
    parsed.dhRecbto = input.json.dhRecbto ?? input.json.dhProc ?? parsed.dhRecbto;
  }

  return parsed;
}

export function parseEventosConsulta(input: { text: string; json?: any }): SefinEventoConsulta {
  const embedded = extractEmbeddedXml(input.json);
  const xml = embedded ?? input.text;
  const result: SefinEventoConsulta = { status: NfseEmissionStatus.PENDING, eventos: [] };

  if (!xml?.trim()) return result;
  result.xml = xml;
  result.cStat = extractIntTag(xml, 'cStat');
  result.xMotivo = extractTag(xml, 'xMotivo');

  for (const bloco of extractAllTags(xml, 'evento')) {
    result.eventos.push({
      tipoEvento: detectEventoTipo(bloco),
      cStat: extractIntTag(bloco, 'cStat'),
      xMotivo: extractTag(bloco, 'xMotivo'),
      nProt: extractTag(bloco, 'nProt'),
      dhRecbto: extractTag(bloco, 'dhRecbto'),
    });
  }

  if (EVENTO_CANCELAMENTO_TAG_REGEX.test(xml)) {
    result.status = NfseEmissionStatus.CANCELED;
  } else if (hasElement(xml, 'infNFSe')) {
    result.status = NfseEmissionStatus.AUTHORIZED;
  }

  const temCancelamento = result.eventos.some(
    (evento) => evento.tipoEvento === 'e101101' || evento.tipoEvento === 'e105102',
  );
  if (temCancelamento) result.status = NfseEmissionStatus.CANCELED;

  if (input.json && typeof input.json === 'object') {
    const statusLabel = findDeepStringValue(input.json, JSON_STATUS_KEYS);
    const mapped = statusLabel ? JSON_STATUS_TO_DOMAIN[statusLabel.toUpperCase()] : undefined;
    if (mapped) result.status = mapped;
  }

  return result;
}
