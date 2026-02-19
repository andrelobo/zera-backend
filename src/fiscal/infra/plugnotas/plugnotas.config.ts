import { Logger } from '@nestjs/common';

export type PlugNotasEnvironment = 'sandbox' | 'production';
export type PlugNotasPrereqMode = 'off' | 'warn' | 'enforce';

export type PlugNotasConfig = {
  environment: PlugNotasEnvironment;
  baseUrl: string;
  apiKey: string;
  cnpjPathTemplate: string;
  nfseXmlPathTemplate: string;
  nfsePdfPathTemplate: string;
  prereqMode: PlugNotasPrereqMode;
  prereqCityCheckEnabled: boolean;
  prereqCompanyEnableEnabled: boolean;
  prereqCityPathTemplate: string;
  prereqCompanyPath: string;
  prereqCacheTtlMs: number;
};

function inferEnvironment(baseUrl: string): PlugNotasEnvironment {
  return baseUrl.includes('sandbox') ? 'sandbox' : 'production';
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parsePrereqMode(value: string | undefined): PlugNotasPrereqMode {
  const normalized = (value ?? 'off').trim().toLowerCase();
  if (normalized === 'warn' || normalized === 'enforce') {
    return normalized;
  }
  return 'off';
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
}

export function getPlugNotasConfig(): PlugNotasConfig {
  const logger = new Logger('PlugNotasConfig');
  const baseUrl = process.env.PLUGNOTAS_BASE_URL ?? 'https://api.sandbox.plugnotas.com.br';
  const apiKey = process.env.PLUGNOTAS_API_KEY ?? '';
  const environment =
    (process.env.PLUGNOTAS_ENV as PlugNotasEnvironment) ?? inferEnvironment(baseUrl);
  const cnpjPathTemplate = process.env.PLUGNOTAS_CNPJ_PATH ?? '/cnpj/{cnpj}';
  const nfseXmlPathTemplate = process.env.PLUGNOTAS_NFSE_XML_PATH ?? '/nfse/xml/{id}';
  const nfsePdfPathTemplate = process.env.PLUGNOTAS_NFSE_PDF_PATH ?? '/nfse/pdf/{id}';
  const prereqMode = parsePrereqMode(process.env.PLUGNOTAS_PREREQ_MODE);
  const prereqCityCheckEnabled = parseBoolean(process.env.PLUGNOTAS_PREREQ_CHECK_CITY, true);
  const prereqCompanyEnableEnabled = parseBoolean(
    process.env.PLUGNOTAS_PREREQ_ENABLE_COMPANY,
    false,
  );
  const prereqCityPathTemplate =
    process.env.PLUGNOTAS_PREREQ_CITY_PATH ?? '/Auxiliares/getCidadeById?id={ibge}';
  const prereqCompanyPath = process.env.PLUGNOTAS_PREREQ_COMPANY_PATH ?? '/Empresa/updateCompany';
  const prereqCacheTtlMs = parsePositiveInt(process.env.PLUGNOTAS_PREREQ_CACHE_TTL_MS, 3600000);

  if (!apiKey) {
    throw new Error('PLUGNOTAS_API_KEY not set');
  }

  if ((process.env.PLUGNOTAS_DEBUG_CONFIG ?? 'false').toLowerCase() === 'true') {
    const suffix = apiKey.slice(-4);
    logger.log(
      `PlugNotas config loaded env=${environment} baseUrl=${baseUrl} apiKeySuffix=****${suffix}`,
    );
  }

  return {
    environment,
    baseUrl,
    apiKey,
    cnpjPathTemplate,
    nfseXmlPathTemplate,
    nfsePdfPathTemplate,
    prereqMode,
    prereqCityCheckEnabled,
    prereqCompanyEnableEnabled,
    prereqCityPathTemplate,
    prereqCompanyPath,
    prereqCacheTtlMs,
  };
}
