import { Injectable } from '@nestjs/common'
import { getNuvemFiscalConfig } from './nuvemfiscal.config'
import { NuvemFiscalAuthService } from './nuvemfiscal.auth.service'

export type NuvemFiscalHttpError = {
  status: number
  message: string
  body?: unknown
}

@Injectable()
export class NuvemFiscalHttp {
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
  }): Promise<T> {
    const token = await this.auth.getAccessToken()

    const url = this.buildUrl(input.path, input.query)

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

    const res = await fetch(url, {
      method: input.method,
      headers,
      body,
    })

    const contentType = res.headers.get('content-type') ?? ''
    const isJson = contentType.includes('application/json')

    if (!res.ok) {
      const parsedBody = isJson
        ? await res.json().catch(() => undefined)
        : await res.text().catch(() => undefined)

      const err: NuvemFiscalHttpError = {
        status: res.status,
        message: `NuvemFiscal API error: ${res.status}`,
        body: parsedBody,
      }

      throw Object.assign(new Error(err.message), err)
    }

    if (res.status === 204) {
      return undefined as unknown as T
    }

    if (isJson) {
      return (await res.json()) as T
    }

    const arrayBuffer = await res.arrayBuffer()
    return new Uint8Array(arrayBuffer) as unknown as T
  }
}
