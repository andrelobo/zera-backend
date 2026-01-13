import { Body, Controller, Post } from '@nestjs/common'
import { WebhooksService } from './webhooks.service'

@Controller('webhooks/fiscal')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  handle(@Body() payload: unknown) {
    return this.service.process(payload)
  }
}
