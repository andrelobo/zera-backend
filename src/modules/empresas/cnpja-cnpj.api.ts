import { Injectable, Logger } from '@nestjs/common';

type CnpjaError = {
  status: number;
  body?: unknown;
};

type AuthScheme = 'raw' | 'bearer';

@Injectable()
export class CnpjaCnpjApi {
  private readonly logger = new Logger(CnpjaCnpjApi.name);

  async consultarCnpj(cnpj: string): Promise<Record<string, unknown>> {
    const apiKey = (process.env.CNPJA_API_KEY ?? '').trim();
    if (!apiKey) {
      throw {
        status: 500,
        body: { message: 'CNPJA_API_KEY não configurada' },
      } as CnpjaError;
    }

    const baseUrl = process.env.CNPJA_BASE_URL ?? 'https://api.cnpja.com';
    const timeoutMs = Number(process.env.CNPJA_TIMEOUT_MS ?? 12000);
    const strategy = process.env.CNPJA_CACHE_STRATEGY ?? 'CACHE_IF_ERROR';
    const maxAge = Number(process.env.CNPJA_CACHE_MAX_AGE_DAYS ?? 45);
    const maxStale = Number(process.env.CNPJA_CACHE_MAX_STALE_DAYS ?? 365);
    const includeSimples = (process.env.CNPJA_INCLUDE_SIMPLES ?? 'true') !== 'false';
    const includeSuframa = (process.env.CNPJA_INCLUDE_SUFRAMA ?? 'true') !== 'false';
    const registrationsMode = (process.env.CNPJA_REGISTRATIONS_MODE ?? 'ORIGIN').trim();
    const authScheme = (process.env.CNPJA_AUTH_SCHEME ?? 'auto').trim().toLowerCase();
    const authCandidates = this.resolveAuthCandidates(authScheme);

    const params = new URLSearchParams();
    if (includeSimples) params.set('simples', 'true');
    if (includeSuframa) params.set('suframa', 'true');
    if (registrationsMode) params.set('registrations', registrationsMode);
    if (strategy) params.set('strategy', strategy);
    if (Number.isFinite(maxAge) && maxAge > 0) params.set('maxAge', String(maxAge));
    if (Number.isFinite(maxStale) && maxStale > 0) params.set('maxStale', String(maxStale));

    const url = `${baseUrl.replace(/\/+$/, '')}/office/${cnpj}?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let lastError: CnpjaError | null = null;
      for (let index = 0; index < authCandidates.length; index += 1) {
        const scheme = authCandidates[index];
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: this.formatAuthorization(apiKey, scheme),
          },
          signal: controller.signal,
        });

        const text = await response.text();
        const body = text ? this.safeJsonParse(text) : undefined;

        if (response.ok) {
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw {
              status: 502,
              body: { message: 'Resposta inválida da CNPJA' },
            } as CnpjaError;
          }

          if (index > 0) {
            this.logger.warn(
              { cnpj, scheme },
              'CNPJA autenticou após fallback de esquema Authorization',
            );
          } else {
            this.logger.log({ cnpj, scheme }, 'Consultando CNPJ na CNPJA');
          }
          return body as Record<string, unknown>;
        }

        lastError = {
          status: response.status,
          body,
        };

        // Se vier 401 no primeiro esquema, tentamos o próximo.
        if (response.status === 401 && index < authCandidates.length - 1) {
          this.logger.warn(
            { cnpj, scheme, status: response.status, body },
            'Falha de auth na CNPJA; tentando esquema alternativo',
          );
          continue;
        }

        throw lastError;
      }

      throw (
        lastError ?? ({ status: 502, body: { message: 'Falha desconhecida CNPJA' } } as CnpjaError)
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveAuthCandidates(rawScheme: string): AuthScheme[] {
    if (rawScheme === 'raw') return ['raw', 'bearer'];
    if (rawScheme === 'bearer') return ['bearer', 'raw'];
    return ['raw', 'bearer'];
  }

  private formatAuthorization(apiKey: string, scheme: AuthScheme): string {
    return scheme === 'bearer' ? `Bearer ${apiKey}` : apiKey;
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
