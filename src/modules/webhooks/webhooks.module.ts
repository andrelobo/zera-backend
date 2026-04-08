import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookHandler } from './handlers/webhook.handler';
import { WebhookDeliveryAuditRepository } from './webhook-delivery-audit.repository';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import {
  NfseEmission,
  NfseEmissionSchema,
} from '../../fiscal/infra/mongo/schemas/nfse-emission.schema';
import { FiscalModule } from '../fiscal/fiscal.module';
import {
  WebhookDeliveryAudit,
  WebhookDeliveryAuditSchema,
} from './schemas/webhook-delivery-audit.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfseEmission.name, schema: NfseEmissionSchema },
      { name: WebhookDeliveryAudit.name, schema: WebhookDeliveryAuditSchema },
    ]),
    FiscalModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookHandler, NfseEmissionRepository, WebhookDeliveryAuditRepository],
})
export class WebhooksModule {}
