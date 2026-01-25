import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { EmpresasController } from './empresas.controller'
import { EmpresasService } from './empresas.service'
import { Empresa, EmpresaSchema } from './schemas/empresa.schema'
import { NuvemFiscalAuthService } from '../../fiscal/infra/nuvemfiscal/nuvemfiscal.auth.service'
import { NuvemFiscalHttp } from '../../fiscal/infra/nuvemfiscal/nuvemfiscal.http'
import { CnpjApi } from '../../fiscal/infra/nuvemfiscal/cnpj.api'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Empresa.name, schema: EmpresaSchema }]),
  ],
  controllers: [EmpresasController],
  providers: [EmpresasService, NuvemFiscalAuthService, NuvemFiscalHttp, CnpjApi],
  exports: [EmpresasService],
})
export class EmpresasModule {}
