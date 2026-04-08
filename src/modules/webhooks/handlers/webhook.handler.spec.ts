import { Logger, UnauthorizedException } from '@nestjs/common';
import { WebhookHandler } from './webhook.handler';

describe('WebhookHandler', () => {
  const webhooksService = {
    handleFiscalWebhook: jest.fn(),
  };
  const audits = {
    create: jest.fn(),
  };

  let handler: WebhookHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new WebhookHandler(webhooksService as any, audits as any);
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
    webhooksService.handleFiscalWebhook.mockResolvedValue({
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-1',
      mappedStatus: 'AUTHORIZED',
    });

    await expect(handler.handle({ externalId: 'ext-1' }, {})).resolves.toEqual({
      received: true,
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-1',
      mappedStatus: 'AUTHORIZED',
    });

    expect(webhooksService.handleFiscalWebhook).toHaveBeenCalledWith({ externalId: 'ext-1' });
    expect(audits.create).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/webhooks/fiscal',
        requestExternalId: 'ext-1',
        candidateExternalIds: ['ext-1'],
        ok: true,
        sharedSecretConfigured: false,
        tokenAccepted: null,
      }),
    );
  });

  it('rejects webhook when shared secret header is invalid', async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    process.env.WEBHOOK_SHARED_SECRET_HEADER = 'x-custom-token';

    await expect(
      handler.handle({ externalId: 'ext-1' }, { 'x-custom-token': 'errado' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(webhooksService.handleFiscalWebhook).not.toHaveBeenCalled();
    expect(audits.create).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/webhooks/fiscal',
        requestExternalId: 'ext-1',
        ok: false,
        reason: 'invalid_shared_secret',
        sharedSecretConfigured: true,
        sharedSecretHeader: 'x-custom-token',
        tokenAccepted: false,
      }),
    );
  });

  it('accepts webhook when shared secret header is valid', async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    process.env.WEBHOOK_SHARED_SECRET_HEADER = 'x-custom-token';
    webhooksService.handleFiscalWebhook.mockResolvedValue({
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-2',
      matchedBy: 'ext-2',
      mappedStatus: 'AUTHORIZED',
    });

    await expect(
      handler.handle({ externalId: 'ext-2', status: 'AUTORIZADO' }, { 'x-custom-token': 'segredo' }),
    ).resolves.toEqual({
      received: true,
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-2',
      matchedBy: 'ext-2',
      mappedStatus: 'AUTHORIZED',
    });

    expect(webhooksService.handleFiscalWebhook).toHaveBeenCalledWith({
      externalId: 'ext-2',
      status: 'AUTORIZADO',
    });
    expect(audits.create).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/webhooks/fiscal',
        requestExternalId: 'ext-2',
        ok: true,
        matchedBy: 'ext-2',
        resolvedExternalId: 'ext-2',
        mappedStatus: 'AUTHORIZED',
        tokenAccepted: true,
      }),
    );
  });

  it('accepts webhook when shared secret header arrives as array', async () => {
    process.env.WEBHOOK_SHARED_SECRET = 'segredo';
    webhooksService.handleFiscalWebhook.mockResolvedValue({
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-3',
      mappedStatus: 'AUTHORIZED',
    });

    await expect(
      handler.handle(
        { externalId: 'ext-3', status: 'AUTORIZADO' },
        { 'x-webhook-token': ['segredo'] },
      ),
    ).resolves.toEqual({
      received: true,
      ok: true,
      matchedCount: 1,
      modifiedCount: 1,
      externalId: 'ext-3',
      mappedStatus: 'AUTHORIZED',
    });
    expect(audits.create).toHaveBeenCalledWith(
      expect.objectContaining({
        requestExternalId: 'ext-3',
        tokenAccepted: true,
      }),
    );
  });
});
