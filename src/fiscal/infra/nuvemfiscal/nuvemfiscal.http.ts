import { Injectable, Logger } from '@nestjs/common'
import { getNuvemFiscalConfig } from './nuvemfiscal.config'
import { NuvemFiscalAuthService } from './nuvemfiscal.auth.service'

export type NuvemFiscalHttpError = {
  status: number
  message: string
  body?: unknown
  retryAfterMs?: number
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const dateMs = Date.parse(value)
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now())
  return undefined
}

@Injectable()
export class NuvemFiscalHttp {
  private readonly logger = new Logger(NuvemFiscalHttp.name)

  constructor(private readonly auth: NuvemFiscalAuthService) {}

  private buildUrl(path: string, query?: Record<string, any>) {
    const cfg = getNuvemFiscalConfig()
    const url = new URL(`${cfg.apiBaseUrl}${path}`)

    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue
        url.searchParams.set(k, String(v))
      }
    }

    return url.toString()
  }

  async request<T>(input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    path: string
    query?: Record<string, any>
    body?: any
    headers?: Record<string, string>
    retry?: {
      maxAttempts?: number
      baseDelayMs?: number
      maxDelayMs?: number
    }
  }): Promise<T> {
    const cfg = getNuvemFiscalConfig()
    const url = this.buildUrl(input.path, input.query)

    const maxAttempts = input.retry?.maxAttempts ?? Number(process.env.NUVEMFISCAL_HTTP_MAX_ATTEMPTS ?? 3)
    const baseDelayMs = input.retry?.baseDelayMs ?? Number(process.env.NUVEMFISCAL_HTTP_BASE_DELAY_MS ?? 500)
    const maxDelayMs = input.retry?.maxDelayMs ?? Number(process.env.NUVEMFISCAL_HTTP_MAX_DELAY_MS ?? 5000)

    let attempt = 0
    while (true) {
      attempt += 1
      const startedAt = Date.now()

      try {
        const token = await this.auth.getAccessToken()

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          ...input.headers,
        }

        let body: any = undefined
        if (input.body !== undefined) {
          headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
          body =
            headers['Content-Type'] === 'application/json'
              ? JSON.stringify(input.body)
              : input.body
        }

        this.logger.log(`[${cfg.environment}] ${input.method} ${input.path} attempt=${attempt}`)

        const res = await fetch(url, {
          method: input.method,
          headers,
          body,
        })

        const elapsed = Date.now() - startedAt
        const contentType = res.headers.get('content-type') ?? ''
        const isJson = contentType.includes('application/json')

        if (!res.ok) {
          const parsedBody = isJson
            ? await res.json().catch(() => undefined)
            : await res.text().catch(() => undefined)

          const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'))

          const err: NuvemFiscalHttpError = {
            status: res.status,
            message: `NuvemFiscal API error: ${res.status}`,
            body: parsedBody,
            retryAfterMs,
          }

          const transient = res.status === 429 || (res.status >= 500 && res.status <= 599)

          this.logger.warn(`[${cfg.environment}] ${input.method} ${input.path} status=${res.status} ms=${elapsed} transient=${transient}`)

          if (transient && attempt < maxAttempts) {
            const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
            const jitter = Math.floor(Math.random() * 200)
            const delay = Math.min(maxDelayMs, (retryAfterMs ?? exp) + jitter)
            await sleep(delay)
            continue
          }

          throw Object.assign(new Error(err.message), err)
        }

        this.logger.log(`[${cfg.environment}] ${input.method} ${input.path} status=${res.status} ms=${elapsed}`)

        if (res.status === 204) {
          return undefined as unknown as T
        }

        if (isJson) {
          return (await res.json()) as T
        }

        const arrayBuffer = await res.arrayBuffer()
        return new Uint8Array(arrayBuffer) as unknown as T
      } catch (e) {
        const status = (e as any)?.status
        const isHttpTransient = status === 429 || (typeof status === 'number' && status >= 500 && status <= 599)
        const isNetwork = status === undefined

        if ((isHttpTransient || isNetwork) && attempt < maxAttempts) {
          const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1))
          const jitter = Math.floor(Math.random() * 200)
          await sleep(Math.min(maxDelayMs, exp + jitter))
          continue
        }

        throw e
      }
    }
  }
}
