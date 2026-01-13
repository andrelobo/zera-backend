import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  process(payload: unknown) {
    this.logger.log('Fiscal webhook received')
    return { received: true }
  }
}
