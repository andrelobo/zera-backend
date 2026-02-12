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

Crie um arquivo `.env` na raiz do projeto (baseado em `.env.example`):

```env
NODE_ENV=development
APP_PORT=3000
CORS_ORIGINS=http://localhost:8080,http://127.0.0.1:8080

MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority&appName=zera

PLUGNOTAS_BASE_URL=https://api.sandbox.plugnotas.com.br
PLUGNOTAS_API_KEY=
PLUGNOTAS_CNPJ_PATH=/cnpj/{cnpj}
PLUGNOTAS_NFSE_XML_PATH=/nfse/xml/{id}
PLUGNOTAS_NFSE_PDF_PATH=/nfse/pdf/{id}

JWT_SECRET=
JWT_EXPIRES_IN=7d
ADMIN_SETUP_TOKEN=
BOOTSTRAP_ENABLED=true
ADMIN_RESET_ENABLED=true

NFSE_POLLING_ENABLED=true
NFSE_POLLING_INTERVAL_MS=300000
NFSE_POLLING_JITTER_MS=15000
NFSE_POLLING_LIMIT=50
NFSE_POLLING_OLDER_THAN_MS=30000

NFSE_STORE_ARTIFACTS=true
NFSE_CMUN_IBGE=1302603

WEBHOOK_SHARED_SECRET=
WEBHOOK_SHARED_SECRET_HEADER=x-webhook-token
```


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
docker compose up --build
```

API disponível em:
http://localhost:3000

Health check:
GET /health

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
