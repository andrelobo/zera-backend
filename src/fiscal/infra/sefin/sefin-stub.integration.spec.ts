import * as https from 'node:https';

import { EmpresasService } from '../../../modules/empresas/empresas.service';
import { NfseEmissionStatus } from '../../domain/types/nfse-emission-status';
import { createTestPki, toPem } from '../../test-fixtures/test-cert';
import { SefinStubServer } from '../../test-fixtures/sefin-stub-server';
import { NfseEmissionRepository } from '../mongo/repositories/nfse-emission.repository';
import { SefinMtlsHttp } from './sefin-mtls.http';
import { LobonotasProvider } from './sefin.provider';

const CHAVE = `NFS${'1'.repeat(50)}`;

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
    expect(post?.body).toContain('<ds:Signature');
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
});
