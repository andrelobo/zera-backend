import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'

@Schema({ _id: false })
export class Endereco {
  @Prop()
  logradouro?: string

  @Prop()
  numero?: string

  @Prop()
  complemento?: string

  @Prop()
  bairro?: string

  @Prop()
  codigoMunicipio?: string

  @Prop()
  cidade?: string

  @Prop()
  uf?: string

  @Prop()
  codigoPais?: string

  @Prop()
  pais?: string

  @Prop()
  cep?: string
}

const EnderecoSchema = SchemaFactory.createForClass(Endereco)

@Schema({ timestamps: true })
export class Empresa {
  @Prop({ required: true, unique: true, index: true })
  cnpj: string

  @Prop()
  razaoSocial?: string

  @Prop()
  nomeFantasia?: string

  @Prop()
  inscricaoMunicipal?: string

  @Prop()
  email?: string

  @Prop()
  fone?: string

  @Prop({ type: EnderecoSchema })
  endereco?: Endereco

  @Prop({ type: Object })
  providerData?: Record<string, any>
}

export type EmpresaDocument = HydratedDocument<Empresa>

export const EmpresaSchema = SchemaFactory.createForClass(Empresa)
