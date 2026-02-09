import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { WebhooksService } from '../webhooks.service'

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name)

  constructor(
    private readonly webhooksService: WebhooksService,
  ) {}

  private requireSharedSecret(headers: any) {
    const secret = process.env.WEBHOOK_SHARED_SECRET
    if (!secret) return

    const headerName = (process.env.WEBHOOK_SHARED_SECRET_HEADER ?? 'x-webhook-token').toLowerCase()
    const received = headers?.[headerName]

    if (!received || received !== secret) {
      throw new UnauthorizedException('Invalid webhook token')
    }
  }

  async handle(payload: any, headers: any) {
    this.requireSharedSecret(headers)

    this.logger.log('Webhook fiscal recebido', {
      hasExternalId: !!payload?.externalId,
      status: payload?.status,
    })

    const result = await this.webhooksService.handleFiscalWebhook(payload)

    return { received: true, ...result }
  }
}
