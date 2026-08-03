import { PDFDocument } from 'pdf-lib';
import { detectDanfseSituacao, gerarDanfsePdf, parseNfseToDanfse } from './danfse';

const CHAVE = `NFS${'1'.repeat(50)}`;
const CHAVE_DIGITS = '1'.repeat(50);

function wrapSefin(xml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">${xml}</NFSe>`;
}

const richDps = `
  <infDPS Id="DPS${'2'.repeat(42)}">
    <tpAmb>2</tpAmb>
    <nDPS>1</nDPS>
    <serie>1</serie>
    <dhEmi>2026-08-01T11:00:00-04:00</dhEmi>
    <dCompet>2026-08-01</dCompet>
    <tpEmit>1</tpEmit>
    <finNFSe>1</finNFSe>
    <prest>
      <CNPJ>11222333000181</CNPJ>
      <IM>123456</IM>
      <fone>(92) 99999-9999</fone>
      <xNome>EMPRESA TESTE LTDA</xNome>
      <endNac>
        <xLgr>Rua A</xLgr>
        <nro>10</nro>
        <xBairro>Centro</xBairro>
        <xMun>Manaus</xMun>
        <UF>AM</UF>
        <cMun>1302603</cMun>
        <CEP>69000000</CEP>
      </endNac>
    </prest>
    <regTrib>
      <opSimpNac>3</opSimpNac>
      <regApTribSN>4</regApTribSN>
      <regEspTrib>0</regEspTrib>
    </regTrib>
    <toma>
      <CNPJ>99888777000166</CNPJ>
      <xNome>CLIENTE TESTE SA</xNome>
      <endNac>
        <xLgr>Av B</xLgr>
        <nro>100</nro>
        <xBairro>Industrial</xBairro>
        <xMun>Sao Paulo</xMun>
        <UF>SP</UF>
        <cMun>3550308</cMun>
        <CEP>01001000</CEP>
      </endNac>
    </toma>
    <serv>
      <cServ>
        <cTribNac>1.01</cTribNac>
        <cTribMun>010101</cTribMun>
        <xDescServ>Consultoria em tecnologia da informacao e comunicacao</xDescServ>
      </cServ>
      <locPrest><cLocPrestacao>1302603</cLocPrestacao></locPrest>
      <infoCompl>Teste integral de DANFSe</infoCompl>
    </serv>
    <valores>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <xLocIncid>Manaus/AM</xLocIncid>
          <regEspTrib>0</regEspTrib>
          <vBC>1000.00</vBC>
          <pAliq>2.00</pAliq>
          <tpRetISSQN>1</tpRetISSQN>
          <vISSQN>20.00</vISSQN>
        </tribMun>
        <tribFed>
          <vRetIRRF>15.00</vRetIRRF>
          <vRetCP>0.00</vRetCP>
          <vRetCSLL>0.00</vRetCSLL>
          <vPis>1.65</vPis>
          <vCofins>7.60</vCofins>
          <tpRetPisCofins>1</tpRetPisCofins>
        </tribFed>
        <totTrib>
          <pTotTrib>
            <pTotTribFed>2.42</pTotTribFed>
            <pTotTribEst>0.00</pTotTribEst>
            <pTotTribMun>2.00</pTotTribMun>
          </pTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>`;

const richInfNfse = `
  <infNFSe Id="${CHAVE}">
    <cStat>100</cStat>
    <dhProc>2026-08-01T12:00:00-04:00</dhProc>
    <nNFSe>7</nNFSe>
    <xLocEmi>Manaus/AM</xLocEmi>
    <ambGer>2</ambGer>
    <xNBS>1.04</xNBS>
    <xTribNac>1.01</xTribNac>
    <xTribMun>0101.01</xTribMun>
    <xOutInf>Nota gerada pelo ZERA</xOutInf>
    <valores>
      <vServ>1000.00</vServ>
      <vDescIncond>0.00</vDescIncond>
      <vDescCond>0.00</vDescCond>
      <vTotalRet>15.00</vTotalRet>
      <vLiq>985.00</vLiq>
      <vTotNF>1000.00</vTotNF>
    </valores>
    <IBSCBS>
      <CST>0</CST>
      <cClassTrib>0</cClassTrib>
      <cIndOp>0</cIndOp>
      <xLocalidadeIncid>Manaus</xLocalidadeIncid>
      <vExclusoes>0.00</vExclusoes>
      <vBC>1000.00</vBC>
      <pRedAliq>0.00</pRedAliq>
      <pAliq>0.00</pAliq>
      <pAliqEfetMun>0.00</pAliqEfetMun>
      <pAliqEfetUF>0.00</pAliqEfetUF>
      <pCBS>0.00</pCBS>
      <pAliqEfetCBS>0.00</pAliqEfetCBS>
      <totCIBS>
        <gIBS>
          <vIBSMun>0.00</vIBSMun>
          <vIBSUF>0.00</vIBSUF>
          <vIBSTot>0.00</vIBSTot>
        </gIBS>
        <gCBS><vCBS>0.00</vCBS></gCBS>
      </totCIBS>
    </IBSCBS>
    <DPS>${richDps}</DPS>
  </infNFSe>`;

const richXml = wrapSefin(richInfNfse);

describe('parseNfseToDanfse', () => {
  it('extrai chave de acesso sem o prefixo NFS e os dados principais', () => {
    const data = parseNfseToDanfse(richXml);
    expect(data.chaveAcesso).toBe(CHAVE_DIGITS);
    expect(data.nNFSe).toBe('7');
    expect(data.cStat).toBe('100');
    expect(data.tpAmb).toBe('2');
    expect(data.ambGer).toBe('2');
    expect(data.xLocEmi).toBe('Manaus/AM');
    expect(data.finNFSe).toBe('NFS-e regular');
  });

  it('mapeia dados do prestador com máscaras', () => {
    const data = parseNfseToDanfse(richXml);
    expect(data.prest.documento).toBe('11.222.333/0001-81');
    expect(data.prest.im).toBe('123456');
    expect(data.prest.xNome).toBe('EMPRESA TESTE LTDA');
    expect(data.prest.endereco).toBe('Rua A, 10, Centro');
    expect(data.prest.municipioUf).toBe('Manaus / AM');
    expect(data.prest.cep).toBe('69000-000');
    expect(data.prestSn?.opSimpNac).toBe('Não Optante');
    expect(data.prestSn?.regApTribSN).toContain('regime normal');
  });

  it('mapeia tomador, serviço e tributação', () => {
    const data = parseNfseToDanfse(richXml);
    expect(data.toma?.documento).toBe('99.888.777/0001-66');
    expect(data.toma?.xNome).toBe('CLIENTE TESTE SA');
    expect(data.serv.cTribNac).toBe('1.01');
    expect(data.serv.cTribMun).toBe('010101');
    expect(data.serv.xDescServ).toContain('Consultoria');
    expect(data.iss?.tribISSQN).toBe('Operação tributável');
    expect(data.iss?.vBC).toBe('1.000,00');
    expect(data.iss?.pAliq).toBe('2,00%');
    expect(data.iss?.vISSQN).toBe('20,00');
    expect(data.iss?.tpRetISSQN).toBe('Não Retido');
    expect(data.fed?.vRetIRRF).toBe('15,00');
    expect(data.fed?.vPis).toBe('1,65');
    expect(data.fed?.vCofins).toBe('7,60');
  });

  it('mapeia IBS/CBS, totais e a linha da Lei 12.741/2012', () => {
    const data = parseNfseToDanfse(richXml);
    expect(data.ibscbs?.cst).toBe('0');
    expect(data.ibscbs?.xLocalidadeIncid).toBe('Manaus');
    expect(data.totais.vServ).toBe('1.000,00');
    expect(data.totais.vTotalRet).toBe('15,00');
    expect(data.totais.vLiq).toBe('985,00');
    expect(data.totais.vTotNF).toBe('1.000,00');
    expect(data.totTrib?.mun).toBe('2,00%');
    expect(data.infoCompl).toContain('Lei nº 12.741/2012');
    expect(data.infoCompl).toContain('Teste integral de DANFSe');
    expect(data.infoCompl).toContain('Nota gerada pelo ZERA');
  });

  it('usa "-" e tpAmb=1 quando o XML é mínimo', () => {
    const data = parseNfseToDanfse(
      wrapSefin(
        `<infNFSe Id="${CHAVE}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00-04:00</dhProc></infNFSe>`,
      ),
    );
    expect(data.chaveAcesso).toBe(CHAVE_DIGITS);
    expect(data.tpAmb).toBe('1');
    expect(data.prest.documento).toBeUndefined();
    expect(data.nNFSe).toBeUndefined();
    expect(data.totais.vServ).toBe('-');
    expect(data.iss?.vISSQN).toBe('-');
  });
});

describe('detectDanfseSituacao', () => {
  it('detecta NFS-e cancelada (e101101)', () => {
    expect(
      detectDanfseSituacao(richXml.replace('<DPS>', '<e101101><chNFSe>x</chNFSe></e101101><DPS>')),
    ).toBe('CANCELADA');
  });

  it('detecta NFS-e substituída (e105102)', () => {
    expect(
      detectDanfseSituacao(richXml.replace('<DPS>', '<e105102><chNFSe>x</chNFSe></e105102><DPS>')),
    ).toBe('SUBSTITUIDA');
  });

  it('retorna undefined sem eventos', () => {
    expect(detectDanfseSituacao(richXml)).toBeUndefined();
  });
});

describe('gerarDanfsePdf', () => {
  async function pdfOf(xml: string) {
    const bytes = await gerarDanfsePdf(xml);
    expect(Buffer.from(bytes).slice(0, 5).toString()).toBe('%PDF-');
    return PDFDocument.load(bytes);
  }

  it('gera um PDF A4 de uma única página (QR embutido sem erro)', async () => {
    const pdf = await pdfOf(richXml);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 0);
    expect(height).toBeCloseTo(841.89, 0);
  });

  it('gera DANFSe de NFS-e cancelada (marca d água) sem erro', async () => {
    const canceled = richXml.replace(
      '</infNFSe>',
      '<evento><e101101><chNFSe>1</chNFSe><dhEvento>2026-08-02T10:00:00-04:00</dhEvento></e101101></evento></infNFSe>',
    );
    const data = parseNfseToDanfse(canceled);
    expect(data.situacao).toBe('CANCELADA');
    const pdf = await pdfOf(canceled);
    expect(pdf.getPageCount()).toBe(1);
  });

  it('aceita XML mínimo (sem DPS) mantendo 1 página', async () => {
    const minimal = wrapSefin(
      `<infNFSe Id="${CHAVE}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00-04:00</dhProc></infNFSe>`,
    );
    const pdf = await pdfOf(minimal);
    expect(pdf.getPageCount()).toBe(1);
  });

  it('quebra linhas de descrição longa sem estourar a página', async () => {
    const longDesc = 'Descrição '.repeat(120).trim();
    const xml = richXml.replace(
      '<xDescServ>Consultoria em tecnologia da informacao e comunicacao</xDescServ>',
      `<xDescServ>${longDesc}</xDescServ>`,
    );
    const pdf = await pdfOf(xml);
    expect(pdf.getPageCount()).toBe(1);
  });
});
