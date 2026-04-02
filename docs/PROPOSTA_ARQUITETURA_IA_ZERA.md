# Proposta de Arquitetura de IA para o ZERA

Data: 2026-04-01
Status: discussão com P.O

## Objetivo

Registrar uma proposta de arquitetura para introdução de capacidades de IA no ZERA de forma segura, incremental e compatível com um sistema já operando em produção.

## Visão Geral

A recomendação não é criar um "agente único" que faça tudo. O caminho mais seguro é tratar IA no ZERA como um **copiloto fiscal e operacional**, dividido em capacidades separadas.

Capacidades desejadas:

1. dar dicas operacionais e fiscais
2. aprender com o histórico da prestadora
3. sugerir ou preencher rascunhos quando fizer sentido
4. automatizar emissões padrão recorrentes

## Princípio central

IA não deve decidir regra fiscal.

A IA deve:

- sugerir
- resumir
- explicar
- identificar padrões
- preencher rascunhos

Quem decide de verdade:

- regras fixas do backend
- validação fiscal
- usuário
- automação explicitamente autorizada

## Arquitetura recomendada

Separar em 5 blocos lógicos:

1. `ai-insights`
2. `ai-recommendations`
3. `ai-memory`
4. `automation-rules`
5. `automation-runner`

## 1. ai-insights

Responsabilidade:

- dar dicas
- apontar inconsistências
- alertar sobre padrões e campos faltantes

Exemplos:

- "Este tomador é recorrente para este prestador"
- "Última emissão semelhante usou descrição diferente"
- "Há padrão mensal aparente para este serviço"

Risco:

- baixo

Observação:

- não precisa escrever no banco principal
- pode ser apenas leitura + sugestão

## 2. ai-recommendations

Responsabilidade:

- gerar recomendações estruturadas com base no histórico

Exemplos:

- tomador mais provável
- descrição sugerida
- faixa de valor recorrente
- serviço mais frequente

Risco:

- médio

Observação:

- recomendação não é emissão
- deve sempre vir com justificativa

## 3. ai-memory

Responsabilidade:

- consolidar padrões operacionais da prestadora

Exemplos:

- top tomadores
- top serviços
- descrições frequentes
- periodicidade mensal
- valores recorrentes

Risco:

- baixo a médio

Observação:

- pode começar sem LLM
- estatística + heurística já entregam valor

## 4. automation-rules

Responsabilidade:

- armazenar regras explícitas de automação de emissão

Exemplos:

- emitir todo dia 5 para tomador X
- usar serviço Y
- usar descrição Z
- usar valor fixo ou parametrizado

Risco:

- alto

Observação:

- exige criação consciente pelo usuário
- não deve nascer automático

## 5. automation-runner

Responsabilidade:

- executar com segurança as regras agendadas

Exemplos:

- disparo programado
- fila de execução
- tentativa controlada
- auditoria completa

Risco:

- muito alto

Observação:

- só deve existir depois das camadas de sugestão estarem maduras

## Backend proposto

No `zera-backend`, módulos sugeridos:

```text
src/modules/ai-insights
src/modules/ai-recommendations
src/modules/ai-memory
src/modules/automation-rules
src/modules/automation-runner
```

### Endpoints iniciais sugeridos

```text
GET   /ai/insights/empresa/:empresaId
GET   /ai/recommendations/emissao/:empresaId
POST  /ai/recommendations/draft
GET   /ai/memory/:empresaId
POST  /automation-rules
GET   /automation-rules/:empresaId
PATCH /automation-rules/:id
POST  /automation-rules/:id/run-now
GET   /automation-runs/:empresaId
```

## Persistência proposta

Coleções Mongo sugeridas:

- `ai_company_profiles`
- `ai_recommendation_snapshots`
- `automation_rules`
- `automation_runs`
- `automation_run_logs`

### Exemplo de `ai_company_profiles`

- `empresaId`
- `topTomadores`
- `topServicos`
- `descricoesFrequentes`
- `valoresRecorrentes`
- `janelasRecorrencia`
- `ultimaAtualizacao`
- `confidenceScores`

### Exemplo de `automation_rules`

- `empresaId`
- `nome`
- `ativo`
- `frequencia`
- `diaDoMes`
- `tomadorId`
- `servico`
- `descricao`
- `valor`
- `impostosBase`
- `modoExecucao`
- `requiresApproval`
- `createdBy`
- `updatedBy`

### Exemplo de `automation_runs`

- `ruleId`
- `empresaId`
- `status`
- `scheduledFor`
- `startedAt`
- `finishedAt`
- `draftPayload`
- `finalPayload`
- `emissionId`
- `error`

## Filas e jobs

Infra recomendada:

- `Redis`
- `BullMQ`

Filas sugeridas:

- `ai-profile-refresh`
- `ai-draft-generation`
- `scheduled-emission`
- `scheduled-emission-retry`

## Papel do LLM

LLM não precisa estar no centro de tudo.

### Sem LLM

Pode ser resolvido com heurística e histórico:

- tomadores mais frequentes
- serviços mais frequentes
- valor médio ou mais recorrente
- periodicidade
- padrões mensais

### Com LLM

Usar para:

- explicar a sugestão
- resumir histórico
- gerar texto natural
- melhorar descrições

Conclusão:

- decisão estrutural = backend + heurística
- linguagem natural = LLM

## Frontend proposto

No `zera-frontend`, frentes sugeridas:

1. dicas na emissão
2. memória da empresa
3. automações

### Componentes/páginas sugeridos

```text
src/pages/AiAutomationPage.tsx
src/components/ai/InsightsCard.tsx
src/components/ai/RecommendationCard.tsx
src/components/ai/AutomationRuleForm.tsx
src/components/ai/AutomationRunTable.tsx
```

## Fluxo seguro de emissão assistida

1. usuário abre Nova DANFSE
2. frontend chama `GET /ai/recommendations/emissao/:empresaId`
3. backend lê histórico da empresa
4. backend monta recomendação estruturada
5. frontend mostra:
   - tomador sugerido
   - serviço sugerido
   - valor sugerido
   - descrição sugerida
   - motivo da sugestão
6. usuário aceita ou ignora
7. emissão segue o fluxo já existente

## Fluxo seguro de automação

1. usuário cria regra de automação
2. backend valida
3. regra fica ativa
4. scheduler dispara job
5. runner monta draft
6. validação fiscal roda
7. se `requiresApproval = true`, fica pendente
8. se `false`, emite
9. grava auditoria completa

## Guardrails obrigatórios

- IA nunca emite diretamente sem validação do backend
- IA nunca define regra fiscal
- automação precisa de idempotência
- toda sugestão deve ser explicável
- toda execução deve ter auditoria
- feature flag por empresa
- kill switch global

## Infra mínima recomendada

- Mongo atual
- Redis
- BullMQ
- módulo server-side de LLM
- logs estruturados
- observabilidade forte

## Roadmap sugerido

### Fase 1

- `ai-memory`
- `ai-recommendations`
- dicas na emissão

Objetivo:

- entregar valor sem risco de emissão automática

### Fase 2

- rascunho assistido
- descrição sugerida
- card de padrões recorrentes

Objetivo:

- acelerar emissão mantendo confirmação humana

### Fase 3

- regras de automação
- runner
- aprovação opcional

Objetivo:

- permitir automações explícitas e auditáveis

### Fase 4

- automação sem aprovação para cenários elegíveis
- retries controlados
- tuning fino

Objetivo:

- ganho operacional máximo com maturidade suficiente

## Recomendação final

Vale a pena iniciar a frente de IA no ZERA, mas de forma incremental.

Ordem recomendada:

1. começar por dicas e memória
2. depois avançar para rascunhos assistidos
3. só depois discutir emissão automática recorrente

## Frase-resumo

No ZERA, IA deve entrar primeiro como copiloto explicável, não como piloto automático.
