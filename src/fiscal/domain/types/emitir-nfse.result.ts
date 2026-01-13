export type EmitirNfseStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'ERROR';

export interface EmitirNfseResult {
  status: EmitirNfseStatus;
  provider: 'PLUGNOTAS';
  referenceId?: string;
  raw?: unknown;
}
