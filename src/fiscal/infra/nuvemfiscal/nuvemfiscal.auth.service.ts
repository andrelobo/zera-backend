import { Injectable } from '@nestjs/common'
import { getNuvemFiscalConfig } from './nuvemfiscal.config'

type OAuthTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
}

@Injectable()
export class NuvemFiscalAuthService {
  private accessToken: string | null = null
  private expiresAtMs: number = 0

  async getAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && now < this.expiresAtMs) {
      return this.accessToken
    }

    const cfg = getNuvemFiscalConfig()

    if (!cfg.clientId || !cfg.clientSecret) {
      throw new Error('NUVEMFISCAL_CLIENT_ID/NUVEMFISCAL_CLIENT_SECRET not set')
    }

    const tokenUrl = `${cfg.authBaseUrl}/oauth/token`

    const body = new URLSearchParams()
    body.set('grant_type', 'client_credentials')
    body.set('client_id', cfg.clientId)
    body.set('client_secret', cfg.clientSecret)
    body.set('scope', cfg.scope)

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`NuvemFiscal token error: ${res.status} ${text}`)
    }

    const data = (await res.json()) as OAuthTokenResponse

    const safetyWindowMs = 30_000
    const ttlMs = Math.max(0, data.expires_in * 1000 - safetyWindowMs)

    this.accessToken = data.access_token
    this.expiresAtMs = Date.now() + ttlMs

    return this.accessToken
  }
}
