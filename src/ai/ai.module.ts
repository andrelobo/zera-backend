import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NfseEmissionRepository } from '../fiscal/infra/mongo/repositories/nfse-emission.repository';
import { NfseEmission, NfseEmissionSchema } from '../fiscal/infra/mongo/schemas/nfse-emission.schema';
import { WebhookDeliveryAuditRepository } from '../modules/webhooks/webhook-delivery-audit.repository';
import {
  WebhookDeliveryAudit,
  WebhookDeliveryAuditSchema,
} from '../modules/webhooks/schemas/webhook-delivery-audit.schema';
import { DiagnoseAgent } from './agents/diagnose.agent';
import { AiController } from './ai.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfseEmission.name, schema: NfseEmissionSchema },
      { name: WebhookDeliveryAudit.name, schema: WebhookDeliveryAuditSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [DiagnoseAgent, NfseEmissionRepository, WebhookDeliveryAuditRepository],
})
export class AiModule {}
