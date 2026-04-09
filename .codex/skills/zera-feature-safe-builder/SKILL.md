---
name: zera-feature-safe-builder
description: Use when implementing or patching ZERA features in production-sensitive areas and the priority is minimal change, auditability, tests, and avoiding regressions across backend or frontend flows.
---

# ZERA Skill — Feature Safe Builder

Use esta skill quando precisar:
- implementar ajuste pequeno ou medio sem quebrar producao
- corrigir bug em area sensivel
- fazer patch incremental com validacao
- mexer em fluxo real sem abrir refactor amplo

Nao use esta skill para:
- diagnostico puro sem intencao de editar
- redesign visual amplo
- experimentos arquiteturais

## Premissas obrigatorias

- tratar o sistema como produto em producao
- preferir patch minimo no ponto exato do sintoma
- preservar contratos e comportamento existente
- nunca misturar varias frentes sensiveis no mesmo passo sem necessidade

## Metodo obrigatorio

1. alinhar o estado recente em `CURRENT_STATE.md`
2. localizar a area exata do codigo afetada
3. formular a menor mudanca capaz de resolver o problema
4. validar com build e testes focados
5. explicitar:
   - o que mudou
   - o que ficou preservado
   - qual risco residual existe

## Guardrails

- nao propor reescrita ampla antes de esgotar patch local
- nao desligar fallback operacional ativo
- nao alterar payload, DTO ou regras fiscais sem evidencia direta
- se houver tensao entre “ficar bonito” e “nao regredir”, priorizar nao regredir

## Saida recomendada

Responder sempre com:
1. objetivo da mudanca
2. area alterada
3. validacao executada
4. risco residual
