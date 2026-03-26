import { Logger } from '@nestjs/common';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  const emissions = {
    updateByExternalId: jest.fn(),
    findByExternalId: jest.fn(),
  };
  const syncArtifacts = {
    execute: jest.fn(),
  };

  let service: WebhooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhooksService(emissions as any, syncArtifacts as any);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates emission as authorized when payload contains concluded status', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = {
      externalId: 'ext-1',
      status: 'AUTORIZADO',
      idNota: 'nota-1',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'nota-1',
      matchedBy: 'ext-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: true,
        found: true,
        synced: true,
        reason: 'ok',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'ext-1',
      resolvedExternalId: 'nota-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
    expect(syncArtifacts.execute).toHaveBeenCalledWith({
      emissionId: 'emission-1',
      requestedBy: 'webhook',
      ip: null,
    });
  });

  it('extracts externalId from nested documents payload', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const payload = {
      retorno: { situacao: 'REJEITADA' },
      documents: [{ idNota: 'nota-doc-1' }],
    };

    await service.handleFiscalWebhook(payload);

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'nota-doc-1',
      resolvedExternalId: 'nota-doc-1',
      status: NfseEmissionStatus.REJECTED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
  });

  it('extracts externalId from nested documents protocol payload', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const payload = {
      status: 'AUTORIZADO',
      documents: [{ protocol: 'nota-doc-protocol-1' }],
    };

    await service.handleFiscalWebhook(payload);

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'nota-doc-protocol-1',
      resolvedExternalId: 'nota-doc-protocol-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
  });

  it('tries idIntegracao before protocol when both are present in the webhook payload', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-protocol-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = {
      id: 'nota-id-1',
      protocol: 'nota-protocol-1',
      idIntegracao: 'nfse-front-1',
      status: 'AUTORIZADO',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'nota-protocol-1',
      matchedBy: 'nfse-front-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: true,
        found: true,
        synced: true,
        reason: 'ok',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'nfse-front-1',
      resolvedExternalId: 'nota-protocol-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
  });

  it('falls back from idIntegracao to protocol when the first candidate does not match', async () => {
    emissions.updateByExternalId
      .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 })
      .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-doc-protocol-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = {
      status: 'AUTORIZADO',
      protocol: 'nota-doc-protocol-1',
      idIntegracao: 'nfse-front-2',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'nota-doc-protocol-1',
      matchedBy: 'nota-doc-protocol-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: true,
        found: true,
        synced: true,
        reason: 'ok',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(emissions.updateByExternalId).toHaveBeenNthCalledWith(1, {
      externalId: 'nfse-front-2',
      resolvedExternalId: 'nota-doc-protocol-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
    expect(emissions.updateByExternalId).toHaveBeenNthCalledWith(2, {
      externalId: 'nota-doc-protocol-1',
      resolvedExternalId: 'nota-doc-protocol-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
  });

  it('matches a real PlugNotas-like payload by idIntegracao and persists protocol as externalId', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-real-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = [
      {
        idIntegracao: 'nfse-front-1774545464662',
        protocol: '15ad0e5f-27a0-440e-98ea-798c1268a394',
        id: '69c56a57caa084c60d18af73',
        status: 'CONCLUIDO',
        retorno: {
          situacao: 'AUTORIZADA',
          numeroNfse: '31',
        },
        dps: {
          numero: 44,
          serie: '01',
        },
      },
    ];

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: '15ad0e5f-27a0-440e-98ea-798c1268a394',
      matchedBy: 'nfse-front-1774545464662',
      providerStatus: 'AUTORIZADA',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: true,
        found: true,
        synced: true,
        reason: 'ok',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'nfse-front-1774545464662',
      resolvedExternalId: '15ad0e5f-27a0-440e-98ea-798c1268a394',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload[0],
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
    expect(syncArtifacts.execute).toHaveBeenCalledWith({
      emissionId: 'emission-real-1',
      requestedBy: 'webhook',
      ip: null,
    });
  });

  it('processes single-item array payload using the item status and externalId', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-array-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = [{ externalId: 'ext-array-1', status: 'AUTORIZADO' }];

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'ext-array-1',
      matchedBy: 'ext-array-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: true,
        found: true,
        synced: true,
        reason: 'ok',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });
  });

  it('processes multi-item array payloads as a batch', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-batch-1' } });
    syncArtifacts.execute.mockResolvedValue({ found: true, synced: true, reason: 'ok' });

    const payload = [
      { externalId: 'ext-batch-1', status: 'AUTORIZADO' },
      { externalId: 'ext-batch-2', status: 'REJEITADA' },
    ];

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      batch: true,
      totalReceived: 2,
      okCount: 2,
      failedCount: 0,
      results: [
        {
          ok: true,
          externalId: 'ext-batch-1',
          matchedBy: 'ext-batch-1',
          providerStatus: 'AUTORIZADO',
          mappedStatus: NfseEmissionStatus.AUTHORIZED,
          artifactSync: {
            ok: true,
            found: true,
            synced: true,
            reason: 'ok',
          },
          matchedCount: 1,
          modifiedCount: 1,
        },
        {
          ok: true,
          externalId: 'ext-batch-2',
          matchedBy: 'ext-batch-2',
          providerStatus: 'REJEITADA',
          mappedStatus: NfseEmissionStatus.REJECTED,
          artifactSync: null,
          matchedCount: 1,
          modifiedCount: 1,
        },
      ],
    });
  });

  it('keeps pending when payload status is unknown', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const payload = {
      externalId: 'ext-pending',
      status: 'PROCESSANDO',
    };

    await service.handleFiscalWebhook(payload);

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'ext-pending',
      resolvedExternalId: undefined,
      status: NfseEmissionStatus.PENDING,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
    expect(syncArtifacts.execute).not.toHaveBeenCalled();
  });

  it('ignores payload without externalId', async () => {
    const payload = {
      status: 'AUTORIZADO',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: false,
      reason: 'externalId_not_found',
      externalId: null,
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
    });

    expect(emissions.updateByExternalId).not.toHaveBeenCalled();
  });

  it('returns not eligible when no emission matches the webhook update', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });

    const payload = {
      externalId: 'ext-missing',
      status: 'AUTORIZADO',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: false,
      reason: 'emission_not_found_or_not_eligible',
      externalId: 'ext-missing',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
    });
  });

  it('preserves webhook success when artifact sync fails', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    emissions.findByExternalId.mockResolvedValue({ _id: { toString: () => 'emission-2' } });
    syncArtifacts.execute.mockRejectedValue(new Error('provider timeout'));

    const payload = {
      externalId: 'ext-artifacts-1',
      status: 'AUTORIZADO',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'ext-artifacts-1',
      matchedBy: 'ext-artifacts-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      artifactSync: {
        ok: false,
        reason: 'artifact_sync_failed',
        message: 'provider timeout',
      },
      matchedCount: 1,
      modifiedCount: 1,
    });
  });
});
