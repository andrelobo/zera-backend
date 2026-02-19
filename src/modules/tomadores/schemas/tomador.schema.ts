import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class TomadorEndereco {
  @Prop()
  logradouro?: string;

  @Prop()
  numero?: string;

  @Prop()
  complemento?: string;

  @Prop()
  bairro?: string;

  @Prop()
  municipio?: string;

  @Prop()
  uf?: string;

  @Prop()
  cep?: string;
}

const TomadorEnderecoSchema = SchemaFactory.createForClass(TomadorEndereco);

@Schema({ timestamps: true })
export class Tomador {
  @Prop({ required: true, index: true })
  empresaCnpj: string;

  @Prop({ required: true })
  cpfCnpj: string;

  @Prop({ required: true })
  razaoSocial: string;

  @Prop()
  inscricaoMunicipal?: string;

  @Prop()
  email?: string;

  @Prop({ type: TomadorEnderecoSchema })
  endereco?: TomadorEndereco;
}

export type TomadorDocument = HydratedDocument<Tomador>;

export const TomadorSchema = SchemaFactory.createForClass(Tomador);

TomadorSchema.index({ empresaCnpj: 1, cpfCnpj: 1 }, { unique: true });
