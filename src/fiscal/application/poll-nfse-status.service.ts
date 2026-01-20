import { Injectable, Logger } from '@nestjs/common'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'
import { NfseApi } from '../infra/nuvemfiscal/nfse.api'
import { mapNuvemFiscalStatusToDomain } from '../infra/nuvemfiscal/nfse.mapper'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

@Injectable()
export class PollNfseStatusService {
  private readonly logger = new Logger(PollNfseStatusService.name)

  constructor(
    private readonly repo: NfseEmissionRepository,
    private readonly nfseApi: NfseApi,
  ) {}

  async runOnce(input?: { limit?: number; olderThanMs?: number }) {
    const pending = await this.repo.findPending({
      provider: 'NUVEMFISCAL',
      limit: input?.limit ?? 50,
      olderThanMs: input?.olderThanMs ?? 30_000,
    })

    if (!pending.length) return

    for (const emission of pending) {
      if (!emission.externalId) continue

      try {
        const resp = await this.nfseApi.consultarNfse(emission.externalId)
        const status = mapNuvemFiscalStatusToDomain(resp.status)

        if (status === NfseEmissionStatus.PENDING) {
          await this.repo.updateByExternalId({
            externalId: emission.externalId,
            status,
            providerResponse: resp as any,
            provider: 'NUVEMFISCAL',
          })
          continue
        }

        await this.repo.updateByExternalId({
          externalId: emission.externalId,
          status,
          providerResponse: resp as any,
          provider: 'NUVEMFISCAL',
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        this.logger.error(`Polling error for externalId=${emission.externalId}: ${msg}`)

        await this.repo.updateByExternalId({
          externalId: emission.externalId,
          status: NfseEmissionStatus.ERROR,
          error: msg,
          provider: 'NUVEMFISCAL',
        })
      }
    }
  }
}
