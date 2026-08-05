import { Injectable, Logger } from '@nestjs/common';
import type { FiscalProvider } from '../domain/fiscal-provider.interface';
import { LOBONOTAS_PROVIDER, PLUGNOTAS_PROVIDER } from '../domain/provider-names';
import { LobonotasConfig } from '../infra/sefin/lobonotas.config';
import { LobonotasProvider } from '../infra/sefin/sefin.provider';
import { PlugNotasProvider } from '../infra/plugnotas.provider';

function unknownProviderError(name: string): Error {
  return Object.assign(new Error(`FiscalProvider desconhecido: ${name}`), {
    code: 'FISCAL_PROVIDER_UNKNOWN',
  });
}

@Injectable()
export class FiscalProviderResolver {
  private readonly logger = new Logger(FiscalProviderResolver.name);
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

  /**
   * Politica operacional permanente:
   * - LOBONOTAS e o unico provider operacional (emissao, sync, cancelamento, polling, download).
   * - PLUGNOTAS nunca e fallback e nunca executa operacoes externas (apenas leitura historica/auditoria).
   */
  activeProviderName(): string {
    const explicit = process.env.FISCAL_PROVIDER_ACTIVE?.trim().toUpperCase();
    if (explicit && explicit !== LOBONOTAS_PROVIDER) {
      this.logger.warn(
        `FISCAL_PROVIDER_ACTIVE=${explicit} ignorado: o unico provider operacional e ${LOBONOTAS_PROVIDER} (PlugNotas desativado para operacoes externas)`,
      );
    }
    return LOBONOTAS_PROVIDER;
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

  resolveProviderForCnpj(_cnpj?: string): FiscalProvider {
    return this.resolve();
  }

  pollingProviderNames(): string[] {
    return [LOBONOTAS_PROVIDER];
  }
}
