import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { EmpresasController } from './empresas.controller'
import { EmpresasService } from './empresas.service'
import { Empresa, EmpresaSchema } from './schemas/empresa.schema'
import { PlugNotasHttp } from '../../fiscal/infra/plugnotas/plugnotas.http'
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Empresa.name, schema: EmpresaSchema }]),
  ],
  controllers: [EmpresasController],
  providers: [EmpresasService, PlugNotasHttp, PlugNotasCnpjApi],
  exports: [EmpresasService],
})
export class EmpresasModule {}
