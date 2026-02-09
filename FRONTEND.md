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
- Calls PlugNotas CNPJ endpoint (`/cnpj/:cnpj`) to fetch Receita data
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

## 5. NFSe (Fiscal) – PlugNotas (NFSe Nacional)

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
    "inscricaoMunicipal": "8214100099",
    "email": "cliente@example.com",
    "endereco": {
      "logradouro": "Rua Exemplo",
      "numero": "100",
      "complemento": "sala 01",
      "bairro": "Centro",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69010000"
    }
  },
  "servico": {
    "codigoMunicipal": "0107",
    "codigoNacional": "100101",
    "descricao": "Serviços de informática",
    "valor": 100,
    "iss": {
      "tipoTributacao": 6,
      "exigibilidade": 1,
      "retido": false,
      "aliquota": 2
    },
    "tributacaoTotal": {
      "federal": { "valor": 0.1, "valorPercentual": 1 },
      "estadual": { "valor": 0.1, "valorPercentual": 2 },
      "municipal": { "valor": 0.1, "valorPercentual": 3 }
    }
  },
  "referenciaExterna": "teste-cli-005"
}
```

Notas importantes:
- **NFSe Nacional exige `codigoNacional` com 6 dígitos.**
- O backend mapeia para o formato PlugNotas (`servico[]`, `valor.servico` etc.).
- `referenciaExterna` vira `idIntegracao` na PlugNotas.
- Em produção (Manaus/AM), a prefeitura exige **códigos de tributação válidos na competência**. Sem isso, a emissão é rejeitada (E0312/E0314).

### 5.2 Consultas

- GET /nfse/:id
- GET /nfse/external/:externalId
- GET /nfse/:id/provider-response
- GET /nfse/:id/artifacts
- GET /nfse/:id/xml
- GET /nfse/:id/pdf
- GET /nfse/:id/remote/xml (download direto do provider usando idNota)
- GET /nfse/:id/remote/pdf (download direto do provider usando idNota)

---

## 6. Webhooks

- POST /webhooks/fiscal

Used by the fiscal provider to update status. If `WEBHOOK_SHARED_SECRET` is set, the provider must send the token in `WEBHOOK_SHARED_SECRET_HEADER` (default `x-webhook-token`).

### 6.1 PlugNotas (recomendado)

- Para o PlugNotas, **webhook é o fluxo recomendado**.
- O frontend deve estar pronto para:
  - atualizar status em tempo real (via SSE/polling interno do app),
  - refletir `AUTHORIZED/REJECTED` rapidamente sem esperar o polling.
- Polling pode ficar como fallback.

---

## 7. Health

- GET /health

---

## 8. Errors (common)

- 400 Bad Request
  - Invalid CNPJ
  - Provider lookup failure (PlugNotas)
- 401 Unauthorized
  - Missing/invalid token
- 403 Forbidden
  - Wrong role (non-admin)
- Produção Manaus/AM (PlugNotas):
  - E0312: código de tributação nacional não administrado na competência.
  - E0314: código de tributação municipal inexistente/não administrado.

---

## 9. Notes for Frontend

- Use the Swagger UI as the source of truth for payloads.
- Empresa creation only needs CNPJ; rest is auto-filled (via PlugNotas).
- Preview endpoint allows showing data before saving.
- JWT token should be stored securely (memory or secure storage).
- Se o status ficar `ERROR` com mensagem `PlugNotas API error: 404`, normalmente é falha no download de XML/PDF (endpoints incorretos ou nota ainda não disponível).

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

---

# ✅ Documento de Migração para o Frontend (NuvemFiscal → PlugNotas)

Use esta seção como **checklist final** para atualizar o frontend.

## A. Fluxos que mudaram

1) **Emissão de NFSe**
- Agora o backend envia para **PlugNotas (NFSe Nacional)**.
- O front deve enviar **`codigoNacional` (6 dígitos)** no payload.
- O front deve manter `referenciaExterna` única por nota.

2) **Consulta de CNPJ**
- Continua via `/empresas/preview` e `/empresas` (admin), mas agora a fonte é **PlugNotas /cnpj**.
- Pode retornar 200 com “erro” no corpo (alerta da Receita).

3) **Download de XML/PDF**
- O backend pode baixar localmente (se artifacts foram salvos).
- Existe endpoint novo para **download direto do provider**:
  - `GET /nfse/:id/remote/xml`
  - `GET /nfse/:id/remote/pdf`

## B. Mudanças de payload (front → backend)

### 1) Emissão (`POST /nfse/emitir`)
**Obrigatório no front agora:**
- `servico.codigoNacional` com 6 dígitos (ex.: `"100101"`).
- `tomador.endereco.complemento` é aceito (opcional).

Exemplo mínimo ajustado:
```json
{
  "prestador": {
    "cnpj": "08187168000160",
    "inscricaoMunicipal": "716",
    "razaoSocial": "TECNOSPEED S/A",
    "endereco": {
      "logradouro": "AV DUQUE DE CAXIAS",
      "numero": "882",
      "bairro": "ZONA 07",
      "municipio": "MARINGA",
      "uf": "PR",
      "cep": "87020025"
    }
  },
  "tomador": {
    "cpfCnpj": "99999999999999",
    "razaoSocial": "Empresa de Teste LTDA",
    "email": "teste@plugnotas.com.br",
    "endereco": {
      "logradouro": "Barao do rio branco",
      "numero": "1001",
      "bairro": "Centro",
      "municipio": "Maringa",
      "uf": "PR",
      "cep": "87020100",
      "complemento": "sala 01"
    }
  },
  "servico": {
    "codigoMunicipal": "0107",
    "codigoNacional": "100101",
    "descricao": "Descrição dos serviços prestados",
    "valor": 1
  },
  "referenciaExterna": "teste-cli-001"
}
```

## C. Mudanças de UI/UX recomendadas

1) **Tela de emissão**
- Exigir `codigoNacional` (6 dígitos) ou fornecer lista de serviços.
- Mostrar `referenciaExterna` gerada automaticamente.

2) **Tela de status**
- Exibir status interno: `PENDING`, `AUTHORIZED`, `REJECTED`, `ERROR`.
- Quando `ERROR` e o providerResponse indicar `AUTORIZADA`, mostrar alerta:
  “Nota autorizada, mas falhou o download do XML/PDF.”

3) **Tela de download**
- Primeiro tentar `/nfse/:id/xml` e `/nfse/:id/pdf`.
- Se retornar `hasXml=false` ou `hasPdf=false`, oferecer botão “Baixar direto do provider”
  usando `/nfse/:id/remote/xml` e `/nfse/:id/remote/pdf`.

## D. Mudanças de contrato de API que impactam o front

### 1) `servico.codigoNacional` obrigatório
- Sem 6 dígitos a API retorna erro de validação.

### 2) Endpoints novos de download remoto
- Úteis quando o backend não salvou artifacts.

## E. Erros comuns e como tratar no front

- **400**: Falha de validação do payload (ex.: `codigoNacional` inválido).
- **401/403**: Token inválido ou falta de permissão admin.
- **Status interno ERROR com providerResponse autorizado**:
  mostrar CTA para baixar via `/nfse/:id/remote/*`.

## G. Estratégia recomendada (PlugNotas)

- **Preferir Webhook** para atualização de status.
- **Polling apenas como fallback** (ex.: 5–10 min) para garantir reconciliação.

## F. Checklist final para o time de front

- [ ] Adicionar campo `codigoNacional` (6 dígitos) no formulário de emissão.
- [ ] Atualizar schema de validação do payload.
- [ ] Atualizar tela de status para mostrar mensagens do providerResponse.
- [ ] Implementar botão “Baixar direto do provider”.
- [ ] Ajustar fluxos de CNPJ (source PlugNotas).
- [ ] Testar emissão sandbox (status autorizado).
