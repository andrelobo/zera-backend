import { Logger } from '@nestjs/common';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  const emissions = {
    updateByExternalId: jest.fn(),
  };

  let service: WebhooksService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhooksService(emissions as any);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('updates emission as authorized when payload contains concluded status', async () => {
    emissions.updateByExternalId.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const payload = {
      externalId: 'ext-1',
      status: 'AUTORIZADO',
      idNota: 'nota-1',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: true,
      externalId: 'ext-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: NfseEmissionStatus.AUTHORIZED,
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'ext-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
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
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
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
      status: NfseEmissionStatus.PENDING,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: expect.any(Date),
      lastUpdateSource: 'webhook',
    });
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
});
