import { Injectable, Logger, Optional } from '@nestjs/common';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { ProviderDocumentParsers } from '../../fiscal/domain/provider-document-parsers';
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service';

const WEBHOOK_PROVIDER_HEADER = 'x-zera-provider';
const DEFAULT_WEBHOOK_PROVIDER = 'PLUGNOTAS';

export function extractWebhookProvider(payload: any, headers?: Record<string, unknown>): string {
  const normalized = Array.isArray(payload) ? payload[0] : payload;
  const fromPayload =
    typeof normalized?.provider === 'string' && normalized.provider.trim()
      ? normalized.provider.trim().toUpperCase()
      : undefined;

  const rawHeader = headers?.[WEBHOOK_PROVIDER_HEADER];
  const receivedHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const fromHeader =
    typeof receivedHeader === 'string' && receivedHeader.trim()
      ? receivedHeader.trim().toUpperCase()
      : undefined;

  return fromPayload ?? fromHeader ?? DEFAULT_WEBHOOK_PROVIDER;
}

function normalizeCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function appendCandidate(target: string[], value: unknown) {
  const normalized = normalizeCandidate(value);
  if (!normalized || target.includes(normalized)) return;
  target.push(normalized);
}

export function extractWebhookExternalIdCandidates(payload: any): string[] {
  if (!payload) return [];

  const normalized = Array.isArray(payload) ? payload[0] : payload;
  const doc = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents;

  const candidates: string[] = [];

  // Prefer our own correlation key when present, then fall back to provider identifiers.
  appendCandidate(candidates, normalized?.externalId);
  appendCandidate(candidates, normalized?.idIntegracao);
  appendCandidate(candidates, normalized?.protocolo);
  appendCandidate(candidates, normalized?.protocol);
  appendCandidate(candidates, normalized?.idNota);
  appendCandidate(candidates, normalized?.id);
  appendCandidate(candidates, doc?.externalId);
  appendCandidate(candidates, doc?.idIntegracao);
  appendCandidate(candidates, doc?.protocolo);
  appendCandidate(candidates, doc?.protocol);
  appendCandidate(candidates, doc?.idNota);
  appendCandidate(candidates, doc?.id);

  return candidates;
}

export function extractWebhookExternalId(payload: any): string | undefined {
  return extractWebhookExternalIdCandidates(payload)[0];
}

function extractWebhookProviderReference(payload: any): string | undefined {
  if (!payload) return undefined;

  const normalized = Array.isArray(payload) ? payload[0] : payload;
  const doc = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents;

  return (
    normalizeCandidate(normalized?.protocolo) ??
    normalizeCandidate(normalized?.protocol) ??
    normalizeCandidate(normalized?.idNota) ??
    normalizeCandidate(normalized?.id) ??
    normalizeCandidate(doc?.protocolo) ??
    normalizeCandidate(doc?.protocol) ??
    normalizeCandidate(doc?.idNota) ??
    normalizeCandidate(doc?.id)
  );
}

function normalizeWebhookPayloadItems(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === 'object');
  }
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly emissions: NfseEmissionRepository,
    @Optional() private readonly syncArtifacts?: SyncNfseArtifactsService,
    private readonly documentParsers: ProviderDocumentParsers = new ProviderDocumentParsers(),
  ) {}

  private async syncArtifactsIfAuthorized(externalId: string, status: NfseEmissionStatus) {
    if (status !== NfseEmissionStatus.AUTHORIZED || !this.syncArtifacts) {
      return null;
    }

    const emission = await this.emissions.findByExternalId(externalId);
    if (!emission?._id) {
      return {
        ok: false,
        reason: 'emission_not_found_after_update',
      };
    }

    try {
      const out = await this.syncArtifacts.execute({
        emissionId: emission._id.toString(),
        requestedBy: 'webhook',
        ip: null,
      });
      return {
        ok: true,
        ...out,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Webhook fiscal nao conseguiu sincronizar artefatos', {
        externalId,
        message,
      });
      return {
        ok: false,
        reason: 'artifact_sync_failed',
        message,
      };
    }
  }

  private async handleSingleFiscalWebhook(payload: any, providerName: string) {
    const candidateExternalIds = extractWebhookExternalIdCandidates(payload);
    const externalId = candidateExternalIds[0];
    const parser = this.documentParsers.resolve(providerName);
    const rawStatus = parser.extractStatus(payload);
    const status = parser.mapStatusToDomain(rawStatus);
    const providerReference = extractWebhookProviderReference(payload);

    if (!externalId) {
      this.logger.warn('Webhook fiscal ignorado: externalId ausente', {
        provider: providerName,
        status: rawStatus ?? null,
      });
      return {
        ok: false,
        reason: 'externalId_not_found',
        externalId: null,
        providerStatus: rawStatus ?? null,
        mappedStatus: status ?? NfseEmissionStatus.PENDING,
      };
    }

    let matchedBy: string | null = null;
    let updateResult = { matchedCount: 0, modifiedCount: 0 };

    for (const candidate of candidateExternalIds) {
      updateResult = await this.emissions.updateByExternalId({
        externalId: candidate,
        resolvedExternalId: providerReference,
        status: status ?? NfseEmissionStatus.PENDING,
        providerResponse: payload,
        provider: providerName,
        lastWebhookAt: new Date(),
        lastUpdateSource: 'webhook',
      });

      if (updateResult.matchedCount) {
        matchedBy = candidate;
        break;
      }
    }

    if (!updateResult.matchedCount) {
      this.logger.warn('Webhook fiscal sem emissao elegivel para atualizar', {
        provider: providerName,
        externalId,
        candidates: candidateExternalIds,
        status: status ?? NfseEmissionStatus.PENDING,
      });
      return {
        ok: false,
        reason: 'emission_not_found_or_not_eligible',
        externalId,
        providerStatus: rawStatus ?? null,
        mappedStatus: status ?? NfseEmissionStatus.PENDING,
      };
    }

    const resolvedExternalId = providerReference ?? matchedBy ?? externalId;
    const artifactSync = await this.syncArtifactsIfAuthorized(
      resolvedExternalId,
      status ?? NfseEmissionStatus.PENDING,
    );

    this.logger.log('Webhook fiscal processado', {
      provider: providerName,
      externalId: resolvedExternalId,
      matchedBy,
      status: status ?? NfseEmissionStatus.PENDING,
    });

    return {
      ok: true,
      externalId: resolvedExternalId,
      matchedBy,
      providerStatus: rawStatus ?? null,
      mappedStatus: status ?? NfseEmissionStatus.PENDING,
      artifactSync,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    };
  }

  async handleFiscalWebhook(payload: any, headers?: Record<string, unknown>) {
    const providerName = extractWebhookProvider(payload, headers);
    const items = normalizeWebhookPayloadItems(payload);

    if (Array.isArray(payload) && items.length > 1) {
      const results = await Promise.all(
        items.map((item) => this.handleSingleFiscalWebhook(item, providerName)),
      );
      const okCount = results.filter((item) => item.ok).length;
      const failedCount = results.length - okCount;

      this.logger.log('Webhook fiscal em lote processado', {
        provider: providerName,
        totalReceived: items.length,
        okCount,
        failedCount,
      });

      return {
        ok: failedCount === 0,
        batch: true,
        totalReceived: items.length,
        okCount,
        failedCount,
        results,
      };
    }

    if (Array.isArray(payload) && items.length === 1) {
      return this.handleSingleFiscalWebhook(items[0], providerName);
    }

    return this.handleSingleFiscalWebhook(payload, providerName);
  }
}
