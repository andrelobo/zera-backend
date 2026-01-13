import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NfseEmissionDocument = NfseEmission & Document;

@Schema({ timestamps: true })
export class NfseEmission {
  @Prop({ required: true })
  prestadorCnpj: string;

  @Prop({ required: true })
  tomadorCpfCnpj: string;

  @Prop({ required: true })
  status: string;

  @Prop({ type: Object, required: true })
  payload: any;
}

export const NfseEmissionSchema = SchemaFactory.createForClass(NfseEmission);
