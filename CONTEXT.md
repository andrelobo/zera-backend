# ZERA Backend – Project Context

## 1. Overview

ZERA is a NestJS backend that powers a PWA to issue ultra-simplified NFSe (Brazilian national NFSe standard 2026), aimed at micro-entrepreneurs and small businesses.

Main goals:

* Hide fiscal complexity
* Keep legal compliance
* Allow switching fiscal providers without changing the core domain

Repo (main branch only):

* [https://github.com/andrelobo/zera-backend](https://github.com/andrelobo/zera-backend)

---

## 2. Tech Stack

* Node.js 20
* NestJS + TypeScript
* MongoDB Atlas (Mongoose)
* JWT + Passport
* Docker

---

## 3. Domain Summary

Core domain focus: **NFSe issuance lifecycle**

* issue (create/submit)
* pending processing
* authorized (success)
* rejected (failure)
* cancel (future)

ZERA aims to keep the UI extremely simple while producing valid NFSe documents.

---

## 4. Current Problem (January 2026)

### Context

We issue NFSe for Manaus/AM (IBGE 1302603) using a fiscal provider API.

Observed behavior (NuvemFiscal, production):

* NFSe request is accepted by provider
* status becomes **pending**
* later becomes **rejected/negada** with `E403`

We confirmed the business/fiscal data is valid by issuing successfully through the **Portal Nacional** and obtaining the authorized XML.

### Current conclusion

Root cause is still unclear. The provider returns `E403` and asks to "recuperar a relação dos erros", but there is no known endpoint returning the detailed errors. This blocks diagnosis and reinforces the decision to migrate providers.

---

## 5. Provider Abstraction

ZERA’s backend is designed to swap fiscal providers with minimal impact.

Provider responsibilities:

* auth / credentials
* issue NFSe
* query status
* download XML/PDF
* receive webhook callbacks

Domain responsibilities:

* validation and normalization
* idempotency and correlation
* internal status model

---

## 6. Next Steps

* stabilize emission flow for Manaus
* keep full traceability (request → provider id → status → XML)
* improve provider observability and error reporting

---

# ADDENDUM (PT-BR) – Migração para PlugNotas (Tecnospeed) e NFSe Nacional (2026)

> **Importante (canônico):** as seções 1–6 acima permanecem como histórico do backend. Este addendum registra a **realidade atual** (migração e endpoints) sem sobrescrever o histórico.

## A. Por que estamos mudando de provider

Motivação (objetiva):

* Integração anterior (NuvemFiscal) ficou bloqueada com rejeições municipais (Manaus) e **baixa responsividade de suporte**.
* O core do ZERA é **emissão fiscal em produção**; previsibilidade e suporte são requisitos.
* PlugNotas expõe claramente os fluxos de **NFSe Nacional** (Padrão Nacional), com consulta assíncrona e webhooks.

## B. PlugNotas – Ambiente Sandbox

* Base URL: `https://api.sandbox.plugnotas.com.br`
* Auth: header `x-api-key: <SUA_API_KEY_SANDBOX>`

⚠️ **Não versionar chaves no repositório.** Guardar em `.env` / secret manager:

* `PLUGNOTAS_BASE_URL=https://api.sandbox.plugnotas.com.br`
* `PLUGNOTAS_API_KEY=...`
* `PLUGNOTAS_CNPJ_PATH=/cnpj/{cnpj}` (consulta Receita Federal, cadastro facilitado)
* `PLUGNOTAS_NFSE_XML_PATH=/nfse/{id}/xml` (ajustável se doc indicar outro)
* `PLUGNOTAS_NFSE_PDF_PATH=/nfse/{id}/pdf` (ajustável se doc indicar outro)

## C. NFSe Nacional – Pré-requisitos (PlugNotas)

### 1) Verificar se a cidade está homologada no Ambiente Nacional

* Rota: `GET /Auxiliares/getCidadeById`
* Objetivo: confirmar se o município (IBGE) está homologado para NFSe Nacional

### 2) Habilitar a empresa para NFSe Nacional

* Rota: `PUT /Empresa/updateCompany`
* Body (mínimo):

```json
{ "nfseNacional": true }
```

## D. Emissão NFSe Nacional (assíncrona)

### Endpoint

* `POST https://api.sandbox.plugnotas.com.br/nfse`

### Headers

* `Content-Type: application/json`
* `Accept: application/json`
* `x-api-key: <SUA_API_KEY_SANDBOX>`

### Observações do PlugNotas (requisitos operacionais)

* A aplicação deve gerar um **`idIntegracao` único por nota** (idempotência).
* O processamento depende da disponibilidade do webservice municipal.
* Se o contribuinte nunca emitiu via webservice, pode precisar de homologação/liberação na prefeitura.
* Tamanho máximo de envio: **até 500 notas por lote** (quando o município suportar lote).

### Payload (exemplo mínimo – conforme doc colada)

```json
[
  {
    "idIntegracao": "XXXYY999",
    "emitente": {
      "tipo": 1,
      "codigoCidade": "4115200"
    },
    "prestador": {
      "cpfCnpj": "08187168000160"
    }
  }
]
```

> Nota: o payload completo depende do município e do serviço. O ZERA deve manter um **mapeador** do domínio interno para o JSON do PlugNotas NFSe Nacional.

## E. Consulta de status

Como a emissão é assíncrona:

* `GET /nfse/{idNotaOrProtocol}`

## F. Consulta de CNPJ (cadastro facilitado)

* `GET https://api.sandbox.plugnotas.com.br/cnpj/{cnpj}`
* Retorna dados cadastrais da Receita Federal (razao social, endereco, telefone, email, CNAE, etc.)
* Observação: resposta pode ser `200` com mensagem de rejeição quando a Receita retorna alerta

O ZERA deve:

* Persistir `idIntegracao` (interno) ↔ `idNota`/`protocol` (externo)
* Implementar polling com backoff
* Tratar estados finais (autorizada/rejeitada/cancelada)

## G. Webhooks (recomendado)

O PlugNotas permite webhook por organização ou empresa para notificar quando o processamento terminar.

Regras do ZERA:

* Validar origem do webhook (segredo/assinatura conforme configuração)
* Implementar idempotência de eventos
* Atualizar status interno apenas em eventos finais

## H. Implicações para o produto (ZERA)

* O ZERA pode continuar **simplificando a UI**, desde que o **XML autorizado** seja a verdade fiscal.
* “Mais campos no portal” não implica que o ZERA está errado; muitos campos são derivados/configurados no prestador.
* O ponto crítico é a **conformidade estrutural do XML final** gerado pelo provider, especialmente para municípios rígidos.

---

# ATUALIZAÇÃO (28/01/2026) – PlugNotas Sandbox (NFSe Nacional)

## 1. Emissão autorizada no sandbox

* Emissão na PlugNotas Sandbox concluiu com **AUTORIZADA**
* `retorno.situacao`: **AUTORIZADA**
* `numeroNfse`: `2600`
* `codigoVerificacao`: `5278FE6A7`
* `dataAutorizacao`: `2026-01-28T17:08:08.675Z`

## 2. Endpoints corretos de download (NFSe Nacional)

Os endpoints corretos de download na PlugNotas (NFSe Nacional) são:

* `GET /nfse/xml/{idNota}`
* `GET /nfse/pdf/{idNota}`

O backend inicialmente marcou **ERROR** ao usar endpoints antigos. Com os endpoints corretos e o `idNota`, o XML/PDF foram baixados com sucesso no sandbox.
