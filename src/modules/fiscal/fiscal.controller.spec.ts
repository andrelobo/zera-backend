import { BadRequestException } from '@nestjs/common';
import { FiscalController } from './fiscal.controller';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';

describe('FiscalController', () => {
  const emitirNfseService = { execute: jest.fn() };
  const emitirNfseQuickService = { execute: jest.fn() };
  const servicoCatalog = {
    autocomplete: jest.fn(),
    list: jest.fn(),
    findByCodigo: jest.fn(),
  };
  const syncNfseArtifactsService = { execute: jest.fn() };
  const webhookAudits = {
    getLatestByRoute: jest.fn(),
    getLatestSuccessByRoute: jest.fn(),
    getLatestFailureByRoute: jest.fn(),
  };
  const repo = {
    findPaginated: jest.fn(),
    getBiSummary: jest.fn(),
    findById: jest.fn(),
    findByExternalId: jest.fn(),
  };
  const provider = {
    getNfseByExternalId: jest.fn(),
    getDocumentById: jest.fn(),
    solicitarCancelamentoNfse: jest.fn(),
    consultarSolicitacaoCancelamentoNfse: jest.fn(),
  };

  let controller: FiscalController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FiscalController(
      emitirNfseService as any,
      emitirNfseQuickService as any,
      servicoCatalog as any,
      syncNfseArtifactsService as any,
      repo as any,
      webhookAudits as any,
      provider as any,
    );
  });

  it('throws INVALID_PAGE when page is less than 1', async () => {
    await expect(controller.list('0', '20')).rejects.toThrow(BadRequestException);
    await expect(controller.list('0', '20')).rejects.toMatchObject({
      response: { code: 'INVALID_PAGE' },
    });
  });

  it('throws INVALID_LIMIT when limit is less than 1', async () => {
    await expect(controller.list('1', '0')).rejects.toThrow(BadRequestException);
    await expect(controller.list('1', '0')).rejects.toMatchObject({
      response: { code: 'INVALID_LIMIT' },
    });
  });

  it('throws INVALID_STATUS when status is unknown', async () => {
    await expect(controller.list('1', '20', undefined, undefined, 'UNKNOWN')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.list('1', '20', undefined, undefined, 'UNKNOWN')).rejects.toMatchObject({
      response: { code: 'INVALID_STATUS' },
    });
  });

  it('forwards filters with defaults and trims provider', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [
        {
          _id: { toString: () => 'em-1' },
          provider: 'PLUGNOTAS',
          status: NfseEmissionStatus.PENDING,
          externalId: 'ext-1',
          empresaCnpj: '43521115000134',
          createdAt: new Date('2026-02-28T00:00:00.000Z'),
          updatedAt: new Date('2026-02-28T00:01:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const out = await controller.list(undefined, undefined, '  plugnotas  ', undefined, undefined, undefined, undefined);

    expect(repo.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      provider: 'plugnotas',
      empresaCnpj: undefined,
      status: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    });
    expect(out).toEqual({
      items: [
        expect.objectContaining({
          id: 'em-1',
          provider: 'PLUGNOTAS',
          status: NfseEmissionStatus.PENDING,
          externalId: 'ext-1',
          empresaCnpj: '43521115000134',
          error: null,
        }),
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });
  });

  it('accepts valid status filter and forwards enum value', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 1,
    });

    await controller.list('2', '10', undefined, undefined, NfseEmissionStatus.AUTHORIZED);

    expect(repo.findPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      provider: undefined,
      empresaCnpj: undefined,
      status: NfseEmissionStatus.AUTHORIZED,
      createdFrom: undefined,
      createdTo: undefined,
    });
  });

  it('throws INVALID_DATE_TO when dateTo is invalid', async () => {
    await expect(
      controller.list('1', '20', undefined, undefined, undefined, undefined, 'invalid'),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_DATE_TO' },
    });
  });

  it('forwards empresaCnpj filter and exposes portal nacional fields in list output', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [
        {
          _id: { toString: () => 'em-portal-1' },
          provider: 'PLUGNOTAS',
          status: NfseEmissionStatus.AUTHORIZED,
          externalId: 'ext-portal-1',
          empresaCnpj: '43521115000134',
          numeroNfse: '1001',
          dpsNum: '2002',
          serieDpsNum: '3',
          parametroIssAplicado: 'iss_proprio_municipio',
          createdAt: new Date('2026-03-20T00:00:00.000Z'),
          updatedAt: new Date('2026-03-20T00:01:00.000Z'),
        },
      ],
      total: 1,
      page: 1,
      limit: 1,
      totalPages: 1,
    });

    const out = await controller.list('1', '1', 'plugnotas', '43.521.115/0001-34');

    expect(repo.findPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 1,
      provider: 'plugnotas',
      empresaCnpj: '43521115000134',
      status: undefined,
      createdFrom: undefined,
      createdTo: undefined,
    });
    expect(out.items[0]).toEqual(
      expect.objectContaining({
        numeroNfse: '1001',
        dpsNum: '2002',
        serieDpsNum: '3',
        parametroIssAplicado: 'iss_proprio_municipio',
      }),
    );
  });

  it('forwards BI summary filters with sanitization', async () => {
    repo.getBiSummary.mockResolvedValue({
      totals: { totalEmissoes: 0 },
      retencoes: {},
      tributacaoTotal: {},
      seriesCompetencia: [],
      topServicos: [],
      topMunicipiosPrestacao: [],
      topTomadores: [],
    });

    await controller.getBiSummary(
      ' plugnotas ',
      NfseEmissionStatus.AUTHORIZED,
      '43.521.115/0001-34',
      '17.19.01',
      '2026-02-01',
      '2026-03-31',
    );

    expect(repo.getBiSummary).toHaveBeenCalledWith({
      provider: 'plugnotas',
      status: NfseEmissionStatus.AUTHORIZED,
      empresaCnpj: '43521115000134',
      codigoServico: '171901',
      createdFrom: new Date('2026-02-01'),
      createdTo: new Date('2026-03-31'),
    });
  });

  it('returns webhook diagnostics for homologation', async () => {
    delete process.env.WEBHOOK_SHARED_SECRET;
    delete process.env.WEBHOOK_SHARED_SECRET_HEADER;
    webhookAudits.getLatestByRoute.mockResolvedValue(null);
    webhookAudits.getLatestSuccessByRoute.mockResolvedValue(null);
    webhookAudits.getLatestFailureByRoute.mockResolvedValue(null);

    await expect(controller.getWebhookDiagnostico()).resolves.toEqual({
      route: '/webhooks/fiscal',
      sharedSecretConfigured: false,
      sharedSecretHeader: 'x-webhook-token',
      pollingFallbackEnabled: true,
      artifactSyncOnAuthorizedWebhook: true,
      observabilityCheck: '/nfse/:id/observability',
      providerResponseCheck: '/nfse/:id/provider-response',
      lastAudit: null,
      lastSuccess: null,
      lastFailure: null,
    });

    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    process.env.WEBHOOK_SHARED_SECRET_HEADER = 'x-custom-token';
    webhookAudits.getLatestByRoute.mockResolvedValue({
      id: 'wa-1',
      route: '/webhooks/fiscal',
      ok: false,
      reason: 'invalid_shared_secret',
      createdAt: new Date('2026-04-08T15:00:00.000Z'),
    });
    webhookAudits.getLatestSuccessByRoute.mockResolvedValue({
      id: 'wa-2',
      route: '/webhooks/fiscal',
      ok: true,
      resolvedExternalId: 'protocol-1',
      createdAt: new Date('2026-04-08T15:01:00.000Z'),
    });
    webhookAudits.getLatestFailureByRoute.mockResolvedValue({
      id: 'wa-1',
      route: '/webhooks/fiscal',
      ok: false,
      reason: 'invalid_shared_secret',
      createdAt: new Date('2026-04-08T15:00:00.000Z'),
    });

    await expect(controller.getWebhookDiagnostico()).resolves.toEqual({
      route: '/webhooks/fiscal',
      sharedSecretConfigured: true,
      sharedSecretHeader: 'x-custom-token',
      pollingFallbackEnabled: true,
      artifactSyncOnAuthorizedWebhook: true,
      observabilityCheck: '/nfse/:id/observability',
      providerResponseCheck: '/nfse/:id/provider-response',
      lastAudit: {
        id: 'wa-1',
        route: '/webhooks/fiscal',
        ok: false,
        reason: 'invalid_shared_secret',
        createdAt: new Date('2026-04-08T15:00:00.000Z'),
      },
      lastSuccess: {
        id: 'wa-2',
        route: '/webhooks/fiscal',
        ok: true,
        resolvedExternalId: 'protocol-1',
        createdAt: new Date('2026-04-08T15:01:00.000Z'),
      },
      lastFailure: {
        id: 'wa-1',
        route: '/webhooks/fiscal',
        ok: false,
        reason: 'invalid_shared_secret',
        createdAt: new Date('2026-04-08T15:00:00.000Z'),
      },
    });

    delete process.env.WEBHOOK_SHARED_SECRET;
    delete process.env.WEBHOOK_SHARED_SECRET_HEADER;
  });

  it('emits substituicao using idNota from original emission when body does not provide idNotaSubstituida', async () => {
    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-1' },
      status: NfseEmissionStatus.AUTHORIZED,
      externalId: 'ext-1',
      providerResponse: { idNota: 'nota-123' },
    });
    emitirNfseService.execute.mockResolvedValue({
      emissionId: 'em-2',
      idempotentReplay: false,
      result: { status: NfseEmissionStatus.PENDING, provider: 'PLUGNOTAS' },
    });

    const payload = {
      referenciaExterna: 'sub-001',
      prestador: {
        cnpj: '43521115000134',
        razaoSocial: 'BURGUS LTDA',
        endereco: {
          logradouro: 'R A',
          numero: '1',
          bairro: 'CENTRO',
          municipio: 'MANAUS',
          uf: 'AM',
          cep: '69010000',
        },
      },
      tomador: {
        cpfCnpj: '11144477735',
        razaoSocial: 'CLIENTE',
        endereco: {
          logradouro: 'R B',
          numero: '2',
          bairro: 'CENTRO',
          municipio: 'MANAUS',
          uf: 'AM',
          cep: '69010000',
        },
      },
      servico: {
        codigoNacional: '171901',
        descricao: 'SERVICO',
        valor: 100,
      },
    };

    await controller.emitirSubstituicao('em-1', payload as any);

    expect(emitirNfseService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        substituicao: true,
        idNotaSubstituida: 'nota-123',
      }),
    );
  });

  it('rejects substituicao when original emission is not AUTHORIZED', async () => {
    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-1' },
      status: NfseEmissionStatus.PENDING,
      providerResponse: { idNota: 'nota-123' },
    });

    await expect(
      controller.emitirSubstituicao('em-1', {
        referenciaExterna: 'sub-001',
      } as any),
    ).rejects.toMatchObject({
      response: { code: 'SUBSTITUICAO_STATUS_INVALIDO' },
    });
  });

  it('returns observability trace with timeline and provider I/O', async () => {
    const createdAt = new Date('2026-03-10T10:00:00.000Z');
    const updatedAt = new Date('2026-03-10T10:05:00.000Z');
    const lastPolledAt = new Date('2026-03-10T10:03:00.000Z');
    const lastWebhookAt = new Date('2026-03-10T10:04:00.000Z');

    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-obs-1' },
      provider: 'PLUGNOTAS',
      status: NfseEmissionStatus.AUTHORIZED,
      externalId: 'ext-obs-1',
      idempotencyKey: 'idem-obs-1',
      numeroNfse: '123',
      payload: { referenciaExterna: 'idem-obs-1' },
      biSnapshot: { localPrestacao: { municipio: 'Manaus' } },
      providerRequest: { payload: [{ idIntegracao: 'idem-obs-1' }] },
      providerResponse: [{ status: 'AUTORIZADA' }],
      xmlBase64: 'xml',
      pdfBase64: 'pdf',
      pollAttempts: 2,
      lastPolledAt,
      lastWebhookAt,
      lastUpdateSource: 'webhook',
      lastPollError: null,
      nextPollAt: null,
      artifactSyncAudit: [{ outcome: 'ok' }],
      createdAt,
      updatedAt,
    });

    const out = await controller.getObservability('em-obs-1');

    expect(out.id).toBe('em-obs-1');
    expect(out.observability.providerRequest).toEqual({ payload: [{ idIntegracao: 'idem-obs-1' }] });
    expect(out.observability.providerResponse).toEqual([{ status: 'AUTORIZADA' }]);
    expect(out.observability.poll).toEqual({
      attempts: 2,
      lastPolledAt,
      nextPollAt: null,
      lastPollError: null,
    });
    expect(out.observability.webhook).toEqual({
      lastWebhookAt,
      lastUpdateSource: 'webhook',
    });
    expect(out.observability.timeline.map((item: any) => item.type)).toEqual([
      'EMISSION_CREATED',
      'PROVIDER_REQUEST_PREPARED',
      'PROVIDER_STATUS_POLLED',
      'WEBHOOK_RECEIVED',
      'PROVIDER_EXTERNAL_ID_LINKED',
      'EMISSION_FINAL_STATUS',
    ]);
  });

  it('returns observability trace by externalId', async () => {
    const createdAt = new Date('2026-03-10T10:00:00.000Z');
    const updatedAt = new Date('2026-03-10T10:05:00.000Z');

    repo.findByExternalId.mockResolvedValue({
      _id: { toString: () => 'em-obs-ext-1' },
      provider: 'PLUGNOTAS',
      status: NfseEmissionStatus.AUTHORIZED,
      externalId: 'ext-obs-ext-1',
      idempotencyKey: 'idem-obs-ext-1',
      numeroNfse: '999',
      payload: { referenciaExterna: 'idem-obs-ext-1' },
      providerRequest: { payload: [{ idIntegracao: 'idem-obs-ext-1' }] },
      providerResponse: [{ status: 'AUTORIZADA' }],
      xmlBase64: 'xml',
      pdfBase64: 'pdf',
      createdAt,
      updatedAt,
    });

    const out = await controller.getObservabilityByExternalId('ext-obs-ext-1');

    expect(repo.findByExternalId).toHaveBeenCalledWith('ext-obs-ext-1');
    expect(out).toEqual(
      expect.objectContaining({
        id: 'em-obs-ext-1',
        externalId: 'ext-obs-ext-1',
        numeroNfse: '999',
      }),
    );
    expect(out.observability.providerResponse).toEqual([{ status: 'AUTORIZADA' }]);
  });

  it('returns local artifacts availability for an emission', async () => {
    const updatedAt = new Date('2026-03-10T10:05:00.000Z');

    repo.findById.mockResolvedValue({
      _id: { toString: () => 'em-art-1' },
      externalId: 'ext-art-1',
      status: NfseEmissionStatus.AUTHORIZED,
      xmlBase64: 'xml',
      pdfBase64: null,
      updatedAt,
    });

    const out = await controller.getArtifacts('em-art-1');

    expect(out).toEqual({
      id: 'em-art-1',
      externalId: 'ext-art-1',
      hasXml: true,
      hasPdf: false,
      status: NfseEmissionStatus.AUTHORIZED,
      updatedAt,
    });
  });
});
