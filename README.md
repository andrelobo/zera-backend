<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="100" alt="NestJS Logo" />
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

Este repositório encontra-se atualmente em:

> **Sprint 01 — Fundação & Infraestrutura**

Funcionalidades implementadas até o momento:
- Bootstrap do projeto NestJS
- Conexão com MongoDB (Atlas) via Mongoose
- Configuração por variáveis de ambiente
- Endpoint de saúde (`GET /health`)
- Dockerização completa da API
- ESLint + Prettier configurados

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

Crie um arquivo `.env` na raiz do projeto:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority&appName=zera
```

---

## ▶️ Executando o Projeto

```bash
yarn install
yarn start:dev
```

---

## 🐳 Executando com Docker

```bash
docker compose up --build
```

API disponível em:
http://localhost:3000

Health check:
GET /health
