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
    handler.handle.mockResolvedValue({ received: true, ok: true });

    const payload = { externalId: 'ext-1', status: 'AUTORIZADO' };
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: true,
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });

  it('preserves explicit no-match webhook result from handler', async () => {
    handler.handle.mockResolvedValue({
      received: true,
      ok: false,
      reason: 'emission_not_found_or_not_eligible',
    });

    const payload = { externalId: 'ext-missing', status: 'AUTORIZADO' };
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: false,
      reason: 'emission_not_found_or_not_eligible',
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });

  it('forwards array payloads without reshaping them', async () => {
    handler.handle.mockResolvedValue({
      received: true,
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
    });

    const payload = [{ externalId: 'ext-array-1', status: 'AUTORIZADO' }];
    const headers = { 'x-webhook-token': 'segredo' };

    await expect(controller.receive(payload, headers)).resolves.toEqual({
      received: true,
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
    });

    expect(handler.handle).toHaveBeenCalledWith(payload, headers);
  });
});
