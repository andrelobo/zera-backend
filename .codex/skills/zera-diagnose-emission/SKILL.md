---
name: zera-diagnose-emission
description: Use when diagnosing NFSe emission failures, delays, rejections, webhook vs polling behavior, missing artifacts, provider inconsistencies, or frontend/backend divergence in the ZERA fiscal flow.
---

# ZERA Skill — Diagnose Emission

Use esta skill quando o caso envolver:
- falha para emitir NFSe
- nota criada mas travada
- rejeicao do provider
- duvida entre webhook e polling
- XML/PDF ausentes
- divergencia entre UI, observabilidade e backend

Nao use esta skill para:
- redesign visual
- refactors amplos
- tarefas genericas sem relacao com emissao NFSe

## Premissas obrigatorias

- tratar o ZERA como sistema em producao
- evitar mudanca ampla antes de isolar causa raiz
- priorizar leitura auditavel e sem regressao
- backend usa PlugNotas como provider fiscal principal
- `polling` continua fallback obrigatorio
- a observabilidade da emissao e fonte primaria de verdade
- diferenciar sempre:
  - payload
  - provider
  - webhook
  - polling
  - artifacts
  - frontend/cache

## Leitura inicial obrigatoria

Antes de diagnosticar um caso real, alinhe o estado operacional atual:
- leia `CURRENT_STATE.md` na raiz do repo
- use `CONTEXT.md` apenas se precisar de historico/linha do tempo

Se precisar de mapa de arquivos ou pontos de entrada:
- leia `references/entrypoints.md`

Se precisar de comandos seguros de validacao:
- leia `references/validation.md`

## Entrada minima ideal

Quando houver, trabalhe com um ou mais destes insumos:
- `emissionId`
- `externalId`
- payload do provider
- `providerResponse`
- tela de observabilidade
- logs do backend
- erro bruto do frontend

Se faltarem dados, diagnostique com o que existe, mas explicite a incerteza.

## Metodo obrigatorio de analise

Siga esta ordem.

### Etapa 1 — Classificacao do sintoma

Classifique o caso em um grupo:
- emissao nao criada
- emissao criada mas nao processada
- emissao pendente por tempo excessivo
- emissao autorizada no provider mas nao refletida no ZERA
- emissao rejeitada
- XML/PDF ausentes
- divergencia entre frontend e backend
- problema de cadastro/completude bloqueando emissao

### Etapa 2 — Identificacao do ponto de falha

Localize a falha provavel em uma camada:
- input do frontend
- DTO/normalizacao backend
- provider request
- provider response
- webhook callback
- polling fallback
- sincronizacao de artifacts
- leitura/refresh do frontend

### Etapa 3 — Leitura operacional do status

Use esta semantica:
- `PENDING`
  - emissao criada e enviada
  - ainda sem desfecho final
- `PROCESSING`
  - provider em processamento
- `AUTHORIZED`
  - nota autorizada
- `REJECTED`
  - rejeicao fiscal ou estrutural
- `ERROR`
  - erro operacional/interno/provider sem conclusao confiavel

### Etapa 4 — Heuristicas obrigatorias

#### Webhook vs Polling

- Se houver `WEBHOOK_RECEIVED` ou `lastUpdateSource = webhook`, tratar callback como aplicado.
- Se a emissao fechou com `lastUpdateSource = polling`, o webhook nao foi a trilha final.
- Se houver `invalid_shared_secret`, a causa esta no segredo/header, nao no provider fiscal.
- Se o callback existe no provider mas nao atualiza a emissao, investigar match por:
  - `externalId`
  - `idIntegracao`
  - `protocol`
  - `id`
  - `idNota`

#### Provider

- Se o provider aceitou e gerou `protocol` ou `idIntegracao`, a emissao passou da camada de criacao.
- Se houve HTTP 400 com `protocol`, considerar possibilidade de aceite em processamento, nao erro fatal automatico.
- Rejeicoes como `E0312`, `E0314`, `E0625` devem ser lidas como rejeicoes fiscais/contextuais.

#### Artifacts

- Se status esta `AUTHORIZED` mas XML/PDF ausentes:
  - verificar sync automatico
  - verificar sync manual
  - verificar se o identificador de download correto era `idNota` e nao apenas `protocol`
- Nao concluir “nota nao autorizada” apenas por artifact ausente.

#### Frontend

- Se providerResponse/backend estao corretos e a UI nao reflete isso:
  - considerar cache
  - invalidation ausente
  - stale query
  - problema visual/semanico
- Nao culpar backend sem evidencia do contrato real.

### Etapa 5 — Saida obrigatoria

Responder sempre neste formato:

1. **Classificacao do caso**
2. **Causa raiz mais provavel**
3. **Evidencias que sustentam essa leitura**
4. **O que nao parece ser o problema**
5. **Proxima acao minima e segura**
6. **Nivel de confianca**: baixo / medio / alto

## Restricoes

- nao recomendar reescrita ampla
- nao sugerir desligar `polling` sem evidencia operacional forte
- nao inventar campos fiscais sem evidencia
- nao tratar frontend como fonte de verdade quando backend/observabilidade contradizerem a UI
- em caso de duvida entre hipotese estrutural e operacional, preferir a hipotese operacional com menor raio de mudanca

## Conhecimento contextual que deve ser respeitado

- PlugNotas e o provider fiscal principal
- webhook e polling coexistem; polling continua rede de seguranca
- observabilidade por emissao e central para diagnostico
- frontend pode divergir por cache/query invalidation
- prestador, emissao e artifacts sao areas sensiveis
- quando houver tensao entre memoria do agente e estado recente do projeto, prevalece `CURRENT_STATE.md`

## Perguntas que esta skill deve responder bem

- “essa nota ficou pending por que?”
- “isso e bug de webhook ou polling?”
- “o problema e payload ou tabela municipal?”
- “por que o XML nao apareceu se a nota foi autorizada?”
- “isso e erro do front ou do backend?”
- “esse externalId nao bate; o que provavelmente aconteceu?”
