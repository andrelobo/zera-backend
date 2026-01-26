# ZERA Frontend Integration Guide

## 1. Base URL

Default local base URL:
- http://127.0.0.1:3000

Swagger (OpenAPI) UI:
- http://127.0.0.1:3000/docs

---

## 2. Auth (Admin)

### 2.1 Bootstrap Admin (one-time)

Used only once to create the first admin user.
Disabled in production or when `BOOTSTRAP_ENABLED=false`.

Request:
- POST /auth/bootstrap
- Header: x-admin-setup-token: <ADMIN_SETUP_TOKEN>
- Body:
```json
{
  "name": "Admin Zera",
  "email": "admin@zera.com",
  "password": "password"
}
```

Response:
```json
{
  "id": "...",
  "name": "Admin Zera",
  "email": "admin@zera.com",
  "role": "admin",
  "status": "active"
}
```

### 2.2 Login

Request:
- POST /auth/login
- Body:
```json
{
  "email": "admin@zera.com",
  "password": "password"
}
```

Response:
```json
{
  "accessToken": "<JWT>"
}
```

Notes:
- Users with `status="inactive"` are blocked from login.

### 2.3 Using the token

For all protected endpoints, include:
- Authorization: Bearer <JWT>

### 2.4 Reset Admin Password (via setup token)

Enabled when `ADMIN_RESET_ENABLED=true`.

Request:
- POST /auth/admin/reset-password
- Header: x-admin-setup-token: <ADMIN_SETUP_TOKEN>
- Body:
```json
{
  "email": "admin@zera.com",
  "password": "new-strong-password"
}
```

Response:
```json
{
  "id": "...",
  "email": "admin@zera.com",
  "role": "admin"
}
```

---

## 3. Users (CRUD)

All endpoints require admin auth.

### 3.1 List

- GET /users
Response:
```json
[
  {
    "id": "...",
    "name": "Nome completo",
    "email": "email@exemplo.com",
    "role": "user",
    "status": "active",
    "createdAt": "2026-01-26T12:00:00.000Z",
    "updatedAt": "2026-01-26T12:00:00.000Z"
  }
]
```

### 3.2 Get by ID

- GET /users/:id
Response:
```json
{
  "id": "...",
  "name": "Nome completo",
  "email": "email@exemplo.com",
  "role": "user",
  "status": "active",
  "createdAt": "2026-01-26T12:00:00.000Z",
  "updatedAt": "2026-01-26T12:00:00.000Z"
}
```

### 3.3 Create

- POST /users
- Body:
```json
{
  "name": "Nome completo",
  "email": "email@exemplo.com",
  "password": "senha-forte",
  "role": "user",
  "status": "active"
}
```

### 3.4 Update

- PATCH /users/:id
- Body (partial):
```json
{
  "name": "Nome atualizado",
  "email": "novo@email.com",
  "password": "nova-senha-forte",
  "role": "manager",
  "status": "inactive"
}
```

### 3.5 Delete

- DELETE /users/:id

---

## 4. Empresas (CRUD + CNPJ lookup)

All endpoints require admin auth.

### 4.1 Create from CNPJ

Request:
- POST /empresas
- Body:
```json
{
  "cnpj": "43521115000134"
}
```

Behavior:
- Calls NuvemFiscal CNPJ endpoint
- Maps data to Empresa fields
- Saves in MongoDB

### 4.2 Preview from CNPJ (no persistence)

Request:
- POST /empresas/preview
- Body:
```json
{
  "cnpj": "43521115000134"
}
```

Behavior:
- Same mapping as create
- Does not save

### 4.3 List

- GET /empresas

### 4.4 Get by ID

- GET /empresas/:id

### 4.5 Get by CNPJ

- GET /empresas/cnpj/:cnpj

### 4.6 Update

- PATCH /empresas/:id
- Body (partial):
```json
{
  "razaoSocial": "...",
  "nomeFantasia": "...",
  "inscricaoMunicipal": "...",
  "email": "...",
  "fone": "...",
  "endereco": {
    "logradouro": "...",
    "numero": "...",
    "bairro": "...",
    "cidade": "...",
    "uf": "...",
    "cep": "..."
  }
}
```

### 4.7 Delete

- DELETE /empresas/:id

---

## 5. NFSe (Fiscal)

### 5.1 Emitir NFSe

- POST /nfse/emitir
- Body (exemplo):
```json
{
  "prestador": {
    "cnpj": "43521115000134",
    "inscricaoMunicipal": "51754301",
    "razaoSocial": "BURGUS LTDA",
    "endereco": {
      "logradouro": "Rua Saldanha Marinho",
      "numero": "606",
      "bairro": "Centro",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69010040"
    }
  },
  "tomador": {
    "cpfCnpj": "11144477735",
    "razaoSocial": "Cliente Exemplo",
    "email": "cliente@example.com",
    "endereco": {
      "logradouro": "Rua Exemplo",
      "numero": "100",
      "bairro": "Centro",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69010000"
    }
  },
  "servico": {
    "codigoMunicipal": "0107",
    "descricao": "Serviços de informática",
    "valor": 100
  },
  "referenciaExterna": "teste-cli-005"
}
```

### 5.2 Consultas

- GET /nfse/:id
- GET /nfse/external/:externalId
- GET /nfse/:id/provider-response
- GET /nfse/:id/artifacts
- GET /nfse/:id/xml
- GET /nfse/:id/pdf

---

## 6. Webhooks

- POST /webhooks/fiscal

Used by the fiscal provider to update status. No auth in the current setup.

---

## 7. Health

- GET /health

---

## 8. Errors (common)

- 400 Bad Request
  - Invalid CNPJ
  - Provider lookup failure
- 401 Unauthorized
  - Missing/invalid token
- 403 Forbidden
  - Wrong role (non-admin)

---

## 9. Notes for Frontend

- Use the Swagger UI as the source of truth for payloads.
- Empresa creation only needs CNPJ; rest is auto-filled.
- Preview endpoint allows showing data before saving.
- JWT token should be stored securely (memory or secure storage).

---

## 10. Quick Test (curl)

Login:
```bash
curl -s -X POST http://127.0.0.1:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@zera.com","password":"password"}'
```

Create user:
```bash
TOKEN="<JWT>"
curl -s -X POST http://127.0.0.1:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Nome completo","email":"email@exemplo.com","password":"senha-forte","role":"user","status":"active"}'
```

Create empresa:
```bash
TOKEN="<JWT>"
curl -s -X POST http://127.0.0.1:3000/empresas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cnpj":"43521115000134"}'
```

Preview empresa:
```bash
TOKEN="<JWT>"
curl -s -X POST http://127.0.0.1:3000/empresas/preview \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cnpj":"43521115000134"}'
```
