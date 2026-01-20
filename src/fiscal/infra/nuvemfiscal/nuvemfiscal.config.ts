export type NuvemFiscalEnvironment = 'sandbox' | 'production'

export type NuvemFiscalConfig = {
  environment: NuvemFiscalEnvironment
  clientId: string
  clientSecret: string
  scope: string
  authBaseUrl: string
  apiBaseUrl: string
}

export function getNuvemFiscalConfig(): NuvemFiscalConfig {
  const environment =
    (process.env.NUVEMFISCAL_ENV as NuvemFiscalEnvironment) ?? 'sandbox'

  const clientId = process.env.NUVEMFISCAL_CLIENT_ID ?? ''
  const clientSecret = process.env.NUVEMFISCAL_CLIENT_SECRET ?? ''
  const scope = process.env.NUVEMFISCAL_SCOPE ?? 'nfse'

  const authBaseUrl = 'https://auth.nuvemfiscal.com.br'
  const apiBaseUrl =
    environment === 'production'
      ? 'https://api.nuvemfiscal.com.br'
      : 'https://api.sandbox.nuvemfiscal.com.br'

  return {
    environment,
    clientId,
    clientSecret,
    scope,
    authBaseUrl,
    apiBaseUrl,
  }
}
