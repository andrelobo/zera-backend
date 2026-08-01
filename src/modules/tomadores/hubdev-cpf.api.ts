import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type HubdevError = {
  status: number;
  body?: unknown;
};

@Injectable()
export class HubdevCpfApi {
  private readonly logger = new Logger(HubdevCpfApi.name);

  async consultarCpf(cpf: string): Promise<Record<string, unknown>> {
    const token = (process.env.HUBDEV_CADASTROPF_TOKEN ?? process.env.HUBDEV_TOKEN ?? '').trim();
    if (!token) {
      throw new ServiceUnavailableException({
        code: 'CPF_LOOKUP_NOT_CONFIGURED',
        message: 'Integração de CPF não configurada no backend.',
      });
    }

    const baseUrl = (
      process.env.HUBDEV_CADASTROPF_BASE_URL ??
      'https://ws.hubdodesenvolvedor.com.br/v2/cadastropf/'
    ).trim();
    const timeoutMs = Number(process.env.HUBDEV_CADASTROPF_TIMEOUT_MS ?? 12000);
    const url = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
    url.searchParams.set('cpf', cpf);
    url.searchParams.set('token', token);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      this.logger.log({ cpf }, 'Consultando CPF no Hub do Desenvolvedor');
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      const text = await response.text();
      const body = text ? this.safeJsonParse(text) : undefined;

      if (response.status === 404) {
        return {};
      }

      if (!response.ok) {
        throw {
          status: response.status,
          body,
        } as HubdevError;
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return {};
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
