import * as https from 'node:https';

import { EmpresasService } from '../../../modules/empresas/empresas.service';
import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import { createTestPki, toPem } from '../../test-fixtures/test-cert';
import { SefinStubServer } from '../../test-fixtures/sefin-stub-server';
import { NfseEmissionRepository } from '../mongo/repositories/nfse-emission.repository';
import { buildPedidoCancelamentoAssinado } from './evento-builder';
import { SefinMtlsHttp } from './sefin-mtls.http';
import { LobonotasProvider } from './sefin.provider';
import { gzipBase64ToXml } from './sefin-codec';

const CHAVE = `NFS${'1'.repeat(50)}`;
const CHAVE_CANCELADA = `NFS${'7'.repeat(50)}`;
const CHAVE_INEXISTENTE = `NFS${'8'.repeat(50)}`;
const CHAVE_NAO_CANCELAVEL = `NFS${'9'.repeat(50)}`;

describe('SefinMtlsHttp real mTLS contra stub SEFIN local (Ambiente Nacional simulado)', () => {
  const pki = createTestPki();
  const clientPem = toPem(pki.clientPfx);
  let stub: SefinStubServer;
  let baseUrl: string;
  let http: SefinMtlsHttp;

  const originalEnv: Record<string, string | undefined> = {};

  function captureEnv(names: string[]) {
    for (const name of names) originalEnv[name] = process.env[name];
  }

  function restoreEnv(names: string[]) {
    for (const name of names) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }

  beforeAll(async () => {
    captureEnv(['SEFIN_BASE_URL', 'SEFIN_VERIFY_CERT', 'SEFIN_NFSE_ENVELOPE', 'SEFIN_TP_AMB']);
    stub = new SefinStubServer(pki, CHAVE);
    baseUrl = await stub.start();
    http = new SefinMtlsHttp();
  });

  afterAll(async () => {
    await stub.close();
    restoreEnv(['SEFIN_BASE_URL', 'SEFIN_VERIFY_CERT', 'SEFIN_NFSE_ENVELOPE', 'SEFIN_TP_AMB']);
  });

  beforeEach(() => {
    delete process.env.SEFIN_NFSE_ENVELOPE;
    delete process.env.SEFIN_TP_AMB;
    process.env.SEFIN_BASE_URL = baseUrl;
    process.env.SEFIN_VERIFY_CERT = 'false';
  });

  it('realiza handshake TLS com certificado de cliente e o stub valida o CN do cliente', async () => {
    const dpsXml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="DPS${'3'.repeat(42)}"><serie>00001</serie><nDPS>1</nDPS></infDPS></DPS>`;

    const response = await http.request({
      method: 'POST',
      path: '/nfse',
      cert: clientPem,
      body: dpsXml,
      contentType: 'application/xml',
    });

    expect(response.status).toBe(200);
    expect(response.text).toContain(`Id="${CHAVE}"`);
    expect(stub.requests).toHaveLength(1);
    expect(stub.requests[0].clientCertCn).toBe('ZERA SEFIN TESTE');
    expect(stub.requests[0].body).toContain('DPS');
  });

  it('exige certificado de cliente: request sem cert é rejeitado pelo servidor', async () => {
    await expect(
      new Promise<void>((resolve, reject) => {
        const req = https.request(
          `${baseUrl}/nfse`,
          {
            method: 'GET',
            rejectUnauthorized: false,
          },
          (res) => {
            res.resume();
            if ((res.statusCode ?? 0) < 400) {
              reject(new Error(`esperado erro por falta de client cert, status=${res.statusCode}`));
              return;
            }
            resolve();
          },
        );
        req.on('error', () => resolve());
        req.end();
      }),
    ).resolves.toBeUndefined();
  });

  it('GET /dps/{dpsId} devolve a chave de acesso gerada no POST /nfse', async () => {
    const dpsId = `DPS${'4'.repeat(42)}`;
    const dpsXml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="${dpsId}"><serie>00001</serie><nDPS>1</nDPS></infDPS></DPS>`;

    await http.request({
      method: 'POST',
      path: '/nfse',
      cert: clientPem,
      body: dpsXml,
      contentType: 'application/xml',
    });

    const response = await http.request({ method: 'GET', path: `/dps/${dpsId}`, cert: clientPem });
    expect(response.status).toBe(200);
    expect(response.json.chaveAcesso).toBe(CHAVE);
  });

  it('SEFIN_VERIFY_CERT=true contra cert autofirmado falha com SEFIN_CERT_VERIFY_FAILED', async () => {
    process.env.SEFIN_VERIFY_CERT = 'true';

    await expect(
      http.request({ method: 'GET', path: '/dps/inexistente', cert: clientPem }),
    ).rejects.toMatchObject({ code: 'SEFIN_CERT_VERIFY_FAILED' });
  });

  it('POST /nfse/{chave}/eventos registra evento e101101 via mTLS real', async () => {
    const eventoXml = buildPedidoCancelamentoAssinado(
      {
        chave: CHAVE,
        motivo: 'Cancelamento a pedido do Prestador',
        tpAmb: '2',
        verAplic: 'ZERA-1.0',
      },
      toPem(pki.clientPfx),
    );

    const response = await http.registrarEvento({ chave: CHAVE, body: eventoXml, cert: clientPem });

    expect(response.status).toBe(200);
    expect(response.text).toContain('<cStat>100</cStat>');
    expect(response.text).toContain('<nProt>');
    expect(response.text).toContain('<e101101>');

    const post = stub.requests.find(
      (r) => r.method === 'POST' && r.path === `/nfse/${CHAVE}/eventos`,
    );
    expect(post).toBeDefined();
    expect(post?.body).toContain('<ds:Signature');
    expect(post?.clientCertCn).toBe('ZERA SEFIN TESTE');
  });

  it('GET /nfse/{chave}/eventos devolve o evento e101101 registrado', async () => {
    await http.registrarEvento({
      chave: CHAVE,
      body: buildPedidoCancelamentoAssinado(
        { chave: CHAVE, motivo: 'Cancelamento a pedido do Prestador' },
        toPem(pki.clientPfx),
      ),
      cert: clientPem,
    });

    const response = await http.consultarEventos({ chave: CHAVE, cert: clientPem });

    expect(response.status).toBe(200);
    expect(response.text).toContain('<e101101>');
    expect(response.text).toContain('<nProt>');
  });

  it('GET eventos de NFS-e já cancelada (NFS7..) devolve e101101', async () => {
    const response = await http.consultarEventos({ chave: CHAVE_CANCELADA, cert: clientPem });
    expect(response.status).toBe(200);
    expect(response.text).toContain('<e101101>');
  });

  it('POST evento de NFS-e inexistente (NFS8..) retorna 404', async () => {
    await expect(
      http.registrarEvento({ chave: CHAVE_INEXISTENTE, body: '<pedRegEvento/>', cert: clientPem }),
    ).rejects.toMatchObject({ code: 'SEFIN_HTTP_ERROR', status: 404 });
  });

  it('POST evento de NFS-e não cancelável (NFS9..) retorna 400 com cStat 600', async () => {
    await expect(
      http.registrarEvento({
        chave: CHAVE_NAO_CANCELAVEL,
        body: '<pedRegEvento/>',
        cert: clientPem,
      }),
    ).rejects.toMatchObject({ code: 'SEFIN_HTTP_ERROR', status: 400 });
  });
});

describe('LobonotasProvider ponta a ponta via mTLS real (stub SEFIN)', () => {
  const pki = createTestPki();
  const clientPem = toPem(pki.clientPfx);
  let stub: SefinStubServer;
  let baseUrl: string;
  let provider: LobonotasProvider;

  const empresasService = {
    obterMaterialCertificado: jest.fn(),
    reservarNumeracaoDps: jest.fn(),
  } as unknown as EmpresasService;

  const repository = {
    findByExternalId: jest.fn(),
  } as unknown as NfseEmissionRepository;

  const originalEnv: Record<string, string | undefined> = {};

  function captureEnv(names: string[]) {
    for (const name of names) originalEnv[name] = process.env[name];
  }

  function restoreEnv(names: string[]) {
    for (const name of names) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
  }

  beforeAll(async () => {
    captureEnv([
      'SEFIN_BASE_URL',
      'SEFIN_VERIFY_CERT',
      'SEFIN_NFSE_ENVELOPE',
      'SEFIN_TP_AMB',
      'SEFIN_DPS_SERIE',
      'SEFIN_CMUN_IBGE',
      'SEFIN_CODIGO_TRIBUTACAO_NACIONAL',
    ]);
    stub = new SefinStubServer(pki, CHAVE);
    baseUrl = await stub.start();
  });

  afterAll(async () => {
    await stub.close();
    restoreEnv([
      'SEFIN_BASE_URL',
      'SEFIN_VERIFY_CERT',
      'SEFIN_NFSE_ENVELOPE',
      'SEFIN_TP_AMB',
      'SEFIN_DPS_SERIE',
      'SEFIN_CMUN_IBGE',
      'SEFIN_CODIGO_TRIBUTACAO_NACIONAL',
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SEFIN_NFSE_ENVELOPE;
    delete process.env.SEFIN_TP_AMB;
    delete process.env.SEFIN_DPS_SERIE;
    delete process.env.SEFIN_CMUN_IBGE;
    delete process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL;
    process.env.SEFIN_BASE_URL = baseUrl;
    process.env.SEFIN_VERIFY_CERT = 'false';

    empresasService.obterMaterialCertificado.mockResolvedValue(pki.clientPfx);
    empresasService.reservarNumeracaoDps.mockResolvedValue({ serie: '1', nDPS: '1' });
    repository.findByExternalId.mockResolvedValue({ empresaCnpj: '43521115000134' });

    provider = new LobonotasProvider(empresasService, new SefinMtlsHttp(), repository);
  });

  it('emite DPS assinada por POST /nfse via mTLS real e retorna AUTHORIZED + chave', async () => {
    const result = await provider.emitirNfse({
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
        iss: { retido: false },
      },
      referenciaExterna: 'sefin-stub-e2e-1',
    } as any);

    expect(result.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(result.externalId).toBe(CHAVE);
    expect(result.providerResponse.chaveAcesso).toBe(CHAVE);

    const post = stub.requests.find((r) => r.method === 'POST' && r.path === '/nfse');
    expect(post).toBeDefined();
    const envelope = JSON.parse(post!.body);
    const dpsXml = gzipBase64ToXml(envelope.dpsXmlGZipB64);
    expect(dpsXml).toContain('<ds:Signature');
    expect(post?.clientCertCn).toBe('ZERA SEFIN TESTE');
  });

  it('consulta reconcilia DPS id -> chave via GET /dps e depois GET /nfse/{chave}', async () => {
    const dpsId = `DPS${'5'.repeat(42)}`;
    const dpsXml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01"><infDPS Id="${dpsId}"><serie>00001</serie><nDPS>1</nDPS></infDPS></DPS>`;
    await new SefinMtlsHttp().request({
      method: 'POST',
      path: '/nfse',
      cert: clientPem,
      body: dpsXml,
      contentType: 'application/xml',
    });

    const { status, providerResponse } = await provider.consultarNfse(dpsId);

    expect(status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(providerResponse.chaveAcesso).toBe(CHAVE);

    const paths = stub.requests.filter((r) => r.method === 'GET').map((r) => r.path);
    expect(paths).toContain(`/dps/${dpsId}`);
    expect(paths).toContain(`/nfse/${CHAVE}`);
  });

  it('solicita cancelamento ponta a ponta: evento assinado + protocolo = chave', async () => {
    const result = await provider.solicitarCancelamentoNfse(CHAVE, {
      codigo: '1',
      motivo: 'Cancelamento a pedido do Prestador',
    });

    expect(result.protocol).toBe(CHAVE);
    expect(result.providerResponse.aceito).toBe(true);
    expect(result.providerResponse.cStat).toBe('100');
    expect(result.providerResponse.nProt).toMatch(/^\d{15}$/);

    const post = stub.requests.find(
      (r) => r.method === 'POST' && r.path === `/nfse/${CHAVE}/eventos`,
    );
    const eventoXml = gzipBase64ToXml(
      JSON.parse(post!.body).pedidoRegistroEventoXmlGZipB64 as string,
    );
    expect(eventoXml).toContain('<ds:Signature');
    expect(post?.clientCertCn).toBe('ZERA SEFIN TESTE');
  });

  it('consulta cancelamento ponta a ponta devolve CANCELED após registrar evento', async () => {
    await provider.solicitarCancelamentoNfse(CHAVE, { codigo: '1', motivo: 'x' });

    const { status, providerResponse } = await provider.consultarSolicitacaoCancelamentoNfse(CHAVE);

    expect(status).toBe(NfseEmissionStatus.CANCELED);
    expect(providerResponse.chaveAcesso).toBe(CHAVE);
    expect(providerResponse.eventos[0].tipoEvento).toBe('e101101');
  });

  it('consulta NFS-e já cancelada (NFS7..) devolve CANCELED', async () => {
    const { status, providerResponse } = await provider.consultarNfse(CHAVE_CANCELADA);
    expect(status).toBe(NfseEmissionStatus.CANCELED);
    expect(providerResponse.chaveAcesso).toBe(CHAVE_CANCELADA);
  });

  it('cancelamento de NFS-e não cancelável (NFS9..) devolve protocol=null sem lançar', async () => {
    const result = await provider.solicitarCancelamentoNfse(CHAVE_NAO_CANCELAVEL, {
      codigo: '9',
      motivo: 'x',
    });
    expect(result.protocol).toBeNull();
    expect(result.providerResponse).toEqual(
      expect.objectContaining({ cStat: '600', aceito: false }),
    );
  });
});
