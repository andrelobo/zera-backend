# LOBONOTAS — 03. Contrato e Compatibilidade

> Contrato HTTP atual, consumidores reais do frontend, campos específicos do PlugNotas, proposta de resposta canônica e estratégia de depreciação.
> Data: **01/08/2026**.

---

## 1. Contrato HTTP atual (superfície pública preservada)

Rotas fiscais atuais (mapeadas em `src/modules/fiscal/fiscal.controller.ts`; todas protegidas por JWT + roles, exceto webhook):

| Rota | Método | Função | Linha |
|---|---|---|---|
| `/nfse/emitir` | POST | Emissão padrão (DANFSE) | fiscal.controller.ts:205 |
| `/nfse/quick` | POST | Emissão rápida (PDV) | :214 |
| `/nfse/:id/substituicao` | POST | Nota substituta | :227 |
| `/nfse/:id/cancelamento` | POST | Cancelamento | :265 |
| `/nfse/cancelamento/:cancellationProtocol` | GET | Consulta cancelamento | :322 |
| `/nfse` | GET | Listagem paginada (filtros provider/status/data/empresa) | :343 |
| `/nfse/bi/summary` | GET | BI | :465 |
| `/nfse/webhook/diagnostico` | GET | Diagnóstico webhook | :527 |
| `/nfse/servicos/*` | GET | Catálogo LC116 | :551-637 |
| `/nfse/:id/sync-artifacts` | POST | Sync manual XML/PDF | :639 |
| `/nfse/:id` | GET | Detalhe | :655 |
| `/nfse/:id/observability` | GET | Observabilidade | :700 |
| `/nfse/external/:externalId/...` | GET | Consulta por externalId | :750-775 |
| `/nfse/:id/provider-response` | GET | Payload bruto do provider | — |
| `/nfse/:id/artifacts` `xml` `pdf` | GET | Artifacts locais | :798-864 |
| `/nfse/:id/remote/xml` `remote/pdf` | GET | Artifacts do provider | :866-910 |
| `/webhooks/fiscal` | POST | Callback fiscal (público, com shared secret) | webhooks.controller.ts:6 |

Também relevante: `/empresas/*` (incl. `POST /empresas/:id/plugnotas/sync`, `POST /empresas/:id/plugnotas/sync` por CNPJ, certificado/import, certificado/diagnostico) e `/tomadores/*`.

**Regra D1/D2**: esta superfície é preservada. Mudanças internas de roteamento não alteram estes endpoints.

---

## 2. Consumidores reais no frontend

Mapeamento completo em `01-INVENTARIO-AS-IS.md` (4.3). Síntese dos consumidores que dependem de `provider-response` e de shape PlugNotas:

| Consumidor | Arquivo | Dependência |
|---|---|---|
| Detalhe NFS-e | `src/pages/NfseDetailPage.tsx:141-198` | `GET /nfse/:id`, artifacts, provider-response, sync-artifacts, downloads |
| Listagem NFS-e | `src/pages/NfseListPage.tsx:44,65,98` | listagem + provider-response por linha (prefetch) |
| Espelho Portal Nacional no prestador | `src/pages/EmpresaFormPage.tsx:1046-1122` | última emissão + provider-response → `inferNfseDataFromProvider` |
| Sincronização prestador | `src/pages/EmpresaFormPage.tsx:1228-1260` | `POST /empresas/:id/plugnotas/sync` (contrato `SyncEmpresaPlugNotasResponse`) |
| Emissão | `src/pages/NfseEmitPage.tsx` / `NfseQuickEmitPage.tsx` | `EmitirNfseResponse` (`result.idNota`, `protocol`, `status`) |
| Observabilidade | `src/pages/ObservabilidadeFiscalPage.tsx:99` | `/nfse/external/:externalId/observability` |
| BI/Dashboard | `useDashboardData.ts`, `DashboardPage.tsx`, `GestorAiPage.tsx`, etc. | listagem + filtro `PLUGNOTAS` |

**Regra para LOBONOTAS**: novos campos canônicos devem ser **aditivos**; os campos hoje consumidos (`idNota`, `protocol`, `status`, `numeroNfse`, `dpsNum`, `serieDpsNum`) devem continuar presentes enquanto o frontend não for migrado.

---

## 3. Campos específicos do PlugNotas (devem ser preservados como legado)

| Campo/estrutura | Onde é lido | Tratamento |
|---|---|---|
| `providerRequest.payload[0].tomador/prestador/servico[0].valor.servico` | `nfse-provider.ts:55-62` | Legado; manter para emissões PLUGNOTAS |
| `providerResponse[0].retorno.numeroNfse` | `nfse-provider.ts:101-115`, mapper | Legado |
| `providerResponse[0].dps.numero` / `dps.serie` | idem | Legado |
| `retorno.situacao` | `nfse.mapper.ts:19-31` | Legado |
| `idNota` / `protocol` / `protocolo` / `idIntegracao` | webhook, polling, controller, provider | Legado + candidatos canônicos |
| `providerResponse.cancelamento` | `fiscal.controller.ts:298-307` | Legado |
| `providerCertificadoId` | `empresas.service.ts:348-382,737-778` | Mantém-se (é id de certificado do provider) |
| toggles `plugNotasNfse.*` | `empresa.schema.ts:140-161`; `EmpresaFormPage.tsx:71-76` | Mantém-se como legado; LOBONOTAS não depende deles |

---

## 4. Proposta de contrato canônico (neutro de provider)

### 4.1 Camada de parser neutro ✅ IMPLEMENTADA (Slice 1)

Camada `fiscal/domain` que extrai **identificadores canônicos** de qualquer `providerResponse`, sem conhecer o provider:

```ts
// src/fiscal/domain/provider-document-parser.ts
export interface DocumentIdentifiers {
  numeroNfse?: string;
  dpsNum?: string;
  serieDpsNum?: string;
}

export interface ProviderDocumentParser {
  readonly providerName: string;
  extractStatus(response: any): string | undefined;
  mapStatusToDomain(status?: string): NfseEmissionStatus;
  extractDocumentIdentifiers(response: unknown): DocumentIdentifiers;
}
```

- **Implementação (entregue)**:
  - `GenericDocumentParser` (`fiscal/domain/generic-document-parser.ts`): parser neutro padrão (replica a lógica atual do PlugNotas, com `providerName = '*'`).
  - `ProviderDocumentParsers` (`fiscal/domain/provider-document-parsers.ts`): registry `providerName → parser` com fallback para o genérico quando o provider não está registrado.
  - `PlugNotasDocumentParser` (`fiscal/infra/plugnotas/plugnotas-document-parser.ts`): extrator legado (`providerName = 'PLUGNOTAS'`), registrado no `FiscalModule`.
  - `nfse.mapper.ts` virou **re-export de compat** (`mapPlugNotasStatusToDomain`, `extractPlugNotasStatus`, `extractPlugNotasDocumentIdentifiers`) — nomes preservados para `plugnotas.provider.ts` e specs.
- O **repositório não importa mais o mapper PlugNotas** (`nfse-emission.repository.ts`); `create`, `updateEmission` e `updateByExternalId` resolvem o parser via registry pelo `provider` do input.
- O webhook deixou de hardcodar `'PLUGNOTAS'` (`webhooks.service.ts`): provider derivado de `payload.provider` → header `x-zera-provider` → default `PLUGNOTAS`, e o parser correspondente é resolvido via registry.
- **Nota**: os demais campos da proposta (`externalId`, `idNota`, `protocolo`, `codigoVerificacao`, `dataAutorizacao`, `status`) permanecem como evolução futura no contrato canônico (não alteram compatibilidade).

### 4.2 Resposta canônica de emissão/consulta

Proposta (aditiva; campos legados continuam):

```jsonc
{
  "emissionId": "…",
  "result": {
    "provider": "LOBONOTAS",            // novo: obrigatório em novas emissões (D8)
    "externalId": "…",
    "status": "PENDING",
    "canonico": {                        // NOVO
      "dpsId": "…", "dpsNumero": "…", "dpsSerie": "…",
      "numeroNfse": "…", "protocolo": "…", "idNota": "…",
      "codigoVerificacao": "…", "dataAutorizacao": "…"
    },
    "providerRequest": { … },            // mantido (auditoria)
    "providerResponse": { … }            // mantido (auditoria)
  },
  "idempotentReplay": false
}
```

### 4.3 Identificadores canônicos a padronizar

> Resolvido na pesquisa oficial (doc `06-SPEC-AMBIENTE-NACIONAL.md`, Slice 2). Fonte: XSD 1.01 do Sistema Nacional NFS-e + Manual do Emissor Público Nacional (v1.0) + Anexo II de Eventos (gov.br, consulta 01/08/2026).

| Conceito | Nome canônico | PlugNotas hoje | LOBONOTAS (SEFIN) |
|---|---|---|---|
| Chave de correlação do ZERA | `idempotencyKey` / `referenciaExterna` | `idIntegracao` | `Id` da DPS = `TSIdDPS` (`DPS`+42 dígitos) — chave única do documento; envio síncrono via `POST /nfse` |
| Id do provider | `externalId` | `idNota / protocol / id` | **Chave de acesso da NFS-e** = `TSIdNFSe` (`NFS`+50 dígitos); recuperável por `GET /dps/{id}` |
| Protocolo | `protocolo` | `protocol / protocolo` | **Não existe no padrão Nacional.** Retorno da emissão = XML da NFS-e com `cStat`/`dhProc`/`nDFSe`. Campo mantido como **legado** (N/A para LOBONOTAS) |
| Nº NFS-e | `numeroNfse` | `retorno.numeroNfse` | `nNFSe` (número sequencial por emitente) |
| Nº DPS | `dpsNumero` | `dps.numero` | `nDPS` (`TSNumDPS`, máx. 15) |
| Série DPS | `dpsSerie` | `dps.serie` | `serie` (`TSSerieDPS`, máx. 5) |
| Código verificação | `codigoVerificacao` | (no retorno) | **Não existe campo próprio na NFS-e Nacional** (apenas `cVerifNFSeMun` em dedução de outras NFS-e municipais). Chave `TSIdNFSe` embute Cód.Num(9)+DV(1) |
| Status | `status` | mapa PlugNotas→domínio | `cStat` + `dhProc` na NFS-e; situação alterada por **eventos** (cancelamento/manifestações) |

> Decisão de mapeamento: `numeroNfse`→`nNFSe`, `dpsNumero`→`nDPS`, `dpsSerie`→`serie`, `externalId`→chave `TSIdNFSe` (nomenclatura oficial confirmada em doc 06). `protocolo` e `codigoVerificacao` ficam **N/A para emissões LOBONOTAS**, preservando os nomes neutros legados (`externalId`, `numeroNfse`, `dpsNum`, `serieDpsNum`, `status`) que o frontend já lê.

### 4.4 Contrato de erros normalizados

Já existe global: `{ code, message, correlationId, details? }` (`src/common/http/api-exception.filter.ts:75-82`; header `x-correlation-id`).

Proposta aditiva:
- adicionar `provider` no corpo de erro quando o erro vier de um provider fiscal (ex.: `provider: 'LOBONOTAS'`);
- novos códigos da frente LOBONOTAS seguem o padrão `LOBONOTAS_*` (ex.: `LOBONOTAS_NOT_CONFIGURED`, `LOBONOTAS_XSD_INVALID`, `LOBONOTAS_SIGNATURE_ERROR`, `LOBONOTAS_MTLS_ERROR`, `LOBONOTAS_TIMEOUT_POS_TRANSMISSION`);
- **erro não deve vazar certificado, senha ou XML** (D10) — manter o padrão de redação que já existe.

---

## 5. Estratégia de depreciação de `providerRequest` / `providerResponse`

1. **Fase 1 (contrato canônico aditivo)**: continuar persistindo e expondo; adicionar `canonico` e `provider`. Nada é removido.
2. **Fase 2 (frontend migrado)**: o frontend passa a consumir `canonico`/`status`/`provider` em vez de `inferNfseDataFromProvider`; `provider-response` deixa de ser usado por telas novas.
3. **Fase 3 (congelamento)**: depreciação sinalizada em Swagger/OpenAPI (`deprecated: true`) em `provider-response` para emissões novas.
4. **Fase 4 (remoção futura, somente com ADR)**: quando não houver mais consumidor ativo e após auditoria de dados históricos. **Nunca** apagar os payloads históricos do banco (D7) — apenas deixar de expor.

Regra de compatibilidade: emissões `provider: PLUGNOTAS` continuam exibindo seus `providerResponse` legados; emissões `provider: LOBONOTAS` preenchem `canonico` e também um `providerResponse` (estrutura LOBONOTAS) para auditoria.

---

## 6. Critérios de aceite do contrato canônico

- [ ] Repositório `NfseEmission` não importa mais módulos `plugnotas/*` (exceção: extrator legado isolado em `fiscal/infra/plugnotas/`).
- [ ] Webhook atualiza emissão LOBONOTAS com `provider` dinâmico e `lastUpdateSource` correto.
- [ ] Frontend existente continua funcionando sem alteração (regressão zero) com campos legados presentes.
- [ ] Novas emissões gravam `provider` explícito (`LOBONOTAS`).
- [ ] `idempotencyKey` continua único por provider.
