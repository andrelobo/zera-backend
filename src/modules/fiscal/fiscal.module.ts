import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { FiscalController } from './fiscal.controller'

import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { PollNfseStatusService } from '../../fiscal/application/poll-nfse-status.service'
import { PollNfseStatusRunner } from '../../fiscal/application/poll-nfse-status.runner'
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service'
import { PlugNotasProvider } from '../../fiscal/infra/plugnotas.provider'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmission, NfseEmissionSchema } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'
import { PlugNotasHttp } from '../../fiscal/infra/plugnotas/plugnotas.http'
import { PlugNotasNfseApi } from '../../fiscal/infra/plugnotas/nfse.api'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NfseEmission.name, schema: NfseEmissionSchema }]),
  ],
  controllers: [FiscalController],
  providers: [
    NfseEmissionRepository,
    EmitirNfseService,
    SyncNfseArtifactsService,
    PollNfseStatusService,
    PollNfseStatusRunner,
    PlugNotasHttp,
    PlugNotasNfseApi,
    {
      provide: 'FiscalProvider',
      useClass: PlugNotasProvider,
    },
  ],
  exports: [EmitirNfseService, PollNfseStatusService],
})
export class FiscalModule {}
