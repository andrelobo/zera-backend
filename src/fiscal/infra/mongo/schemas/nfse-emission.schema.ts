import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import type { HydratedDocument } from 'mongoose'
import { NfseEmissionStatus } from '../../../domain/types/nfse-emission-status'

export type NfseEmissionDocument = HydratedDocument<NfseEmission>

@Schema({ timestamps: true })
export class NfseEmission {
  @Prop({ required: true })
  provider: string

  @Prop({ required: true, type: String, enum: NfseEmissionStatus })
  status: NfseEmissionStatus

  @Prop({ type: Object, required: true })
  payload: Record<string, any>

  @Prop({ index: true })
  externalId?: string

  @Prop()
  error?: string

  @Prop({ type: Object })
  providerResponse?: Record<string, any>
}

export const NfseEmissionSchema = SchemaFactory.createForClass(NfseEmission)

NfseEmissionSchema.index({ provider: 1, externalId: 1 }, { unique: false })
