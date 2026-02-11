import { BadRequestException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common'
import type { FiscalProvider } from '../domain/fiscal-provider.interface'
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status'
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository'

function toBase64(data: Uint8Array) {
  return Buffer.from(data).toString('base64')
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
export class SyncNfseArtifactsService {
  constructor(
    private readonly repo: NfseEmissionRepository,
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
  ) {}

  async execute(input: { emissionId: string; requestedBy?: string | null; ip?: string | null }) {
    const now = new Date()
    const doc = await this.repo.findById(input.emissionId)
    if (!doc) return { found: false }

    if (doc.xmlBase64 && doc.pdfBase64) {
      await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
        at: now,
        outcome: 'noop_already_present',
        requestedBy: input.requestedBy ?? null,
        ip: input.ip ?? null,
      })
      return {
        found: true,
        id: doc._id.toString(),
        status: doc.status,
        synced: false,
        reason: 'already_present',
        hasXml: true,
        hasPdf: true,
      }
    }

    const minIntervalMs = Number(process.env.NFSE_SYNC_ARTIFACTS_MIN_INTERVAL_MS ?? 60000)
    const lastSyncAt = doc.lastArtifactSyncAt ? new Date(doc.lastArtifactSyncAt).getTime() : 0
    const nowMs = now.getTime()
    if (lastSyncAt && nowMs - lastSyncAt < minIntervalMs) {
      const retryAfterMs = minIntervalMs - (nowMs - lastSyncAt)
      await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
        at: now,
        outcome: 'blocked_rate_limited',
        message: `retry after ${retryAfterMs}ms`,
        requestedBy: input.requestedBy ?? null,
        ip: input.ip ?? null,
      })
      throw new HttpException(
        {
          message: 'Artifact sync rate limited',
          retryAfterMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    if (!doc.externalId) {
      await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
        at: now,
        outcome: 'failed_missing_external_id',
        requestedBy: input.requestedBy ?? null,
        ip: input.ip ?? null,
      })
      throw new BadRequestException({
        message: 'Emission has no externalId',
      })
    }

    try {
      const { status, providerResponse } = await this.provider.consultarNfse(doc.externalId)
      if (status !== NfseEmissionStatus.AUTHORIZED) {
        await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
          at: now,
          outcome: 'skipped_not_authorized',
          message: `provider status=${status}`,
          requestedBy: input.requestedBy ?? null,
          ip: input.ip ?? null,
        })
        return {
          found: true,
          id: doc._id.toString(),
          status,
          synced: false,
          reason: 'not_authorized',
          hasXml: Boolean(doc.xmlBase64),
          hasPdf: Boolean(doc.pdfBase64),
        }
      }

      const artifactId = extractArtifactId(providerResponse, doc.externalId)
      const [xml, pdf] = await Promise.all([
        this.provider.baixarXmlNfse(artifactId),
        this.provider.baixarPdfNfse(artifactId),
      ])

      await this.repo.saveArtifactsById({
        id: doc._id.toString(),
        status: NfseEmissionStatus.AUTHORIZED,
        providerResponse,
        xmlBase64: toBase64(xml),
        pdfBase64: toBase64(pdf),
        error: null,
      })
      await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
        at: now,
        outcome: 'success',
        message: `artifactId=${artifactId}`,
        requestedBy: input.requestedBy ?? null,
        ip: input.ip ?? null,
      })

      return {
        found: true,
        id: doc._id.toString(),
        status: NfseEmissionStatus.AUTHORIZED,
        synced: true,
        reason: 'ok',
        artifactId,
        hasXml: true,
        hasPdf: true,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await this.repo.appendArtifactSyncAudit(doc._id.toString(), {
        at: now,
        outcome: 'failed',
        message: msg,
        requestedBy: input.requestedBy ?? null,
        ip: input.ip ?? null,
      })
      throw e
    }
  }
}
