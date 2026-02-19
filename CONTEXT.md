# ZERA Backend – Project Context

> Leitura rápida operacional: veja `CURRENT_STATE.md` (snapshot atual).
> Este documento (`CONTEXT.md`) permanece como histórico completo e linha do tempo.

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

## 6. Next Steps (histórico)

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
* `PLUGNOTAS_NFSE_XML_PATH=/nfse/xml/{id}` (ajustável se doc indicar outro)
* `PLUGNOTAS_NFSE_PDF_PATH=/nfse/pdf/{id}` (ajustável se doc indicar outro)
* `NFSE_CMUN_IBGE=1302603` (IBGE do município emissor, obrigatório no payload atual)

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

Campos opcionais suportados pelo backend (quando exigidos pelo município):
* `tomador.inscricaoMunicipal`
* `servico.iss` (ex.: `tipoTributacao`, `exigibilidade`, `retido`, `aliquota`)
* `servico.tributacaoTotal` (federal/estadual/municipal)

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
---

# ADDENDUM 2 (PT-BR) – Emissões NFSe Nacional Manaus (fev/2026)

> **Resumo prático:** o backend foi ajustado e está enviando corretamente a **IM** no payload, mas as rejeições atuais são **E0312/E0314** por **códigos de tributação não administrados em produção** (Manaus). O bloqueio agora é **tabela municipal/competência**, não o payload.

## 1) Ajustes feitos no backend

* **IM enviada no payload do PlugNotas**: `emitente.inscricaoMunicipal` e `prestador.inscricaoMunicipal`.
* **Registro do payload enviado**: persistimos `providerRequest` no Mongo para inspecionar o JSON real enviado ao PlugNotas.
* **Campo opcional `codigoMunicipal`** no serviço (para testar sem cTribMun).
* **Suporte a `codigoTributacao`** no serviço (workaround sugerido em doc PlugNotas).

## 2) Evidências coletadas

### 2.1 Payload enviado (PlugNotas)

Confirmado no `providerRequest`:

```json
{
  "emitente": { "codigoCidade": "1302603", "inscricaoMunicipal": "51754301" },
  "prestador": { "cpfCnpj": "43521115000134", "inscricaoMunicipal": "51754301" },
  "tomador": { "...": "..." },
  "servico": [ { "codigo": "171901", "codigoTributacao": "001", "valor": { "servico": 1000 } } ]
}
```

### 2.2 Resultado (produção)

* **E0312**: `cTribNac` não administrado pelo município na competência.
* **E0314**: `cTribMun` não existe/ não administrado na competência.

Ou seja, **o payload está correto**; o bloqueio é **tabela de códigos válida em produção**.

## 3) XML autorizado via Portal Nacional (homologação)

XML autorizado pelo Portal Nacional (Manaus) mostrou:

* `cTribNac = 171901`
* `cTribMun = 100`
* competência: **2026-01-21**

Em produção, esses códigos retornam **E0312/E0314**.

## 4) Conclusão atual

Necessário obter **cTribNac/cTribMun válidos em produção** para Manaus (via contador/prefeitura/PlugNotas).  
Sem isso, emissão seguirá rejeitando com E0312/E0314.

## 5) Observação sobre ambientes (homologação x produção)

* No backend atual, os ambientes suportados são `sandbox` e `production`.
* O `sandbox` é o ambiente de **homologação** da PlugNotas (equivalentes no código).
* Se a PlugNotas tiver uma URL de homologação diferente do sandbox, será necessário ajustar `PLUGNOTAS_BASE_URL` e aceitar `PLUGNOTAS_ENV=homologacao` no código.

# STATUS ATUAL DO CÓDIGO (04 FEV 2026)

Este bloco reflete o **estado real do repositório** na data acima.

## 1) Implementado

* Provider ativo: **PlugNotas** via DI no módulo fiscal.
* Emissão confirmada no **sandbox da PlugNotas** (NFSe emitida e retornada via API).
* Emissão assíncrona com persistência, status PENDING e polling com backoff.
* Download de XML/PDF (via artifacts salvos e via provider).
* Consulta de CNPJ (cadastro facilitado) via PlugNotas.

## 2) Parcial / pendente

* **Webhooks**: endpoint processa status e salva `providerResponse`; validação de origem é opcional via token compartilhado (sem assinatura criptográfica).
* **Pré-requisitos NFSe Nacional** (cidade homologada e habilitar empresa) **não estão implementados**.
* **Idempotência**: `idIntegracao` usa `referenciaExterna`, mas não há constraint de unicidade no banco.

## 3) Código legado

* Implementações NuvemFiscal foram removidas do repositório.

---

# RELATÓRIO DE PRODUÇÃO (06/02/2026)

Para detalhes completos do cenário em produção, ver:

* `REPORT_PLUGNOTAS_PROD_2026-02-06.md`
* `endpoints-plug-notas.md`

---

# ATUALIZAÇÃO (09/02/2026) – Produção Manaus (PlugNotas)

## 1) Emissão concluída até o provider

* Emissão em produção passou a etapa de envio e retornou `PENDING` com `externalId`.
* A empresa foi confirmada pela API de produção da PlugNotas.

## 2) Rejeição atual

* Status final: **REJECTED**
* Código: **E0312**
* Mensagem: *código de tributação nacional não administrado pelo município na competência da DPS.*

## 3) Observação importante

* Os códigos que funcionam no **Portal Nacional (homologação)** não são aceitos automaticamente em **produção**.
* É necessário obter **cTribNac** (e possivelmente **cTribMun**) válidos para Manaus **na competência atual**.

## 4) Ajustes recentes no backend (09/02/2026)

* Payload mínimo está funcionando com:
  * `prestador` + IM
  * `tomador` com endereço completo
  * `servico.codigoNacional` (6 dígitos), `codigoMunicipal` e `valor`
* Campos opcionais aceitos pelo backend:
  * `tomador.inscricaoMunicipal`
  * `servico.iss`
  * `servico.tributacaoTotal`

# ATUALIZAÇÃO (09/02/2026) – Testes em produção (cobertura para backend)

## Objetivo

Registrar evidências de que o backend está enviando payloads válidos e que as rejeições
ocorrem por **códigos de tributação não administrados na competência** do município
de Manaus (ambiente nacional, produção).

## Evidências (resumo dos testes)

### Teste A

* `emissionId`: `698a59f224e4cd053339c21f`
* `externalId`: `0a294998-f3dc-4544-96f9-ffc7c6908983`
* Payload: `cTribNac=171901`, `cTribMun=100`
* Resultado: **REJECTED** – **E0312** (código nacional não administrado na competência)

### Teste B

* `emissionId`: `698a5edf24e4cd053339c24d`
* `externalId`: `0b36b977-bbed-459e-95c9-b1dde89ae274`
* Payload: `cTribNac=171901`, `codigoTributacao=001`
* Resultado: **REJECTED** – **E0314** (código municipal não administrado na competência)

### Teste C

* `emissionId`: `698a61c524e4cd053339c286`
* `externalId`: `301af169-2a2c-42af-bf01-2e2435f12717`
* Payload: `cTribNac=171901`, `codigoTributacao=001`, **sem** `cTribMun` no input
* Resultado: **REJECTED** – **E0314**

### Teste D

* `emissionId`: `698a6ac424e4cd053339c294`
* `externalId`: `ffd6e161-1db1-4b81-8dd3-570c4b3362d4`
* Payload: `cTribNac=171901`, `codigoTributacao=001`, tentativa com `cTribMun=1719`
* Resultado: **REJECTED** – **E0314**

## Conclusão técnica

* O backend envia corretamente os dados (prestador, tomador, serviço) e o provider aceita
  a requisição, retornando processamento e status final.
* As rejeições são consistentes e apontam para **tabela/competência municipal** no
  ambiente nacional (Manaus) e **não para erro de payload** no backend.

## Referências internas

* Relatório completo: `REPORT_PLUGNOTAS_PROD_2026-02-09.md`

---

# ATUALIZAÇÃO (10/02/2026) – Vitória em Produção (PlugNotas)

## Resultado confirmado

* Emissão **concluída/autorizada** no **painel da PlugNotas** em produção para Manaus.
* O payload incluiu:
  * `codigoNacional = 171901`
  * `codigoTributacao = 100`
  * `regimeApuracaoTributaria = 1` (campo exigido para optante do Simples)
  * `opSimpNac = 3`, `regApTribSN = 1`, `regEspTrib = 0`

## Observação técnica

* A API da PlugNotas chegou a responder **HTTP 400** com **`protocol`** e mensagem *“Nota(s) em processamento”*.
* Isso confirma que o envio foi aceito e o processamento seguiu no provider, embora o backend tenha marcado `ERROR`.

## Próximos passos práticos

1. Reemitir com o backend já reiniciado (com o fix do **HTTP 400 + protocol**) para o status ficar **PENDING** em vez de **ERROR**.
2. Aguardar o polling baixar XML/PDF.
3. Se necessário, baixar direto pelo provider:
   * `/nfse/{id}/remote/xml`
   * `/nfse/{id}/remote/pdf`

## Melhorias planejadas (backend)

1. Ajustar o backend para, ao receber `protocol` com `HTTP 400`, salvar como **PENDING**.
2. Adicionar um job rápido para sincronizar o status do `externalId` atual e puxar XML/PDF automaticamente.

## Payloads de referência (10/02/2026)

### 1) Payload de entrada (Swagger/backend)

```json
{
  "prestador": {
    "cnpj": "43521115000134",
    "inscricaoMunicipal": "51754301",
    "razaoSocial": "BURGUS LTDA",
    "regimeTributarioSn": {
      "opSimpNac": 3,
      "regApTribSN": 1,
      "regEspTrib": 0
    },
    "endereco": {
      "logradouro": "Saldanha Marinho",
      "numero": "606",
      "bairro": "Centro",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69010040"
    }
  },
  "tomador": {
    "cpfCnpj": "61020788100",
    "razaoSocial": "ANDRE AUGUSTO DE HOLANDA LOBO",
    "endereco": {
      "logradouro": "R FREI JOSE DE LEONISSA",
      "numero": "758",
      "bairro": "NOVA CIDADE",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69017020"
    }
  },
  "servico": {
    "codigoNacional": "171901",
    "codigoTributacao": "100",
    "descricao": "Consulta IR 2024...",
    "valor": 150
  },
  "referenciaExterna": "nfse-prod-150-20260210-06"
}
```

### 2) Payload efetivo enviado ao PlugNotas (`providerRequest.payload[0]`)

```json
{
  "idIntegracao": "nfse-prod-150-20260210-06",
  "regimeApuracaoTributaria": 1,
  "emitente": {
    "tipo": 1,
    "codigoCidade": "1302603",
    "inscricaoMunicipal": "51754301"
  },
  "prestador": {
    "cpfCnpj": "43521115000134",
    "inscricaoMunicipal": "51754301",
    "opSimpNac": 3,
    "regApTribSN": 1,
    "regEspTrib": 0
  },
  "tomador": {
    "cpfCnpj": "61020788100",
    "razaoSocial": "ANDRE AUGUSTO DE HOLANDA LOBO"
  },
  "servico": [
    {
      "codigo": "171901",
      "codigoTributacao": "100",
      "discriminacao": "Consulta IR 2024...",
      "valor": {
        "servico": 150
      }
    }
  ]
}
```

---

# ATUALIZAÇÃO (11/02/2026) – Produção Manaus (estabilização de fluxo)

## 1) Emissão de validação (R$ 175) em produção

* Emissão criada no backend com:
  * `emissionId`: `698c972c4cf35620b8333687`
  * `externalId` (protocol): `c8831c99-b021-4a60-8b6a-49a73435dc53`
  * `idIntegracao`: `nfse-prod-175-20260211-02`
* Retorno inicial: **PENDING** (com `idempotentReplay=false`).
* No painel PlugNotas: emissão **concluída**.

## 2) Correções aplicadas no backend

### 2.1 Tratamento de envio aceito com HTTP 400

* Quando a PlugNotas responde `HTTP 400` mas inclui `protocol/protocolo`, o backend agora trata como emissão aceita em processamento e mantém status **PENDING** (não **ERROR**).

### 2.2 Idempotência persistente

* Criado `idempotencyKey` com índice único parcial por provider:
  * `provider + idempotencyKey` (unique + partial filter).
* Fluxo de emissão reaproveita emissão existente por `referenciaExterna` e retorna `idempotentReplay=true` quando aplicável.

### 2.3 Polling de artifacts (XML/PDF)

* Ajustado o polling para baixar XML/PDF usando **`idNota`** retornado na consulta de status quando disponível.
* Isso evita erro de download quando `externalId` é `protocol` e não `idNota`.

### 2.4 Robustez de API

* `GET /nfse/:id` e endpoints que dependem de `findById` agora validam `ObjectId`; entradas inválidas não derrubam com `CastError`.

## 3) Observação operacional

* Para emissões que ficaram em **ERROR** antes do fix do polling, os endpoints locais `/nfse/:id/xml` e `/nfse/:id/pdf` podem retornar `hasXml/hasPdf=false` porque os artifacts não foram persistidos na época.
* Nesses casos, o fallback `/nfse/:id/remote/xml` e `/nfse/:id/remote/pdf` permite baixar direto do provider.

---

# ATUALIZAÇÃO (11/02/2026) – Sync manual de artifacts (arquitetura operacional)

## 1) Diretriz adotada

* **Polling permanece o fluxo principal** para emissões em `PENDING`.
* Foi adicionado um fluxo **manual/on-demand** para recuperação de artifacts, sem depender de alteração de status no banco.
* Estratégia definida: **não reabrir `ERROR -> PENDING` manualmente** como padrão operacional.

## 2) Novo endpoint

* `POST /nfse/{id}/sync-artifacts`
* Objetivo: sincronizar e persistir `XML/PDF` para uma emissão específica sob demanda.
* Comportamento idempotente:
  * Se artifacts já existem no banco, retorna `synced=false` com motivo `already_present`.
  * Se provider ainda não está `AUTHORIZED`, retorna `synced=false` com motivo `not_authorized`.
  * Se autorizado, baixa e persiste artifacts com `synced=true`.

## 3) Rate limit e audit log

* Rate limit por emissão no sync manual:
  * variável: `NFSE_SYNC_ARTIFACTS_MIN_INTERVAL_MS` (default `60000`).
  * chamadas dentro da janela retornam `429` com `retryAfterMs`.
* Audit log de sincronização por emissão:
  * `lastArtifactSyncAt`
  * `artifactSyncAudit[]` (janela dos últimos eventos)
  * outcomes típicos: `success`, `noop_already_present`, `blocked_rate_limited`, `skipped_not_authorized`, `failed`.

## 4) Resultado esperado de produto

* Fluxo normal continua simples e assíncrono (`emitir -> pending -> authorized -> artifacts` via polling).
* Time operacional ganha ferramenta de recuperação rápida quando necessário, sem intervenção manual no status da emissão.

---

# ATUALIZAÇÃO (11/02/2026) – Validação final de artifacts automáticos

## 1) Emissão de teste (R$ 80) concluída

* Emissão confirmada em produção com:
  * `emissionId`: `698cae8b6f39cad27baa64de`
  * `externalId` (protocol): `6a98c170-baab-4899-aa13-790e7127152e`
* Status final no backend:
  * `AUTHORIZED`
  * `error: null`

## 2) Download automático de artifacts validado

Logs do backend confirmaram download automático após autorização:
* `GET /nfse/xml/698cae8ca4f3374d2a5efd63` → `200`
* `GET /nfse/pdf/698cae8ca4f3374d2a5efd63` → `200`

Conclusão:
* O fluxo padrão (`polling` + persistência de artifacts) está funcional ponta a ponta em produção.

---

# ATUALIZAÇÃO (12/02/2026) – Emissões por categoria (Manaus)

## 1) Beleza / Estética – emissões concluídas

Foram emitidas e concluídas com sucesso, em produção (Manaus), 2 NFSe com valor de **R$ 125,00** cada:

* `060101` – Barbearia, cabeleireiros, manicuros, pedicuros e congêneres.
* `060201` – Esteticistas, tratamento de pele, depilação e congêneres.

Observação:
* Mantido o mesmo padrão de payload já validado no ambiente de produção (prestador/tomador e regime SN).

## 2) Saúde – testes de emissão (Manaus)

Foram preparados payloads (1 por serviço, valor de **R$ 125,00**) para Manaus, com o seguinte status:

* `041201` – Odontologia (serviços odontológicos): **emitido e concluído com sucesso**.
* `041601` – Psicologia (serviços de psicologia): payload preparado (pendente de emissão).
* `040101` – Medicina (serviços de medicina): payload preparado (pendente de emissão).

---

# ATUALIZAÇÃO (12/02/2026) – API front-ready + preparo de deploy

## 1) Endpoints e contrato para frontend

Melhorias implementadas para integração estável com frontend:

* **Contrato de erro padronizado** em nível global:
  * formato: `{ code, message, correlationId }`
  * `correlationId` também retornado no header `x-correlation-id`
* **Endpoint de sessão do usuário**:
  * `GET /auth/me`
* **Listagem paginada de emissões**:
  * `GET /nfse?page=&limit=&status=&provider=`
* **Artifacts por emissão**:
  * `GET /nfse/:id/artifacts` mantido e validado
* **Padronização de not-found no módulo fiscal**:
  * removidos retornos ad hoc `{ found: false }`
  * uso de exceções padronizadas com `code/message`

## 2) Segurança do módulo fiscal

* `FiscalController` passou a exigir autenticação/autorização:
  * `JwtAuthGuard`
  * `RolesGuard`
  * roles permitidas: `admin`, `manager`, `user`

## 3) OpenAPI e geração de tipos

Fluxo para contratos tipados do frontend:

* OpenAPI disponível em `/docs-json`
* Scripts adicionados:
  * `npm run openapi:export`
  * `npm run openapi:types`
  * `npm run openapi:sync`

## 4) Testes e validação

* Build validado com sucesso (`npm run build`)
* Testes unitários passando (`npm test -- --runInBand`)
* Teste unitário do filtro de erro adicionado para validar contrato padronizado
  (`code/message/correlationId`)

## 5) Deploy (Render)

* Adicionado `render.yaml` para deploy via Blueprint na Render.
* Configurado para **`plan: free`**, com:
  * build: `npm ci && npm run build`
  * start: `npm run start:prod`
  * healthcheck: `/health`
  * `NODE_VERSION=20`
* `README.md` atualizado com passo a passo de deploy e lista de secrets obrigatórios.

---

# ATUALIZAÇÃO (13/02/2026) – Incidente de runtime na Render (resolvido)

## 1) Sintoma observado

* Build concluía com sucesso, mas `/health` não respondia.
* Logs de runtime mostravam:
  * `Running 'yarn start'`
  * `No open ports detected`
  * `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
  * reinício em loop com status `134`.

## 2) Causa raiz

* O serviço em execução na Render estava iniciando com `yarn start` (`nest start`) em vez de `start:prod`.
* Esse modo provocou consumo de memória alto no plano free antes de o app abrir porta.

## 3) Correção aplicada

* Start command efetivo do serviço ajustado para `yarn start:prod` (equivalente a `node dist/main`).
* Confirmado runtime saudável com logs:
  * bootstrap do Nest concluído
  * conexão MongoDB estabelecida
  * rotas mapeadas (incluindo `/health`)
  * mensagem final: `Nest application successfully started`
  * serviço marcado como `live` na URL pública.

## 4) Observações operacionais

* O `render.yaml` já estava correto (`startCommand: npm run start:prod`); o ponto crítico foi garantir que o serviço ativo aplicasse essa configuração no painel/deploy corrente.
* Em caso de troubleshooting futuro, priorizar sempre logs de **runtime** (não apenas build logs).

---

# ATUALIZAÇÃO (16/02/2026) – Hardening de segurança e validação global

## 1) Segurança JWT (fail-fast)

Mudança aplicada para evitar boot inseguro:

* `JWT_SECRET` agora é **obrigatório** no bootstrap.
* Foram removidos fallbacks inseguros de secret (ex.: `change-me`/string vazia).
* Se `JWT_SECRET` não estiver definido, a aplicação falha ao iniciar (com erro explícito).

Impacto:
* reduz risco de ambientes subirem com assinatura de token fraca/inconsistente.

## 2) ValidationPipe global (modo compatível com produção)

Validação global habilitada em `main.ts` com:

* `whitelist: true`
* `forbidNonWhitelisted: false` (evita quebra por campos extras)
* `transform: true`
* `forbidUnknownValues: false`

Objetivo:
* aumentar robustez de entrada sem causar ruptura imediata nos clientes existentes.

## 3) DTOs com `class-validator`

Validações adicionadas nos DTOs principais:

* `auth` (`login`, `bootstrap`, `reset-password`)
* `users` (`create`, `update`)
* `empresas` (`create`, `update`, incluindo objeto `endereco`)
* `fiscal` (`emitir-nfse`, com validação aninhada de `prestador`, `tomador`, `servico`)

Dependências adicionadas:
* `class-validator`
* `class-transformer`

## 4) Validação técnica executada

No ambiente local (Node 20), após as mudanças:

* `yarn build` ✅
* `yarn test --runInBand` ✅ (`6 suites`, `13 testes`)
* `yarn start:dev` ✅ com conexão MongoDB estabelecida e rotas mapeadas
* validação funcional confirmada pelo frontend (sem necessidade de teste de emissão NFSe nesta etapa)

## 5) Estratégia de versionamento aplicada

As alterações foram separadas em dois commits:

1. commit de segurança/validação (JWT + ValidationPipe + DTO validation)
2. commit de limpeza/formatação (`lint --fix`) para reduzir risco de rollback e facilitar auditoria

---

# ATUALIZAÇÃO (16/02/2026) – Certificado digital + Emissão Rápida (`/nfse/quick`)

## 1) Importação de certificado digital (novo endpoint)

Foi implementado endpoint dedicado para importação do certificado da empresa:

* `POST /empresas/certificado/import`
* `Content-Type: multipart/form-data`
* Campos obrigatórios:
  * `cnpj`
  * `senhaCertificado`
  * `file` (`.pfx` ou `.p12`)

Validações aplicadas no backend:
* extensão permitida (`.pfx`/`.p12`)
* arquivo não vazio
* limite de tamanho via `EMPRESA_CERT_MAX_SIZE_BYTES` (default `5_000_000`)

Persistência:
* o certificado fica vinculado à empresa por CNPJ
* metadados salvos: `filename`, `mimeType`, `size`, `sha256`, `uploadedAt`
* conteúdo do certificado (`pfxBase64`) e senha são armazenados de forma protegida:
  * `pfxBase64` com `select: false`
  * senha criptografada com `AES-256-GCM`

## 2) Regra de negócio no cadastro de empresa

O fluxo `POST /empresas` (createFromCnpj) passou a exigir certificado prévio para empresa nova/incompleta:

* sem certificado importado: retorna `CERTIFICADO_REQUIRED`
* empresas já completas previamente cadastradas continuam retornando normalmente

Objetivo:
* garantir pré-condição operacional para emissão fiscal com certificado vinculado.

## 3) Emissão ultra-simplificada (novo endpoint)

Foi implementado endpoint de emissão rápida:

* `POST /nfse/quick`
* body mínimo:
  * `cpfTomador`
  * `valor`

Todo o restante é inferido pelo backend (payload interno completo):
* prestador/emitente (empresa selecionada)
* códigos padrão (`codigoNacional`, `codigoTributacao`)
* descrição padrão
* dados default de tomador/endereço quando necessário
* `referenciaExterna` gerada automaticamente

A emissão quick reutiliza o fluxo padrão (`EmitirNfseService`), preservando:
* idempotência/persistência
* polling e artifacts
* modelo de status existente

## 4) Seleção de empresa no quick flow

Prioridade de seleção do prestador:

1. `QUICK_NFSE_PRESTADOR_CNPJ` (quando configurado)
2. fallback para empresa mais recente com certificado importado

Erros de configuração/estado:
* `QUICK_PRESTADOR_NOT_FOUND`
* `QUICK_PRESTADOR_NO_CERT`
* `QUICK_CONFIG_INCOMPLETE`
* `QUICK_CPF_INVALID`

## 5) Variáveis de ambiente relevantes

Certificado:
* `EMPRESA_CERT_ENCRYPTION_KEY` (recomendado; fallback em `JWT_SECRET`)
* `EMPRESA_CERT_MAX_SIZE_BYTES`

Quick flow:
* `QUICK_NFSE_PRESTADOR_CNPJ`
* `QUICK_NFSE_CODIGO_NACIONAL`
* `QUICK_NFSE_CODIGO_TRIBUTACAO`
* `QUICK_NFSE_DESCRICAO_PADRAO`
* `QUICK_NFSE_ISS_ALIQUOTA`
* `QUICK_NFSE_TOMADOR_RAZAO_SOCIAL` (opcional)
* `QUICK_NFSE_TOMADOR_LOGRADOURO` (opcional)
* `QUICK_NFSE_TOMADOR_NUMERO` (opcional)
* `QUICK_NFSE_TOMADOR_COMPLEMENTO` (opcional)
* `QUICK_NFSE_TOMADOR_BAIRRO` (opcional)
* `QUICK_NFSE_TOMADOR_MUNICIPIO` (opcional)
* `QUICK_NFSE_TOMADOR_UF` (opcional)
* `QUICK_NFSE_TOMADOR_CEP` (opcional)

## 6) Observação operacional

Com essa atualização, o backend passa a suportar formalmente:
* onboarding por certificado digital antes do cadastro fiscal efetivo
* emissão expressa (`/nfse/quick`) para experiência de operação estilo PDV

---

# ATUALIZAÇÃO (16/02/2026) – Catálogo de serviços LC116 + autocomplete global + quick com `codigoServico`

## 1) Catálogo central de serviços (fonte única)

Foi integrado ao backend um catálogo central de serviços da LC116/NFS-e Nacional, usando o arquivo:

* `servicos_lc116_v2.json` (335 itens validados)

Estrutura utilizada por item:
* `codigo_nacional`
* `item_lc116`
* `sequencial`
* `descricao`

Configuração:
* `NFSE_SERVICOS_CATALOGO_PATH` (opcional; default `servicos_lc116_v2.json`)

Objetivo:
* reutilizar a mesma base para qualquer fluxo que precise de busca/autocomplete e inferência de descrição por código.

## 2) Novos endpoints de consulta de serviço

### 2.1 Autocomplete global

* `GET /nfse/servicos/autocomplete?q=&limit=`
* Busca por prefixo de código e por texto na descrição (normalizado, sem acento).
* Retorna itens no formato:
  * `codigoServico`
  * `itemLc116`
  * `descricao`

### 2.2 Detalhe por código

* `GET /nfse/servicos/{codigo}`
* Valida `codigo` com exatamente 6 dígitos.
* Retorna:
  * `codigoServico`
  * `itemLc116`
  * `sequencial`
  * `descricao`

Erros padronizados:
* `INVALID_CODIGO_SERVICO` (400)
* `SERVICO_NOT_FOUND` (404)

## 3) Emissão rápida com inferência por código de serviço

O endpoint `POST /nfse/quick` passou a aceitar também:

* `codigoServico` (opcional, 6 dígitos)

Comportamento:
* Quando `codigoServico` é informado e existe no catálogo:
  * `servico.codigoNacional` é inferido pelo catálogo
  * `servico.descricao` é inferida pela descrição oficial do catálogo
* Quando `codigoServico` não é informado:
  * mantém fallback atual via variáveis `QUICK_NFSE_*`

Erro específico:
* `QUICK_CODIGO_SERVICO_INVALIDO` (400), quando o código não é encontrado no catálogo.

Exemplo de payload quick atualizado:

```json
{
  "cpfTomador": "61020788100",
  "valor": 125,
  "codigoServico": "060101"
}
```

## 4) Validação técnica

Após as mudanças:
* `npm run build` ✅
* `npm test -- --runInBand` ✅ (`6 suites`, `13 testes`)

---

# ATUALIZAÇÃO (16/02/2026) – `/nfse/quick` com `cnpj` obrigatório no payload

## 1) Mudança de contrato (frontend -> backend)

O endpoint `POST /nfse/quick` foi ajustado para receber explicitamente o `cnpj` no body da requisição.

Payload mínimo atualizado:

```json
{
  "cnpj": "43521115000134",
  "cpfTomador": "61020788100",
  "valor": 125
}
```

`codigoServico` continua opcional (6 dígitos), mantendo a inferência via catálogo LC116 quando informado.

## 2) Regra de seleção de empresa no quick flow

A seleção de prestador no quick flow passa a ser orientada pelo `cnpj` informado pelo frontend:

1. validação de formato (`14` dígitos)
2. busca da empresa por CNPJ no banco
3. validação de certificado importado para a empresa encontrada

Erros de negócio aplicáveis:
* `QUICK_CNPJ_INVALID` (400)
* `QUICK_PRESTADOR_NOT_FOUND` (400)
* `QUICK_PRESTADOR_NO_CERT` (400)
* `QUICK_CPF_INVALID` (400)
* `QUICK_CODIGO_SERVICO_INVALIDO` (400)

## 3) Impacto em configuração

Com essa mudança, `QUICK_NFSE_PRESTADOR_CNPJ` deixa de ser o mecanismo principal de seleção de empresa no fluxo quick.
Os demais parâmetros `QUICK_NFSE_*` permanecem válidos como defaults para composição de serviço/tomador.

## 4) Validação técnica executada

Build validado após a alteração usando Node 20:
* `node -v` -> `v20.20.0`
* `yarn build` ✅

---

# ATUALIZAÇÃO (16/02/2026) – Quick com inferência de regime tributário SN (correção E0166)

## 1) Problema observado

Na emissão rápida (`POST /nfse/quick`), a API do provider retornava rejeição:

* `E0166`: obrigatório informar regime de apuração dos tributos do SN para optante do Simples.

## 2) Ajuste aplicado no quick flow

A inferência de `regimeTributarioSn` foi centralizada no backend (somente no fluxo quick), sem aumentar o payload mínimo do frontend.

Regras implementadas:
* se `empresa.providerData.simples` indicar **não optante**, o quick **não envia** `regimeTributarioSn`;
* se indicar optante ou estiver ausente/ambíguo, o quick envia defaults SN:
  * `opSimpNac = 3`
  * `regApTribSN = 1`
  * `regEspTrib = 0`

## 3) Configuração opcional (override)

Mantidos overrides por variável de ambiente para o quick:
* `QUICK_NFSE_OP_SIMP_NAC`
* `QUICK_NFSE_REG_AP_TRIB_SN`
* `QUICK_NFSE_REG_ESP_TRIB`

## 4) Validação técnica

* Teste unitário do `EmitirNfseQuickService` cobrindo:
  * envio de defaults SN;
  * não envio quando marcado como não optante.
* Build da aplicação validado com sucesso.

---

# ATUALIZAÇÃO (19/02/2026) – Pré-requisitos NFSe Nacional no backend (modo seguro)

## 1) Implementação

Foi implementada a camada de pré-requisitos PlugNotas antes da emissão, cobrindo:
* checagem de cidade homologada no Ambiente Nacional (rota configurável)
* habilitação da empresa para `nfseNacional` (rota configurável)

## 2) Estratégia para não quebrar produção

A funcionalidade entrou com feature flags:
* `PLUGNOTAS_PREREQ_MODE=off|warn|enforce` (default: `off`)
* `PLUGNOTAS_PREREQ_CHECK_CITY` (default: `true`)
* `PLUGNOTAS_PREREQ_ENABLE_COMPANY` (default: `false`)

Com `off`, o comportamento atual de produção permanece inalterado.
Com `warn`, os checks rodam sem bloquear emissão.
Com `enforce`, falha de pré-requisito bloqueia emissão.

## 3) Observação operacional

Foi adicionado cache em memória por TTL para reduzir chamadas repetidas aos endpoints de pré-requisito.

---

# ATUALIZAÇÃO (19/02/2026) – Cadastro de tomadores + autocomplete para emissão

## 1) Implementação

Foi implementado novo módulo de tomadores no backend com CRUD completo:

* `POST /tomadores`
* `GET /tomadores`
* `GET /tomadores/{id}`
* `PATCH /tomadores/{id}`
* `DELETE /tomadores/{id}`

## 2) Regra de vínculo por prestador (empresa)

Para evitar mistura entre prestadores, o tomador passou a ser vinculado por `empresaCnpj`.

Regra de unicidade:
* índice único em `empresaCnpj + cpfCnpj`

Resultado:
* o mesmo tomador (mesmo CPF/CNPJ) pode existir para empresas diferentes;
* dentro da mesma empresa, não permite duplicidade do tomador por documento.

## 3) Autocomplete para frontend (emissão)

Novo endpoint:
* `GET /tomadores/autocomplete?empresaCnpj=&q=&limit=`

Comportamento:
* `empresaCnpj` obrigatório;
* busca por `q` em **CPF/CNPJ** (normalizado para dígitos) e **nome/razão social**;
* `limit` com default `10` e teto `50`.

## 4) Segurança e compatibilidade

* Rotas protegidas com `JwtAuthGuard` + `RolesGuard` (`admin`, `manager`, `user`).
* Mudança **aditiva**, sem alterar contrato dos endpoints existentes de emissão (`/nfse/emitir` e `/nfse/quick`).
* Fluxo atual de produção permanece inalterado.

## 5) Validação técnica

Executado em Node 20:
* `yarn build` ✅
* `yarn test --runInBand src/modules/tomadores/tomadores.service.spec.ts` ✅ (`6 testes`)
* `yarn test --runInBand` ✅ (`9 suites`, `23 testes`)
