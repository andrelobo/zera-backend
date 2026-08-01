import { NfseEmissionStatus } from './types/nfse-emission-status';

export interface DocumentIdentifiers {
  numeroNfse?: string;
  dpsNum?: string;
  serieDpsNum?: string;
}

export interface ProviderDocumentParser {
  readonly providerName: string;
  extractStatus(response: any): string | undefined;
  mapStatusToDomain(status?: string): NfseEmissionStatus;
  extractDocumentIdentifiers(response: unknown): DocumentIdentifiers;
}
