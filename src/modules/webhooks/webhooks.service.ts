import { Injectable, Logger } from '@nestjs/common';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import {
  extractPlugNotasStatus,
  mapPlugNotasStatusToDomain,
} from '../../fiscal/infra/plugnotas/nfse.mapper';

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

  constructor(private readonly emissions: NfseEmissionRepository) {}

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

    this.logger.log('Webhook fiscal processado', {
      externalId,
      status: status ?? NfseEmissionStatus.PENDING,
    });

    return {
      ok: true,
      externalId,
      providerStatus: rawStatus ?? null,
      mappedStatus: status ?? NfseEmissionStatus.PENDING,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    };
  }
}
