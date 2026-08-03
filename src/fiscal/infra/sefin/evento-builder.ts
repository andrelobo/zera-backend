import { DPS_NAMESPACE, DPS_VERSION } from './dps-builder';
import { signXmlElement, type DpsCertMaterialPem } from './dps-signer';

export const EVENTO_CANCELAMENTO_TAG = 'e101101';
export const EVENTO_CANCELAMENTO_CODIGO = '101101';
export const EVENTO_SUBSTITUICAO_TAG = 'e105102';
export const EVENTO_CODIGO_PATTERN = /^e\d{6}$/;

export interface CancelamentoEventoOptions {
  chave: string;
  motivo: string;
  tpAmb?: '1' | '2';
  verAplic?: string;
  cnpjAutor?: string;
  nSeqEvento?: string;
  dhEvento?: string;
  nDFSe?: string;
}

export function chNfseFromChave(chave: string): string {
  return chave.replace(/^NFS/, '');
}

export function buildTCEventoId(chave: string): string {
  return `${EVENTO_CANCELAMENTO_TAG}${chNfseFromChave(chave)}`;
}

export function buildPedidoRegistroId(chave: string): string {
  return `pedRegEvento${chNfseFromChave(chave)}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDateTimeUtc(value?: string): string {
  if (!value) {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
  }
  const cleaned = value.replace(/\.\d{3}Z$/, 'Z').replace(/\.\d{3}[+-]\d{2}:\d{2}$/, '+00:00');
  const hasOffset = /[+-]\d{2}:\d{2}$/.test(cleaned);
  const candidate = hasOffset ? cleaned : `${cleaned.replace('Z', '')}+00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(candidate)) {
    return candidate;
  }
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Gera o pedido de registro do evento de cancelamento (e101101) do Ambiente
 * Nacional no formato TCEvento (evento_v1.01.xsd): `infEvento` (parte genérica
 * com `nSeqEvento`/`dhProc`/`nDFSe`) + `pedRegEvento` (`infPedReg` com a parte
 * específica `e101101`). A `ds:Signature` é obrigatória no envio à API.
 */
export function buildPedidoCancelamento(options: CancelamentoEventoOptions): string {
  const tpAmb = options.tpAmb ?? '2';
  const verAplic = options.verAplic ?? 'ZERA-1.0';
  const nSeqEvento = options.nSeqEvento ?? '1';
  const nDFSe = options.nDFSe ?? '1';
  const dhEvento = toDateTimeUtc(options.dhEvento);
  const chNFSe = chNfseFromChave(options.chave);
  const tcEventoId = buildTCEventoId(options.chave);
  const pedRegId = buildPedidoRegistroId(options.chave);
  const cnpjAutor = (options.cnpjAutor ?? '').replace(/\D+/g, '');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TCEvento xmlns="${DPS_NAMESPACE}" versao="${DPS_VERSION}">
  <infEvento Id="${tcEventoId}">
    <verAplic>${verAplic}</verAplic>
    <ambGer>${tpAmb}</ambGer>
    <nSeqEvento>${nSeqEvento}</nSeqEvento>
    <dhProc>${dhEvento}</dhProc>
    <nDFSe>${nDFSe}</nDFSe>
    <pedRegEvento>
      <infPedReg Id="${pedRegId}">
        <tpAmb>${tpAmb}</tpAmb>
        <verAplic>${verAplic}</verAplic>
        <dhEvento>${dhEvento}</dhEvento>
        ${cnpjAutor ? `<CNPJAutor>${cnpjAutor}</CNPJAutor>` : ''}
        <chNFSe>${chNFSe}</chNFSe>
        <${EVENTO_CANCELAMENTO_TAG}>
          <versao>${DPS_VERSION}</versao>
          <xJust>${escapeXml(options.motivo)}</xJust>
        </${EVENTO_CANCELAMENTO_TAG}>
      </infPedReg>
    </pedRegEvento>
  </infEvento>
</TCEvento>`;
}

export function extractEventoId(xml: string): string {
  const match = /<infEvento\s+Id="([^"]+)"/.exec(xml);
  if (!match) {
    throw new Error('TCEvento XML não contém infEvento/@Id');
  }
  return match[1];
}

export function signPedidoCancelamento(xml: string, keyAndCert: DpsCertMaterialPem): string {
  return signXmlElement({
    xml,
    id: extractEventoId(xml),
    localName: 'infEvento',
    keyAndCert,
  });
}

export function buildPedidoCancelamentoAssinado(
  options: CancelamentoEventoOptions,
  keyAndCert: DpsCertMaterialPem,
): string {
  return signPedidoCancelamento(buildPedidoCancelamento(options), keyAndCert);
}
