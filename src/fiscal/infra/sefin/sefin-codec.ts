import { gzipSync, gunzipSync } from 'zlib';

/**
 * Codifica UTF-8 XML em GZip + Base64 para o envelope JSON do Ambiente Nacional.
 *
 * O contrato oficial (doc 06 §2.1) exige que o campo `dps` trafegue como
 * Base64Binary do XML comprimido com GZip.
 */
export function xmlToGzipBase64(xml: string): string {
  const buffer = Buffer.from(xml, 'utf-8');
  const compressed = gzipSync(buffer);
  return compressed.toString('base64');
}

/**
 * Decodifica Base64 + GZip de volta para UTF-8 XML.
 *
 * Utilizado para ler a resposta compactada do Ambiente Nacional quando o campo
 * `nfse` (ou similar) vem em Base64Binary.
 */
export function gzipBase64ToXml(base64: string): string {
  const buffer = Buffer.from(base64, 'base64');
  const decompressed = gunzipSync(buffer);
  return decompressed.toString('utf-8');
}

/**
 * Verifica se uma string parece ser Base64 de um XML comprimido (GZip).
 * Retorna true quando a string é composta apenas de caracteres Base64 válidos
 * e tem comprimento razoável (> 20 chars para evitar falsos positivos).
 */
export function looksLikeGzipBase64(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length < 20) return false;
  // Base64 padrão: A-Z, a-z, 0-9, +, /, =
  return /^[A-Za-z0-9+/=]+$/.test(value);
}
