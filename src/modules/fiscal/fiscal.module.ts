import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FiscalController } from './fiscal.controller';

import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service';
import { EmitirNfseQuickService } from '../../fiscal/application/emitir-nfse-quick.service';
import { PollNfseStatusService } from '../../fiscal/application/poll-nfse-status.service';
import { PollNfseStatusRunner } from '../../fiscal/application/poll-nfse-status.runner';
import { ServicoCatalogService } from '../../fiscal/application/servico-catalog.service';
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service';
import { PlugNotasProvider } from '../../fiscal/infra/plugnotas.provider';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import {
  NfseEmission,
  NfseEmissionSchema,
} from '../../fiscal/infra/mongo/schemas/nfse-emission.schema';
import { PlugNotasHttp } from '../../fiscal/infra/plugnotas/plugnotas.http';
import { PlugNotasNfseApi } from '../../fiscal/infra/plugnotas/nfse.api';
import { PlugNotasPrerequisitesService } from '../../fiscal/infra/plugnotas/prerequisites.service';
import { EmpresasModule } from '../empresas/empresas.module';
import { TomadoresModule } from '../tomadores/tomadores.module';
import { WebhookDeliveryAuditRepository } from '../webhooks/webhook-delivery-audit.repository';
import {
  WebhookDeliveryAudit,
  WebhookDeliveryAuditSchema,
} from '../webhooks/schemas/webhook-delivery-audit.schema';
import { ProviderDocumentParsers } from '../../fiscal/domain/provider-document-parsers';
import { PlugNotasDocumentParser } from '../../fiscal/infra/plugnotas/plugnotas-document-parser';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfseEmission.name, schema: NfseEmissionSchema },
      { name: WebhookDeliveryAudit.name, schema: WebhookDeliveryAuditSchema },
    ]),
    EmpresasModule,
    TomadoresModule,
  ],
  controllers: [FiscalController],
  providers: [
    NfseEmissionRepository,
    {
      provide: ProviderDocumentParsers,
      useValue: new ProviderDocumentParsers([new PlugNotasDocumentParser()]),
    },
    EmitirNfseService,
    EmitirNfseQuickService,
    ServicoCatalogService,
    SyncNfseArtifactsService,
    PollNfseStatusService,
    PollNfseStatusRunner,
    PlugNotasHttp,
    PlugNotasNfseApi,
    PlugNotasPrerequisitesService,
    WebhookDeliveryAuditRepository,
    {
      provide: 'FiscalProvider',
      useClass: PlugNotasProvider,
    },
  ],
  exports: [
    EmitirNfseService,
    PollNfseStatusService,
    SyncNfseArtifactsService,
    NfseEmissionRepository,
    ProviderDocumentParsers,
  ],
})
export class FiscalModule {}
