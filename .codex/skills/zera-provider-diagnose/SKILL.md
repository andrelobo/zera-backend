---
name: zera-provider-diagnose
description: Use when debugging PlugNotas or provider-side NFSe issues such as HTTP 4xx/5xx, rejected requests, inconsistent provider responses, missing protocol/idIntegracao, municipal rejection codes, or divergence between provider acceptance and ZERA persistence.
---

# ZERA Skill — Provider Diagnose

Use esta skill quando o problema parecer estar no provider fiscal:
- PlugNotas retornando 400/401/403/422/500
- rejeicao fiscal
- providerResponse estranho ou incompleto
- aceite do provider sem reflexo claro no backend

## Premissas obrigatorias

- diferenciar erro do provider de erro de webhook
- diferenciar rejeicao fiscal de falha de transporte
- nao tratar todo HTTP 400 como falha definitiva sem olhar corpo e contexto

## Leitura prioritaria

- `providerRequest`
- `providerResponse`
- `error`
- `externalId`
- `protocol`
- `idIntegracao`
- codigos fiscais retornados

## Arquivos mais relevantes

- `src/fiscal/infra/plugnotas.provider.ts`
- `src/fiscal/infra/plugnotas/nfse.api.ts`
- `src/fiscal/infra/plugnotas/nfse.mapper.ts`
- `src/fiscal/application/emitir-nfse.service.ts`

## Heuristicas obrigatorias

- se houve `protocol` ou aceite identificavel, a criacao passou da camada inicial
- se o backend persistiu `providerRequest` e `providerResponse`, use isso como verdade tecnica
- se a rejeicao tiver codigo municipal/fiscal, tratar como contexto tributario, nao como bug generico
- se o provider estiver correto e o ZERA nao refletir, a causa migra para persistencia, webhook, polling ou frontend

## Saida recomendada

1. status da camada provider
2. erro ou aceite identificado
3. evidencia no request/response
4. proximo passo minimo seguro
