import { GenericDocumentParser } from './generic-document-parser';
import { ProviderDocumentParser } from './provider-document-parser';

export class ProviderDocumentParsers {
  private readonly parsers = new Map<string, ProviderDocumentParser>();
  private readonly fallback: ProviderDocumentParser;

  constructor(parsers: ProviderDocumentParser[] = []) {
    const [first] = parsers;
    this.fallback = first ?? new GenericDocumentParser();
    for (const parser of parsers) {
      this.parsers.set(parser.providerName, parser);
    }
  }

  register(parser: ProviderDocumentParser): this {
    this.parsers.set(parser.providerName, parser);
    return this;
  }

  resolve(providerName?: string | null): ProviderDocumentParser {
    if (providerName) {
      const parser = this.parsers.get(providerName);
      if (parser) return parser;
    }
    return this.fallback;
  }

  has(providerName: string): boolean {
    return this.parsers.has(providerName);
  }

  providerNames(): string[] {
    return Array.from(this.parsers.keys());
  }
}
