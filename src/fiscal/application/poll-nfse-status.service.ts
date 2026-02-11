import { Inject, Injectable, Logger } from '@nestjs/common'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'

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

function extractArtifactId(providerResponse: any, fallbackExternalId: string): string {
  const normalized = Array.isArray(providerResponse) ? providerResponse[0] : providerResponse
  const firstDocument = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents

  return (
    normalized?.idNota ??
    normalized?.id ??
    normalized?.nota?.idNota ??
    normalized?.nota?.id ??
    firstDocument?.idNota ??
    firstDocument?.id ??
    fallbackExternalId
  )
}

@Injectable()
export class PollNfseStatusService {
  private readonly logger = new Logger(PollNfseStatusService.name)

  constructor(
    private readonly repo: NfseEmissionRepository,
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
  ) {}

  async runOnce(input?: { limit?: number; olderThanMs?: number }) {
    const pending = await this.repo.findPending({
      provider: this.provider.providerName,
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
        const { status, providerResponse } = await this.provider.consultarNfse(emission.externalId)

        if (status === NfseEmissionStatus.PENDING) {
          await this.repo.updateByExternalId({
            externalId: emission.externalId,
            status,
            providerResponse,
            provider: this.provider.providerName,
          })
          continue
        }

        if (status === NfseEmissionStatus.AUTHORIZED && storeArtifacts) {
          const artifactId = extractArtifactId(providerResponse, emission.externalId)
          const [xml, pdf] = await Promise.all([
            this.provider.baixarXmlNfse(artifactId),
            this.provider.baixarPdfNfse(artifactId),
          ])

          await this.repo.updateByExternalId({
            externalId: emission.externalId,
            status,
            providerResponse,
            provider: this.provider.providerName,
            xmlBase64: toBase64(xml),
            pdfBase64: toBase64(pdf),
          })

          continue
        }

        await this.repo.updateByExternalId({
          externalId: emission.externalId,
          status,
          providerResponse,
          provider: this.provider.providerName,
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
              provider: this.provider.providerName,
            })
            continue
          }

          const nextPollAt = computeNextPollAt(attempts)

          this.logger.warn(`Polling transient failure externalId=${emission.externalId} attempts=${attempts} nextPollAt=${nextPollAt.toISOString()} ${msg}`)

          await this.repo.markPollingTransientFailure({
            externalId: emission.externalId,
            provider: this.provider.providerName,
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
          provider: this.provider.providerName,
        })
      }
    }
  }
}
