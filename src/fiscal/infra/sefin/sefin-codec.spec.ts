import { xmlToGzipBase64, gzipBase64ToXml, looksLikeGzipBase64 } from './sefin-codec';

describe('sefin-codec', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS versao="1.01" xmlns="http://www.nfe.fazenda.gov.br/nfse/dps">
  <infDPS Id="DPS123456789012345678901234567890123456">
    <tpAmb>1</tpAmb>
    <verAplic>1.00</verAplic>
    <nDPS>1</nDPS>
  </infDPS>
</DPS>`;

  describe('xmlToGzipBase64', () => {
    it('deve comprimir XML e retornar Base64 válido', () => {
      const result = xmlToGzipBase64(sampleXml);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(/^[A-Za-z0-9+/=]+$/.test(result)).toBe(true);
    });

    it('deve retornar resultado diferente do input', () => {
      const result = xmlToGzipBase64(sampleXml);
      expect(result).not.toBe(sampleXml);
    });
  });

  describe('gzipBase64ToXml', () => {
    it('deve descompactar Base64+GZip de volta para XML original', () => {
      const compressed = xmlToGzipBase64(sampleXml);
      const decompressed = gzipBase64ToXml(compressed);
      expect(decompressed).toBe(sampleXml);
    });

    it('deve ser idempotente (round-trip)', () => {
      const step1 = xmlToGzipBase64(sampleXml);
      const step2 = gzipBase64ToXml(step1);
      const step3 = xmlToGzipBase64(step2);
      const step4 = gzipBase64ToXml(step3);
      expect(step4).toBe(sampleXml);
    });
  });

  describe('looksLikeGzipBase64', () => {
    it('deve retornar true para string Base64 válida longa', () => {
      const compressed = xmlToGzipBase64(sampleXml);
      expect(looksLikeGzipBase64(compressed)).toBe(true);
    });

    it('deve retornar false para XML puro', () => {
      expect(looksLikeGzipBase64(sampleXml)).toBe(false);
    });

    it('deve retornar false para string curta', () => {
      expect(looksLikeGzipBase64('abc')).toBe(false);
    });

    it('deve retornar false para non-string', () => {
      expect(looksLikeGzipBase64(null)).toBe(false);
      expect(looksLikeGzipBase64(undefined)).toBe(false);
      expect(looksLikeGzipBase64(123)).toBe(false);
    });

    it('deve retornar false para string com caracteres inválidos', () => {
      expect(looksLikeGzipBase64('abc@#$%^&*()_+{}|:<>?')).toBe(false);
    });
  });
});
