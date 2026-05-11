export type AiDiagnosticSeverity = 'low' | 'medium' | 'high';

export type AiProbableLayer =
  | 'webhook'
  | 'polling'
  | 'provider'
  | 'payload'
  | 'artifacts'
  | 'unknown';

export interface DiagnoseEmissionEvidence {
  emissionId: string;
  externalId: string | null;
  status: string;
  lastUpdateSource: string | null;
  pollAttempts: number;
  lastPollError: string | null;
  hasWebhookEvent: boolean;
  hasXml: boolean;
  hasPdf: boolean;
  latestWebhookAuditReason: string | null;
  latestWebhookAuditTokenAccepted: boolean | null;
  providerMessage: string | null;
}

export interface DiagnoseEmissionResult {
  agent: 'DiagnoseAgent';
  mode: 'deterministic';
  severity: AiDiagnosticSeverity;
  probableLayer: AiProbableLayer;
  probableCause: string;
  summary: string;
  recommendedActions: string[];
  confidence: number;
  evidence: DiagnoseEmissionEvidence;
  references: string[];
}
