# Entry Points

Use este arquivo quando precisar localizar rapidamente os pontos principais do fluxo NFSe.

## Estado operacional

- `CURRENT_STATE.md`
- `CONTEXT.md`
- `CHECKLIST_WEBHOOK_PLUGNOTAS_PRODUCAO.md`

## Emissao

- `src/fiscal/application/emitir-nfse.service.ts`
- `src/fiscal/application/emitir-nfse-quick.service.ts`
- `src/modules/fiscal/dtos/emitir-nfse.dto.ts`
- `src/modules/fiscal/fiscal.controller.ts`

## Polling

- `src/fiscal/application/poll-nfse-status.service.ts`
- `src/fiscal/application/poll-nfse-status.runner.ts`

## Artifacts

- `src/fiscal/application/sync-nfse-artifacts.service.ts`

## Provider PlugNotas

- `src/fiscal/infra/plugnotas.provider.ts`
- `src/fiscal/infra/plugnotas/nfse.api.ts`
- `src/fiscal/infra/plugnotas/nfse.mapper.ts`
- `src/fiscal/infra/plugnotas/plugnotas.config.ts`
- `src/fiscal/infra/plugnotas/prerequisites.service.ts`

## Persistencia da emissao

- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
- `src/fiscal/infra/mongo/schemas/nfse-emission.schema.ts`

## Webhook

- `src/modules/webhooks/handlers/webhook.handler.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/webhooks/webhook-delivery-audit.repository.ts`
- `src/modules/webhooks/schemas/webhook-delivery-audit.schema.ts`

## Endpoints uteis

- `GET /nfse/webhook/diagnostico`
- `GET /nfse/:id/observability`
- `GET /nfse/external/:externalId/observability`
- `GET /nfse/:id/provider-response`
- `GET /nfse/external/:externalId/provider-response`
- `POST /webhooks/fiscal`

## Testes mais relevantes

- `src/modules/webhooks/handlers/webhook.handler.spec.ts`
- `src/modules/webhooks/webhooks.service.spec.ts`
- `src/modules/fiscal/fiscal.controller.spec.ts`
- `src/fiscal/application/emitir-nfse.service.spec.ts`
- `src/fiscal/application/poll-nfse-status.service.spec.ts`
- `src/fiscal/application/sync-nfse-artifacts.service.spec.ts`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.spec.ts`
- `src/fiscal/infra/plugnotas.provider.spec.ts`
