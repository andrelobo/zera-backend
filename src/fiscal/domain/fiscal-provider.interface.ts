import { EmitirNfseInput } from './types/emitir-nfse.types';
import { EmitirNfseResult } from './types/emitir-nfse.result';
import { NfseEmissionStatus } from './types/nfse-emission-status';

export interface FiscalProvider {
  providerName: string;
  emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult>;
  consultarNfse(externalId: string): Promise<{
    status: NfseEmissionStatus;
    providerResponse: any;
  }>;
  baixarXmlNfse(externalId: string): Promise<Uint8Array>;
  baixarPdfNfse(
    externalId: string,
    query?: { logotipo?: boolean; mensagem_rodape?: string },
  ): Promise<Uint8Array>;
}
