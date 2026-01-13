import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { FiscalController } from './fiscal.controller'

import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { PlugNotasProvider } from '../../fiscal/infra/plugnotas.provider'
import type { FiscalProvider } from '../../fiscal/domain/fiscal-provider.interface'

import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmission, NfseEmissionSchema } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NfseEmission.name, schema: NfseEmissionSchema },
    ]),
  ],
  controllers: [FiscalController],
  providers: [
    NfseEmissionRepository,
    EmitirNfseService,
    {
      provide: 'FiscalProvider',
      useClass: PlugNotasProvider,
    },
  ],
  exports: [EmitirNfseService],
})
export class FiscalModule {}
