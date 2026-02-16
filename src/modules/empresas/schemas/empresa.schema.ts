import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class Endereco {
  @Prop()
  logradouro?: string;

  @Prop()
  numero?: string;

  @Prop()
  complemento?: string;

  @Prop()
  bairro?: string;

  @Prop()
  codigoMunicipio?: string;

  @Prop()
  cidade?: string;

  @Prop()
  uf?: string;

  @Prop()
  codigoPais?: string;

  @Prop()
  pais?: string;

  @Prop()
  cep?: string;
}

const EnderecoSchema = SchemaFactory.createForClass(Endereco);

@Schema({ _id: false })
export class CertificadoDigital {
  @Prop()
  filename?: string;

  @Prop()
  mimeType?: string;

  @Prop()
  size?: number;

  @Prop()
  sha256?: string;

  @Prop()
  uploadedAt?: Date;

  @Prop({ select: false })
  pfxBase64?: string;

  @Prop({ select: false })
  passwordEncrypted?: string;
}

const CertificadoDigitalSchema = SchemaFactory.createForClass(CertificadoDigital);

@Schema({ timestamps: true })
export class Empresa {
  @Prop({ required: true, unique: true, index: true })
  cnpj: string;

  @Prop()
  razaoSocial?: string;

  @Prop()
  nomeFantasia?: string;

  @Prop()
  inscricaoMunicipal?: string;

  @Prop()
  email?: string;

  @Prop()
  fone?: string;

  @Prop({ type: EnderecoSchema })
  endereco?: Endereco;

  @Prop({ type: Object })
  providerData?: Record<string, any>;

  @Prop({ type: CertificadoDigitalSchema })
  certificado?: CertificadoDigital;
}

export type EmpresaDocument = HydratedDocument<Empresa>;

export const EmpresaSchema = SchemaFactory.createForClass(Empresa);
