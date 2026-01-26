# ZERA Backend – Project Context

## 1. Overview

ZERA is a NestJS backend that powers a PWA to issue ultra-simplified NFSe (Brazilian national NFSe standard 2026), aimed at micro-entrepreneurs and small businesses.

Main goals:
- Hide fiscal complexity
- Keep legal compliance
- Allow switching fiscal providers without changing the core domain

Repo (main branch only):
- https://github.com/andrelobo/zera-backend

---

## 2. Tech Stack

- Node.js 20
- NestJS + TypeScript
- MongoDB Atlas (Mongoose)
- REST API
- Yarn
- ESLint + Prettier
- Swagger (OpenAPI) via @nestjs/swagger

---

## 3. Architecture (high level)

Flow:
- Controller → Application Service → FiscalProvider (NuvemFiscal) → Mongo Repository

Relevant structure:
- src/fiscal/
  - domain/
    - fiscal-provider.interface.ts
    - types/
      - emitir-nfse.types.ts
      - emitir-nfse.result.ts
      - nfse-emission-status.ts
  - application/
    - emitir-nfse.service.ts
    - poll-nfse-status.service.ts
  - infra/
    - nuvemfiscal.provider.ts
    - nuvemfiscal/
      - nuvemfiscal.config.ts
      - nuvemfiscal.http.ts
      - nuvemfiscal.auth.service.ts
      - nfse.api.ts
      - cnpj.api.ts
      - nfse.types.ts
      - nfse.mapper.ts
    - mongo/
      - schemas/nfse-emission.schema.ts
      - repositories/nfse-emission.repository.ts
- src/modules/fiscal/
  - fiscal.module.ts
  - fiscal.controller.ts
  - dtos/emitir-nfse.dto.ts
- src/modules/webhooks/
  - webhooks.module.ts
  - webhooks.controller.ts (/webhooks/fiscal)
  - handlers/webhook.handler.ts
  - webhooks.service.ts
  - services/update-status.service.ts
- src/modules/auth/
  - auth.module.ts
  - auth.controller.ts
  - auth.service.ts
  - jwt.strategy.ts
  - password.ts
  - guards/
    - jwt-auth.guard.ts
    - roles.guard.ts
    - roles.decorator.ts
  - schemas/user.schema.ts
  - dtos/login.dto.ts
  - dtos/bootstrap-admin.dto.ts
  - dtos/reset-admin-password.dto.ts
- src/modules/users/
  - users.module.ts
  - users.controller.ts
  - users.service.ts
  - dtos/create-user.dto.ts
  - dtos/update-user.dto.ts
- src/modules/empresas/
  - empresas.module.ts
  - empresas.controller.ts
  - empresas.service.ts
  - schemas/empresa.schema.ts
  - dtos/create-empresa.dto.ts
  - dtos/update-empresa.dto.ts

Domain principles:
- Provider decoupled (was PlugNotas, now NuvemFiscal)
- Use externalId for reconciliation
- Idempotent webhook handling
- Polling as fallback

---

## 4. NuvemFiscal Integration

Current provider: src/fiscal/infra/nuvemfiscal.provider.ts

### 4.1 Env & Auth

Env vars:
- NUVEMFISCAL_ENV: "sandbox" or "production"
- NUVEMFISCAL_CLIENT_ID
- NUVEMFISCAL_CLIENT_SECRET
- NUVEMFISCAL_SCOPE: "empresa nfse cnpj"
- NFSE_CMUN_IBGE: city IBGE code (currently 1302603 for Manaus)
- APP_VERSION: used as verAplic in DPS (default "zera-backend")

Company in NuvemFiscal:
- CNPJ: 43521115000134 (BURGUS LTDA / ECONTABILIS LTDA)
- Inscricao municipal: 0051754301
- Municipality: Manaus (1302603)
- Certificate installed and valid to 2027
- NFSe config set via PUT /empresas/{cpf_cnpj}/nfse

OAuth:
- We successfully get tokens with scope "empresa nfse cnpj"
- Backend logs show:
  - OAuth token request env=sandbox scope=empresa nfse
  - OAuth token ok expiresIn=2592000s tokenPrefix=eyJ0eXAi

### 4.2 NFSe API Layer

- NuvemFiscalHttp: wraps base URL, retries, logs, error handling
- NfseApi:
  - emitirDps(body)
  - consultarNfse(id)
  - baixarXmlNfse(id)
  - baixarPdfNfse(id, query?)
- CnpjApi:
  - consultarCnpj(cnpj)
- nfse.mapper.ts: maps provider status → NfseEmissionStatus enum

---

## 5. NFSe Use Case

### 5.1 Endpoints

FiscalController (/nfse):

- POST /nfse/emitir
  - Input: EmitirNfseDto (prestador, tomador, servico, referenciaExterna)
  - Calls EmitirNfseService

- GET /nfse/:id
- GET /nfse/external/:externalId
- GET /nfse/:id/provider-response
- GET /nfse/:id/artifacts   (hasXml, hasPdf, status)
- GET /nfse/:id/xml          (returns XML if stored)
- GET /nfse/:id/pdf          (returns PDF if stored)

WebhooksController:
- POST /webhooks/fiscal
  - Receives callbacks, updates emission by externalId (idempotent)

### 5.2 Persistence

Mongo schema NfseEmission:
- provider: string
- status: NfseEmissionStatus
- payload: Record<string, any>
- externalId?: string (indexed)
- error?: string
- providerResponse?: Record<string, any>
- timestamps: createdAt, updatedAt

Repository methods:
- create(...)
- updateEmission(...)
- updateStatus(...)
- setExternalId(...)
- updateByExternalId(...)
- findPending(...)
- findById(...)
- findByExternalId(...)

### 5.3 EmitirNfseService

- Creates emission with status PENDING and provider 'NUVEMFISCAL'
- Calls FiscalProvider.emitirNfse(input)
- Stores externalId when returned
- Returns:
  - emissionId
  - result (EmitirNfseResult: status, provider, externalId, providerResponse)

### 5.4 Polling

PollNfseStatusService:

- Finds pending emissions:
  - provider = NUVEMFISCAL
  - limit / olderThanMs from env
- Calls NfseApi.consultarNfse(externalId)
- Maps provider status to domain status
- Updates status + providerResponse
- On error: sets status = ERROR and saves error

Configured by:
- NFSE_POLLING_ENABLED
- NFSE_POLLING_INTERVAL_MS
- NFSE_POLLING_JITTER_MS
- NFSE_POLLING_LIMIT
- NFSE_POLLING_OLDER_THAN_MS

---

## 6. Empresas (CRUD + CNPJ Lookup)

### 6.1 Endpoints (auth required)

- POST /empresas
  - Body: { cnpj }
  - Fetches CNPJ data from NuvemFiscal and saves

- POST /empresas/preview
  - Body: { cnpj }
  - Fetches CNPJ data from NuvemFiscal and returns mapped payload without saving

- GET /empresas
- GET /empresas/:id
- GET /empresas/cnpj/:cnpj
- PATCH /empresas/:id
- DELETE /empresas/:id

### 6.2 Persistence

Mongo schema Empresa:
- cnpj (unique)
- razaoSocial
- nomeFantasia
- inscricaoMunicipal
- email
- fone
- endereco (logradouro, numero, complemento, bairro, codigoMunicipio, cidade, uf, codigoPais, pais, cep)
- providerData (trimmed payload from NuvemFiscal)
- timestamps: createdAt, updatedAt

### 6.3 ProviderData Trim

Saved providerData is trimmed for size and Mongo compatibility:
- Identificacao basica, situacao cadastral, atividades, endereco, contatos, simples/simei
- Removes heavy/irrelevant sections (ex: socios)

---

## 7. Auth + Users

### 7.1 Auth

- JWT auth with @nestjs/jwt + passport
- Bootstrap flow (one-time): POST /auth/bootstrap with header x-admin-setup-token
  - Disabled when NODE_ENV=production or BOOTSTRAP_ENABLED=false
  - Now requires name, email, password
- Login: POST /auth/login returns accessToken
  - Users with status="inactive" are blocked
- Reset admin password: POST /auth/admin/reset-password with header x-admin-setup-token
  - Enabled when ADMIN_RESET_ENABLED=true

Env vars:
- JWT_SECRET
- JWT_EXPIRES_IN (default 7d)
- ADMIN_SETUP_TOKEN
- BOOTSTRAP_ENABLED
- ADMIN_RESET_ENABLED
- CORS_ORIGINS (comma-separated, used by app.enableCors)

### 7.2 Users (CRUD, admin-only)

Roles:
- admin
- manager
- user

Status:
- active
- inactive

User fields:
- name (required)
- email (unique, required)
- passwordHash (required)
- role (required)
- status (required, default active)

Endpoints:
- GET /users
- GET /users/:id
- POST /users
- PATCH /users/:id
- DELETE /users/:id

---

## 8. Swagger (OpenAPI)

Swagger UI is available at:
- http://localhost:3000/docs

Documented with @nestjs/swagger in controllers and DTOs.

---

## 9. Current NFSe Payload Mapping (NuvemFiscalProvider)

EmitirNfseInput (simplified):

- prestador:
  - cnpj
  - inscricaoMunicipal?
  - razaoSocial
  - endereco (logradouro, numero, bairro, municipio, uf, cep)
- tomador:
  - cpfCnpj
  - razaoSocial
  - email?
  - endereco (...)
- servico:
  - codigoMunicipal
  - descricao
  - valor
- referenciaExterna: string

nfse.json used for tests (example):

- prestador.cnpj = 43521115000134
- prestador.inscricaoMunicipal = 51754301
- tomador.cpfCnpj = 11144477735 (or other test CPFs)
- servico.codigoMunicipal = "0107"
- valor = 100
- referenciaExterna = "teste-cli-005" (last version)

NuvemFiscalProvider.emitirNfse:

- Normalizes:
  - cnpjPrest = digits(prestador.cnpj)
  - imPrest   = digits(prestador.inscricaoMunicipal || "")
  - docTom    = digits(tomador.cpfCnpj)
- Uses NFSE_CMUN_IBGE as cMun (1302603)
- Builds DPS payload aligned with Padrao Nacional NFSe:
  - top-level: ambiente, referencia
  - infDPS:
    - tpAmb (1 production / 2 homologation)
    - dhEmi: new Date().toISOString()
    - verAplic: APP_VERSION or "zera-backend"
    - dCompet: YYYY-MM-DD (today)
    - prest: { CNPJ: cnpjPrest }  (IM handling is the bottleneck)
    - toma: orgaoPublico, CPF/CNPJ, xNome, email, optional endNac
    - serv: cServ (cTribNac, xDescServ)
    - valores: vServ, trib → ISSQN

---

## 10. Error History & Bottleneck

### 10.1 Already handled / understood

1. InvalidJsonProperty: "prestador"
   - Wrong JSON shape; fixed by proper DPS object.

2. InvalidJsonProperty: "IM", "inscrMun", "inscricaoMunicipal" in TInfoPrestador
   - NuvemFiscal rejected all these property names for the DPS Prestador block.
   - Indicates IM is not a direct property of TInfoPrestador in their public contract.

3. EmpresaNotFound
   - Solved by registering the company in NuvemFiscal and verifying with GET /empresas/{cpf_cnpj}.

4. CertificateNotFound
   - Solved by uploading a valid certificate to NuvemFiscal panel.

5. ConfigNfseNotFound
   - Solved by calling PUT /empresas/{cpf_cnpj}/nfse with the minimal valid NFSe configuration.

6. E50 – "Inscricao Municipal do prestador invalida"
   - Appears as a municipal/national validation code when DPS/IM config do not match prefeitura expectations.
   - Changing IM format in NuvemFiscal (with/without leading zeros) changed the error behavior but did not fully solve the problem.

7. X800 / ValidationFailed – QuantidadeRps vs InscricaoMunicipal
   - Message from XML validator:
     - "Erro de Validacao:  --> 1871 - Element 'QuantidadeRps': This element is not expected. Expected is ( InscricaoMunicipal )."
   - Indicates a deeper issue on how the batch header / DPS / Inscricao Municipal is represented in the generated XML, and how the prefeitura's rules are configured.

We also have a successful NFSe XML from the national portal (outside our system) using the same:

- CNPJ 43521115000134
- Inscricao municipal 51754301
- Municipality Manaus 1302603
- National standard 2026

This proves that:

- The company is enabled for NFSe in that municipality,
- The problem is not business enablement but how NuvemFiscal expects the DPS payload / config.

### 10.2 Current bottleneck (short)

- Integration with NuvemFiscal (auth, HTTP, company, certificate, config) is OK.
- Our backend successfully calls /nfse/dps and gets consistent error payloads.
- The remaining blocker is the combination of:
  - Padrao Nacional NFSe DPS JSON contract in NuvemFiscal (TInfDPS / TInfoPrestador / batch header),
  - The company's Inscricao Municipal and NFSe configuration,
  - Municipality Manaus validation rules.

At this point, trial-and-error of JSON field names is exhausted and unproductive.

---

## 11. Contact with NuvemFiscal Support (VERY IMPORTANT)

We are actively requesting help from NuvemFiscal support.

Our support request includes:

- CNPJ: 43521115000134 (BURGUS LTDA)
- Environment: we first used sandbox in NuvemFiscal, but the company appears to be enabled only for production NFSe in Manaus.
- Inscricao municipal in NuvemFiscal: 0051754301
- Municipality: Manaus (IBGE 1302603)
- Certificate: installed, valid to 2027
- NFSe config: present (PUT /empresas/{cpf_cnpj}/nfse)
- Scope: "empresa nfse cnpj"
- API: /nfse/dps being called from backend with valid OAuth tokens

Error history described to support:

- Previous: E50 – Inscricao Municipal do prestador invalida
- Current: X800 / ValidationFailed: QuantidadeRps vs InscricaoMunicipal
- We also have a valid NFSe XML issued via national portal for the same CNPJ/IM.

Explicit questions to support:

1. What is the exact JSON schema expected for TNfseDpsPedidoEmissao / TInfoPrestador in Padrao Nacional NFSe, specifically for Manaus?
2. How should Inscricao Municipal be supplied:
   - Only via company config in /empresas/{cpf_cnpj}, or
   - Also in DPS JSON; if yes, what is the exact property name and location?
3. For Manaus, should we be using sandbox or production for NFSe testing with this company?
4. Why does the validator claim it expects InscricaoMunicipal instead of QuantidadeRps in the specific XML node (1871)?

Until NuvemFiscal support answers these questions with precision, we are not changing the DPS payload structure again.

---

## 12. Development Workflow (EOF Pattern)

Because the chat interface often breaks large files, we enforce a strict pattern for code changes.

### 12.1 Creating or replacing files

Any assistant must provide file changes like this:

```bash
cat << 'EOF' > src/some/path/file.ts
// full file content here
// NO truncation, NO "..." placeholders
