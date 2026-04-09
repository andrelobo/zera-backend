---
name: zera-webhook-debug
description: Use when diagnosing webhook callback issues in the ZERA fiscal flow, including route delivery, shared-secret mismatches, invalid headers, callback payload shape, match failures by externalId/idIntegracao/protocol/idNota, lastAudit/lastSuccess/lastFailure, and webhook observability.
---

# ZERA Skill — Webhook Debug

Use esta skill quando o caso envolver:
- callback nao chegando
- callback rejeitado
- `invalid_shared_secret`
- `WEBHOOK_RECEIVED` ausente
- emissao que o provider diz ter enviado por webhook, mas o ZERA nao atualizou

## Premissas obrigatorias

- webhook e uma trilha aditiva ao fluxo fiscal
- `polling` continua fallback de seguranca
- a borda HTTP do callback deve ser lida antes de culpar match interno

## Evidencias prioritarias

- `GET /nfse/webhook/diagnostico`
- `lastAudit`
- `lastSuccess`
- `lastFailure`
- `WEBHOOK_RECEIVED`
- `lastUpdateSource`
- payload real do callback

## Heuristicas obrigatorias

- `invalid_shared_secret` = problema de segredo/header
- `lastAudit` sem mudar = callback nao chegou
- `lastSuccess` atualizado sem reflexo na emissao = investigar match/update
- match deve considerar:
  - `externalId`
  - `idIntegracao`
  - `protocol`
  - `id`
  - `idNota`

## Arquivos mais relevantes

- `src/modules/webhooks/handlers/webhook.handler.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/webhooks/webhook-delivery-audit.repository.ts`
- `src/modules/fiscal/fiscal.controller.ts`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`

## Saida recomendada

1. callback chegou ou nao
2. se foi aceito ou rejeitado
3. se matchou ou nao a emissao
4. proximo passo minimo seguro
