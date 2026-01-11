# ZERA Backend — Project Context

## 1. Purpose of this File

This document defines the **current technical context** of the ZERA backend repository.

It must be read **before suggesting changes, features or integrations**, especially by:
- AI assistants
- New developers
- External contributors

This file represents the **source of truth** for the current state of the codebase.

---

## 2. Project Overview

ZERA is a backend API built to support a Progressive Web App (PWA) focused on **ultra-simplified issuance of NFS-e (Brazilian National Standard – 2026)**.

The main goal is to remove technical and operational complexity for micro-entrepreneurs and small businesses.

This repository currently represents **Sprint 01 – Foundation & Infrastructure**.

---

## 3. Tech Stack (Current)

- Runtime: Node.js 20
- Framework: NestJS
- Language: TypeScript
- Package Manager: Yarn
- Database: MongoDB (Atlas)
- ODM: Mongoose
- API Style: REST
- Containerization: Docker
- Linting: ESLint (Flat Config)
- Formatting: Prettier

---

## 4. Architecture Overview

The backend follows a **modular NestJS architecture**, with clear separation of concerns.

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

## 5. Environment Configuration

Environment variables are managed via **NestJS ConfigModule**.

```
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority&appName=zera
```

Notes:
- MongoDB runs externally (MongoDB Atlas)
- No local database container is used
- Docker is used only for the API

---

## 6. Containerization

- Multi-stage Dockerfile
- docker-compose.yml with API only
- Exposed port: 3000

---

## 7. Code Quality & Standards

- ESLint Flat Config
- Prettier as formatting authority
- Balanced TypeScript strictness for MVP phase

---

## 8. Current Features (Sprint 01)

- NestJS bootstrap
- MongoDB connection
- Health endpoint (`GET /health`)
- Dockerized API
- Environment-based configuration
- ESLint + Prettier

---

## 9. Out of Scope (Not Implemented Yet)

- Authentication
- NFS-e integration
- XML/PDF generation
- Webhooks
- WhatsApp / Email notifications
- Roles / permissions
- Rate limiting
- Audit logs

---

## 10. Next Planned Phase

**Sprint 02 – Core Fiscal Foundations**
- Authentication module
- Fiscal provider abstraction
- Secure signing
- Initial NFS-e flow

---

## 11. Guidance

All future changes must respect:
- MongoDB as the only database
- NestJS modular structure
- Dockerized API
- Sprint-based incremental evolution
