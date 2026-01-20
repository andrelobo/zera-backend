import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { FiscalController } from './fiscal.controller'

import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { PollNfseStatusService } from '../../fiscal/application/poll-nfse-status.service'
import { PollNfseStatusRunner } from '../../fiscal/application/poll-nfse-status.runner'
import { NuvemFiscalProvider } from '../../fiscal/infra/nuvemfiscal.provider'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmission, NfseEmissionSchema } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'
import { NuvemFiscalAuthService } from '../../fiscal/infra/nuvemfiscal/nuvemfiscal.auth.service'
import { NuvemFiscalHttp } from '../../fiscal/infra/nuvemfiscal/nuvemfiscal.http'
import { NfseApi } from '../../fiscal/infra/nuvemfiscal/nfse.api'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NfseEmission.name, schema: NfseEmissionSchema }]),
  ],
  controllers: [FiscalController],
  providers: [
    NfseEmissionRepository,
    EmitirNfseService,
    PollNfseStatusService,
    PollNfseStatusRunner,
    NuvemFiscalAuthService,
    NuvemFiscalHttp,
    NfseApi,
    {
      provide: 'FiscalProvider',
      useClass: NuvemFiscalProvider,
    },
  ],
  exports: [EmitirNfseService, PollNfseStatusService],
})
export class FiscalModule {}
