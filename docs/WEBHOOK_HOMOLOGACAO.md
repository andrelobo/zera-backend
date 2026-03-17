# Webhook Fiscal – Homologacao

Guia rapido para validar o webhook fiscal atual sem mexer no fluxo principal de emissao.

## Endpoint

- `POST /webhooks/fiscal`

## Seguranca

Se `WEBHOOK_SHARED_SECRET` estiver configurado, envie tambem o header:

- padrao: `x-webhook-token`
- customizavel por: `WEBHOOK_SHARED_SECRET_HEADER`

## O que o webhook atual faz

1. recebe o payload bruto
2. valida segredo, se existir
3. extrai `externalId`
4. extrai/mapeia status PlugNotas
5. atualiza a emissao correspondente
6. mantem polling como fallback

## Campos de payload aceitos pelo parser atual

### External ID

O parser tenta, nesta ordem:

- `externalId`
- `idNota`
- `id`
- `protocolo`
- `protocol`
- `idIntegracao`
- `documents[0].id`
- `documents[0].idNota`

### Status

O parser tenta, nesta ordem:

- `retorno.situacao`
- `retorno.status`
- `status`
- `situacao`
- `statusNota`
- `statusNfse`
- `situacaoNota`
- `situacaoRps`

## Mapeamento atual de status

- contem `conclu` -> `AUTHORIZED`
- contem `autoriz` -> `AUTHORIZED`
- contem `rejeit` ou `negad` -> `REJECTED`
- contem `cancel` -> `CANCELED`
- contem `erro` ou `falh` -> `ERROR`
- qualquer outro -> `PENDING`

## Payloads de teste

### 1. Autorizado simples

```json
{
  "externalId": "ext-webhook-001",
  "status": "AUTORIZADO",
  "idNota": "nota-001"
}
```

### 2. Rejeitado em formato nested

```json
{
  "retorno": {
    "situacao": "REJEITADA"
  },
  "documents": [
    {
      "idNota": "nota-002"
    }
  ]
}
```

### 3. Cancelado

```json
{
  "externalId": "ext-webhook-003",
  "situacao": "CANCELADA"
}
```

## Exemplo com curl

Sem segredo:

```bash
curl -X POST http://localhost:3000/webhooks/fiscal \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "ext-webhook-001",
    "status": "AUTORIZADO",
    "idNota": "nota-001"
  }'
```

Com segredo:

```bash
curl -X POST http://localhost:3000/webhooks/fiscal \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: SEU_SEGREDO" \
  -d '{
    "externalId": "ext-webhook-001",
    "status": "AUTORIZADO",
    "idNota": "nota-001"
  }'
```

## Checklist de homologacao

1. Confirmar que existe uma emissao `PENDING` com `externalId` conhecido.
2. Enviar payload autorizado para o endpoint.
3. Confirmar que a emissao mudou de status.
4. Confirmar que `providerResponse` foi atualizado.
5. Confirmar que o polling continua ligado para outras emissoes `PENDING`.
6. Repetir com payload rejeitado.
7. Repetir com segredo invalido quando `WEBHOOK_SHARED_SECRET` estiver ativo.

## Observacoes

- Este webhook e **aditivo**.
- Ele nao substitui o polling nesta etapa.
- Para producao, prefira homologar com payload real ou payload capturado da PlugNotas assim que disponivel.
