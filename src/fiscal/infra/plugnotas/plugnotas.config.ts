export type PlugNotasEnvironment = 'sandbox' | 'production'

export type PlugNotasConfig = {
  environment: PlugNotasEnvironment
  baseUrl: string
  apiKey: string
  cnpjPathTemplate: string
  nfseXmlPathTemplate: string
  nfsePdfPathTemplate: string
}

function inferEnvironment(baseUrl: string): PlugNotasEnvironment {
  return baseUrl.includes('sandbox') ? 'sandbox' : 'production'
}

export function getPlugNotasConfig(): PlugNotasConfig {
  const baseUrl = process.env.PLUGNOTAS_BASE_URL ?? 'https://api.sandbox.plugnotas.com.br'
  const apiKey = process.env.PLUGNOTAS_API_KEY ?? ''
  const environment = (process.env.PLUGNOTAS_ENV as PlugNotasEnvironment) ?? inferEnvironment(baseUrl)
  const cnpjPathTemplate = process.env.PLUGNOTAS_CNPJ_PATH ?? '/cnpj/{cnpj}'
  const nfseXmlPathTemplate = process.env.PLUGNOTAS_NFSE_XML_PATH ?? '/nfse/xml/{id}'
  const nfsePdfPathTemplate = process.env.PLUGNOTAS_NFSE_PDF_PATH ?? '/nfse/pdf/{id}'

  if (!apiKey) {
    throw new Error('PLUGNOTAS_API_KEY not set')
  }

  return {
    environment,
    baseUrl,
    apiKey,
    cnpjPathTemplate,
    nfseXmlPathTemplate,
    nfsePdfPathTemplate,
  }
}
