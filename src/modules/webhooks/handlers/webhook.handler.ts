import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  WebhooksService,
  extractWebhookExternalId,
  extractWebhookExternalIdCandidates,
} from '../webhooks.service';
import { extractPlugNotasStatus } from '../../../fiscal/infra/plugnotas/nfse.mapper';
import { WebhookDeliveryAuditRepository } from '../webhook-delivery-audit.repository';

const FISCAL_WEBHOOK_ROUTE = '/webhooks/fiscal';

@Injectable()
export class WebhookHandler {
  private readonly logger = new Logger(WebhookHandler.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly audits: WebhookDeliveryAuditRepository,
  ) {}

  private getSharedSecretConfig() {
    return {
      secret: process.env.WEBHOOK_SHARED_SECRET,
      headerName: (process.env.WEBHOOK_SHARED_SECRET_HEADER ?? 'x-webhook-token').toLowerCase(),
    };
  }

  private validateSharedSecret(headers: any) {
    const { secret, headerName } = this.getSharedSecretConfig();
    if (!secret) {
      return {
        sharedSecretConfigured: false,
        sharedSecretHeader: headerName,
        tokenAccepted: null,
      };
    }

    const rawReceived = headers?.[headerName];
    const received = Array.isArray(rawReceived) ? rawReceived[0] : rawReceived;

    return {
      sharedSecretConfigured: true,
      sharedSecretHeader: headerName,
      tokenAccepted: typeof received === 'string' && received.trim() === secret,
    };
  }

  private async recordAudit(input: {
    payload: any;
    ok: boolean;
    reason?: string | null;
    mappedStatus?: string | null;
    matchedBy?: string | null;
    resolvedExternalId?: string | null;
    batch?: boolean;
    totalReceived?: number | null;
    okCount?: number | null;
    failedCount?: number | null;
    sharedSecretConfigured: boolean;
    sharedSecretHeader: string;
    tokenAccepted?: boolean | null;
    errorMessage?: string | null;
  }) {
    const batchSize = Array.isArray(input.payload) ? input.payload.length : 1;
    try {
      await this.audits.create({
        route: FISCAL_WEBHOOK_ROUTE,
        batchSize,
        requestExternalId: extractWebhookExternalId(input.payload) ?? null,
        candidateExternalIds: extractWebhookExternalIdCandidates(input.payload),
        providerStatus: extractPlugNotasStatus(input.payload) ?? null,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Falha ao gravar auditoria de webhook', {
        route: FISCAL_WEBHOOK_ROUTE,
        message,
      });
    }
  }

  private async requireSharedSecret(headers: any, payload: any) {
    const validation = this.validateSharedSecret(headers);
    if (!validation.sharedSecretConfigured || validation.tokenAccepted) {
      return validation;
    }

    await this.recordAudit({
      payload,
      ok: false,
      reason: 'invalid_shared_secret',
      sharedSecretConfigured: validation.sharedSecretConfigured,
      sharedSecretHeader: validation.sharedSecretHeader,
      tokenAccepted: validation.tokenAccepted,
      errorMessage: 'Invalid webhook token',
    });

    throw new UnauthorizedException('Invalid webhook token');
  }

  async handle(payload: any, headers: any) {
    const secretValidation = await this.requireSharedSecret(headers, payload);
    const batchSize = Array.isArray(payload) ? payload.length : 1;

    this.logger.log('Webhook fiscal recebido', {
      batchSize,
      hasExternalId: !!extractWebhookExternalId(payload),
      externalId: extractWebhookExternalId(payload) ?? null,
      status: extractPlugNotasStatus(payload) ?? null,
    });

    try {
      const result = await this.webhooksService.handleFiscalWebhook(payload);
      const isBatch = Array.isArray((result as any)?.results);
      await this.recordAudit({
        payload,
        ok: Boolean((result as any)?.ok),
        reason: (result as any)?.reason ?? null,
        mappedStatus: isBatch ? null : ((result as any)?.mappedStatus ?? null),
        matchedBy: isBatch ? null : ((result as any)?.matchedBy ?? null),
        resolvedExternalId: isBatch ? null : ((result as any)?.externalId ?? null),
        batch: Boolean((result as any)?.batch),
        totalReceived: (result as any)?.totalReceived ?? null,
        okCount: (result as any)?.okCount ?? null,
        failedCount: (result as any)?.failedCount ?? null,
        sharedSecretConfigured: secretValidation.sharedSecretConfigured,
        sharedSecretHeader: secretValidation.sharedSecretHeader,
        tokenAccepted: secretValidation.tokenAccepted,
      });

      return { received: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordAudit({
        payload,
        ok: false,
        reason: 'handler_exception',
        sharedSecretConfigured: secretValidation.sharedSecretConfigured,
        sharedSecretHeader: secretValidation.sharedSecretHeader,
        tokenAccepted: secretValidation.tokenAccepted,
        errorMessage: message,
      });
      throw error;
    }
  }
}
