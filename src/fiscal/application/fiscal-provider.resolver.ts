import { Injectable } from '@nestjs/common';
import type { FiscalProvider } from '../domain/fiscal-provider.interface';
import { LOBONOTAS_PROVIDER, PLUGNOTAS_PROVIDER } from '../domain/provider-names';
import { LobonotasConfig } from '../infra/sefin/lobonotas.config';
import { LobonotasProvider } from '../infra/sefin/sefin.provider';
import { PlugNotasProvider } from '../infra/plugnotas.provider';

function envBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function unknownProviderError(name: string): Error {
  return Object.assign(new Error(`FiscalProvider desconhecido: ${name}`), {
    code: 'FISCAL_PROVIDER_UNKNOWN',
  });
}

@Injectable()
export class FiscalProviderResolver {
  private readonly registry: Record<string, FiscalProvider>;

  constructor(
    plugNotasProvider: PlugNotasProvider,
    lobonotasProvider: LobonotasProvider,
    private readonly config: LobonotasConfig,
  ) {
    this.registry = {
      [PLUGNOTAS_PROVIDER]: plugNotasProvider,
      [LOBONOTAS_PROVIDER]: lobonotasProvider,
    };
  }

  activeProviderName(): string {
    const explicit = process.env.FISCAL_PROVIDER_ACTIVE?.trim().toUpperCase();
    if (explicit) return explicit;
    if (envBoolean(process.env.SEFIN_ENABLED, false)) return LOBONOTAS_PROVIDER;
    return PLUGNOTAS_PROVIDER;
  }

  isActive(name: string): boolean {
    return name === this.activeProviderName();
  }

  byProviderName(name: string): FiscalProvider {
    const provider = this.registry[name];
    if (!provider) throw unknownProviderError(name);
    return provider;
  }

  resolve(): FiscalProvider {
    return this.byProviderName(this.activeProviderName());
  }

  resolveProviderForCnpj(cnpj?: string): FiscalProvider {
    if (this.config.isPilotoCnpj(cnpj)) {
      return this.byProviderName(LOBONOTAS_PROVIDER);
    }
    return this.resolve();
  }

  pollingProviderNames(): string[] {
    const names = new Set<string>([this.resolve().providerName]);
    if (this.config.pilotEnabled) names.add(LOBONOTAS_PROVIDER);
    return Array.from(names);
  }
}
