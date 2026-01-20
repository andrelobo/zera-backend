import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { FiscalController } from './fiscal.controller'

import { EmitirNfseService } from '../../fiscal/application/emitir-nfse.service'
import { NuvemFiscalProvider } from '../../fiscal/infra/nuvemfiscal.provider'
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
      useClass: NuvemFiscalProvider,
    },
  ],
  exports: [EmitirNfseService],
})
export class FiscalModule {}
