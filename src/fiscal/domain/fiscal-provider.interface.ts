import { EmitirNfseInput } from './types/emitir-nfse.types';
import { EmitirNfseResult } from './types/emitir-nfse.result';

export interface FiscalProvider {
  emitirNfse(input: EmitirNfseInput): Promise<EmitirNfseResult>;
}
