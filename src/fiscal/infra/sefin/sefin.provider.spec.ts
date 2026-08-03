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
        contentType: 'application/xml',
      }),
    );

    const requestCall = (http.request as jest.Mock).mock.calls[0][0];
    const body = requestCall.body as string;
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

  it('suporta envelope JSON quando SEFIN_NFSE_ENVELOPE=json', async () => {
    process.env.SEFIN_NFSE_ENVELOPE = 'json';
    (http.request as jest.Mock).mockResolvedValue(xmlResponse(nfseXml()));

    await provider.emitirNfse(baseInput);

    const requestCall = (http.request as jest.Mock).mock.calls[0][0];
    expect(requestCall.contentType).toBe('application/json');
    const parsed = JSON.parse(requestCall.body as string);
    expect(typeof parsed.dps).toBe('string');
    expect(parsed.dps).toContain('<DPS');
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

  it('PDF/DANFSE retorna vazio neste escopo (Slice 7) sem quebrar sync', async () => {
    const pdf = await provider.baixarPdfNfse(CHAVE);
    expect(pdf.length).toBe(0);
  });

  it('cancelamento lança SEFIN_EVENTO_NOT_IMPLEMENTED até o Slice 7', async () => {
    await expect(
      provider.solicitarCancelamentoNfse(CHAVE, { codigo: '1', motivo: 'teste' }),
    ).rejects.toMatchObject({ code: 'SEFIN_EVENTO_NOT_IMPLEMENTED' });
  });
});
