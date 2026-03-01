import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api';
import { PlugNotasHttp } from '../../fiscal/infra/plugnotas/plugnotas.http';
import { EmpresasController } from './empresas.controller';
import { BrasilApiCnpjApi } from './brasilapi-cnpj.api';
import { CnpjaCnpjApi } from './cnpja-cnpj.api';
import { EmpresasService } from './empresas.service';
import { ReceitaWsCnpjApi } from './receitaws-cnpj.api';
import { Empresa, EmpresaSchema } from './schemas/empresa.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Empresa.name, schema: EmpresaSchema }])],
  controllers: [EmpresasController],
  providers: [
    EmpresasService,
    CnpjaCnpjApi,
    BrasilApiCnpjApi,
    ReceitaWsCnpjApi,
    PlugNotasHttp,
    PlugNotasCnpjApi,
  ],
  exports: [EmpresasService],
})
export class EmpresasModule {}
