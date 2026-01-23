# ZERA Backend — Project Context

## 1. Purpose of this File

This document defines the **current technical and architectural context**
of the ZERA backend repository.

It must be read **before suggesting changes, features or integrations**,
especially by:
- AI assistants
- New developers
- External contributors

This file is the **source of truth** for the current state of the codebase.

Additional instruction for AI pair coding:
- When proposing changes, always send the full target file content using `cat <<'EOF'` to make edits easier.

---

## 2. Project Overview

ZERA is a backend API built to support a Progressive Web App (PWA)
focused on **ultra-simplified issuance of NFS-e**
(Brazilian National Standard – 2026).

The core product goals are:
- Hide fiscal and municipal complexity
- Maintain legal compliance
- Allow fiscal provider replacement without refactoring core logic
- Be resilient to provider instability

The backend is already capable of **real NFSe emission in sandbox**.

---

## 3. Current Sprint Status

**Current milestone:** Sprint 02D — Fiscal Core (Robust)

Already implemented:
- Real NFSe emission via fiscal provider
- OAuth2 integration
- Polling with retry/backoff
- Artifact handling (XML / PDF)
- Idempotent updates via `externalId`

The backend is now considered **feature-complete for MVP backend**.
Frontend is purely a consumer.

---

## 4. Tech Stack (Current)

- Runtime: Node.js 20
- Framework: NestJS
- Language: TypeScript
- Package Manager: Yarn
- Database: MongoDB Atlas
- ODM: Mongoose
- API Style: REST
- Containerization: Docker
- Linting: ESLint (Flat Config)
- Formatting: Prettier

---

## 5. Architecture Overview

The backend follows a **modular architecture with explicit domain boundaries**.

Core flow:

Controller
  → Application Service
    → FiscalProvider (decoupled)
      → External API (NuvemFiscal)
    → Repository (MongoDB)

---

## 6. Status

Backend ready for frontend integration.
