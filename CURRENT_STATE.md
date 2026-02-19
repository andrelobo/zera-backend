# ZERA Backend – Current State

Snapshot operacional do backend em **19/02/2026** (última atualização consolidada).

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

## 10. Referências

* Histórico completo: `CONTEXT.md`
* Detalhes de produção: `REPORT_PLUGNOTAS_PROD_2026-02-06.md`, `REPORT_PLUGNOTAS_PROD_2026-02-09.md`
* Endpoints PlugNotas: `endpoints-plug-notas.md`
