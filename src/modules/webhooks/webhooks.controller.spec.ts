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
});
