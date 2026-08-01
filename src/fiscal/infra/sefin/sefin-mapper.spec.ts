import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import {
  DPS_ID_PATTERN,
  NFSE_CHAVE_PATTERN,
  looksLikeDpsId,
  looksLikeNfseChave,
  mapSefinNfseResponse,
} from './sefin-mapper';

const CHAVE = `NFS${'1'.repeat(50)}`;
const DPS_ID = `DPS${'2'.repeat(42)}`;

const nfseXml = `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${CHAVE}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00+00:00</dhProc><nNFSe>7</nNFSe><nDFSe>1</nDFSe></infNFSe></NFSe>`;

describe('sefin-mapper', () => {
  it('mapeia NFS-e autorizada (infNFSe) para AUTHORIZED com chave de acesso', () => {
    const parsed = mapSefinNfseResponse({ text: nfseXml });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
    expect(parsed.cStat).toBe('100');
    expect(parsed.dhProc).toBe('2026-08-01T12:00:00+00:00');
    expect(parsed.nNFSe).toBe('7');
    expect(parsed.nDFSe).toBe('1');
  });

  it('tolera prefixos de namespace nos elementos', () => {
    const prefixed = nfseXml.replace('<NFSe ', '<n0:NFSe ').replace('infNFSe', 'n0:infNFSe');
    const parsed = mapSefinNfseResponse({ text: prefixed });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
  });

  it('rejeição com cStat 4xx/5xx vira REJECTED', () => {
    const parsed = mapSefinNfseResponse({
      text: `<?xml version="1.0" encoding="UTF-8"?><resNfse xmlns="http://www.sped.fazenda.gov.br/nfse"><cStat>501</cStat><xMotivo>Rejeicao: DPS invalida</xMotivo></resNfse>`,
    });
    expect(parsed.status).toBe(NfseEmissionStatus.REJECTED);
    expect(parsed.cStat).toBe('501');
    expect(parsed.xMotivo).toContain('DPS invalida');
  });

  it('cStat 1xx/2xx sem autorização permanece PENDING', () => {
    const parsed = mapSefinNfseResponse({
      text: `<resNfse xmlns="http://www.sped.fazenda.gov.br/nfse"><cStat>100</cStat><xMotivo>Processamento em andamento</xMotivo></resNfse>`,
    });
    expect(parsed.status).toBe(NfseEmissionStatus.PENDING);
  });

  it('extrai XML embutido em resposta JSON', () => {
    const parsed = mapSefinNfseResponse({
      text: '{"nfse":"indefinido"}',
      json: { resposta: { xml: nfseXml } },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
    expect(parsed.xml).toContain('<infNFSe');
  });

  it('extrai chave de acesso de JSON sem XML', () => {
    const parsed = mapSefinNfseResponse({
      text: '{}',
      json: { nfse: { chaveAcesso: CHAVE, status: 'AUTORIZADA' } },
    });
    expect(parsed.chaveAcesso).toBe(CHAVE);
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
  });

  it('corpo vazio permanece PENDING sem cStat', () => {
    const parsed = mapSefinNfseResponse({ text: '' });
    expect(parsed.status).toBe(NfseEmissionStatus.PENDING);
    expect(parsed.cStat).toBeUndefined();
  });

  it('padrões de identificador: chave NFS 50 dígitos e DPS id', () => {
    expect(NFSE_CHAVE_PATTERN.test(CHAVE)).toBe(true);
    expect(DPS_ID_PATTERN.test(DPS_ID)).toBe(true);
    expect(looksLikeNfseChave(CHAVE)).toBe(true);
    expect(looksLikeNfseChave(DPS_ID)).toBe(false);
    expect(looksLikeDpsId(DPS_ID)).toBe(true);
    expect(looksLikeDpsId(CHAVE)).toBe(false);
  });
});
