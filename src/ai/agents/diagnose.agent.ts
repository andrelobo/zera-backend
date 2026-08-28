import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NfseEmissionStatus } from '../../fiscal/domain/types/nfse-emission-status';
import { NfseEmissionRepository } from '../../fiscal/infra/mongo/repositories/nfse-emission.repository';
import type { NfseEmissionDocument } from '../../fiscal/infra/mongo/schemas/nfse-emission.schema';
import { WebhookDeliveryAuditRepository } from '../../modules/webhooks/webhook-delivery-audit.repository';
import type { DiagnoseEmissionResult } from '../interfaces/diagnose-emission-result.interface';

const WEBHOOK_ROUTE = '/webhooks/fiscal';

type WebhookAuditSummary = {
  reason?: string | null;
  tokenAccepted?: boolean | null;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsAny(text: string, terms: string[]): boolean {
  const haystack = normalizeForSearch(text);
  return terms.some((term) => haystack.includes(normalizeForSearch(term)));
}

function collectMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMessages(item));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const direct = [
    record.message,
    record.Mensagem,
    record.descricao,
    record.Descricao,
    record.error,
    record.erro,
    record.detail,
    record.details,
    record.reason,
  ].flatMap((item) => collectMessages(item));

  return direct;
}

@Injectable()
export class DiagnoseAgent {
  constructor(
    private readonly emissions: NfseEmissionRepository,
    private readonly webhookAudits: WebhookDeliveryAuditRepository,
  ) {}

  async diagnoseEmission(input: {
    emissionId?: string;
    externalId?: string;
  }): Promise<DiagnoseEmissionResult> {
    const emission = await this.resolveEmission(input);
    const [lastAudit, lastSuccess, lastFailure] = await Promise.all([
      this.webhookAudits.getLatestByRoute(WEBHOOK_ROUTE),
      this.webhookAudits.getLatestSuccessByRoute(WEBHOOK_ROUTE),
      this.webhookAudits.getLatestFailureByRoute(WEBHOOK_ROUTE),
    ]);

    return this.buildResult(emission, {
      lastAudit: lastAudit as WebhookAuditSummary | null,
      lastSuccess: lastSuccess as WebhookAuditSummary | null,
      lastFailure: lastFailure as WebhookAuditSummary | null,
    });
  }

  private async resolveEmission(input: { emissionId?: string; externalId?: string }) {
    const emissionId = normalizeString(input.emissionId);
    const externalId = normalizeString(input.externalId);

    if (!emissionId && !externalId) {
      throw new BadRequestException({
        code: 'AI_DIAGNOSIS_INPUT_REQUIRED',
        message: 'Informe emissionId ou externalId para diagnosticar a emissão.',
      });
    }

    const emission = emissionId
      ? await this.emissions.findById(emissionId)
      : await this.emissions.findByExternalId(externalId!);

    if (!emission) {
      throw new NotFoundException({
        code: 'AI_DIAGNOSIS_EMISSION_NOT_FOUND',
        message: 'Emissão não encontrada para diagnóstico.',
      });
    }

    return emission;
  }

  private buildResult(
    emission: NfseEmissionDocument,
    audits: {
      lastAudit: WebhookAuditSummary | null;
      lastSuccess: WebhookAuditSummary | null;
      lastFailure: WebhookAuditSummary | null;
    },
  ): DiagnoseEmissionResult {
    const raw = emission as any;
    const status = emission.status;
    const lastUpdateSource = raw.lastUpdateSource ?? null;
    const pollAttempts = raw.pollAttempts ?? 0;
    const lastPollError = normalizeString(raw.lastPollError);
    const hasWebhookEvent = Boolean(raw.lastWebhookAt);
    const hasXml = Boolean(emission.xmlBase64);
    const hasPdf = Boolean(emission.pdfBase64);
    const providerMessage =
      collectMessages([
        emission.error,
        emission.providerResponse,
        raw.lastPollError,
        audits.lastFailure?.reason,
      ])[0] ?? null;

    const evidence = {
      emissionId: emission._id.toString(),
      externalId: emission.externalId ?? null,
      empresaCnpj: emission.empresaCnpj ?? null,
      status,
      lastUpdateSource,
      pollAttempts,
      lastPollError,
      hasWebhookEvent,
      hasXml,
      hasPdf,
      latestWebhookAuditReason: audits.lastFailure?.reason ?? audits.lastAudit?.reason ?? null,
      latestWebhookAuditTokenAccepted:
        audits.lastFailure?.tokenAccepted ?? audits.lastAudit?.tokenAccepted ?? null,
      providerMessage,
    };

    const references = [
      'AI_CONTEXT.md#16 DIAGNOSE AGENT',
      'AI_CONTEXT.md#17 FORMATO DE RESPOSTA',
      'CURRENT_STATE.md#0 Atualizacao rapida (08/04/2026) - webhook homologado em producao com callback real aplicado',
      'CONTEXT.md#PREMISSA CANONICA DE OPERACAO',
      '/nfse/:id/observability',
      '/nfse/webhook/diagnostico',
    ];

    const combinedText = [providerMessage, lastPollError, emission.error].filter(Boolean).join(' ');

    if (audits.lastFailure?.reason === 'invalid_shared_secret' && !hasWebhookEvent) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'high',
        probableLayer: 'webhook',
        probableCause: 'invalid_shared_secret',
        summary:
          'O callback fiscal provavelmente está chegando com segredo divergente e não consegue atualizar a emissão.',
        recommendedActions: [
          'Conferir WEBHOOK_SHARED_SECRET no backend e o header x-webhook-token configurado no provider.',
          'Consultar /nfse/webhook/diagnostico para validar lastFailure, tokenAccepted e rota recebida.',
          'Não desligar o polling enquanto o webhook não voltar a atualizar emissões reais.',
        ],
        confidence: 0.98,
        evidence,
        references,
      };
    }

    if (
      containsAny(combinedText, [
        'temporariamente indisponivel',
        'temporariamente indisponível',
        'indisponivel',
        'indisponível',
        'manutencao',
        'manutenção',
        'timeout',
        'unavailable',
        '503',
        '502',
        '504',
        '429',
      ])
    ) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'high',
        probableLayer: 'provider',
        probableCause: 'provider_temporarily_unavailable',
        summary:
          'A emissão aparenta ter esbarrado em indisponibilidade transitória da cadeia externa da NFS-e, não em regra fiscal local.',
        recommendedActions: [
          'Evitar reenvio cego para não correr risco de duplicidade quando o provedor normalizar.',
          'Consultar /nfse/:id/observability e a resposta do provider para confirmar se houve fila, timeout ou manutenção externa.',
          'Retentar apenas após normalização do Ambiente Nacional/PlugNotas e com checagem de status da emissão existente.',
        ],
        confidence: 0.93,
        evidence,
        references,
      };
    }

    if (status === NfseEmissionStatus.AUTHORIZED && (!hasXml || !hasPdf)) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'medium',
        probableLayer: 'artifacts',
        probableCause: 'artifact_sync_incomplete',
        summary:
          'A emissão parece autorizada, mas a sincronização de artefatos ainda está incompleta.',
        recommendedActions: [
          'Consultar /nfse/:id/observability para revisar artifactSyncAudit e a timeline completa.',
          'Executar sincronização de XML/PDF apenas sobre a emissão já autorizada, sem reenviar a nota.',
          'Verificar se o provider já disponibilizou ambos os artefatos para download.',
        ],
        confidence: 0.88,
        evidence,
        references,
      };
    }

    if (status === NfseEmissionStatus.AUTHORIZED && lastUpdateSource === 'webhook') {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'low',
        probableLayer: 'webhook',
        probableCause: 'webhook_operational',
        summary: 'A emissão foi concluída pelo caminho preferencial, com atualização via webhook.',
        recommendedActions: [
          'Usar esta emissão como referência de comportamento saudável para comparação com incidentes futuros.',
        ],
        confidence: 0.99,
        evidence,
        references,
      };
    }

    if (status === NfseEmissionStatus.AUTHORIZED && lastUpdateSource === 'polling') {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'medium',
        probableLayer: 'webhook',
        probableCause: 'webhook_not_confirmed_for_this_emission',
        summary:
          'A emissão foi autorizada, mas o fechamento operacional desta ocorrência aconteceu por polling e não por webhook.',
        recommendedActions: [
          'Comparar a timeline da emissão com /nfse/webhook/diagnostico para confirmar se o callback chegou ou ficou sem match.',
          'Manter polling ativo como fallback operacional.',
          'Se isso virar padrão, revisar segredo, entrega do callback e correlação por externalId/idIntegracao.',
        ],
        confidence: 0.86,
        evidence,
        references,
      };
    }

    if (
      status === NfseEmissionStatus.REJECTED ||
      containsAny(combinedText, [
        'rejected the request',
        'invalido',
        'inválido',
        'deve conter',
        'nao encontrado no catalogo',
        'não encontrado no catálogo',
        'required',
      ])
    ) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'medium',
        probableLayer: 'payload',
        probableCause: 'payload_or_catalog_rejection',
        summary:
          'A emissão parece ter sido rejeitada por payload, catálogo fiscal ou validação determinística do fluxo.',
        recommendedActions: [
          'Revisar os campos fiscais obrigatórios e o conteúdo persistido em providerRequest/providerResponse.',
          'Conferir código de serviço, endereço do tomador e demais dados exigidos pelo fluxo acionado.',
          'Se a emissão foi quick, validar também o catálogo LC116 e o endpoint /nfse/servicos/diagnostico.',
        ],
        confidence: 0.82,
        evidence,
        references,
      };
    }

    if (status === NfseEmissionStatus.PENDING && pollAttempts > 0 && !hasWebhookEvent) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'medium',
        probableLayer: 'polling',
        probableCause: 'polling_fallback_active',
        summary:
          'A emissão ainda está em processamento e o backend está dependendo do polling como trilha de fechamento.',
        recommendedActions: [
          'Acompanhar nextPollAt e lastPollError em /nfse/:id/observability antes de tentar nova emissão.',
          'Conferir /nfse/webhook/diagnostico para entender se houve ausência de callback ou apenas atraso de entrega.',
          'Preservar a emissão atual e evitar duplicidade operacional durante o processamento.',
        ],
        confidence: 0.79,
        evidence,
        references,
      };
    }

    if (status === NfseEmissionStatus.PENDING) {
      return {
        agent: 'DiagnoseAgent',
        mode: 'deterministic',
        severity: 'low',
        probableLayer: 'unknown',
        probableCause: 'emission_still_processing',
        summary:
          'A emissão ainda parece estar dentro do ciclo normal de processamento, sem evidência forte de falha conclusiva.',
        recommendedActions: [
          'Aguardar a evolução da timeline em /nfse/:id/observability antes de concluir incidente.',
          'Se o tempo fugir do padrão operacional, cruzar com webhook e provider diagnostics.',
        ],
        confidence: 0.68,
        evidence,
        references,
      };
    }

    return {
      agent: 'DiagnoseAgent',
      mode: 'deterministic',
      severity: status === NfseEmissionStatus.ERROR ? 'high' : 'medium',
      probableLayer: 'unknown',
      probableCause: 'unclassified_backend_error',
      summary:
        'A emissão entrou em estado não classificado pelas heurísticas iniciais do agente e precisa de leitura assistida da observabilidade.',
      recommendedActions: [
        'Inspecionar providerRequest, providerResponse, timeline e auditoria de webhook antes de alterar regra de negócio.',
        'Usar este diagnóstico como triagem, não como substituto da validação fiscal determinística.',
      ],
      confidence: 0.55,
      evidence,
      references,
    };
  }
}
