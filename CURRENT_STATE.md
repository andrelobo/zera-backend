# ZERA Backend – Current State

Snapshot operacional do backend em **26/02/2026** (última atualização consolidada).

## 1. Objetivo do documento

Este arquivo resume o **estado atual** para operação, produto e integração frontend.

Para histórico detalhado (decisões, incidentes, cronologia), usar `CONTEXT.md`.

## 2. Estado atual (alto nível)

* Backend NestJS + TypeScript em Node 20.
* Provider fiscal ativo: **PlugNotas**.
* Fluxo NFSe em produção (Manaus) validado ponta a ponta:
  * emissão assíncrona
  * transição para `AUTHORIZED`
  * persistência/consulta de XML e PDF

## 3. Fluxos principais em produção

### 3.1 Emissão padrão

* Cria emissão com `idIntegracao` (idempotência).
* Salva status inicial (`PENDING`) e metadados do provider.
* Polling com backoff consulta status até estado final.
* Em `AUTHORIZED`, baixa e persiste artifacts (XML/PDF).

### 3.2 Emissão rápida

Endpoint:
* `POST /nfse/quick`

Payload mínimo:
* `cnpj`
* `cpfTomador`
* `valor`

Opcional:
* `codigoServico` (6 dígitos), com inferência por catálogo LC116.

### 3.3 Cadastro de tomadores (novo)

Endpoints:
* `POST /tomadores`
* `GET /tomadores`
* `GET /tomadores/{id}`
* `PATCH /tomadores/{id}`
* `DELETE /tomadores/{id}`

Regra de vínculo:
* tomador vinculado por `empresaCnpj` (isolamento por prestador)
* unicidade por `empresaCnpj + cpfCnpj`

Autocomplete para emissão no frontend:
* `GET /tomadores/autocomplete?empresaCnpj=&q=&limit=`
* busca por CPF/CNPJ ou nome
* `limit` default `10` e máximo `50`

## 4. Segurança e robustez já aplicadas

* `JWT_SECRET` obrigatório no boot (fail-fast).
* ValidationPipe global ativa (`whitelist` + `transform`).
* DTOs com `class-validator` nos módulos principais.
* `FiscalController` protegido por `JwtAuthGuard` e `RolesGuard`.
* Contrato global de erro padronizado: `{ code, message, correlationId }`.

## 5. Idempotência e artifacts

* Índice único parcial para idempotência por provider + chave.
* Tratamento de resposta PlugNotas com `HTTP 400` + `protocol` como aceite em processamento (`PENDING`).
* Sync manual de artifacts disponível:
  * `POST /nfse/{id}/sync-artifacts`
  * com rate limit por emissão e trilha de auditoria.

## 6. Catálogo de serviços

Fonte única:
* `servicos_lc116_v2.json` (catálogo LC116/NFS-e Nacional)

Endpoints:
* `GET /nfse/servicos/autocomplete?q=&limit=`
* `GET /nfse/servicos/{codigo}`

## 7. Certificado digital (empresa)

* Importação via `POST /empresas/certificado/import` (`.pfx`/`.p12`).
* Certificado vinculado por CNPJ.
* Senha protegida com AES-256-GCM.
* Cadastro de empresa nova/incompleta exige certificado prévio (`CERTIFICADO_REQUIRED`).

## 8. Variáveis críticas de ambiente

Obrigatórias/recomendadas:
* `JWT_SECRET`
* `MONGODB_URI`
* `PLUGNOTAS_BASE_URL`
* `PLUGNOTAS_API_KEY`
* `NFSE_CMUN_IBGE`
* `EMPRESA_CERT_ENCRYPTION_KEY` (recomendado)

Importantes para quick flow:
* `QUICK_NFSE_CODIGO_NACIONAL`
* `QUICK_NFSE_CODIGO_TRIBUTACAO`
* `QUICK_NFSE_DESCRICAO_PADRAO`
* `QUICK_NFSE_OP_SIMP_NAC` (opcional override)
* `QUICK_NFSE_REG_AP_TRIB_SN` (opcional override)
* `QUICK_NFSE_REG_ESP_TRIB` (opcional override)

## 9. Gaps conhecidos

* Pré-requisitos NFSe Nacional foram implementados em modo seguro por flag (`off|warn|enforce`), com default `off`; rollout produtivo ainda depende de ativação gradual.
* Estratégia recomendada de rollout: `off` (baseline) -> `warn` (observabilidade sem bloqueio) -> `enforce` (bloqueio por pré-requisito validado).
* Webhook com validação por token compartilhado; assinatura criptográfica ainda não implementada.

## 10. Atualizações recentes relevantes (fev/2026)

* Regressão DANFSE com rejeição `E0312` foi mitigada no backend com fallback defensivo para `servico.codigoTributacao` no provider PlugNotas.
* Ordem de fallback aplicada:
  * `input.servico.codigoTributacao`
  * `NFSE_CODIGO_TRIBUTACAO_PADRAO`
  * `QUICK_NFSE_CODIGO_TRIBUTACAO`
  * default final `"100"`
* Teste de regressão adicionado em `src/fiscal/infra/plugnotas.provider.spec.ts` para garantir que o payload siga com `codigoTributacao` mesmo quando o frontend não envia o campo.

## 11. Referências

* Histórico completo: `CONTEXT.md`
* Detalhes de produção: `REPORT_PLUGNOTAS_PROD_2026-02-06.md`, `REPORT_PLUGNOTAS_PROD_2026-02-09.md`
* Endpoints PlugNotas: `endpoints-plug-notas.md`
* Evidência da regressão/correção: seção `ATUALIZAÇÃO (25/02/2026)` em `CONTEXT.md`

## 12. Atualização operacional (26/02/2026)

* Sincronização de branch concluída: `main` local e `origin/main` alinhados no commit `b0d68cb`.
* Ajustes de emissão/NFSe e tomadores preservados no remoto (sem perda de alterações locais).
* Bateria de validação executada:
  * `npm test` ✅ (`10 suites`, `31 testes`)
  * `npm run test:cov` ✅
  * `npm run test:e2e` ✅ (`1 suite`, `2 testes`)
  * `npm run build` ✅
* Lint executado com autofix: sem erros bloqueantes; warnings remanescentes de `@typescript-eslint` seguem como dívida técnica de tipagem.

## 13. Checklist MVP -> BI (operacional)

* [ ] Contrato canônico de dados definido (empresa/tomador/serviço/tributação/localização/datas).
* [ ] Origem dos dados registrada (`source` e `updatedAt` por campo crítico).
* [ ] Persistência dupla ativa (normalizado + `providerData` bruto).
* [ ] Autocomplete backend-first para CNPJ/CEP/municípios.
* [ ] Campos fiscais mínimos garantidos (`cnaeFiscal`, `ctnCodigo`, `nbsCodigo`, `regimeTributario`, `opcaoPeloSimples`).
* [ ] Histórico/snapshot cadastral habilitado para auditoria.
* [ ] Indicador de completude por empresa calculado.
* [ ] Eventos-chave instrumentados (`empresa_preview`, `empresa_updated`, `nfse_emitida`, `nfse_rejeitada`, `tomador_criado`).
* [ ] Monitoramento de qualidade de dados ativo (vazios, divergências, taxa de autocomplete).
* [ ] Compatibilidade com emissão preservada e validada continuamente.
