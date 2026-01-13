import { Controller, Post, Body, Headers } from '@nestjs/common'
import { WebhookHandler } from '../handlers/webhook.handler'

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly handler: WebhookHandler) {}

  @Post()
  async receive(@Body() payload: any, @Headers() headers: any) {
    return this.handler.handle(payload, headers)
  }
}
