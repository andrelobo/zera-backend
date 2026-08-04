import { EmpresasService } from '../../../modules/empresas/empresas.service';
import { createTestCert, toPem } from '../../test-fixtures/test-cert';
import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import { NfseEmissionRepository } from '../mongo/repositories/nfse-emission.repository';
import { SefinMtlsHttp } from './sefin-mtls.http';
import { LobonotasProvider } from './sefin.provider';

const CHAVE = `NFS${'1'.repeat(50)}`;
const DPS_ID = `DPS${'2'.repeat(42)}`;

const baseInput: any = {
  prestador: {
    cnpj: '43521115000134',
    inscricaoMunicipal: '51754301',
    razaoSocial: 'BURGUS LTDA',
    regimeTributarioSn: { opSimpNac: 3, regApTribSN: 1, regEspTrib: 0 },
  },
  tomador: {
    cpfCnpj: '61020788100',
    razaoSocial: 'ANDRE AUGUSTO DE HOLANDA LOBO',
  },
  servico: {
    codigoNacional: '171901',
    codigoTributacao: '100',
    descricao: 'Consulta IR 2024',
    valor: 150,
    iss: { retido: false, aliquota: 5 },
  },
  referenciaExterna: 'sefin-test-1',
};

function nfseXml(chave = CHAVE): string {
  return `<?xml version="1.0" encoding="UTF-8"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infNFSe Id="${chave}"><cStat>100</cStat><dhProc>2026-08-01T12:00:00+00:00</dhProc><nNFSe>1</nNFSe><nDFSe>1</nDFSe></infNFSe></NFSe>`;
}

function rejectionXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?><resNfse xmlns="http://www.sped.fazenda.gov.br/nfse"><cStat>501</cStat><xMotivo>Rejeicao: DPS invalida</xMotivo></resNfse>`;
}

function xmlResponse(text: string) {
  return {
    status: 200,
    headers: {},
    body: new Uint8Array(Buffer.from(text)),
    text,
    json: undefined,
  };
}

describe('LobonotasProvider', () => {
  const cert = toPem(createTestCert());
  const material = createTestCert();

  const empresasService = {
    obterMaterialCertificado: jest.fn(),
    reservarNumeracaoDps: jest.fn(),
  } as unknown as EmpresasService;

  const http = {
    request: jest.fn(),
    registrarEvento: jest.fn(),
    consultarEventos: jest.fn(),
  } as unknown as SefinMtlsHttp;

  const repository = {
    findByExternalId: jest.fn(),
  } as unknown as NfseEmissionRepository;

  let provider: LobonotasProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SEFIN_NFSE_ENVELOPE;
    delete process.env.SEFIN_TP_AMB;
    delete process.env.SEFIN_DPS_SERIE;
    delete process.env.SEFIN_CMUN_IBGE;
    delete process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL;
    delete process.env.SEFIN_VERIFY_CERT;
    empresasService.obterMaterialCertificado.mockResolvedValue(material);
    empresasService.reservarNumeracaoDps.mockResolvedValue({ serie: '1', nDPS: '1' });
    repository.findByExternalId.mockResolvedValue({ empresaCnpj: '43521115000134' });
    provider = new LobonotasProvider(empresasService, http, repository);
  });

  it('providerName é LOBONOTAS', () => {
    expect(provider.providerName).toBe('LOBONOTAS');
  });

  it('emite DPS assinada e mapeia NFS-e autorizada (status AUTHORIZED + chave)', async () => {
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    const result = await provider.emitirNfse(baseInput);

    expect(empresasService.reservarNumeracaoDps).toHaveBeenCalledWith('43521115000134');
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: '/nfse',
        contentType: 'application/json',
      }),
    );

    const requestCall = (http.request as jest.Mock).mock.calls[0][0];
    const body = JSON.parse(requestCall.body as string).dps as string;
    expect(body).toContain('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">');
    expect(body).toContain('<ds:Signature');
    expect(body).toContain('<serie>00001</serie>');
    expect(requestCall.cert.privateKeyPem).toContain('PRIVATE KEY');
    expect(requestCall.cert.certificatePem).toContain('CERTIFICATE');

    expect(result.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(result.provider).toBe('LOBONOTAS');
    expect(result.externalId).toBe(CHAVE);
    expect(result.providerResponse).toEqual(
      expect.objectContaining({ cStat: '100', chaveAcesso: CHAVE, idNota: CHAVE }),
    );
  });

  it('suporta override de envelope XML quando SEFIN_NFSE_ENVELOPE=xml', async () => {
    process.env.SEFIN_NFSE_ENVELOPE = 'xml';
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    await provider.emitirNfse(baseInput);

    const requestCall = (http.request as jest.Mock).mock.calls[0][0];
    expect(requestCall.contentType).toBe('application/xml');
    expect(requestCall.body).toContain('<DPS');
  });

  it('timeout pós-DPS vira PENDING com transmitidoSemConfirmacao e dpsId p/ reconciliação', async () => {
    (http.request as jest.Mock).mockRejectedValue({
      code: 'SEFIN_REQUEST_TIMEOUT',
      message: 'Sefin HTTP timeout after 30000ms',
    });

    const result = await provider.emitirNfse(baseInput);

    expect(result.status).toBe(NfseEmissionStatus.PENDING);
    expect(result.externalId).toMatch(/^DPS\d{42}$/);
    expect(result.providerResponse).toEqual(
      expect.objectContaining({ transmitidoSemConfirmacao: true, motivo: 'SEFIN_REQUEST_TIMEOUT' }),
    );
  });

  it('4xx com cStat de rejeição vira REJECTED (não ERROR)', async () => {
    (http.request as jest.Mock).mockRejectedValue({
      code: 'SEFIN_HTTP_ERROR',
      status: 400,
      message: 'Sefin API error: 400',
      body: rejectionXml(),
    });

    const result = await provider.emitirNfse(baseInput);

    expect(result.status).toBe(NfseEmissionStatus.REJECTED);
    expect(result.providerResponse).toEqual(
      expect.objectContaining({ cStat: '501', httpStatus: 400 }),
    );
  });

  it('sem certificado local lança SEFIN_CERT_NOT_FOUND', async () => {
    empresasService.obterMaterialCertificado.mockResolvedValue(null);

    await expect(provider.emitirNfse(baseInput)).rejects.toMatchObject({
      code: 'SEFIN_CERT_NOT_FOUND',
    });
  });

  it('consulta NFS-e por chave de acesso', async () => {
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    const { status, providerResponse } = await provider.consultarNfse(CHAVE);

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: `/nfse/${CHAVE}` }),
    );
    expect(status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(providerResponse.chaveAcesso).toBe(CHAVE);
  });

  it('consulta reconcilia DPS id -> chave via GET /dps/{id} e depois GET /nfse/{chave}', async () => {
    (http.request as jest.Mock).mockImplementation(({ path }: { path: string }) => {
      if (path.startsWith('/dps/')) {
        return {
          status: 200,
          headers: {},
          body: new Uint8Array(),
          text: JSON.stringify({ chaveAcesso: CHAVE }),
          json: { chaveAcesso: CHAVE },
        };
      }
      if (path.startsWith('/nfse/')) return xmlResponse(nfseXml());
      throw new Error(`unexpected path ${path}`);
    });

    const { status } = await provider.consultarNfse(DPS_ID);

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: `/dps/${DPS_ID}` }),
    );
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: `/nfse/${CHAVE}` }),
    );
    expect(status).toBe(NfseEmissionStatus.AUTHORIZED);
  });

  it('DPS ainda sem NFS-e permanece PENDING (reconciliação)', async () => {
    (http.request as jest.Mock).mockResolvedValue({
      status: 200,
      headers: {},
      body: new Uint8Array(),
      text: JSON.stringify({ dpsId: DPS_ID, gerada: false }),
      json: { dpsId: DPS_ID, gerada: false },
    });

    const { status, providerResponse } = await provider.consultarNfse(DPS_ID);

    expect(status).toBe(NfseEmissionStatus.PENDING);
    expect(providerResponse.notFound).toBe(true);
  });

  it('404 na consulta da NFS-e permanece PENDING (ainda processando)', async () => {
    (http.request as jest.Mock).mockRejectedValue({
      code: 'SEFIN_HTTP_ERROR',
      status: 404,
      message: 'Sefin API error: 404',
    });

    const { status, providerResponse } = await provider.consultarNfse(CHAVE);

    expect(status).toBe(NfseEmissionStatus.PENDING);
    expect(providerResponse.notFound).toBe(true);
  });

  it('baixa XML da NFS-e autorizada', async () => {
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    const bytes = await provider.baixarXmlNfse(CHAVE);

    expect(Buffer.from(bytes).toString('utf8')).toContain('<infNFSe');
  });

  it('gera o DANFSe v2.0 em PDF a partir do XML da NFS-e', async () => {
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    const pdf = await provider.baixarPdfNfse(CHAVE);

    expect(Buffer.from(pdf).slice(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('solicita cancelamento registrando evento e101101 assinado e devolve protocolo = chave', async () => {
    const retEvento =
      `<retEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>100</cStat><xMotivo>Evento registrado</xMotivo><nProt>123456789012345</nProt>` +
      `<dhRecbto>2026-08-03T12:00:00+00:00</dhRecbto><e101101><versao>1.01</versao><xJust>teste</xJust></e101101></retEvento>`;
    (http.registrarEvento as jest.Mock).mockResolvedValue(xmlResponse(retEvento));

    const result = await provider.solicitarCancelamentoNfse(CHAVE, {
      codigo: '1',
      motivo: 'teste',
    });

    const call = (http.registrarEvento as jest.Mock).mock.calls[0][0];
    expect(call.chave).toBe(CHAVE);
    expect(call.body).toContain('<e101101>');
    expect(call.body).toContain('<ds:Signature');
    expect(call.body).toContain(`<chNFSe>${'1'.repeat(50)}</chNFSe>`);
    expect(call.cert.certificatePem).toContain('CERTIFICATE');

    expect(result.protocol).toBe(CHAVE);
    expect(result.providerResponse).toEqual(
      expect.objectContaining({
        chaveAcesso: CHAVE,
        nProt: '123456789012345',
        cStat: '100',
        aceito: true,
      }),
    );
  });

  it('cancelamento rejeitado (cStat 600) devolve protocol=null e status REJECTED', async () => {
    const reject =
      `<retEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>600</cStat><xMotivo>Cancelamento não permitido</xMotivo></retEvento>`;
    (http.registrarEvento as jest.Mock).mockRejectedValue({
      code: 'SEFIN_HTTP_ERROR',
      status: 400,
      message: 'Sefin API error: 400',
      body: reject,
    });

    const result = await provider.solicitarCancelamentoNfse(CHAVE, { codigo: '9', motivo: 'x' });

    expect(result.protocol).toBeNull();
    expect(result.providerResponse).toEqual(
      expect.objectContaining({
        cStat: '600',
        aceito: false,
        status: NfseEmissionStatus.REJECTED,
      }),
    );
  });

  it('cancelamento de NFS-e inexistente (404) devolve notFound sem lançar', async () => {
    (http.registrarEvento as jest.Mock).mockRejectedValue({
      code: 'SEFIN_HTTP_ERROR',
      status: 404,
      message: 'Sefin API error: 404',
    });

    const result = await provider.solicitarCancelamentoNfse(CHAVE);

    expect(result.protocol).toBeNull();
    expect(result.providerResponse.notFound).toBe(true);
  });

  it('consulta cancelamento via eventos: evento e101101 registrado vira CANCELED', async () => {
    const consulta =
      `<consultarEventos xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">` +
      `<cStat>100</cStat><xMotivo>Sucesso</xMotivo><eventos>` +
      `<evento><cStat>100</cStat><xMotivo>Cancelamento registrado</xMotivo><nProt>123456789012345</nProt>` +
      `<dhRecbto>2026-08-03T12:00:00+00:00</dhRecbto><e101101><versao>1.01</versao><xJust>x</xJust></e101101></evento>` +
      `</eventos></consultarEventos>`;
    (http.consultarEventos as jest.Mock).mockResolvedValue(xmlResponse(consulta));

    const { status, providerResponse } = await provider.consultarSolicitacaoCancelamentoNfse(CHAVE);

    expect(http.consultarEventos).toHaveBeenCalledWith(expect.objectContaining({ chave: CHAVE }));
    expect(status).toBe(NfseEmissionStatus.CANCELED);
    expect(providerResponse.eventos[0].tipoEvento).toBe('e101101');
  });

  it('consulta cancelamento com 404 retorna status undefined e notFound', async () => {
    (http.consultarEventos as jest.Mock).mockRejectedValue({
      code: 'SEFIN_HTTP_ERROR',
      status: 404,
      message: 'Sefin API error: 404',
    });

    const { status, providerResponse } = await provider.consultarSolicitacaoCancelamentoNfse(CHAVE);

    expect(status).toBeUndefined();
    expect(providerResponse.notFound).toBe(true);
  });
});
