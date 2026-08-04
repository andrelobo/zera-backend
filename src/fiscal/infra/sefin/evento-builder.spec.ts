import { SignedXml } from 'xml-crypto';

import { createTestCert, toPem } from '../../test-fixtures/test-cert';
import { DPS_NAMESPACE } from './dps-builder';
import {
  buildPedidoCancelamento,
  buildPedidoCancelamentoAssinado,
  buildPedidoRegistroId,
  buildTCEventoId,
  chNfseFromChave,
  EVENTO_CANCELAMENTO_TAG,
  extractEventoId,
} from './evento-builder';

const CHAVE = `NFS${'1'.repeat(50)}`;

function extractSignatureElement(signedXml: string): string {
  const match = /<Signature[^>]*>[\s\S]*<\/Signature>/.exec(signedXml);
  if (!match) throw new Error('Signature element not found');
  return match[0];
}

describe('evento-builder (TCEvento e101101)', () => {
  const cert = toPem(createTestCert());

  const options = {
    chave: CHAVE,
    motivo: 'Erro na emissão: duplicidade de lançamento',
    tpAmb: '2' as const,
    verAplic: 'ZERA-1.0',
    cnpjAutor: '43521115000134',
    dhEvento: '2026-08-03T12:00:00+00:00',
    nDFSe: '7',
  };

  it('chNFSe é a chave sem o prefixo NFS (50 dígitos)', () => {
    expect(chNfseFromChave(CHAVE)).toBe('1'.repeat(50));
    expect(chNfseFromChave(CHAVE)).toHaveLength(50);
    expect(buildPedidoRegistroId(CHAVE)).toBe(`pedRegEvento${'1'.repeat(50)}`);
    expect(buildTCEventoId(CHAVE)).toBe(`e101101${'1'.repeat(50)}`);
  });

  it('gera TCEvento com infEvento (genérica) + pedRegEvento/e101101 (específica)', () => {
    const xml = buildPedidoCancelamento(options);

    expect(xml).toContain(`<TCEvento xmlns="${DPS_NAMESPACE}" versao="1.01">`);
    expect(xml).toContain(`<infEvento Id="e101101${'1'.repeat(50)}">`);
    expect(xml).toContain('<verAplic>ZERA-1.0</verAplic>');
    expect(xml).toContain('<ambGer>2</ambGer>');
    expect(xml).toContain('<nSeqEvento>1</nSeqEvento>');
    expect(xml).toContain('<dhProc>2026-08-03T08:00:00-04:00</dhProc>');
    expect(xml).toContain('<nDFSe>7</nDFSe>');
    expect(xml).toContain(`<infPedReg Id="pedRegEvento${'1'.repeat(50)}">`);
    expect(xml).toContain('<tpAmb>2</tpAmb>');
    expect(xml).toContain('<dhEvento>2026-08-03T08:00:00-04:00</dhEvento>');
    expect(xml).toContain('<CNPJAutor>43521115000134</CNPJAutor>');
    expect(xml).toContain(`<chNFSe>${'1'.repeat(50)}</chNFSe>`);
    expect(xml).toContain(`<${EVENTO_CANCELAMENTO_TAG}>`);
    expect(xml).toContain('<xJust>Erro na emissão: duplicidade de lançamento</xJust>');
  });

  it('escapa caracteres XML do motivo', () => {
    const xml = buildPedidoCancelamento({ ...options, motivo: 'erro & <cancelamento>' });
    expect(xml).toContain('erro &amp; &lt;cancelamento&gt;');
  });

  it('omite CNPJAutor quando não informado e usa defaults tpAmb/verAplic/nSeqEvento/nDFSe', () => {
    const xml = buildPedidoCancelamento({ chave: CHAVE, motivo: 'motivo' });
    expect(xml).not.toContain('<CNPJAutor>');
    expect(xml).toContain('<tpAmb>2</tpAmb>');
    expect(xml).toContain('<verAplic>ZERA-1.0</verAplic>');
    expect(xml).toContain('<nSeqEvento>1</nSeqEvento>');
    expect(xml).toContain('<nDFSe>1</nDFSe>');
  });

  it('assina o pedido enveloped com Reference apontando infEvento', () => {
    const signed = buildPedidoCancelamentoAssinado(options, cert);
    const id = buildTCEventoId(CHAVE);

    expect(signed).toContain(`<Reference URI="#${id}">`);
    expect(signed.indexOf('<Signature')).toBeGreaterThan(signed.indexOf('</infEvento>'));
    expect(signed).not.toContain('xmlns:ds');
    expect(signed).not.toMatch(/<ds:/);
    expect(extractEventoId(signed)).toBe(id);

    const verifier = new SignedXml({ publicCert: cert.certificatePem });
    verifier.loadSignature(extractSignatureElement(signed));
    expect(verifier.checkSignature(signed)).toBe(true);
  });
});
