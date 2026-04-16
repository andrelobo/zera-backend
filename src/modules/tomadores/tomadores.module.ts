import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TomadoresController } from './tomadores.controller';
import { Tomador, TomadorSchema } from './schemas/tomador.schema';
import { HubdevCpfApi } from './hubdev-cpf.api';
import { TomadoresService } from './tomadores.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Tomador.name, schema: TomadorSchema }])],
  controllers: [TomadoresController],
  providers: [TomadoresService, HubdevCpfApi],
  exports: [TomadoresService],
})
export class TomadoresModule {}
