---
name: zera-polling-analysis
description: Use when analyzing polling fallback behavior, perceived delays, authorization timing, retry cadence, next-poll expectations, and whether an emission was actually slow or merely finalized later because the ZERA app observed the provider status through polling.
---

# ZERA Skill — Polling Analysis

Use esta skill quando a pergunta for:
- “demorou mesmo?”
- “foi o provider ou foi a janela de polling?”
- “essa emissao fechou por webhook ou por polling?”
- “o atraso foi real ou so perceptivo?”

## Premissas obrigatorias

- diferenciar autorizacao no provider de percepcao final no app
- polling e fallback legitimo, nao erro automatico
- tempo operacional deve ser lido com timestamps concretos

## Evidencias prioritarias

- `createdAt`
- `dataAutorizacao` do provider
- `lastPolledAt`
- `nextPollAt`
- `pollAttempts`
- `lastUpdateSource`
- timeline de observabilidade

## Heuristicas obrigatorias

- se provider autorizou rapido e o ZERA fechou bem depois por `polling`, o atraso e de percepcao, nao de autorizacao fiscal
- se `Tentativas de Polling = 0` e mesmo assim houve fechamento posterior, olhar janela inicial do runner/refetch
- se `lastUpdateSource = webhook`, nao atribuir o fechamento ao polling

## Saida recomendada

1. tempo de autorizacao real
2. tempo de percepcao no ZERA
3. trilha final: webhook ou polling
4. leitura operacional correta
