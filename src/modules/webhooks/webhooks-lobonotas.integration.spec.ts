import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service';
import { FiscalProviderResolver } from '../../fiscal/application/fiscal-provider.resolver';
import { ProviderDocumentParsers } from '../../fiscal/domain/provider-document-parsers';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { InMemoryNfseModel } from '../../fiscal/test-fixtures/in-memory-nfse-model';
import { createTestCert } from '../../fiscal/test-fixtures/test-cert';
import { goldenEmitirNfseInput } from '../../fiscal/test-fixtures/emitir-nfse.golden';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import { LobonotasConfig } from '../../fiscal/infra/sefin/lobonotas.config';
import { LobonotasProvider } from '../../fiscal/infra/sefin/sefin.provider';
import { SefinMtlsHttp } from '../../fiscal/infra/sefin/sefin-mtls.http';
import { WebhooksService } from './webhooks.service';

const CHAVE = `NFS${'1'.repeat(50)}`;

describe('LO BONOTAS integration: emissao piloto -> webhook forwarder -> AUTORIZADA', () => {
  let model: InMemoryNfseModel;
  let repository: NfseEmissionRepository;
  let http: { request: jest.Mock };
  let emitirService: EmitirNfseService;
  let webhooksService: WebhooksService;
  let empresasService: any;
  const cert = createTestCert();

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

  beforeAll(() => {
    captureEnv([
      'LOBONOTAS_PILOT_ENABLED',
      'LOBONOTAS_CNPJS_MANAUS',
      'SEFIN_NFSE_ENVELOPE',
      'SEFIN_TP_AMB',
      'SEFIN_DPS_SERIE',
      'SEFIN_CMUN_IBGE',
      'SEFIN_CODIGO_TRIBUTACAO_NACIONAL',
      'SEFIN_VERIFY_CERT',
      'FISCAL_PROVIDER_ACTIVE',
      'SEFIN_ENABLED',
    ]);
  });

  afterAll(() => {
    restoreEnv([
      'LOBONOTAS_PILOT_ENABLED',
      'LOBONOTAS_CNPJS_MANAUS',
      'SEFIN_NFSE_ENVELOPE',
      'SEFIN_TP_AMB',
      'SEFIN_DPS_SERIE',
      'SEFIN_CMUN_IBGE',
      'SEFIN_CODIGO_TRIBUTACAO_NACIONAL',
      'SEFIN_VERIFY_CERT',
      'FISCAL_PROVIDER_ACTIVE',
      'SEFIN_ENABLED',
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SEFIN_NFSE_ENVELOPE;
    delete process.env.SEFIN_TP_AMB;
    delete process.env.SEFIN_DPS_SERIE;
    delete process.env.SEFIN_CMUN_IBGE;
    delete process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL;
    delete process.env.SEFIN_VERIFY_CERT;
    process.env.LOBONOTAS_PILOT_ENABLED = 'true';
    process.env.LOBONOTAS_CNPJS_MANAUS = '43521115000134';
    delete process.env.FISCAL_PROVIDER_ACTIVE;
    delete process.env.SEFIN_ENABLED;

    model = new InMemoryNfseModel();
    repository = new NfseEmissionRepository(model as any, new ProviderDocumentParsers());

    empresasService = {
      getByCnpj: jest.fn().mockResolvedValue({
        cnpj: '43521115000134',
        certificado: { uploadedAt: new Date() },
      }),
      getCadastroResumoByCnpj: jest.fn().mockResolvedValue({
        statusCadastro: 'COMPLETO',
        prontoParaEmitir: true,
        percentualCompletude: 100,
        camposFaltantes: [],
        camposFaltantesEmissao: [],
      }),
      obterMaterialCertificado: jest.fn().mockResolvedValue({
        pfxBase64: cert.pfxBase64,
        password: cert.password,
      }),
      reservarNumeracaoDps: jest.fn().mockResolvedValue({ serie: '1', nDPS: '1' }),
    };
    const tomadoresService = {
      upsertFromEmission: jest.fn().mockResolvedValue(null),
    };

    http = {
      request: jest.fn().mockRejectedValue({
        code: 'SEFIN_REQUEST_TIMEOUT',
        message: 'Sefin HTTP timeout after 30000ms',
      }),
    };

    const lobonotasProvider = new LobonotasProvider(
      empresasService as any,
      http as unknown as SefinMtlsHttp,
      repository,
    );
    const plugNotasStub = {
      providerName: 'PLUGNOTAS',
      emitirNfse: jest.fn(),
      consultarNfse: jest.fn(),
      baixarXmlNfse: jest.fn(),
      baixarPdfNfse: jest.fn(),
      solicitarCancelamentoNfse: jest.fn(),
    } as any;
    const resolver = new FiscalProviderResolver(
      plugNotasStub,
      lobonotasProvider,
      new LobonotasConfig(),
    );

    emitirService = new EmitirNfseService(
      resolver.resolve(),
      repository,
      empresasService,
      tomadoresService,
      resolver,
    );

    webhooksService = new WebhooksService(
      repository,
      {
        execute: jest.fn().mockResolvedValue({ found: true, synced: true, reason: 'ok' }),
      } as any,
      new ProviderDocumentParsers(),
    );
  });

  it('emite DPS do piloto (LOBONOTAS), fica PENDING e webhook forwarder autoriza', async () => {
    const input = structuredClone(goldenEmitirNfseInput);
    input.referenciaExterna = 'lobonotas-webhook-e2e-001';

    const output = await emitirService.execute(input as any);

    expect(output.result.provider).toBe('LOBONOTAS');
    expect(output.result.status).toBe(NfseEmissionStatus.PENDING);
    expect(output.result.externalId).toMatch(/^DPS\d{42}$/);
    expect(empresasService.reservarNumeracaoDps).toHaveBeenCalledWith('43521115000134');
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/nfse', contentType: 'application/json' }),
    );

    const emission = await repository.findById(output.emissionId);
    expect(emission?.provider).toBe('LOBONOTAS');
    expect(emission?.status).toBe(NfseEmissionStatus.PENDING);
    expect(emission?.externalId).toBe(output.result.externalId);

    const dpsId = output.result.externalId as string;
    const webhookResult = await webhooksService.handleFiscalWebhook(
      {
        externalId: dpsId,
        status: 'AUTORIZADA',
        idNota: CHAVE,
      },
      { 'x-zera-provider': 'LOBONOTAS' },
    );

    expect(webhookResult).toEqual(
      expect.objectContaining({
        ok: true,
        providerStatus: 'AUTORIZADA',
        mappedStatus: NfseEmissionStatus.AUTHORIZED,
        matchedCount: 1,
        modifiedCount: 1,
      }),
    );

    const updated = await repository.findById(output.emissionId);
    expect(updated?.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(updated?.externalId).toBe(CHAVE);
    expect(updated?.lastUpdateSource).toBe('webhook');
    expect(updated?.lastWebhookAt).toBeInstanceOf(Date);
    expect(updated?.nextPollAt).toBeNull();
    expect(updated?.providerResponse).toEqual(
      expect.objectContaining({ idNota: CHAVE, status: 'AUTORIZADA' }),
    );
  });

  it('webhook sem identificacao de provider nao casa emissao LOBONOTAS (fail-safe PLUGNOTAS)', async () => {
    const input = structuredClone(goldenEmitirNfseInput);
    input.referenciaExterna = 'lobonotas-webhook-e2e-002';

    const output = await emitirService.execute(input as any);
    const dpsId = output.result.externalId as string;

    const webhookResult = await webhooksService.handleFiscalWebhook({
      externalId: dpsId,
      status: 'AUTORIZADA',
      idNota: CHAVE,
    });

    expect(webhookResult).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'emission_not_found_or_not_eligible',
      }),
    );

    const emission = await repository.findById(output.emissionId);
    expect(emission?.status).toBe(NfseEmissionStatus.PENDING);
    expect(emission?.lastUpdateSource).toBeUndefined();
  });

  it('webhook LOBONOTAS tambem aceita provider no payload (sem header)', async () => {
    const input = structuredClone(goldenEmitirNfseInput);
    input.referenciaExterna = 'lobonotas-webhook-e2e-003';

    const output = await emitirService.execute(input as any);
    const dpsId = output.result.externalId as string;

    const webhookResult = await webhooksService.handleFiscalWebhook({
      provider: 'LOBONOTAS',
      externalId: dpsId,
      status: 'CONCLUIDA',
      idNota: CHAVE,
    });

    expect(webhookResult).toEqual(
      expect.objectContaining({
        ok: true,
        mappedStatus: NfseEmissionStatus.AUTHORIZED,
        matchedCount: 1,
      }),
    );

    const emission = await repository.findById(output.emissionId);
    expect(emission?.status).toBe(NfseEmissionStatus.AUTHORIZED);
    expect(emission?.lastUpdateSource).toBe('webhook');
  });
});
