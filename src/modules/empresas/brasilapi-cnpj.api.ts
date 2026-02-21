import { Injectable, Logger } from '@nestjs/common';

type BrasilApiError = {
  status: number;
  body?: unknown;
};

@Injectable()
export class BrasilApiCnpjApi {
  private readonly logger = new Logger(BrasilApiCnpjApi.name);

  async consultarCnpj(cnpj: string): Promise<Record<string, unknown>> {
    const baseUrl = process.env.BRASILAPI_BASE_URL ?? 'https://brasilapi.com.br/api/cnpj/v1';
    const timeoutMs = Number(process.env.BRASILAPI_TIMEOUT_MS ?? 12000);
    const url = `${baseUrl.replace(/\/+$/, '')}/${cnpj}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.log({ cnpj }, 'Consultando CNPJ na BrasilAPI');
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const text = await response.text();
      const body = text ? this.safeJsonParse(text) : undefined;

      if (!response.ok) {
        throw {
          status: response.status,
          body,
        } as BrasilApiError;
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw {
          status: 502,
          body: { message: 'Resposta inválida da BrasilAPI' },
        } as BrasilApiError;
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
