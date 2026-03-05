import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'cnae_catalogo' })
export class CnaeCatalogo {
  @Prop({ required: true, unique: true, index: true })
  codigoCnae: string;

  @Prop({ default: '' })
  descricao?: string;

  @Prop({ required: true, default: 'III' })
  anexo: string;

  @Prop({ required: true, default: false })
  permiteFatorR: boolean;
}

export type CnaeCatalogoDocument = HydratedDocument<CnaeCatalogo>;
export const CnaeCatalogoSchema = SchemaFactory.createForClass(CnaeCatalogo);
