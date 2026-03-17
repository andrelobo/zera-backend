import { Logger, UnauthorizedException } from '@nestjs/common';
import { WebhookHandler } from './webhook.handler';

describe('WebhookHandler', () => {
  const webhooksService = {
    handleFiscalWebhook: jest.fn(),
  };

  let handler: WebhookHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new WebhookHandler(webhooksService as any);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    delete process.env.WEBHOOK_SHARED_SECRET;
    delete process.env.WEBHOOK_SHARED_SECRET_HEADER;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WEBHOOK_SHARED_SECRET;
    delete process.env.WEBHOOK_SHARED_SECRET_HEADER;
  });

  it('forwards payload when no shared secret is configured', async () => {
    webhooksService.handleFiscalWebhook.mockResolvedValue({ ok: true });

    await expect(handler.handle({ externalId: 'ext-1' }, {})).resolves.toEqual({
      received: true,
      ok: true,
    });

    expect(webhooksService.handleFiscalWebhook).toHaveBeenCalledWith({ externalId: 'ext-1' });
  });

  it('rejects webhook when shared secret header is invalid', async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    process.env.WEBHOOK_SHARED_SECRET_HEADER = 'x-custom-token';

    await expect(
      handler.handle({ externalId: 'ext-1' }, { 'x-custom-token': 'errado' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webhooksService.handleFiscalWebhook).not.toHaveBeenCalled();
  });

  it('accepts webhook when shared secret header is valid', async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    process.env.WEBHOOK_SHARED_SECRET_HEADER = 'x-custom-token';
    webhooksService.handleFiscalWebhook.mockResolvedValue({ ok: true });

    await expect(
      handler.handle({ externalId: 'ext-2', status: 'AUTORIZADO' }, { 'x-custom-token': 'segredo' }),
    ).resolves.toEqual({
      received: true,
      ok: true,
    });

    expect(webhooksService.handleFiscalWebhook).toHaveBeenCalledWith({
      externalId: 'ext-2',
      status: 'AUTORIZADO',
    });
  });
});
