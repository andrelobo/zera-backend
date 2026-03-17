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
    const payload = {
      externalId: 'ext-1',
      status: 'AUTORIZADO',
      idNota: 'nota-1',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({ ok: true });

    expect(emissions.updateByExternalId).toHaveBeenCalledWith({
      externalId: 'ext-1',
      status: NfseEmissionStatus.AUTHORIZED,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
    });
  });

  it('extracts externalId from nested documents payload', async () => {
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
    });
  });

  it('keeps pending when payload status is unknown', async () => {
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
    });
  });

  it('ignores payload without externalId', async () => {
    const payload = {
      status: 'AUTORIZADO',
    };

    await expect(service.handleFiscalWebhook(payload)).resolves.toEqual({
      ok: false,
      reason: 'externalId_not_found',
    });

    expect(emissions.updateByExternalId).not.toHaveBeenCalled();
  });
});
