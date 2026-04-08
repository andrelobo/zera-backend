import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class WebhookDeliveryAudit {
  @Prop({ required: true })
  route: string;

  @Prop({ required: true })
  batchSize: number;

  @Prop({ type: String, default: null })
  requestExternalId?: string | null;

  @Prop({ type: [String], default: [] })
  candidateExternalIds: string[];

  @Prop({ type: String, default: null })
  providerStatus?: string | null;

  @Prop({ type: String, default: null })
  mappedStatus?: string | null;

  @Prop({ type: String, default: null })
  matchedBy?: string | null;

  @Prop({ type: String, default: null })
  resolvedExternalId?: string | null;

  @Prop({ required: true })
  ok: boolean;

  @Prop({ type: String, default: null })
  reason?: string | null;

  @Prop({ default: false })
  batch: boolean;

  @Prop({ type: Number, default: null })
  totalReceived?: number | null;

  @Prop({ type: Number, default: null })
  okCount?: number | null;

  @Prop({ type: Number, default: null })
  failedCount?: number | null;

  @Prop({ required: true })
  sharedSecretConfigured: boolean;

  @Prop({ required: true })
  sharedSecretHeader: string;

  @Prop({ type: Boolean, default: null })
  tokenAccepted?: boolean | null;

  @Prop({ type: String, default: null })
  errorMessage?: string | null;
}

export type WebhookDeliveryAuditDocument = HydratedDocument<WebhookDeliveryAudit>;

export const WebhookDeliveryAuditSchema = SchemaFactory.createForClass(WebhookDeliveryAudit);

WebhookDeliveryAuditSchema.index({ route: 1, createdAt: -1 });
WebhookDeliveryAuditSchema.index({ route: 1, ok: 1, createdAt: -1 });
