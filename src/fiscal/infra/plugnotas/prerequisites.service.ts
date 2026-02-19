import { Injectable, Logger } from '@nestjs/common';
import { PlugNotasHttp } from './plugnotas.http';
import { getPlugNotasConfig, type PlugNotasPrereqMode } from './plugnotas.config';

function onlyDigits(v?: string) {
  return (v ?? '').replace(/\D+/g, '');
}

type PrereqOutcome = {
  ok: boolean;
  reason?: string;
  details?: any;
};

@Injectable()
export class PlugNotasPrerequisitesService {
  private readonly logger = new Logger(PlugNotasPrerequisitesService.name);
  private readonly cache = new Map<string, number>();

  constructor(private readonly http: PlugNotasHttp) {}

  async ensureBeforeIssuance(input: { prestadorCnpj: string; codigoCidadeIbge: string }) {
    const cfg = getPlugNotasConfig();

    if (cfg.prereqMode === 'off') {
      return;
    }

    const cityOutcome = cfg.prereqCityCheckEnabled
      ? await this.checkCityHomologation(input.codigoCidadeIbge)
      : { ok: true };

    const companyOutcome = cfg.prereqCompanyEnableEnabled
      ? await this.enableCompanyForNfseNacional(input.prestadorCnpj)
      : { ok: true };

    this.handleOutcome('city_homologation', cityOutcome, cfg.prereqMode);
    this.handleOutcome('company_nfse_nacional_enable', companyOutcome, cfg.prereqMode);
  }

  private handleOutcome(checkName: string, outcome: PrereqOutcome, mode: PlugNotasPrereqMode) {
    if (outcome.ok) return;

    this.logger.warn(`PlugNotas prerequisite failed: ${checkName}`, outcome.details);

    if (mode === 'enforce') {
      const error = Object.assign(new Error(`PlugNotas prerequisite failed: ${checkName}`), {
        code: 'PLUGNOTAS_PREREQ_FAILED',
        check: checkName,
        details: outcome.details ?? null,
      });
      throw error;
    }
  }

  private isCached(cacheKey: string, ttlMs: number): boolean {
    const lastOk = this.cache.get(cacheKey);
    if (!lastOk) return false;
    if (Date.now() - lastOk > ttlMs) return false;
    return true;
  }

  private markCached(cacheKey: string) {
    this.cache.set(cacheKey, Date.now());
  }

  private async checkCityHomologation(codigoCidadeIbge: string): Promise<PrereqOutcome> {
    const cfg = getPlugNotasConfig();
    const ibge = onlyDigits(codigoCidadeIbge);
    if (!ibge) {
      return { ok: false, reason: 'invalid_ibge', details: { codigoCidadeIbge } };
    }

    const cacheKey = `city:${ibge}`;
    if (this.isCached(cacheKey, cfg.prereqCacheTtlMs)) {
      return { ok: true };
    }

    const path = cfg.prereqCityPathTemplate.replace('{ibge}', ibge);

    try {
      const response = await this.http.request<any>({
        method: 'GET',
        path,
      });
      const normalized = Array.isArray(response) ? response[0] : response;
      const inferred = this.inferHomologationStatus(normalized);

      if (inferred === false) {
        return {
          ok: false,
          reason: 'city_not_homologated',
          details: { ibge, response: normalized ?? null },
        };
      }

      this.markCached(cacheKey);
      return { ok: true, details: { ibge, inferred } };
    } catch (error: any) {
      return {
        ok: false,
        reason: 'city_check_failed',
        details: {
          ibge,
          status: error?.status ?? null,
          message: error?.message ?? 'unknown_error',
        },
      };
    }
  }

  private inferHomologationStatus(response: any): boolean | undefined {
    const candidates = [
      response?.homologada,
      response?.homologado,
      response?.habilitada,
      response?.habilitado,
      response?.nfseNacional,
      response?.ambienteNacionalHabilitado,
      response?.situacao?.homologada,
      response?.situacao?.habilitada,
    ].filter((v) => v !== undefined && v !== null);

    for (const value of candidates) {
      if (typeof value === 'boolean') return value;
      const normalized = String(value).trim().toLowerCase();
      if (['true', '1', 'sim', 'yes', 'homologada', 'habilitada'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'nao', 'não', 'no', 'inativa'].includes(normalized)) {
        return false;
      }
    }

    return undefined;
  }

  private async enableCompanyForNfseNacional(prestadorCnpj: string): Promise<PrereqOutcome> {
    const cfg = getPlugNotasConfig();
    const cnpj = onlyDigits(prestadorCnpj);

    if (cnpj.length !== 14) {
      return { ok: false, reason: 'invalid_cnpj', details: { prestadorCnpj } };
    }

    const cacheKey = `company:${cnpj}`;
    if (this.isCached(cacheKey, cfg.prereqCacheTtlMs)) {
      return { ok: true };
    }

    try {
      await this.http.request<any>({
        method: 'PUT',
        path: cfg.prereqCompanyPath,
        body: {
          cnpj,
          cpfCnpj: cnpj,
          nfseNacional: true,
        },
      });
      this.markCached(cacheKey);
      return { ok: true, details: { cnpj } };
    } catch (error: any) {
      return {
        ok: false,
        reason: 'company_enable_failed',
        details: {
          cnpj,
          status: error?.status ?? null,
          message: error?.message ?? 'unknown_error',
          provider: error?.body ?? null,
        },
      };
    }
  }
}
