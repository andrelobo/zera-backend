# LOBONOTAS — 01. Inventário As-Is

> Estado real do sistema (backend, frontend, banco, infra) com acoplamentos ao PlugNotas, divergências entre documentação/código/runtime e riscos classificados.
> Data de referência: **01/08/2026**. Nenhum código foi alterado.

---

## 1. Legenda

- **[FATO]** — observado diretamente no código/documentos/execução local.
- **[INFERÊNCIA]** — conclusão derivada dos fatos, não medida em runtime.
- **[RECOMENDAÇÃO]** — proposta do arquiteto, sujeita a aprovação.
- **[PENDENTE]** — não verificável sem acesso que hoje está bloqueado (VPS/Atlas).
- **[DIVERGÊNCIA]** — documentação vs código vs runtime.

---

## 2. Estado real dos componentes

### 2.1 Backend (`zera-backend`)

- **Branch/commit local**: `main` @ `be18106` ("fix: force docker dns for atlas resolution"). Working tree limpo.
- Framework: NestJS, Node 20, TypeScript, Mongoose, MongoDB Atlas.
- **Provider fiscal ativo**: PlugNotas, registrado no token `'FiscalProvider'` → `PlugNotasProvider` (`src/modules/fiscal/fiscal.module.ts:51-54`).
- Fluxo de emissão completo em produção: emissão assíncrona → `PENDING` → polling/webhook → `AUTHORIZED` + artifacts (XML/PDF).
- Webhook `POST /webhooks/fiscal` homologado (atualização CURRENT_STATE 08/04/2026: callback real ~15s, `WEBHOOK_RECEIVED`, `ARTIFACTS_SYNCED`).
- Roles: `admin`, `manager`, `user`, `readonly` (adicionada em 19/05/2026).
- Camada `src/ai/*` read-only: `DiagnoseAgent` (`POST /ai/diagnostics/emission`).

### 2.2 Frontend (`zera-frontend2`)

- **Branch/commit local**: `main` @ `66ae09f` ("fix: route api traffic through explicit vercel proxy"). Working tree limpo.
- React/Vite/TS, Vercel. `api/proxy.ts` faz proxy de `/api/*` → `http://136.248.90.172:3000` (Oracle VPS).
- Base de API em produção: `VITE_API_BASE_URL=/api` (relativa) (`src/lib/api.ts:19`).
- **Não há chamada HTTP direta do frontend à PlugNotas** — o acoplamento é de **shape de dados** (ver seção 4).
- **Não há tipos OpenAPI gerados no frontend** — contratos manuscritos em `src/types/api.ts` (~650 linhas).

### 2.3 Banco MongoDB Atlas — auditoria por código [FATO]

**Collections (por schema Mongoose):**

| Coleção | Schema | Índices/regras |
|---|---|---|
| `nfseemissions` | `NfseEmission` | ver abaixo |
| `empresas` | `Empresa` | `cnpj` unique+index (`empresa.schema.ts:165-166`) |
| `tomadores` | `Tomador` | unique `{empresaCnpj, cpfCnpj}` (`tomador.schema.ts:92`) |
| `users` | `User` | `select:false` no hash de senha (`user.schema.ts:43`) |
| `webhookdeliveryaudits` | `WebhookDeliveryAudit` | `{route, createdAt:-1}` e `{route, ok, createdAt:-1}` |
| `cnaecatalogos` | `CnaeCatalogo` | — |

**Índices de `NfseEmission`** (`nfse-emission.schema.ts:168-178` + `index:true` por campo):
- `{provider:1, externalId:1}` (não único)
- `{empresaCnpj:1, createdAt:-1}`
- `{tomadorCpfCnpj:1, createdAt:-1}`
- `{codigoServico:1, createdAt:-1}`
- `{provider:1, idempotencyKey:1}` **UNIQUE** (parcial, `partialFilterExpression` para string) — nome `uniq_provider_idempotency_key`
- índices simples em `idempotencyKey`, `externalId`, `nextPollAt`

**Idempotência**: `idempotencyKey` = `referenciaExterna` normalizada; em replay retorna `idempotentReplay: true` e reaproveita a emissão existente (race 11000 tratado) (`emitir-nfse.service.ts:109-195`).

**Relacionamentos lógicos**: emissão vincula `empresaCnpj` e `tomadorCpfCnpj`; tomador vincula `empresaCnpj` (isolamento por prestador); certificado vive dentro do documento `Empresa`.

**Campos específicos do PlugNotas persistidos**: `providerRequest`, `providerResponse` (`{type:Object}` = Mixed), `provider` (`'PLUGNOTAS'`), e identificadores extraídos do providerResponse via `extractPlugNotasDocumentIdentifiers` (`numeroNfse`, `dpsNum`, `serieDpsNum`) em `nfse-emission.repository.ts:82,154,209`.

**Armazenamento de XML/PDF**: base64 em `xmlBase64`/`pdfBase64` no próprio documento da emissão (sem serviço externo de objetos). Gate por `NFSE_STORE_ARTIFACTS`.

**Armazenamento do certificado** (`empresa.schema.ts:40-67`):
- `pfxBase64` (base64 do arquivo) e `passwordEncrypted` com `select:false`.
- Senha criptografada com **AES-256-GCM**; chave = `EMPRESA_CERT_ENCRYPTION_KEY`, com **fallback em `JWT_SECRET`** (`.env.example:37-38`).
- ⚠️ `pfxBase64` é **base64 em texto claro** no Atlas (não criptografado). `select:false` impede leitura default, **não é criptografia**.

**Riscos multi-prestador**: modelo já é multi (`empresaCnpj` em emissões e tomadores). O único ponto mono-prestador restante é o quick flow inferindo defaults de prestador por CNPJ obrigatório no payload (resolvido em 16/02) e defaults de serviço `QUICK_NFSE_*`.

**Compatibilidade de documentos históricos**: emissões antigas podem não ter `provider` explícito ou ter o bug histórico de `plugnotas` minúsculo (registrado no frontend, CURRENT_STATE front 07/04/2026).

**[PENDENTE]** Quantidades de documentos, índices reais no Atlas e distribuição por `provider`/`status` exigem acesso read-only ao Atlas (não solicitado nesta rodada).

### 2.4 VPS Oracle — estado observado

**[FATO]** Acesso SSH **bloqueado**: `Permission denied (publickey)`; `~/.ssh` sem chave privada.
**[PENDENTE/DOC]** hostname `lobojow`, IP `136.248.90.172`, Ubuntu 20.04, container `zera-backend-api`, porta `3000`, `/home/ubuntu/zera-backend`.
**[INFERÊNCIA]** Não é possível afirmar estado de runtime do container, uso de CPU/RAM/swap/disco nem branch/commit real na VPS sem acesso.

---

## 3. Fluxo atual de emissão (ponta a ponta)

```
Frontend (DANFSE/Quick)
   │  POST /nfse/emitir | /nfse/quick   (JWT + role user/admin/manager)
   ▼
FiscalController  (src/modules/fiscal/fiscal.controller.ts:205-225)
   ▼
EmitirNfseService.execute  (src/fiscal/application/emitir-nfse.service.ts:80-252)
   1. enrichInputForProvider (regime SN)         :254-285
   2. valida endereco do tomador                 :86-107
   3. idempotencyKey = referenciaExterna         :109-132
   4. assertPrestadorHasCertificate              :287-316
   5. buildBiSnapshot                            :318-476
   6. create (status PENDING) + replay 11000     :136-195
   7. upsertTomadorFromEmission (se sync)        :200-202
   8. provider.emitirNfse (payload p/ provider)  :203-217
   9. grava providerRequest/providerResponse     :211-238
   ▼
PlugNotasProvider  (src/fiscal/infra/plugnotas.provider.ts:52-199)
   ▼  POST /nfse (array, idIntegracao=referenciaExterna)
   ▼
NfseEmission (Atlas)  → status PENDING, externalId
   ▼
Polling runner  (src/fiscal/application/poll-nfse-status.runner.ts)
   └─ PollNfseStatusService (backoff, artifacts) :82-192
Webhook  POST /webhooks/fiscal
   └─ WebhookHandler/Service → updateByExternalId :127-204
   ▼
AUTHORIZED → XML/PDF base64 persistidos → listagem/detalhe/BI
```

### Dependências entre os quatro componentes

- **Frontend → Backend**: único caminho HTTP via `src/lib/api.ts`; produção usa proxy Vercel `/api` → Oracle VPS. CORS controlado por `CORS_ORIGINS`.
- **Backend → Atlas**: `MONGO_URI`; módulo `infra/mongo/mongo.module.ts`; `src/config/database.config.ts:1-5`.
- **Backend → PlugNotas**: `PlugNotasHttp` + `PlugNotasNfseApi` (emissão/consulta/xml/pdf/cancelamento), `PlugNotasCnpjApi`/`PlugNotasCompanyApi`/`PrerequisitesService` (empresas).
- **Backend → demais providers**: CNPJá (CNPJ primário), BrasilAPI, ReceitaWS (CNPJ fallback), ViaCEP (CEP), IBGE (municípios), Hub do Desenvolvedor (CPF).
- **Frontend → terceiros (dívida)**: 2 chamadas diretas ao IBGE (`src/services/location.ts:16` e `src/components/emissao/PrestacaoServicoSection.tsx:210`).

---

## 4. Todos os acoplamentos ao PlugNotas

### 4.1 Backend — acoplamento de contrato (forte)

| # | Local | O que acopla |
|---|---|---|
| A1 | `src/modules/fiscal/fiscal.module.ts:51-54` | Token `'FiscalProvider'` → `PlugNotasProvider` (DI direta) |
| A2 | `src/fiscal/infra/plugnotas.provider.ts:52-53` | `providerName = 'PLUGNOTAS'` |
| A3 | `src/fiscal/infra/plugnotas.provider.ts:102` | escreve `idIntegracao = referenciaExterna` no payload |
| A4 | `src/fiscal/infra/plugnotas.provider.ts:169-190` | trata HTTP 400+protocol como PENDING; `externalId` via `idNota/id/protocolo/protocol/idIntegracao` |
| A5 | `src/fiscal/infra/plugnotas/nfse.mapper.ts:7-31` | mapeia status e lê `retorno.situacao/status` etc. |
| A6 | `src/fiscal/infra/plugnotas/nfse.mapper.ts:52-115` | extrai `numeroNfse`, `dpsNum`, `serieDpsNum` do retorno |
| A7 | `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts:6` | **importa diretamente o mapper PlugNotas** (acoplamento mais forte: o core de persistência conhece o formato do provider) |
| A8 | `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts:8-30` | `buildExternalReferenceFilter` lê campos do `providerResponse` |
| A9 | `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts:82,154,209` | extrai identificadores do providerResponse em create/update |
| A10 | `src/fiscal/application/poll-nfse-status.service.ts:41-56` | `extractArtifactId` lê `idNota/id/nota.idNota/documents[0].*` |
| A11 | `src/fiscal/application/sync-nfse-artifacts.service.ts:10-24` | idem |
| A12 | `src/modules/webhooks/webhooks.service.ts:22-47,53-71` | candidatos de match `externalId/idIntegracao/protocolo/protocol/idNota/id` |
| A13 | `src/modules/webhooks/webhooks.service.ts:156` | **`provider: 'PLUGNOTAS'` hardcoded no webhook** |
| A14 | `src/modules/fiscal/fiscal.controller.ts:59-73` | `extractIdNota` lê `documents[0].id/id/idNota/nota.*` |
| A15 | `src/modules/fiscal/fiscal.controller.ts:286,298-307` | cancelamento extrai `idNota` e merge `providerResponse.cancelamento` |
| A16 | `src/modules/fiscal/fiscal.controller.ts:875,898` | download remoto usa `extractIdNota` |

### 4.2 Backend — acoplamento de integração (empresas)

| # | Local | O que faz |
|---|---|---|
| B1 | `src/modules/empresas/empresas.service.ts:7-9,133-134` | usa `PlugNotasCompanyApi`, `PlugNotasCnpjApi`, `getPlugNotasConfig` |
| B2 | `empresas.service.ts:348-382,737-778` | upload de certificado → `providerCertificadoId` |
| B3 | `company.api.ts:84-118` | `POST /certificado`, `POST /empresa`, `PATCH /empresa/{cnpj}` |
| B4 | `empresas.service.ts:1243-1270` | PlugNotas como fallback de consulta CNPJ |
| B5 | `empresa.schema.ts:140-161` | schema `PlugNotasNfseConfig` (toggles `ativoNfseNacional`, `consultaAutomaticaDfe`, `consultarDfe*`, `emailAutomatico`) |
| B6 | Rotas `POST /empresas/:id/plugnotas/sync` e `POST /empresas/cnpj/:cnpj/plugnotas/sync` | sincronização explícita de prestador com o provider |

### 4.3 Frontend — acoplamento de shape de dados

| # | Local | O que interpreta |
|---|---|---|
| C1 | `src/lib/nfse-provider.ts:52-129` | `providerRequest.payload[0]`, `providerResponse[0]`, `retorno.numeroNfse`, `dps.numero`, `dps.serie`, `servico[0].valor.servico` |
| C2 | `src/services/api.ts:431-466` | endpoints `provider-response` (por id e por externalId), normaliza `protocol = externalId`, `raw = providerResponse` |
| C3 | `src/types/api.ts:417-484` | tipos `EmitirNfseRequest/Response` com `opSimpNac/regApTribSN/regEspTrib`, `iss.*`, `idNota`, `protocol` |
| C4 | `src/pages/NfseEmitPage.tsx:111-112,460-461` | gera `referenciaExterna`, envia `codigoTributacao`/`codigoNacional` |
| C5 | `src/pages/EmpresaFormPage.tsx:1046-1122` | espelha Portal Nacional da última emissão via `provider-response` + `inferNfseDataFromProvider` |
| C6 | `src/pages/EmpresaFormPage.tsx:71-76,731-736,1228-1260` | toggles `plugNotasNfse` e `syncPlugNotas` (contrato `SyncEmpresaPlugNotasResponse`) |
| C7 | `src/services/api.ts:383` | filtro `provider === 'PLUGNOTAS'` na listagem |
| C8 | `src/types/api.ts:350-351` | `NfseStatus = PENDING|PROCESSING|AUTHORIZED|REJECTED|ERROR|CANCELLED` e `NfseProvider = PLUGNOTAS|MANAUS|MOCK` |

---

## 5. Divergências documentação ↔ código ↔ runtime

| # | Severidade | Divergência |
|---|---|---|
| V1 | Média | `CURRENT_STATE.md:1077` lista `MONGODB_URI`; o código lê **`MONGO_URI`** (`database.config.ts:3`, `.env.example:22`). Renomear só no doc quebra o runtime. |
| V2 | Média | CONTEXT (addendum) menciona `PUT /Empresa/updateCompany`; o código atual usa **`PATCH /empresa/{cnpj}`** (`company.api.ts:112-118`). Documento = histórico; código prevalece. |
| V3 | Alta | Docs registram webhook em `https://zera-backend.onrender.com/webhooks/fiscal` (Render, `CURRENT_STATE.md:395`); a infra atual é **Oracle VPS** via proxy Vercel `/api` (14/05). O callback do provider precisa apontar para onde o backend efetivamente recebe hoje — **não confirmado em runtime**. |
| V4 | Média | `README.md`/`render.yaml` descrevem deploy Render; produção real migrou para Oracle VPS (`docs/DEPLOY_ORACLE_VPS.md`, workflow `deploy-oracle.yml`). |
| V5 | Baixa | Polling: código default `NFSE_POLLING_INTERVAL_MS=300000` e jitter `15000` (`poll-nfse-status.runner.ts:16-21`); `.env.example` sugere `60000`/`3000`. Valor efetivo em runtime é `[PENDENTE]`. |
| V6 | Baixa | Status interno do backend é **`CANCELED`** (`nfse-emission-status.ts`); o tipo do frontend é **`CANCELLED`** (`types/api.ts:350`). Não quebra hoje (labels/maps), mas é incompatível como enum canônico. |
| V7 | Média | Frontend CONTEXT registra `VITE_API_BASE_URL=https://zera-backend.onrender.com` como canônica (2026-03-10); código atual usa `/api` relativo + proxy Vercel → Oracle. |

---

## 6. Riscos classificados

### 6.1 Riscos críticos (C)

- **R1-C [FATO/BLOQUEIO]** — **Sem acesso à VPS**: impossível confirmar commit real, health, recursos, env aplicado. Qualquer ação futura de deploy/rollback fica cega até chave SSH ser configurada. Ação: conseguir chave/autorização; então repetir inspeção read-only da seção 3 de `05-OPERACAO-ORACLE-VPS.md`.
- **R2-C [INFERÊNCIA]** — **Certificado A1 em texto-base64 no Atlas** (`empresa.schema.ts:63`): se a base for comprometida, o `.pfx` é recuperável; senha criptografada (AES-256-GCM) protege parcialmente, mas chave pode cair para `JWT_SECRET` (`.env.example:38`). Recomendação: mover `.pfx` para gerenciamento externo (secret manager/objeto cifrado) — **exige ADR** (item proibido sem aprovação: alterar infra).
- **R3-C [INFERÊNCIA]** — **Acoplamento do repositório ao formato PlugNotas** (`nfse-emission.repository.ts:6` + A7/A8): qualquer evolução de contrato interno toca o coração da persistência. É o principal alvo do contrato canônico (doc 03).
- **R4-C [FATO]** — **Webhook hardcoded `provider: 'PLUGNOTAS'`** (`webhooks.service.ts:156`): callbacks futuros de LOBONOTAS **não casarão** na emissão enquanto o provider estiver fixo. É bloqueador para o piloto LOBONOTAS.
- **R5-C [FATO]** — **Frontend frágil por shapes mistos**: `normalizeEmpresa` (~340 linhas em `services/api.ts:12-356`) desembrulha JSON string/wrappers/camel-snake. Qualquer mudança de contrato no backend tem alto risco de regressão de tela.

### 6.2 Riscos altos (A)

- **R6-A** — `providerRequest`/`providerResponse` expostos em `GET /nfse/:id/provider-response`, observability e DiagnoseAgent: risco de vazamento de dados fiscais/LGPD se não houver masking. O `DiagnoseAgent` já lê `emission.providerResponse` (`diagnose.agent.ts:126-131`).
- **R7-A** — Multi-prestador depende de config manual na aba NFS-e do provider (lacuna documentada em 18/05/2026). LOBONOTAS precisa eliminar essa dependência (onboarding self-contained).
- **R8-A** — `CORS_ORIGINS` é fonte de verdade; novo domínio quebra preflight (incidente 14/05). Todo rollout de front exige revisar allowlist.
- **R9-A** — Sem `timeline`/`observability` persistidos (computados no controller `fiscal.controller.ts:118-203`): a observabilidade depende de campos derivados; mudanças de provider precisam preservar essa semântica.

### 6.3 Riscos médios (M)

- **R10-M** — `UpdateStatusService` é stub morto (`src/modules/webhooks/services/update-status.service.ts:1-12`, não registrado). Não atrapalha, mas confunde.
- **R11-M** — Índice `{provider:1, externalId:1}` não único: duplicidade de `externalId` é possível (protegida só pela idempotência por `referenciaExterna`).
- **R12-M** — Docs de infra desatualizados (Render) podem orientar errado (V3/V4).
- **R13-M** — Catalogo LC116 carregado em runtime (`servicos_lc116_v2.json`); falha de path no build quebra autocomplete (incidente 20/04 já mitigado com cópia para `dist`).

---

## 7. Pontos fortes a preservar (não regredir)

1. Idempotência única por provider + `referenciaExterna` com replay (sem duplicar nota).
2. Polling com backoff + webhook com auditoria (`WebhookDeliveryAudit`) e `lastUpdateSource`.
3. Modelo multi-prestador validado (`empresaCnpj` em emissões e tomadores).
4. Contrato global de erro `{code, message, correlationId}`.
5. Persistência de BI (`biSnapshot` + campos de 1ª classe).
6. Isolamento do frontend: backend como fachada única de integrações (exceto as 2 chamadas IBGE).
7. `JWT_SECRET` obrigatório no boot (fail-fast).
