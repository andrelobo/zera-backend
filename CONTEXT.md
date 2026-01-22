# ZERA Backend – Project Context (NFSe / NuvemFiscal)

## Project Overview
ZERA Backend is a NestJS-based service responsible for issuing Brazilian NFSe (Nota Fiscal de Serviço Eletrônica) using the NuvemFiscal API, following the National NFSe Standard (Padrão Nacional, 2026 rules).

The backend is designed to:
- Emit real NFSe (sandbox and production)
- Persist emissions safely (no data loss)
- Handle provider instability
- Expose clean endpoints for frontend consumption
- Deliver PDF/XML artifacts when available

Frontend is intentionally thin; all fiscal complexity is handled here.

---

## Current Architecture
- Framework: NestJS
- Database: MongoDB (Mongoose)
- Fiscal Provider: NuvemFiscal
- Auth: OAuth2 Client Credentials
- Pattern: Provider abstraction (FiscalProvider)
- Polling: Background polling for NFSe status updates
- Artifacts: XML/PDF download endpoints

Key modules:
- FiscalModule
- NuvemFiscalProvider
- NfseEmissionRepository
- PollNfseStatusService
- WebhooksModule (ready, not mandatory for MVP)

---

## NFSe Emission Flow (Implemented)
1. POST /nfse/emitir
2. Payload is mapped to DPS (Documento Prestação de Serviço)
3. Request sent to POST /nfse/dps
4. Emission stored as PENDING
5. Background polling updates status:
   - AUTHORIZED
   - REJECTED
   - ERROR
6. Provider response and messages are persisted
7. Frontend queries:
   - /nfse/:id
   - /nfse/:id/provider-response
   - /nfse/:id/artifacts

---

## Environment Configuration (Working)

NUVEMFISCAL_ENV=sandbox  
NUVEMFISCAL_CLIENT_ID=***  
NUVEMFISCAL_CLIENT_SECRET=***  
NUVEMFISCAL_SCOPE="empresa nfse"  
NFSE_CMUN_IBGE=1302603  

OAuth flow confirmed working:
- Token issued correctly
- Scope validated
- API calls authenticated

---

## What Is Working
- OAuth authentication (empresa + nfse scope)
- Company registered in NuvemFiscal sandbox
- NFSe configuration applied
- Certificate installed and valid
- NFSe DPS submission returns 201 Created
- Polling updates emission status
- Provider responses stored and retrievable
- XML/PDF endpoints implemented

---

## Critical Blocking Issue (E50)

Error:
Inscricao Municipal do prestador inválida

Facts:
- The same company and IM successfully issued NFSe via the National Portal (Emissor Web 2026)
- Official XML shows IM = 51754301
- NuvemFiscal company registry also shows the same IM
- DPS schema does NOT accept IM explicitly
- Adding IM causes InvalidJsonProperty
- Removing IM causes E50 rejection

Conclusion:
This is NOT a code bug.
This is a semantic mismatch between:
- National NFSe schema (2026)
- Municipality (Manaus – IBGE 1302603)
- How IM is implicitly resolved by the official portal vs API validation

---

## Current Status
- Backend logic is correct
- Integration is correct
- OAuth is correct
- Payload follows official DPS schema
- Rejection is consistent and reproducible
- Issue is external / provider / municipal validation

---

## Next Actions
1. Open technical ticket with NuvemFiscal including:
   - Working XML from National Portal
   - DPS payload sent by backend
   - Exact E50 responses
2. Confirm with municipality how IM must be resolved
3. Keep backend unchanged (no hacks)
4. Proceed with frontend (flow is demonstrable)

---

## Key Statement
“The backend already emits real NFSe, handles provider instability, never loses an invoice, and delivers XML/PDF. Frontend is now just interface.”

