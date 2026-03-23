import { Injectable, Logger, Optional } from '@nestjs/common';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import {
  extractPlugNotasStatus,
  mapPlugNotasStatusToDomain,
} from '../../fiscal/infra/plugnotas/nfse.mapper';
import { SyncNfseArtifactsService } from '../../fiscal/application/sync-nfse-artifacts.service';

export function extractWebhookExternalId(payload: any): string | undefined {
  if (!payload) return undefined;

  const normalized = Array.isArray(payload) ? payload[0] : payload;
  const doc = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents;

  return (
    normalized?.externalId ??
    normalized?.idNota ??
    normalized?.id ??
    normalized?.protocolo ??
    normalized?.protocol ??
    normalized?.idIntegracao ??
    doc?.externalId ??
    doc?.id ??
    doc?.idNota ??
    doc?.protocolo ??
    doc?.protocol ??
    doc?.idIntegracao ??
    undefined
  );
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly emissions: NfseEmissionRepository,
    @Optional() private readonly syncArtifacts?: SyncNfseArtifactsService,
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

  async handleFiscalWebhook(payload: any) {
    const externalId = extractWebhookExternalId(payload);
    const rawStatus = extractPlugNotasStatus(payload);
    const status = mapPlugNotasStatusToDomain(rawStatus);

    if (!externalId) {
      this.logger.warn('Webhook fiscal ignorado: externalId ausente', {
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

    const updateResult = await this.emissions.updateByExternalId({
      externalId,
      status: status ?? NfseEmissionStatus.PENDING,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
      lastWebhookAt: new Date(),
      lastUpdateSource: 'webhook',
    });

    if (!updateResult.matchedCount) {
      this.logger.warn('Webhook fiscal sem emissao elegivel para atualizar', {
        externalId,
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

    const artifactSync = await this.syncArtifactsIfAuthorized(
      externalId,
      status ?? NfseEmissionStatus.PENDING,
    );

    this.logger.log('Webhook fiscal processado', {
      externalId,
      status: status ?? NfseEmissionStatus.PENDING,
    });

    return {
      ok: true,
      externalId,
      providerStatus: rawStatus ?? null,
      mappedStatus: status ?? NfseEmissionStatus.PENDING,
      artifactSync,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    };
  }
}
