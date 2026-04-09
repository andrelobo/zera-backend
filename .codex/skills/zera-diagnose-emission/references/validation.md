# Validation

Use este arquivo quando a analise exigir verificacao local do backend.

## Build

Na raiz do `zera-backend`:

```bash
npm run build
```

## Suite completa

```bash
npm test
```

## Testes focados por frente

Webhook e observabilidade:

```bash
npm test -- src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/webhooks/webhooks.service.spec.ts src/modules/fiscal/fiscal.controller.spec.ts src/fiscal/infra/mongo/repositories/nfse-emission.repository.spec.ts
```

Emissao e PlugNotas:

```bash
npm test -- src/fiscal/application/emitir-nfse.service.spec.ts src/fiscal/infra/plugnotas.provider.spec.ts
```

Polling e artifacts:

```bash
npm test -- src/fiscal/application/poll-nfse-status.service.spec.ts src/fiscal/application/sync-nfse-artifacts.service.spec.ts
```

## Busca rapida no codigo

Procurar pontos de webhook:

```bash
rg -n "webhook|WEBHOOK_RECEIVED|invalid_shared_secret|lastUpdateSource" src
```

Procurar pontos de provider/response:

```bash
rg -n "providerResponse|idIntegracao|protocol|idNota|externalId" src
```

Procurar endpoints de observabilidade:

```bash
rg -n "observability|provider-response|webhook/diagnostico" src/modules/fiscal
```

## Leitura operacional recomendada

1. confirmar o estado recente em `CURRENT_STATE.md`
2. identificar o sintoma e a camada provavel
3. abrir `provider-response` e `observability`
4. so depois mergulhar em codigo e testes

## Guardrails

- nao desligar `polling` como parte de validacao
- nao inferir causa raiz sem cruzar observabilidade + provider + persistencia
- se o caso for real e recente, priorizar evidencia operacional sobre memoria antiga
