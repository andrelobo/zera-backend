import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { WebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'
import { WebhookHandler } from './handlers/webhook.handler'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmission, NfseEmissionSchema } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfseEmission.name, schema: NfseEmissionSchema },
    ]),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookHandler,
    NfseEmissionRepository,
  ],
})
export class WebhooksModule {}
