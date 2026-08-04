import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import { xmlToGzipBase64 } from './sefin-codec';
import {
  DPS_ID_PATTERN,
  NFSE_CHAVE_PATTERN,
  looksLikeDpsId,
  looksLikeNfseChave,
  mapSefinEventoRegistroResponse,
  mapSefinNfseResponse,
  parseEventosConsulta,
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

  it('NFS-e com evento de cancelamento (e101101) vira CANCELED', () => {
    const canceled = `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${CHAVE}"><cStat>100</cStat></infNFSe><eventos><evento><e101101><versao>1.01</versao><xJust>Cancelamento</xJust></e101101></evento></eventos></NFSe>`;
    const parsed = mapSefinNfseResponse({ text: canceled });
    expect(parsed.status).toBe(NfseEmissionStatus.CANCELED);
  });

  it('mapeia resposta de registro de evento (cStat/nProt/dhRecbto/tipo)', () => {
    const ret =
      `<retEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>100</cStat><xMotivo>Evento registrado</xMotivo><nProt>123456789012345</nProt>` +
      `<dhRecbto>2026-08-03T12:00:00+00:00</dhRecbto><e101101><versao>1.01</versao><xJust>motivo</xJust></e101101></retEvento>`;

    const parsed = mapSefinEventoRegistroResponse({ text: ret });

    expect(parsed.cStat).toBe('100');
    expect(parsed.xMotivo).toBe('Evento registrado');
    expect(parsed.nProt).toBe('123456789012345');
    expect(parsed.dhRecbto).toBe('2026-08-03T12:00:00+00:00');
    expect(parsed.tipoEvento).toBe('e101101');
  });

  it('consulta de eventos sem cancelamento permanece sem status CANCELED', () => {
    const consulta =
      `<consultarEventos xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>100</cStat><xMotivo>Sucesso</xMotivo><eventos></eventos></consultarEventos>`;

    const result = parseEventosConsulta({ text: consulta });

    expect(result.status).toBe(NfseEmissionStatus.PENDING);
    expect(result.eventos).toHaveLength(0);
  });

  it('consulta de eventos com e101101 vira CANCELED e lista o evento', () => {
    const consulta =
      `<consultarEventos xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>100</cStat><xMotivo>Sucesso</xMotivo><eventos>` +
      `<evento><cStat>100</cStat><xMotivo>Cancelamento registrado</xMotivo><nProt>123456789012345</nProt>` +
      `<dhRecbto>2026-08-03T12:00:00+00:00</dhRecbto><e101101><versao>1.01</versao><xJust>motivo</xJust></e101101></evento>` +
      `</eventos></consultarEventos>`;

    const result = parseEventosConsulta({ text: consulta });

    expect(result.status).toBe(NfseEmissionStatus.CANCELED);
    expect(result.eventos).toHaveLength(1);
    expect(result.eventos[0].tipoEvento).toBe('e101101');
    expect(result.eventos[0].nProt).toBe('123456789012345');
  });

  it('descompacta XML GZip+Base64 embutido em resposta JSON', () => {
    const compressed = xmlToGzipBase64(nfseXml);
    const parsed = mapSefinNfseResponse({
      text: '{"nfse":"indefinido"}',
      json: { nfse: compressed },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
    expect(parsed.xml).toContain('<infNFSe');
  });

  it('descompacta XML GZip+Base64 aninhado em objeto JSON', () => {
    const compressed = xmlToGzipBase64(nfseXml);
    const parsed = mapSefinNfseResponse({
      text: '{}',
      json: { data: { nfse: compressed } },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
  });

  it('descompacta o campo real do SEFIN nfseXmlGZipB64', () => {
    const compressed = xmlToGzipBase64(nfseXml);
    const parsed = mapSefinNfseResponse({
      text: JSON.stringify({ nfseXmlGZipB64: compressed }),
      json: { nfseXmlGZipB64: compressed },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.chaveAcesso).toBe(CHAVE);
  });

  it('rejeição JSON do SEFIN com erros Codigo/Descricao vira REJECTED (ex.: E1226)', () => {
    const parsed = mapSefinNfseResponse({
      text: JSON.stringify({
        tipoAmbiente: 1,
        versaoAplicativo: 'SefinNacional_1.6.0',
        dataHoraProcessamento: '2026-08-04T17:05:44.0422736-03:00',
        erros: [{ Codigo: 'E1226', Descricao: 'Estrutura descompactada mal formada.' }],
      }),
      json: {
        tipoAmbiente: 1,
        versaoAplicativo: 'SefinNacional_1.6.0',
        dataHoraProcessamento: '2026-08-04T17:05:44.0422736-03:00',
        erros: [{ Codigo: 'E1226', Descricao: 'Estrutura descompactada mal formada.' }],
      },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.REJECTED);
    expect(parsed.cStat).toBe('E1226');
    expect(parsed.xMotivo).toBe('Estrutura descompactada mal formada.');
  });

  it('erro de evento em JSON (erro[{Codigo,Descricao}]) é mapeado no registro', () => {
    const parsed = mapSefinEventoRegistroResponse({
      text: JSON.stringify({ erro: [{ Codigo: 'E1500', Descricao: 'Evento não permitido' }] }),
      json: { erro: [{ Codigo: 'E1500', Descricao: 'Evento não permitido' }] },
    });
    expect(parsed.cStat).toBe('E1500');
    expect(parsed.xMotivo).toBe('Evento não permitido');
  });

  it('trata Base64 não-XML como texto puro', () => {
    const fakeBase64 = Buffer.from('não é XML comprimido mas é Base64').toString('base64');
    const parsed = mapSefinNfseResponse({
      text: nfseXml,
      json: { nfse: fakeBase64 },
    });
    expect(parsed.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(parsed.xml).toContain('<infNFSe');
  });
});
