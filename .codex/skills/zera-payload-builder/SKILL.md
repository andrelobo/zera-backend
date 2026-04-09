---
name: zera-payload-builder
description: Use when building, reviewing, or validating NFSe payloads for the ZERA fiscal flow, especially PlugNotas requests, DTO normalization, field mapping, service codes, tax parameters, tomador/prestador data, and provider request correctness.
---

# ZERA Skill — Payload Builder

Use esta skill quando o foco for:
- montar payload de emissao NFSe
- revisar payload enviado ao provider
- comparar DTO de entrada com `providerRequest`
- validar campos fiscais sensiveis

## Premissas obrigatorias

- nao inventar campo fiscal
- payload deve refletir contrato real do backend e mapping real do provider
- quando houver duvida, preferir evidencia em:
  - DTO
  - mapper
  - payload persistido
  - providerResponse

## Pontos de leitura prioritarios

- `src/modules/fiscal/dtos/emitir-nfse.dto.ts`
- `src/fiscal/application/emitir-nfse.service.ts`
- `src/fiscal/infra/plugnotas.provider.ts`
- `src/fiscal/infra/plugnotas/nfse.mapper.ts`
- `src/fiscal/test-fixtures/emitir-nfse.golden.ts`

## Checklist obrigatorio

Verificar sempre:
- prestador
- tomador
- servico
- `codigoNacional`
- `codigoTributacao`
- descricao
- valor/base/desconto
- ISS e retencoes
- `referenciaExterna` / `idIntegracao`
- parametro tributario quando houver BI/observabilidade associada

## Heuristicas

- se a nota passou antes e agora falha, comparar `providerRequest`
- se o provider rejeita com 400, olhar request persistido e corpo de resposta
- se o problema parece “do tomador”, confirmar antes se o payload realmente mudou

## Saida recomendada

1. payload esperado
2. campo suspeito
3. evidencia de mapping
4. acao minima segura
