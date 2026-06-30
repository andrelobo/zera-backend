<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="85" alt="NestJS Logo" />
</p>

<h1 align="center">ZERA Backend API</h1>

<p align="center">
  Backend oficial do App ZERA — emissão de NFS-e com complexidade zero.
</p>

---

## 📌 Visão Geral

O **ZERA Backend** é uma API construída em **NestJS** para suportar o App ZERA, uma
**Progressive Web App (PWA)** focada na **emissão ultra-simplificada de Nota Fiscal de Serviços Eletrônica (NFS-e)** no **Padrão Nacional (2026)**.

O objetivo do projeto é **abstrair totalmente a complexidade fiscal**, permitindo que microempreendedores e pequenas empresas emitam notas fiscais de forma rápida, segura e mobile-first.

---

## 🚨 Premissa Canônica

Este backend deve ser tratado como **sistema já em produção**.

Implicações práticas:
- qualquer mudança precisa assumir **usuários reais** e **emissões reais**
- `homologação`, `rollout` e `ajustes` descritos no contexto significam evolução controlada de frentes específicas, e não ausência de operação produtiva
- a prioridade padrão é **evitar regressão operacional/fiscal**

➡️ Antes de sugerir alterações, parta da premissa: **o core do ZERA já roda em PROD**.

---

## 🧱 Estado Atual do Projeto

Este repositório já contempla o **MVP fiscal com PlugNotas** e módulos básicos de autenticação/usuários.

Funcionalidades implementadas:
- Emissão assíncrona de NFS-e via PlugNotas (`POST /nfse/emitir`)
- Persistência de emissões, status e polling com backoff
- Download de XML/PDF (local e direto do provider)
- Consulta de CNPJ (cadastro facilitado) via PlugNotas
- Módulos de auth, users e empresas
- Health check (`GET /health`)
- Dockerização + configuração por `.env`

Situação atual (produção Manaus/AM – fevereiro/2026):
- Payload com IM validado, porém rejeições **E0312/E0314** por **códigos de tributação não administrados** na competência.
- Necessário obter `cTribNac`/`cTribMun` válidos em produção (contador/prefeitura/PlugNotas).
- Detalhes: `REPORT_PLUGNOTAS_PROD_2026-02-06.md`.

📄 **Referência técnica completa:**  
➡️ Consulte o arquivo [`CONTEXT.md`](./CONTEXT.md) antes de sugerir alterações ou novas funcionalidades.

---

## 🛠️ Stack Tecnológica

- Node.js 20
- NestJS
- TypeScript
- MongoDB Atlas
- Mongoose
- Yarn
- Docker / Docker Compose
- ESLint (Flat Config)
- Prettier

---

## 📁 Estrutura de Pastas

```
src/
├── main.ts
├── app.module.ts
│
├── config/
│   ├── app.config.ts
│   └── database.config.ts
│
├── infra/
│   └── mongo/
│       └── mongo.module.ts
│
├── core/
│   └── health/
│       ├── health.controller.ts
│       └── health.module.ts
```

---

## ⚙️ Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto com base em [`./.env.example`](./.env.example).

O `.env.example` agora lista as variaveis usadas pelo backend em runtime, integracoes externas e fluxos auxiliares.

Para deploy, revise obrigatoriamente:
- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_SETUP_TOKEN`
- `PLUGNOTAS_API_KEY`
- `WEBHOOK_SHARED_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_APP_URL`
- `FRONTEND_URL`

Pré-requisitos NFSe Nacional (modo seguro):
- `PLUGNOTAS_PREREQ_MODE=off` mantém o comportamento atual de produção (sem bloqueio).
- `warn` executa os pré-checks e registra falhas sem bloquear emissão.
- `enforce` bloqueia emissão se o check de cidade falhar, e também se a habilitação da empresa estiver ativa e falhar.
- A habilitação da empresa é controlada por `PLUGNOTAS_PREREQ_ENABLE_COMPANY` e vem `false` por padrão para evitar efeito colateral inesperado.

Observacao importante:
- se o banco estiver vazio, `POST /auth/bootstrap` nao responde com `NODE_ENV=production`; faca o bootstrap inicial antes de travar o ambiente em producao ou use uma base ja inicializada.

---

## ▶️ Executando o Projeto

```bash
yarn install
yarn start:dev
```

---

## 🚀 Deploy na Render (Blueprint)

Este repositório inclui `render.yaml` para provisionar o serviço web.

1. No painel da Render: **New +** -> **Blueprint**.
2. Selecione este repositório/branch.
3. Confirme a criação do serviço `zera-backend`.
4. Após o primeiro deploy, configure os secrets no Dashboard:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `ADMIN_SETUP_TOKEN`
   - `PLUGNOTAS_API_KEY`
   - `WEBHOOK_SHARED_SECRET`
5. Valide:
   - `GET /health`
   - `GET /docs`

---

## 🐳 Executando com Docker

```bash
cp .env.example .env
docker compose up -d --build
```

API disponível em:
http://localhost:3000

Health check:
GET /health

Guia do primeiro deploy na Oracle VPS:
[`docs/DEPLOY_ORACLE_VPS.md`](./docs/DEPLOY_ORACLE_VPS.md)

Deploy automatizado:
`.github/workflows/deploy-oracle.yml`

---

## 📌 Endpoints NFSe (PlugNotas)

Emissão:
- `POST /nfse/emitir`

Campos adicionais aceitos no payload:
- `tomador.inscricaoMunicipal` (opcional)
- `servico.iss` (opcional)
- `servico.tributacaoTotal` (opcional)

Consulta interna:
- `GET /nfse/:id`
- `GET /nfse/:id/provider-response`

Download (local, se artifacts foram salvos):
- `GET /nfse/:id/xml`
- `GET /nfse/:id/pdf`

Download direto do provider (usa idNota da PlugNotas):
- `GET /nfse/:id/remote/xml`
- `GET /nfse/:id/remote/pdf`

Cancelamento:
- `POST /nfse/:id/cancelamento` (default `codigo=9`, motivo padrão se omitidos)
- `GET /nfse/cancelamento/:cancellationProtocol`
