import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

type RawServico = {
  codigo_nacional?: string;
  item_lc116?: string;
  sequencial?: number;
  descricao?: string;
};

export type ServicoCatalogItem = {
  codigoNacional: string;
  itemLc116: string;
  sequencial: number;
  descricao: string;
};

function onlyDigits(value?: string): string {
  return (value ?? '').replace(/\D+/g, '');
}

function normalizeText(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

@Injectable()
export class ServicoCatalogService {
  private readonly logger = new Logger(ServicoCatalogService.name);
  private readonly items: ServicoCatalogItem[];
  private readonly configuredPath: string;
  private readonly candidatePaths: string[];
  private readonly resolvedPath: string;
  private loadError: string | null = null;

  constructor() {
    this.configuredPath = process.env.NFSE_SERVICOS_CATALOGO_PATH ?? 'servicos_lc116_v2.json';
    this.candidatePaths = this.buildCandidatePaths(this.configuredPath);
    const { items, resolvedPath } = this.loadCatalog();
    this.items = items;
    this.resolvedPath = resolvedPath;
  }

  private buildCandidatePaths(configuredPath: string): string[] {
    if (isAbsolute(configuredPath)) {
      return [configuredPath];
    }

    return Array.from(
      new Set([
        resolve(process.cwd(), configuredPath),
        resolve(process.cwd(), 'dist', configuredPath),
        resolve(__dirname, '..', '..', configuredPath),
        resolve(__dirname, '..', '..', '..', configuredPath),
      ]),
    );
  }

  private loadCatalog(): { items: ServicoCatalogItem[]; resolvedPath: string } {
    let lastError = 'Catalog file could not be loaded';

    for (const path of this.candidatePaths) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as RawServico[];
        if (!Array.isArray(raw)) {
          lastError = 'Catalog file is not an array';
          continue;
        }

        const parsed = raw
          .map((item) => ({
            codigoNacional: onlyDigits(item.codigo_nacional),
            itemLc116: (item.item_lc116 ?? '').trim(),
            sequencial: Number(item.sequencial ?? 0),
            descricao: (item.descricao ?? '').trim(),
          }))
          .filter((item) => item.codigoNacional.length === 6 && !!item.descricao);

        this.loadError = null;
        this.logger.log(`NFSe service catalog loaded with ${parsed.length} items from ${path}`);
        return { items: parsed, resolvedPath: path };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    const fallbackPath = this.candidatePaths[0] ?? this.configuredPath;
    this.loadError = lastError;
    this.logger.error(
      `Failed to load NFSe service catalog. Tried: ${this.candidatePaths.join(', ')}. Last error: ${lastError}`,
    );
    return { items: [], resolvedPath: fallbackPath };
  }

  findByCodigo(codigo: string): ServicoCatalogItem | null {
    const normalized = onlyDigits(codigo);
    if (normalized.length !== 6) return null;
    return this.items.find((item) => item.codigoNacional === normalized) ?? null;
  }

  getDiagnostics(codes: string[] = ['171901', '170601']) {
    const sampleCodes = codes.map((code) => {
      const normalized = onlyDigits(code);
      const item = normalized.length === 6 ? this.findByCodigo(normalized) : null;
      return {
        codigo: normalized,
        found: Boolean(item),
        descricao: item?.descricao ?? null,
      };
    });

    return {
      configuredPath: this.configuredPath,
      resolvedPath: this.resolvedPath,
      fileExists: existsSync(this.resolvedPath),
      totalItems: this.items.length,
      loadError: this.loadError,
      sampleCodes,
    };
  }

  private searchItems(query?: string): ServicoCatalogItem[] {
    const q = (query ?? '').trim();
    if (!q) {
      return this.items;
    }

    const digitsQuery = onlyDigits(q);
    const normalizedQuery = normalizeText(q);

    const startsWithCode = this.items.filter((item) =>
      digitsQuery ? item.codigoNacional.startsWith(digitsQuery) : false,
    );

    const containsText = this.items.filter((item) => {
      if (!normalizedQuery) return false;
      if (startsWithCode.some((i) => i.codigoNacional === item.codigoNacional)) return false;

      return (
        normalizeText(item.descricao).includes(normalizedQuery) ||
        normalizeText(item.itemLc116).includes(normalizedQuery)
      );
    });

    return [...startsWithCode, ...containsText];
  }

  autocomplete(input?: { q?: string; limit?: number }): ServicoCatalogItem[] {
    const query = (input?.q ?? '').trim();
    const limitRaw = Number(input?.limit ?? 20);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 20;

    return this.searchItems(query).slice(0, limit);
  }

  list(input?: { q?: string; limit?: number; page?: number }): {
    items: ServicoCatalogItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } {
    const query = (input?.q ?? '').trim();
    const limitRaw = Number(input?.limit ?? 20);
    const pageRaw = Number(input?.page ?? 1);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 50)) : 20;
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;

    const filtered = this.searchItems(query);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const normalizedPage = Math.min(page, totalPages);
    const start = (normalizedPage - 1) * limit;
    const items = filtered.slice(start, start + limit);

    return { items, total, page: normalizedPage, limit, totalPages };
  }
}
