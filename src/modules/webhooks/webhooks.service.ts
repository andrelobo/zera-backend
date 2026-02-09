import { Injectable, Logger } from '@nestjs/common'
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository'
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status'
import { extractPlugNotasStatus, mapPlugNotasStatusToDomain } from '../../fiscal/infra/plugnotas/nfse.mapper'

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name)

  constructor(
    private readonly emissions: NfseEmissionRepository,
  ) {}

  private extractExternalId(payload: any): string | undefined {
    if (!payload) return undefined

    const normalized = Array.isArray(payload) ? payload[0] : payload
    const doc = Array.isArray(normalized?.documents) ? normalized.documents[0] : normalized?.documents

    return (
      normalized?.externalId ??
      normalized?.idNota ??
      normalized?.id ??
      normalized?.protocolo ??
      normalized?.protocol ??
      normalized?.idIntegracao ??
      doc?.id ??
      doc?.idNota ??
      undefined
    )
  }

  async handleFiscalWebhook(payload: any) {
    const externalId = this.extractExternalId(payload)
    const rawStatus = extractPlugNotasStatus(payload)
    const status = mapPlugNotasStatusToDomain(rawStatus)

    if (!externalId) {
      this.logger.warn('Webhook fiscal ignorado: externalId ausente', {
        status: rawStatus ?? null,
      })
      return { ok: false, reason: 'externalId_not_found' }
    }

    await this.emissions.updateByExternalId({
      externalId,
      status: status ?? NfseEmissionStatus.PENDING,
      providerResponse: payload,
      provider: 'PLUGNOTAS',
    })

    this.logger.log('Webhook fiscal processado', {
      externalId,
      status: status ?? NfseEmissionStatus.PENDING,
    })

    return { ok: true }
  }
}
