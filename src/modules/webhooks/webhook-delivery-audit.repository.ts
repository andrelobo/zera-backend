import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  WebhookDeliveryAudit,
  WebhookDeliveryAuditDocument,
} from './schemas/webhook-delivery-audit.schema';

type AuditInput = {
  route: string;
  batchSize: number;
  requestExternalId?: string | null;
  candidateExternalIds?: string[];
  providerStatus?: string | null;
  mappedStatus?: string | null;
  matchedBy?: string | null;
  resolvedExternalId?: string | null;
  ok: boolean;
  reason?: string | null;
  batch?: boolean;
  totalReceived?: number | null;
  okCount?: number | null;
  failedCount?: number | null;
  sharedSecretConfigured: boolean;
  sharedSecretHeader: string;
  tokenAccepted?: boolean | null;
  errorMessage?: string | null;
};

function toSummary(doc: WebhookDeliveryAuditDocument | null) {
  if (!doc) return null;

  return {
    id: doc._id.toString(),
    route: doc.route,
    batchSize: doc.batchSize,
    requestExternalId: doc.requestExternalId ?? null,
    candidateExternalIds: doc.candidateExternalIds ?? [],
    providerStatus: doc.providerStatus ?? null,
    mappedStatus: doc.mappedStatus ?? null,
    matchedBy: doc.matchedBy ?? null,
    resolvedExternalId: doc.resolvedExternalId ?? null,
    ok: doc.ok,
    reason: doc.reason ?? null,
    batch: doc.batch ?? false,
    totalReceived: doc.totalReceived ?? null,
    okCount: doc.okCount ?? null,
    failedCount: doc.failedCount ?? null,
    sharedSecretConfigured: doc.sharedSecretConfigured,
    sharedSecretHeader: doc.sharedSecretHeader,
    tokenAccepted: doc.tokenAccepted ?? null,
    errorMessage: doc.errorMessage ?? null,
    createdAt: (doc as any).createdAt ?? null,
    updatedAt: (doc as any).updatedAt ?? null,
  };
}

@Injectable()
export class WebhookDeliveryAuditRepository {
  constructor(
    @InjectModel(WebhookDeliveryAudit.name)
    private readonly model: Model<WebhookDeliveryAuditDocument>,
  ) {}

  async create(input: AuditInput): Promise<void> {
    await this.model.create({
      route: input.route,
      batchSize: input.batchSize,
      requestExternalId: input.requestExternalId ?? null,
      candidateExternalIds: input.candidateExternalIds ?? [],
      providerStatus: input.providerStatus ?? null,
      mappedStatus: input.mappedStatus ?? null,
      matchedBy: input.matchedBy ?? null,
      resolvedExternalId: input.resolvedExternalId ?? null,
      ok: input.ok,
      reason: input.reason ?? null,
      batch: input.batch ?? false,
      totalReceived: input.totalReceived ?? null,
      okCount: input.okCount ?? null,
      failedCount: input.failedCount ?? null,
      sharedSecretConfigured: input.sharedSecretConfigured,
      sharedSecretHeader: input.sharedSecretHeader,
      tokenAccepted: input.tokenAccepted ?? null,
      errorMessage: input.errorMessage ?? null,
    });
  }

  async getLatestByRoute(route: string) {
    const doc = await this.model.findOne({ route }).sort({ createdAt: -1 }).exec();
    return toSummary(doc);
  }

  async getLatestFailureByRoute(route: string) {
    const doc = await this.model.findOne({ route, ok: false }).sort({ createdAt: -1 }).exec();
    return toSummary(doc);
  }

  async getLatestSuccessByRoute(route: string) {
    const doc = await this.model.findOne({ route, ok: true }).sort({ createdAt: -1 }).exec();
    return toSummary(doc);
  }
}
