import { Controller, Post, Body, Headers } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { WebhookHandler } from './handlers/webhook.handler'

@ApiTags('webhooks')
@Controller('webhooks/fiscal')
export class WebhooksController {
  constructor(
    private readonly handler: WebhookHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Receive fiscal provider webhooks' })
  async receive(
    @Body() payload: any,
    @Headers() headers: any,
  ) {
    return this.handler.handle(payload, headers)
  }
}
