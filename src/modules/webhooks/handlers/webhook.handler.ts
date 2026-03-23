import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { WebhooksService, extractWebhookExternalId } from '../webhooks.service';
import { extractPlugNotasStatus } from '../../../fiscal/infra/plugnotas/nfse.mapper';

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  private requireSharedSecret(headers: any) {
    const secret = process.env.WEBHOOK_SHARED_SECRET;
    if (!secret) return;

    const headerName = (
      process.env.WEBHOOK_SHARED_SECRET_HEADER ?? 'x-webhook-token'
    ).toLowerCase();
    const rawReceived = headers?.[headerName];
    const received = Array.isArray(rawReceived) ? rawReceived[0] : rawReceived;

    if (typeof received !== 'string' || received.trim() !== secret) {
      throw new UnauthorizedException('Invalid webhook token');
    }
  }

  async handle(payload: any, headers: any) {
    this.requireSharedSecret(headers);

    this.logger.log('Webhook fiscal recebido', {
      hasExternalId: !!extractWebhookExternalId(payload),
      externalId: extractWebhookExternalId(payload) ?? null,
      status: extractPlugNotasStatus(payload) ?? null,
    });

    const result = await this.webhooksService.handleFiscalWebhook(payload);

    return { received: true, ...result };
  }
}
