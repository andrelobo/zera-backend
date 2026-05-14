# Proposta de Organização de Contexto Compartilhado do ZERA

Data: 2026-04-01
Status: discussão posterior

## Objetivo

Registrar uma proposta de organização de contexto para o ecossistema do ZERA sem executar nenhuma mudança estrutural imediata nos repositórios atuais.

A ideia central é:

> não unificar os repositórios, unificar o cérebro do produto.

## Situação Atual

Hoje o ZERA opera com dois repositórios principais:

- `zera-backend`
- `zera-frontend`

Cada um já possui documentação contextual própria, especialmente via:

- `CONTEXT.md`
- `CURRENT_STATE.md`

Essa estrutura funciona, mas tem um limite natural: parte do conhecimento de produto, regra de negócio e contratos lógicos acaba ficando espalhada entre backend e frontend.

## Problema que a proposta tenta resolver

Evitar cenários como:

- regra fiscal escondida apenas no backend
- decisão de UX escondida apenas no frontend
- duplicação de contexto entre repositórios
- drift entre docs de front e back
- perda de clareza sobre o que é produto versus o que é implementação

## Proposta

Trabalhar com 3 níveis de contexto:

1. contexto local do `zera-backend`
2. contexto local do `zera-frontend`
3. contexto compartilhado canônico do produto em um terceiro repositório ou pasta central

## Estrutura sugerida

### 1. Contexto local por repositório

Cada repo teria sua própria pasta de IA/contexto.

Exemplo para `zera-backend`:

```text
zera-backend/
  ai/
    context/
      project.md
      architecture.md
      fiscal-rules.md
      integrations.md
    skills/
      emitir-nfse.md
      retry-provider.md
      persistir-emissao.md
    base-prompt.md
  CONTEXT.md
```

Exemplo para `zera-frontend`:

```text
zera-frontend/
  ai/
    context/
      project.md
      architecture.md
      ui-rules.md
      offline-sync.md
    skills/
      dashboard-cache.md
      tomadores-list.md
      danfse-ui.md
    base-prompt.md
  CONTEXT.md
```

### 2. Contexto compartilhado entre front e back

Um terceiro repositório ou pasta central para o que é canônico do produto, não da implementação.

Exemplo:

```text
zera-ai-core/
  product/
    vision.md
    domain.md
    glossary.md
    roadmap.md
  business-rules/
    emissao-nfse.md
    status-emissao.md
    provider-strategy.md
  shared-contracts/
    fluxo-emissao.md
    payloads.md
    webhook-lifecycle.md
  skills/
    analisar-payload-rejeitado.md
    comparar-payload-aceito.md
    diagnosticar-falha-provedor.md
```

### 3. Consumo do core compartilhado pelos repos

Formas sugeridas:

#### Opção A. Git submodule

Cada repositório referencia o `zera-ai-core`.

Vantagens:

- tudo versionado
- compartilhamento real
- consistência entre máquinas

Desvantagens:

- exige disciplina com submodule
- aumenta complexidade operacional no Git

#### Opção B. Repositório separado ao lado no workspace

Estrutura:

```text
/workspace
  /zera-backend
  /zera-frontend
  /zera-ai-core
```

Vantagens:

- simples
- sem submodule
- fácil de manter

Desvantagens:

- depende de convenção de estrutura de pastas entre máquinas

#### Opção C. Duplicação controlada

Copiar arquivos canônicos para ambos os repositórios manualmente ou por script.

Vantagens:

- simples para começar
- zero complexidade Git adicional

Desvantagens:

- drift
- risco de divergência entre front e back

## Recomendação inicial para o ZERA

Para o momento atual do projeto, a recomendação mais segura é:

- não fazer refactor estrutural grande agora
- não introduzir submodule neste momento
- manter `CONTEXT.md` e `CURRENT_STATE.md` como base canônica local
- tratar `zera-ai-core` como evolução posterior e incremental

### Estratégia sugerida

Fase 1. Agora

- continuar usando a documentação atual em cada repo
- não mexer na estrutura operacional dos repositórios
- não criar dependência nova no fluxo diário

Fase 2. Próxima versão de organização

- criar `zera-ai-core`
- começar pequeno, com poucos documentos de alto valor:
  - `product/vision.md`
  - `business-rules/emissao-nfse.md`
  - `shared-contracts/webhook-lifecycle.md`
  - `product/glossary.md`

Fase 3. Consolidação posterior

- avaliar se o consumo por convenção de workspace já basta
- só depois decidir se vale migrar para submodule

## Regra de ouro

Produto não é implementação.

Produto:

- deve ficar no `zera-ai-core`

Implementação:

- deve permanecer no repositório específico

## Recomendação final

A proposta faz sentido para o ZERA, mas deve ser tratada como evolução de organização e contexto, não como mudança urgente de operação.

Hoje, a melhor leitura é:

- a ideia é boa
- o timing precisa ser conservador
- a adoção deve ser incremental

## Frase-resumo

Não unificar os repositórios. Unificar o cérebro do produto.
