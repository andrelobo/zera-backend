import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { PlugNotasCompanyApi } from '../../fiscal/infra/plugnotas/company.api';
import { PlugNotasCnpjApi } from '../../fiscal/infra/plugnotas/cnpj.api';
import { PlugNotasHttp } from '../../fiscal/infra/plugnotas/plugnotas.http';
import {
  NfseEmission,
  NfseEmissionSchema,
} from '../../fiscal/infra/mongo/schemas/nfse-emission.schema';
import { EmpresasController } from './empresas.controller';
import { BrasilApiCnpjApi } from './brasilapi-cnpj.api';
import { CnpjaCnpjApi } from './cnpja-cnpj.api';
import { EmpresasService } from './empresas.service';
import { ReceitaWsCnpjApi } from './receitaws-cnpj.api';
import { CnaeCatalogo, CnaeCatalogoSchema } from './schemas/cnae-catalogo.schema';
import { Empresa, EmpresaSchema } from './schemas/empresa.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Empresa.name, schema: EmpresaSchema },
      { name: CnaeCatalogo.name, schema: CnaeCatalogoSchema },
      { name: NfseEmission.name, schema: NfseEmissionSchema },
    ]),
  ],
  controllers: [EmpresasController],
  providers: [
    EmpresasService,
    CnpjaCnpjApi,
    BrasilApiCnpjApi,
    ReceitaWsCnpjApi,
    PlugNotasHttp,
    PlugNotasCnpjApi,
    PlugNotasCompanyApi,
  ],
  exports: [EmpresasService],
})
export class EmpresasModule {}
