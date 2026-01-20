import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  async handleFiscalWebhook(payload: any) {
    this.logger.log('Processando webhook fiscal (stub)', {
      externalId: payload?.externalId,
      status: payload?.status,
    })

    return { ok: true }
  }
}
