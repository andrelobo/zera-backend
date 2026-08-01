# LOBONOTAS — 02. ADR-001 — Transição do Provider Fiscal

> Status: **PROPOSTO** (aguardando aprovação do owner para implementação).
> Contexto: substituição do PlugNotas pelo LOBONOTAS (NFS-e Padrão Nacional) no motor fiscal do ZERA.
> Data: **01/08/2026**.

---

## 1. Contexto

- O backend injeta `{ provide: 'FiscalProvider', useClass: PlugNotasProvider }` (`src/modules/fiscal/fiscal.module.ts:51-54`).
- A interface `FiscalProvider` (`src/fiscal/domain/fiscal-provider.interface.ts:5-28`) já é razoavelmente neutra (métodos genéricos), mas **os tipos de retorno e os parsers internos carregam formato PlugNotas** (ver `01-INVENTARIO-AS-IS.md` seção 4).
- O PlugNotas está inativo comercialmente; deve virar **legado preservado**, nunca fallback automático.
- O LOBONOTAS precisa operar **Direto (DPS → Ambiente Nacional)**, começando por Manaus, mantendo a API pública intacta.

---

## 2. Opções avaliadas

### Opção A — Trocar diretamente o `useClass` para `LobonotasProvider`

- **Descrição**: trocar o provider no `fiscal.module.ts` de `PlugNotasProvider` para `LobonotasProvider`.
- **Prós**: mudança mínima; alavanca a interface existente.
- **Contras**:
  - sem convivência entre providers;
  - rollback = trocar de volta (risco de deploy cego);
  - o webhook continua hardcoded em `'PLUGNOTAS'` (`webhooks.service.ts:156`) — callbacks LOBONOTAS não casam;
  - `providerRequest`/`providerResponse` continuam interpretados por código PlugNotas-específico no repositório;
  - emissão histórica (`provider: PLUGNOTAS`) continua, mas sem capacidade de consulta cruzada.
- **Veredito**: aceitável só como **temporário e pontual**, não como arquitetura de transição.

### Opção B — `FiscalProviderResolver` (registry por provider) — **RECOMENDADA**

- **Descrição**: introduzir um resolver que decide o provider por regra (feature flag + CNPJ/município), mantendo os dois providers registrados:
  ```ts
  // fiscal.module.ts
  providers: [
    PlugNotasProvider,        // legado, inativo por padrão
    LobonotasProvider,        // novo
    FiscalProviderResolver,   // decide: providerName ativo + kill switch
    { provide: 'FiscalProvider', useFactory: (r) => r.resolve(), ... },
  ]
  ```
- **Prós**:
  - convivência controlada durante o piloto Manaus;
  - rollback por configuração (sem rebuild de lógica);
  - base para webhook/consulta/polling roteados por provider;
  - kill switch operacional.
- **Contras**: esforço maior; precisa de contrato canônico (doc 03) para não duplicar parsers.
- **Veredito**: escolha canônica.

### Opção C — Nova rota `/lobonotas/*` com módulo isolado, mantendo `/nfse/*` no PlugNotas

- **Prós**: isolamento máximo (D12).
- **Contras**: duplicaria o ciclo completo (emissão/polling/artifacts/webhook/BI), contrariando D1/D6 (preservar rotas e capacidades sem duplicar produto).
- **Veredito**: rejeitada nesta fase. O isolamento deve ser **lógico** (módulo/classes) atrás da mesma porta, não um segundo produto na mesma API.

---

## 3. Decisão

**Adotar a Opção B — `FiscalProviderResolver`**, com as seguintes regras:

1. `FiscalProviderResolver` expõe:
   - `providerNameAtivo`: lido de `FISCAL_PROVIDER_ACTIVE` (env). Valores possíveis: `LOBONOTAS` (default após aprovação do piloto) ou `PLUGNOTAS` (legado/rollback).
   - `isActive(name)`: permite coexistir leitura/consulta de emissões legadas.
   - `resolve(emission?)`: retorna o provider ativo para o contexto (por default, o global).
2. Ambos os providers são registrados; **apenas o ativo é exposto pelo token** via factory.
3. **Feature flag por piloto** (opcional, fase 2): `LOBONOTAS_CNPJS_MANUAUS` (allowlist de CNPJ) para rotear só prestadores de Manaus; fora da allowlist permanece PlugNotas **apenas durante a fase piloto**, com **flag explícita** (`LOBONOTAS_PILOT_ENABLED=true`). Sem a flag, não existe roteamento automático por CNPJ.
4. **Kill switch**: `FISCAL_PROVIDER_ACTIVE=PLUGNOTAS` ou ausência de config válida → volta ao comportamento atual. Alteração de kill switch é **deploy/operacional**, não reescrita de código.

### 3.1 Comportamento fail-closed

- Se `FISCAL_PROVIDER_ACTIVE=LOBONOTAS` mas o LOBONOTAS falhar (config ausente, mTLS, assinatura, XSD):
  - a emissão deve terminar em **`ERROR`** com código próprio (`LOBONOTAS_*`),
  - **jamais** reenviar a mesma emissão para a PlugNotas (D4/D5),
  - registrar em observabilidade `provider=LOBONOTAS`, `lastUpdateSource` coerente,
  - e exigir reconciliação manual/automatizada com a autoridade fiscal antes de qualquer retry (a DPS já pode ter sido aceita fora do ZERA).
- No caso específico de **timeout após transmissão de DPS** (D5): manter a emissão em `PENDING`/estado de reconciliação e **não** disparar novo envio em outro provider; o polling deve consultar o ambiente nacional (status/consulta por chave da DPS) e só então fechar.

### 3.2 Preservação das rotas públicas (D1/D2)

- Nenhuma rota HTTP muda nesta fase: `/nfse/*`, `/empresas/*`, `/tomadores/*` permanecem.
- A mudança de roteamento é **interna** (resolver). Eventual exposição de novo endpoint de diagnóstico (`GET /nfse/providers/status`) é **aditiva** e sujeita a aprovação.

### 3.3 Compatibilidade de registros históricos (D7)

- `provider` é campo por emissão; emissões antigas continuam com `provider: PLUGNOTAS`.
- Consulta/observabilidade/BI já filtram por `provider` (`GET /nfse?provider=`, `getBiSummary`). Nada é migrado em massa.
- O índice único de idempotência é por `{provider, idempotencyKey}` — **não colide** entre providers.

### 3.4 Rollback seguro

- Rollback = setar `FISCAL_PROVIDER_ACTIVE=PLUGNOTAS` e redeployar (ou reverter commit de config).
- Como o PlugNotasProvider permanece registrado e coberto por testes, o rollback não exige restauração de código.
- Critério de rollback gatilho (sugestão): taxa de emissão em `ERROR` > limiar, rejeições fiscais novas, ou indisponibilidade do Ambiente Nacional sem fallback.

---

## 4. Pré-requisitos antes de ativar `FISCAL_PROVIDER_ACTIVE=LOBONOTAS`

1. Contrato canônico (doc 03) implementado: parser neutro + isolamento do mapper PlugNotas fora do repositório.
2. Webhook roteado por provider (remover hardcode `'PLUGNOTAS'` de `webhooks.service.ts:156`).
3. Piloto em **Produção Restrita** (homologação do Ambiente Nacional) com DPS e assinatura validados contra documentação oficial (marcar `[PENDENTE]` onde não houver doc citada).
4. Kill switch testado (ligar/desligar em homologação).
5. Certificado A1 operacional para prestadores do piloto.

---

## 5. Consequências

### Positivas
- Transição sem janela de risco de troca a seco.
- Rollback operacional simples.
- Observabilidade por provider.

### Negativas / custos
- Custo de desenvolvimento do resolver + contrato canônico.
- Duas classes de provider convivendo no módulo durante o piloto (leve aumento de complexidade).

### Riscos residuais
- Config incorreta do kill switch pode rotear emissão para provider errado → mitigado por `fail-closed` e allowlist explícita.
- Doc oficial da API Nacional ausente em pontos → concluir como `[PENDENTE]` (D13).

---

## 6. Referências

- Interface: `src/fiscal/domain/fiscal-provider.interface.ts`
- Registro atual: `src/modules/fiscal/fiscal.module.ts:51-54`
- Webhook hardcoded: `src/modules/webhooks/webhooks.service.ts:156`
- Mapper acoplado: `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts:6`
- Regras de negócio: `README.md:22-31`; este ADR; `docs/lobonotas/00..01`.
