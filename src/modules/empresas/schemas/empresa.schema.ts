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

@Schema({ _id: false })
export class CnaeListaItem {
  @Prop()
  codigo?: string;

  @Prop()
  descricao?: string;

  @Prop()
  isPrincipal?: boolean;

  @Prop()
  isManual?: boolean;

  @Prop()
  anexo?: string;

  @Prop()
  anexoLoading?: boolean;
}

const CnaeListaItemSchema = SchemaFactory.createForClass(CnaeListaItem);

@Schema({ _id: false })
export class ConfigOperacionalItem {
  @Prop()
  id?: string;

  @Prop()
  natureza?: string;

  @Prop()
  descricao?: string;
}

const ConfigOperacionalItemSchema = SchemaFactory.createForClass(ConfigOperacionalItem);

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
  inscricaoEstadual?: string;

  @Prop()
  suframa?: string;

  @Prop()
  situacaoCadastral?: string;

  @Prop()
  dataSituacaoCadastral?: Date;

  @Prop()
  dataInicioAtividade?: Date;

  @Prop()
  cnaeFiscal?: string;

  @Prop()
  cnaeFiscalDescricao?: string;

  @Prop()
  porte?: string;

  @Prop()
  naturezaJuridica?: string;

  @Prop()
  capitalSocial?: number;

  @Prop()
  opcaoPeloSimples?: boolean;

  @Prop()
  dataOpcaoPeloSimples?: Date;

  @Prop()
  dataExclusaoDoSimples?: Date;

  @Prop()
  opcaoPeloMei?: boolean;

  @Prop()
  regimeTributario?: string;

  @Prop()
  aliquotaSimplesNacional?: string;

  @Prop()
  apuracaoSimplesNacional?: string;

  @Prop()
  rbt12?: number;

  @Prop({ type: [CnaeListaItemSchema], default: undefined })
  cnaesLista?: CnaeListaItem[];

  @Prop({ type: [Object], default: undefined })
  parametroMunicipal?: Record<string, any>[];

  @Prop({ type: [ConfigOperacionalItemSchema], default: undefined })
  configOperacionais?: ConfigOperacionalItem[];

  @Prop()
  ctnCodigo?: string;

  @Prop()
  nbsCodigo?: string;

  @Prop()
  email?: string;

  @Prop()
  fone?: string;

  @Prop()
  whatsapp?: string;

  @Prop()
  nfseNum?: string;

  @Prop()
  dpsNum?: string;

  @Prop()
  serieDpsNum?: string;

  @Prop({ type: EnderecoSchema })
  endereco?: Endereco;

  @Prop({ type: Object })
  providerData?: Record<string, any>;

  @Prop({ type: CertificadoDigitalSchema })
  certificado?: CertificadoDigital;
}

export type EmpresaDocument = HydratedDocument<Empresa>;

export const EmpresaSchema = SchemaFactory.createForClass(Empresa);
