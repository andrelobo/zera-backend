import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { NfseEmissionStatus } from '../../../domain/types/nfse-emission-status';

@Schema({ timestamps: true })
export class NfseEmission {
  @Prop({ required: true })
  provider: string;

  @Prop({ required: true, type: String, enum: NfseEmissionStatus })
  status: NfseEmissionStatus;

  @Prop({ type: Object, required: true })
  payload: Record<string, any>;

  @Prop({ type: Object })
  biSnapshot?: Record<string, any>;

  @Prop({ index: true })
  empresaCnpj?: string;

  @Prop({ index: true })
  tomadorCpfCnpj?: string;

  @Prop()
  tomadorRazaoSocial?: string;

  @Prop()
  descricaoServico?: string;

  @Prop()
  codigoServico?: string;

  @Prop()
  numeroNfse?: string;

  @Prop()
  valorServico?: number;

  @Prop()
  aliquotaIss?: number;

  @Prop()
  valorIss?: number;

  @Prop({ index: true })
  idempotencyKey?: string;

  @Prop({ index: true })
  externalId?: string;

  @Prop()
  error?: string;

  @Prop({ type: Object })
  providerResponse?: Record<string, any>;

  @Prop({ type: Object })
  providerRequest?: Record<string, any>;

  @Prop()
  xmlBase64?: string;

  @Prop()
  pdfBase64?: string;

  @Prop({ default: 0 })
  pollAttempts: number;

  @Prop()
  lastPollError?: string;

  @Prop()
  lastPolledAt?: Date;

  @Prop({ index: true })
  nextPollAt?: Date;

  @Prop()
  lastArtifactSyncAt?: Date;

  @Prop({ type: [Object], default: [] })
  artifactSyncAudit?: Array<Record<string, any>>;
}

export type NfseEmissionDocument = HydratedDocument<NfseEmission>;

export const NfseEmissionSchema = SchemaFactory.createForClass(NfseEmission);

NfseEmissionSchema.index({ provider: 1, externalId: 1 }, { unique: false });
NfseEmissionSchema.index({ empresaCnpj: 1, createdAt: -1 });
NfseEmissionSchema.index({ tomadorCpfCnpj: 1, createdAt: -1 });
NfseEmissionSchema.index({ codigoServico: 1, createdAt: -1 });
NfseEmissionSchema.index(
  { provider: 1, idempotencyKey: 1 },
  {
    unique: true,
    name: 'uniq_provider_idempotency_key',
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
);
