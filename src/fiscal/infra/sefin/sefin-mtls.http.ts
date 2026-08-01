import { Injectable, Logger } from '@nestjs/common';
import { request as httpsRequest } from 'node:https';
import type { DpsCertMaterialPem } from './dps-signer';
import { getSefinConfig } from './sefin.config';

export type SefinHttpError = {
  code: string;
  status?: number;
  message: string;
  body?: unknown;
  retryAfterMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ''), normalizedBase).toString();
}

function toSefinHttpError(input: {
  code: string;
  status?: number;
  message: string;
  body?: unknown;
  retryAfterMs?: number;
}): SefinHttpError {
  return {
    code: input.code,
    status: input.status,
    message: input.message,
    body: input.body,
    ...(input.retryAfterMs !== undefined ? { retryAfterMs: input.retryAfterMs } : {}),
  };
}

@Injectable()
export class SefinMtlsHttp {
  private readonly logger = new Logger(SefinMtlsHttp.name);

  private executeRawRequest(input: {
    method: 'GET' | 'HEAD' | 'POST';
    url: string;
    headers: Record<string, string>;
    cert: DpsCertMaterialPem;
    body?: string | Uint8Array;
    timeoutMs: number;
    verifyCert: boolean;
  }): Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: Uint8Array;
  }> {
    return new Promise((resolve, reject) => {
      const req = httpsRequest(
        input.url,
        {
          method: input.method,
          headers: input.headers,
          key: input.cert.privateKeyPem,
          cert: input.cert.certificatePem,
          rejectUnauthorized: input.verifyCert,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          res.on('end', () => {
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              body: new Uint8Array(Buffer.concat(chunks)),
            });
          });
        },
      );

      const timer = setTimeout(() => {
        const err = toSefinHttpError({
          code: 'SEFIN_REQUEST_TIMEOUT',
          message: `Sefin HTTP timeout after ${input.timeoutMs}ms`,
        });
        req.destroy(Object.assign(new Error(err.message), err));
      }, input.timeoutMs);

      req.on('error', (err) => {
        clearTimeout(timer);
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'SEFIN_REQUEST_TIMEOUT') {
          reject(err);
          return;
        }
        const mTlsCode =
          code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
            ? 'SEFIN_CERT_VERIFY_FAILED'
            : 'SEFIN_MTLS_ERROR';
        const wrapped = toSefinHttpError({
          code: mTlsCode,
          message: `Sefin mTLS error: ${err.message}`,
        });
        reject(Object.assign(new Error(wrapped.message), wrapped));
      });

      req.on('close', () => {
        clearTimeout(timer);
      });

      if (input.body !== undefined) {
        req.write(input.body);
      }
      req.end();
    });
  }

  async request(input: {
    method: 'GET' | 'HEAD' | 'POST';
    baseUrl?: string;
    path: string;
    query?: Record<string, any>;
    cert: DpsCertMaterialPem;
    body?: string | Uint8Array;
    contentType?: string;
  }): Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: Uint8Array;
    text: string;
    json?: any;
  }> {
    const cfg = getSefinConfig();
    const baseUrl = input.baseUrl ?? cfg.baseUrl;
    const url = buildUrl(baseUrl, input.path);

    if (input.query) {
      const target = new URL(url);
      for (const [k, v] of Object.entries(input.query)) {
        if (v === undefined || v === null) continue;
        target.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json, application/xml, */*',
      ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
    };

    this.logger.log(`[${cfg.environment}] ${input.method} ${input.path}`);

    try {
      const res = await this.executeRawRequest({
        method: input.method,
        url,
        headers,
        cert: input.cert,
        body: input.body,
        timeoutMs: cfg.timeoutMs,
        verifyCert: cfg.verifyCert,
      });

      const text = Buffer.from(res.body).toString('utf8');
      const contentType = normalizeHeaderValue(res.headers['content-type']) ?? '';
      let json: any;
      if (text && contentType.includes('json')) {
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
      }

      if (res.status < 200 || res.status >= 300) {
        const retryAfterMs = parseRetryAfterMs(normalizeHeaderValue(res.headers['retry-after']));
        const err = toSefinHttpError({
          code: 'SEFIN_HTTP_ERROR',
          status: res.status,
          message: `Sefin API error: ${res.status}`,
          body: json ?? (text || undefined),
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        });
        throw Object.assign(new Error(err.message), err);
      }

      return { status: res.status, headers: res.headers, body: res.body, text, json };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }
      throw toSefinHttpError({
        code: 'SEFIN_MTLS_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
