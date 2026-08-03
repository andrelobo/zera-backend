import { Injectable } from '@nestjs/common';

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

export function parseCnpjAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  for (const entry of raw.split(',')) {
    const digits = onlyDigits(entry);
    if (digits.length === 14 && !seen.has(digits)) seen.add(digits);
  }
  return Array.from(seen);
}

export function normalizeCnpj(value?: string): string {
  return onlyDigits(value);
}

@Injectable()
export class LobonotasConfig {
  get pilotEnabled(): boolean {
    return parseBooleanEnv(process.env.LOBONOTAS_PILOT_ENABLED, false);
  }

  get pilotCnpjs(): string[] {
    return parseCnpjAllowlist(process.env.LOBONOTAS_CNPJS_MANAUS);
  }

  isPilotoCnpj(cnpj?: string): boolean {
    if (!this.pilotEnabled) return false;
    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14) return false;
    return this.pilotCnpjs.includes(digits);
  }
}
