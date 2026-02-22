import { Injectable, Logger } from '@nestjs/common';

type ReceitaWsError = {
  status: number;
  body?: unknown;
};

@Injectable()
export class ReceitaWsCnpjApi {
  private readonly logger = new Logger(ReceitaWsCnpjApi.name);

  async consultarCnpj(cnpj: string): Promise<Record<string, unknown>> {
    const baseUrl = process.env.RECEITAWS_BASE_URL ?? 'https://receitaws.com.br/v1/cnpj';
    const timeoutMs = Number(process.env.RECEITAWS_TIMEOUT_MS ?? 12000);
    const url = `${baseUrl.replace(/\/+$/, '')}/${cnpj}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.log({ cnpj }, 'Consultando CNPJ na ReceitaWS');
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
        } as ReceitaWsError;
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw {
          status: 502,
          body: { message: 'Resposta inválida da ReceitaWS' },
        } as ReceitaWsError;
      }

      const payload = body as Record<string, unknown>;
      if (payload.status === 'ERROR') {
        throw {
          status: 422,
          body: payload,
        } as ReceitaWsError;
      }

      return payload;
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
