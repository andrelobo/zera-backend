import { WebhooksController } from './webhooks.controller';

describe('WebhooksController', () => {
  const handler = {
    handle: jest.fn(),
  };

  let controller: WebhooksController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhooksController(handler as any);
  });

  it('delegates payload and headers to handler', async () => {
    handler.handle.mockResolvedValue({
      received: true,
      ok: true,
      externalId: 'ext-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: 'AUTHORIZED',
    });

    const payload = { externalId: 'ext-1', status: 'AUTORIZADO' };
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: true,
      externalId: 'ext-1',
      providerStatus: 'AUTORIZADO',
      mappedStatus: 'AUTHORIZED',
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });

  it('preserves explicit no-match webhook result from handler', async () => {
    handler.handle.mockResolvedValue({
      received: true,
      ok: false,
      reason: 'emission_not_found_or_not_eligible',
      externalId: 'ext-missing',
      providerStatus: 'AUTORIZADO',
      mappedStatus: 'AUTHORIZED',
    });

    const payload = { externalId: 'ext-missing', status: 'AUTORIZADO' };
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: false,
      reason: 'emission_not_found_or_not_eligible',
      externalId: 'ext-missing',
      providerStatus: 'AUTORIZADO',
      mappedStatus: 'AUTHORIZED',
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });

  it('forwards array payloads without reshaping them', async () => {
    handler.handle.mockResolvedValue({
      received: true,
      ok: true,
      batch: true,
      totalReceived: 2,
      okCount: 2,
      failedCount: 0,
      results: [
        {
          ok: true,
          externalId: 'ext-array-1',
          providerStatus: 'AUTORIZADO',
          mappedStatus: 'AUTHORIZED',
          matchedCount: 1,
          modifiedCount: 1,
        },
        {
          ok: true,
          externalId: 'ext-array-2',
          providerStatus: 'REJEITADA',
          mappedStatus: 'REJECTED',
          matchedCount: 1,
          modifiedCount: 1,
        },
      ],
    });

    const payload = [
      { externalId: 'ext-array-1', status: 'AUTORIZADO' },
      { externalId: 'ext-array-2', status: 'REJEITADA' },
    ];
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: true,
      batch: true,
      totalReceived: 2,
      okCount: 2,
      failedCount: 0,
      results: [
        {
          ok: true,
          externalId: 'ext-array-1',
          providerStatus: 'AUTORIZADO',
          mappedStatus: 'AUTHORIZED',
          matchedCount: 1,
          modifiedCount: 1,
        },
        {
          ok: true,
          externalId: 'ext-array-2',
          providerStatus: 'REJEITADA',
          mappedStatus: 'REJECTED',
          matchedCount: 1,
          modifiedCount: 1,
        },
      ],
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });
});
