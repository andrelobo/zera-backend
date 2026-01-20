import { Injectable, Logger } from '@nestjs/common'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'
import { NfseApi } from '../infra/nuvemfiscal/nfse.api'
import { mapNuvemFiscalStatusToDomain } from '../infra/nuvemfiscal/nfse.mapper'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'

function toBase64(data: Uint8Array) {
  return Buffer.from(data).toString('base64')
}

function computeNextPollAt(attempt: number) {
  const baseMs = Number(process.env.NFSE_POLLING_BACKOFF_BASE_MS ?? 60000)
  const maxMs = Number(process.env.NFSE_POLLING_BACKOFF_MAX_MS ?? 900000)
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)))
  const jitter = Math.floor(Math.random() * Number(process.env.NFSE_POLLING_BACKOFF_JITTER_MS ?? 5000))
  return new Date(Date.now() + exp + jitter)
}

function isTransientError(e: any) {
  const status = e?.status
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500 && status <= 599) return true
  if (status === undefined) return true
  return false
}

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
      now: new Date(),
    })

    if (!pending.length) return

    const storeArtifacts =
      (process.env.NFSE_STORE_ARTIFACTS ?? 'true').toLowerCase() === 'true'

    const maxAttempts = Number(process.env.NFSE_POLLING_MAX_ATTEMPTS ?? 12)

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

        if (status === NfseEmissionStatus.AUTHORIZED && storeArtifacts) {
          const [xml, pdf] = await Promise.all([
            this.nfseApi.baixarXmlNfse(emission.externalId),
            this.nfseApi.baixarPdfNfse(emission.externalId),
          ])

          await this.repo.updateByExternalId({
            externalId: emission.externalId,
            status,
            providerResponse: resp as any,
            provider: 'NUVEMFISCAL',
            xmlBase64: toBase64(xml),
            pdfBase64: toBase64(pdf),
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

        if (isTransientError(e)) {
          const attempts = (emission.pollAttempts ?? 0) + 1

          if (attempts >= maxAttempts) {
            this.logger.error(`Polling max attempts reached externalId=${emission.externalId}: ${msg}`)
            await this.repo.updateByExternalId({
              externalId: emission.externalId,
              status: NfseEmissionStatus.ERROR,
              error: msg,
              provider: 'NUVEMFISCAL',
            })
            continue
          }

          const nextPollAt = computeNextPollAt(attempts)

          this.logger.warn(`Polling transient failure externalId=${emission.externalId} attempts=${attempts} nextPollAt=${nextPollAt.toISOString()} ${msg}`)

          await this.repo.markPollingTransientFailure({
            externalId: emission.externalId,
            provider: 'NUVEMFISCAL',
            message: msg,
            nextPollAt,
          })

          continue
        }

        this.logger.error(`Polling fatal error externalId=${emission.externalId}: ${msg}`)

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
