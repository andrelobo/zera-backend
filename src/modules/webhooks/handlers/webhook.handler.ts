import { Injectable, Logger } from '@nestjs/common'
import { WebhooksService } from '../webhooks.service'

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name)

  constructor(
    private readonly webhooksService: WebhooksService,
  ) {}

  async handle(payload: any, headers: any) {
    this.logger.log('Webhook fiscal recebido', {
      hasExternalId: !!payload?.externalId,
      status: payload?.status,
    })

    await this.webhooksService.handleFiscalWebhook(payload)

    return { received: true }
  }
}
