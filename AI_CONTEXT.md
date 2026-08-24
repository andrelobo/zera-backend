# AI_CONTEXT.md
# ZERA AI CONTEXT
Versão: 2026-08-07

---

# 0. ESTADO OPERACIONAL CANONICO (05/08/2026)

- Ler primeiro o topo de `CURRENT_STATE.md` e `AGENTS.md`.
- Provider operacional ativo e exclusivo: **LOBONOTAS (SEFIN Nacional)**.
- PlugNotas esta permanentemente **`LEGACY_DISABLED`** e nunca pode ser usado como
  fallback, reemissao, cancelamento, sincronizacao ou download remoto.
- Codigo, parsers, testes, registros e artefatos PlugNotas antigos permanecem somente
  para compatibilidade historica e auditoria; nao remover nem alterar os registros.
- O ciclo LOBONOTAS de emissao, autorizacao e artefatos XML/PDF foi validado em
  producao. Entradas posteriores deste arquivo que descrevam etapas de transicao sao
  historicas e nao substituem esta secao.

---

# 1. PREMISSAS CANÔNICAS

O ZERA Backend Fiscal deve ser tratado como:

- sistema fiscal em produção
- operação fiscal real
- ambiente com risco operacional real
- arquitetura resiliente orientada por observabilidade

A prioridade arquitetural máxima é:

1. preservar emissão
2. preservar integridade fiscal
3. preservar rastreabilidade
4. preservar reconciliacao e continuidade operacional no mesmo provider
5. evitar regressões

---

# 2. LEITURA CORRETA DO ZERA

O ZERA NÃO é apenas um emissor NFSe.

O ZERA deve ser interpretado como:

- plataforma fiscal operacional
- núcleo de automação fiscal
- backend resiliente orientado por eventos
- sistema preparado para IA operacional
- futura plataforma de inteligência fiscal

---

# 3. PRINCÍPIOS DE IA

A IA no ZERA NÃO substitui:

- motor fiscal
- regras tributárias
- validações determinísticas
- compliance oficial
- cálculos fiscais

A IA deve atuar como:

- copiloto operacional
- interpretador contextual
- suporte inteligente
- diagnóstico operacional
- mecanismo de explicação
- assistente de troubleshooting

---

# 4. SEPARAÇÃO ARQUITETURAL OBRIGATÓRIA

## Regra canônica

LLM != motor fiscal

Arquitetura correta:

- LLM = interpretação
- Engine = verdade fiscal
- RAG = memória contextual
- Workflow = automação operacional

Nunca misturar:

- inferência IA
- regra fiscal determinística

---

# 5. PRIORIDADES OPERACIONAIS

## Ordem de prioridade

1. emissão fiscal
2. webhook
3. polling fallback
4. observabilidade
5. onboarding
6. IA

IA nunca pode degradar emissão.

---

# 6. WEBHOOK E POLLING

## Leitura correta

Webhook:
- trilha preferencial

Polling:
- fallback obrigatório

Polling NÃO deve ser removido sem:
- homologação comprovada
- evidência operacional real
- estabilidade contínua

---

# 7. OBSERVABILIDADE

Observabilidade é fonte de verdade operacional.

Toda análise deve priorizar:

- timeline operacional
- eventos persistidos
- origem da atualização
- auditoria
- logs estruturados

---

# 8. REGRAS DE INTERPRETAÇÃO

## Regras importantes

"Ultima Origem: polling"
NÃO significa automaticamente falha do webhook.

Ausência de:
- WEBHOOK_RECEIVED
- POST /webhooks/fiscal

pode indicar:
- callback não entregue
- segredo inválido
- ambiente incorreto
- falha de configuração externa

---

# 9. CONTEXTO PRIORITÁRIO PARA IA

## Ordem canônica de contexto

1. AI_CONTEXT.md
2. CURRENT_STATE.md
3. observabilidade runtime
4. skills locais
5. documentação operacional
6. CONTEXT.md
7. histórico legado

---

# 10. CURRENT_STATE.md

CURRENT_STATE.md representa:

- snapshot operacional atual
- estado canônico recente
- leitura operacional prioritária

Quando houver conflito:
- o topo de `CURRENT_STATE.md` e `AGENTS.md` possui prioridade sobre historico antigo;
- nenhuma entrada historica pode reativar PlugNotas.

---

# 11. CONTEXT.md

CONTEXT.md representa:

- histórico completo
- evolução arquitetural
- timeline operacional
- incidentes históricos
- decisões passadas

Deve ser usado como:
- memória histórica contextual

Não como:
- fonte operacional prioritária.

---

# 12. SKILLS LOCAIS

Skills locais representam:

- execução procedural
- heurísticas operacionais
- métodos de diagnóstico
- workflows especializados

As skills NÃO substituem:
- documentação canônica
- observabilidade
- estado operacional atual

---

# 13. ARQUITETURA AI LAYER

Estrutura esperada:

src/ai/
  orchestrator/
  agents/
  providers/
  prompts/
  rag/
  memory/
  tools/
  workflows/
  diagnostics/
  dto/
  interfaces/

---

# 14. REGRAS DE IMPLEMENTAÇÃO

Sempre utilizar:

- TypeScript fortemente tipado
- SOLID
- clean architecture
- DTOs
- interfaces
- baixo acoplamento
- observabilidade
- logs estruturados

Nunca:
- acoplar IA em controllers fiscais
- misturar IA com regra fiscal
- criar dependência operacional crítica do LLM

---

# 15. PROVIDER DE IA

Provider inicial:

NVIDIA Build Models

Modelo inicial:
qwen/qwen3-coder-480b-a35b-instruct

Requisitos obrigatórios:

- retries
- timeout
- structured output
- logs
- observabilidade
- fallback
- tratamento resiliente de erro

---

# 16. DIAGNOSE AGENT

Primeiro agente oficial do sistema.

Objetivos:

- interpretar erros
- interpretar logs
- diagnosticar webhook
- diagnosticar polling
- interpretar payloads
- auxiliar suporte
- responder JSON estruturado

---

# 17. FORMATO DE RESPOSTA

Preferir:

- JSON estruturado
- severidade
- camada afetada
- causa provável
- ação recomendada
- confiança
- referências documentais

Exemplo:

{
  "severity": "high",
  "probableLayer": "webhook",
  "probableCause": "invalid_shared_secret",
  "confidence": 0.94
}

---

# 18. RAG

O RAG do ZERA deve priorizar:

- documentação operacional
- troubleshooting real
- incidentes reais
- observabilidade
- payloads reais
- regras operacionais

Evitar:
- embeddings excessivos
- documentos redundantes
- contexto inflado

---

# 19. CHUNKING

Chunking deve ser semântico.

Preferir divisão por:

- incidente
- seção operacional
- diagnóstico
- regra
- evidência
- fluxo

Evitar chunking puramente por tamanho bruto.

---

# 20. MEMÓRIA OPERACIONAL

A IA deve operar com:

- memória contextual controlada
- contexto rastreável
- recuperação explicável

Nunca:
- memória infinita
- contexto não auditável
- persistência obscura

---

# 21. TOOL CALLING

Ferramentas futuras esperadas:

- observabilidade
- webhook diagnostics
- polling diagnostics
- provider diagnostics
- consulta emissão
- timeline operacional

Tool calling deve ser:
- auditável
- controlado
- rastreável

---

# 22. LGPD

Toda camada IA deve aplicar:

- masking
- redaction
- anonimização
- controle contextual

Nunca enviar ao LLM:

- secrets
- tokens
- certificados
- credenciais
- payloads sensíveis completos

---

# 23. OBSERVABILIDADE DA IA

Toda execução IA deve registrar:

- modelo
- tempo
- tokens
- agente
- contexto usado
- documentos usados
- usuário
- correlação
- confiança

---

# 24. MULTIAGENTES

Arquitetura futura:

- DiagnoseAgent
- SupportAgent
- WebhookAgent
- EmissionAgent
- ComplianceAgent
- OnboardingAgent

Evitar:
- super agente genérico

---

# 25. WORKFLOWS FUTUROS

Fluxos futuros possíveis:

- onboarding inteligente
- troubleshooting guiado
- suporte assistido
- automação supervisionada
- copiloto operacional

Toda automação deve possuir:

- auditoria
- idempotência
- rastreabilidade
- autorização explícita

---

# 26. ANTI-PADRÕES

Nunca:

- substituir regra fiscal por IA
- permitir emissão autônoma irrestrita
- remover fallback operacional
- confiar em inferência sem validação
- acoplar IA diretamente ao core fiscal

---

# 27. LEITURA ESTRATÉGICA FINAL

O diferencial real do ZERA NÃO é apenas emissão fiscal.

O diferencial é:

- operação real
- observabilidade madura
- histórico operacional
- troubleshooting real
- webhook resiliente
- fallback real
- documentação viva
- semântica operacional consolidada

A IA deve ampliar essa inteligência operacional.
Não substituir a arquitetura existente.

---

# 28. OBJETIVO FINAL

Transformar o ZERA em:

uma plataforma brasileira de inteligência fiscal operacional orientada por IA.

Mantendo:

- estabilidade
- compliance
- rastreabilidade
- resiliência
- auditabilidade
- segurança
