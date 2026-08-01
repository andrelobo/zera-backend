import { Logger } from '@nestjs/common';

export type SefinEnvironment = 'producaorestrita' | 'homologacao' | 'producao';
export type SefinNfseEnvelope = 'xml' | 'json';

export type SefinConfig = {
  enabled: boolean;
  environment: SefinEnvironment;
  baseUrl: string;
  adnBaseUrl: string;
  tpAmb: '1' | '2';
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  verAplic: string;
  dpsSerie: string;
  cLocEmi: string;
  codigoTributacaoNacional?: string;
  verifyCert: boolean;
  nfseEnvelope: SefinNfseEnvelope;
};

function inferEnvironment(baseUrl: string): SefinEnvironment {
  if (baseUrl.includes('producaorestrita')) return 'producaorestrita';
  if (baseUrl.includes('homolog')) return 'homologacao';
  return 'producao';
}

function inferTpAmb(environment: SefinEnvironment): '1' | '2' {
  return environment === 'producao' ? '1' : '2';
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.floor(parsed);
}

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function getSefinConfig(): SefinConfig {
  const logger = new Logger('SefinConfig');

  const enabled = parseBoolean(process.env.SEFIN_ENABLED, false);
  const baseUrl = process.env.SEFIN_BASE_URL ?? 'https://sefin.producaorestrita.nfse.gov.br';
  const adnBaseUrl = process.env.SEFIN_ADN_BASE_URL ?? 'https://adn.producaorestrita.nfse.gov.br';
  const environment =
    (process.env.SEFIN_ENV as SefinEnvironment | undefined) ?? inferEnvironment(baseUrl);
  const tpAmbOverride = process.env.SEFIN_TP_AMB;
  const tpAmb: '1' | '2' =
    tpAmbOverride === '1' || tpAmbOverride === '2' ? tpAmbOverride : inferTpAmb(environment);

  const cLocEmi =
    onlyDigits(process.env.SEFIN_CMUN_IBGE) || onlyDigits(process.env.NFSE_CMUN_IBGE) || '1302603';

  const verAplic = process.env.NFSE_VER_APLIC ?? process.env.SEFIN_VER_APLIC ?? 'ZERA-1.0';

  const cfg: SefinConfig = {
    enabled,
    environment,
    baseUrl,
    adnBaseUrl,
    tpAmb,
    timeoutMs: parsePositiveInt(process.env.SEFIN_HTTP_TIMEOUT_MS, 30000),
    maxAttempts: parsePositiveInt(process.env.SEFIN_HTTP_MAX_ATTEMPTS, 3),
    baseDelayMs: parsePositiveInt(process.env.SEFIN_HTTP_BASE_DELAY_MS, 500),
    maxDelayMs: parsePositiveInt(process.env.SEFIN_HTTP_MAX_DELAY_MS, 5000),
    verAplic,
    dpsSerie: onlyDigits(process.env.SEFIN_DPS_SERIE) || '1',
    cLocEmi,
    codigoTributacaoNacional: process.env.SEFIN_CODIGO_TRIBUTACAO_NACIONAL?.trim() || undefined,
    verifyCert: parseBoolean(process.env.SEFIN_VERIFY_CERT, true),
    nfseEnvelope: process.env.SEFIN_NFSE_ENVELOPE === 'json' ? 'json' : 'xml',
  };

  if (enabled && !baseUrl) {
    logger.warn('SEFIN_ENABLED=true mas SEFIN_BASE_URL ausente; provider usará default');
  }

  return cfg;
}
