import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NfseEmissionRepository } from '../infra/mongo/repositories/nfse-emission.repository';
import { NfseEmissionStatus } from '../domain/types/nfse-emission-status';
import type { NfseEmissionDocument } from '../infra/mongo/schemas/nfse-emission.schema';
import type { FiscalProvider } from '../domain/fiscal-provider.interface';
import { FiscalProviderResolver } from './fiscal-provider.resolver';

function toBase64(data: Uint8Array) {
  return Buffer.from(data).toString('base64');
}

function computeNextPollAt(attempt: number) {
  const baseMs = Number(process.env.NFSE_POLLING_BACKOFF_BASE_MS ?? 60000);
  const maxMs = Number(process.env.NFSE_POLLING_BACKOFF_MAX_MS ?? 900000);
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
  const jitter = Math.floor(
    Math.random() * Number(process.env.NFSE_POLLING_BACKOFF_JITTER_MS ?? 5000),
  );
  return new Date(Date.now() + exp + jitter);
}

function isTransientError(e: any) {
  const status = e?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status <= 599) return true;
  if (status === undefined) return true;
  return false;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

function extractArtifactId(providerResponse: any, fallbackExternalId: string): string {
  const normalized = Array.isArray(providerResponse) ? providerResponse[0] : providerResponse;
  const firstDocument = Array.isArray(normalized?.documents)
    ? normalized.documents[0]
    : normalized?.documents;

  return (
    normalized?.idNota ??
    normalized?.id ??
    normalized?.nota?.idNota ??
    normalized?.nota?.id ??
    firstDocument?.idNota ??
    firstDocument?.id ??
    fallbackExternalId
  );
}

@Injectable()
export class PollNfseStatusService {
  private readonly logger = new Logger(PollNfseStatusService.name);

  constructor(
    private readonly repo: NfseEmissionRepository,
    @Inject('FiscalProvider')
    private readonly provider: FiscalProvider,
    @Optional() private readonly resolver?: FiscalProviderResolver,
  ) {}

  private async updateEmissionFromPolling(
    input: Parameters<NfseEmissionRepository['updateByExternalId']>[0],
  ) {
    const result = await this.repo.updateByExternalId(input);

    if (!result.matchedCount) {
      this.logger.warn(
        `Polling skipped externalId=${input.externalId}: emission not found or not eligible`,
      );
    }

    return result;
  }

  async runOnce(input?: { limit?: number; olderThanMs?: number }) {
    const now = new Date();
    const providerNames = this.resolver
      ? this.resolver.pollingProviderNames()
      : [this.provider.providerName];

    const batches = await Promise.all(
      providerNames.map((providerName) =>
        this.repo.findPending({
          provider: providerName,
          limit: input?.limit ?? 50,
          olderThanMs: input?.olderThanMs ?? 30_000,
          now,
        }),
      ),
    );

    const seen = new Set<string>();
    const pending: NfseEmissionDocument[] = [];
    for (const batch of batches) {
      for (const emission of batch) {
        const key = String(emission._id ?? emission.externalId);
        if (seen.has(key)) continue;
        seen.add(key);
        pending.push(emission);
      }
    }

    if (!pending.length) return;

    const storeArtifacts = (process.env.NFSE_STORE_ARTIFACTS ?? 'true').toLowerCase() === 'true';

    const maxAttempts = Number(process.env.NFSE_POLLING_MAX_ATTEMPTS ?? 12);

    for (const emission of pending) {
      if (!emission.externalId) continue;

      const emissionProviderName = emission.provider ?? this.provider.providerName;
      const emissionProvider = this.resolver
        ? this.resolver.byProviderName(emissionProviderName)
        : this.provider;

      try {
        const { status, providerResponse } = await emissionProvider.consultarNfse(
          emission.externalId,
        );

        if (status === NfseEmissionStatus.PENDING) {
          await this.updateEmissionFromPolling({
            externalId: emission.externalId,
            status,
            providerResponse,
            provider: emissionProviderName,
            lastPolledAt: new Date(),
            lastUpdateSource: 'polling',
          });
          continue;
        }

        if (status === NfseEmissionStatus.AUTHORIZED && storeArtifacts) {
          const artifactId = extractArtifactId(providerResponse, emission.externalId);
          const [xml, pdf] = await Promise.all([
            emissionProvider.baixarXmlNfse(artifactId),
            emissionProvider.baixarPdfNfse(artifactId),
          ]);

          await this.updateEmissionFromPolling({
            externalId: emission.externalId,
            status,
            providerResponse,
            provider: emissionProviderName,
            xmlBase64: toBase64(xml),
            pdfBase64: toBase64(pdf),
            lastPolledAt: new Date(),
            lastUpdateSource: 'polling',
          });

          continue;
        }

        await this.updateEmissionFromPolling({
          externalId: emission.externalId,
          status,
          providerResponse,
          provider: emissionProviderName,
          lastPolledAt: new Date(),
          lastUpdateSource: 'polling',
        });
      } catch (e) {
        const msg = extractErrorMessage(e);

        if (isTransientError(e)) {
          const attempts = (emission.pollAttempts ?? 0) + 1;

          if (attempts >= maxAttempts) {
            this.logger.error(
              `Polling max attempts reached externalId=${emission.externalId}: ${msg}`,
            );
            await this.updateEmissionFromPolling({
              externalId: emission.externalId,
              status: NfseEmissionStatus.ERROR,
              error: msg,
              provider: emissionProviderName,
              lastPolledAt: new Date(),
              lastUpdateSource: 'polling',
            });
            continue;
          }

          const nextPollAt = computeNextPollAt(attempts);

          this.logger.warn(
            `Polling transient failure externalId=${emission.externalId} attempts=${attempts} nextPollAt=${nextPollAt.toISOString()} ${msg}`,
          );

          await this.repo.markPollingTransientFailure({
            externalId: emission.externalId,
            provider: emissionProviderName,
            message: msg,
            nextPollAt,
          });

          continue;
        }

        this.logger.error(`Polling fatal error externalId=${emission.externalId}: ${msg}`);

        await this.updateEmissionFromPolling({
          externalId: emission.externalId,
          status: NfseEmissionStatus.ERROR,
          error: msg,
          provider: emissionProviderName,
          lastPolledAt: new Date(),
          lastUpdateSource: 'polling',
        });
      }
    }
  }
}
