import { Injectable, Logger } from '@nestjs/common';

type CnpjaError = {
  status: number;
  body?: unknown;
};

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
    const authScheme = (process.env.CNPJA_AUTH_SCHEME ?? 'raw').trim().toLowerCase();
    const authorization =
      authScheme === 'bearer'
        ? `Bearer ${apiKey}`
        : apiKey;

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
      this.logger.log({ cnpj }, 'Consultando CNPJ na CNPJA');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      const body = text ? this.safeJsonParse(text) : undefined;

      if (!response.ok) {
        throw {
          status: response.status,
          body,
        } as CnpjaError;
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw {
          status: 502,
          body: { message: 'Resposta inválida da CNPJA' },
        } as CnpjaError;
      }

      return body as Record<string, unknown>;
    } finally {
      clearTimeout(timer);
    }
  }

  private safeJsonParse(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
