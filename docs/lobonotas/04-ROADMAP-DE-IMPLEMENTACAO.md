# LOBONOTAS — 04. Roadmap de Implementação

> Sequência de slices para substituir o PlugNotas pelo LOBONOTAS (NFS-e Padrão Nacional) mantendo a API e as capacidades existentes.
> Cada slice: objetivo, arquivos-alvo, testes, aceite, riscos, dependências, observações e rollback.
> Status geral (03/08/2026): **Slice 0 IMPLEMENTADO; Slice 1 IMPLEMENTADO; Slice 2 EM ANDAMENTO** (pesquisa oficial coletada em doc 06; **pendências da doc 06 §5 resolvíveis sem credencial fechadas em 03/08/2026** — DANFSE NT 008 v1.02, Decreto 6.743 integral, prazos de cancelamento de Manaus; restam as `[PENDENTE]` que exigem credencial piloto; falta review do owner); **Slice 3 IMPLEMENTADO** (DPS builder+signer, XSD oficial); **Slice 4 PARCIALMENTE IMPLEMENTADO** (cliente mTLS/provider prontos; envelope real e tabela `cStat` dependem de credencial piloto); **Slice 5 IMPLEMENTADO** (resolver + allowlist piloto + kill switch + fail-closed; roteamento por CNPJ ligado em emissão/polling/sync-artifacts; certificado A1 cifrado em repouso; harness webhook e stub mTLS concluídos); **Slice 6 BLOQUEADO** (operação real depende de credencial piloto); **Slice 7 PARCIALMENTE IMPLEMENTADO** (cancelamento/eventos `e101101`, consulta e estado `CANCELED`; `baixarXmlNfse` funcional; **DANFSe v2.0 implementado conforme NT 008 v1.02**, com PDF A4 em uma página, QR Code e marcas d'agua; restam validação real de eventos/cStat e substituição); **Slice 8 IMPLEMENTADO** (frontend canônico e municípios centralizados no backend); **Slice 9 PROPOSTO**.

---

## 0. Princípios transversais

- **D1–D13 (ver `00-HANDOVER-E-CONTEXTO.md` §2)**: preservar rotas e capacidades; domínio neutro; PlugNotas inativo/sem fallback; timeout⇒reconciliação; certificado A1; sem Postgres/Redis/microserviço; conclusões da API Nacional com citação oficial.
- Todo slice tem rollback; nenhum remove código PlugNotas nesta fase.
- Piloto inicia em **Manaus** (AM) — decisão do owner.

---

## Slice 0 — Congelar o contrato atual (fundação)

- **Objetivo**: baseline reprodutível antes de qualquer mudança.
- **Ações**:
  1. Registrar commit atual (`zera-backend` @ `be18106`, frontend @ `66ae09f`).
  2. Rodar suite de testes existente e guardar resultado (referência).
  3. Definir contrato de contrato canônico (doc 03) como fonte de verdade.
- **Arquivos**: nenhum (docs já criadas).
- **Testes**: suíte atual verde.
- **Aceite**: baseline documentado e testado.
- **Riscos**: baixo.
- **Rollback**: N/A.

---

## Slice 1 — Isolar o legado PlugNotas (sem mudar comportamento) ✅ IMPLEMENTADO

- **Objetivo**: remover acoplamento do repositório ao mapper PlugNotas sem alterar output.
- **Ações**:
  1. ✅ Introduzido `ProviderDocumentParsers` (map `providerName → parser`) em `fiscal/domain`.
  2. ✅ Implementado `GenericDocumentParser` (canônico) e `PlugNotasDocumentParser` (legado); `nfse.mapper.ts` virou re-export de compat (nomes/assinaturas preservados).
  3. ✅ `NfseEmissionRepository` passou a chamar o parser canônico via registry (`create`, `updateEmission`, `updateByExternalId`) — sem import do mapper.
  4. ✅ Webhook roteia por provider dinâmico (`webhooks.service.ts`): fonte `payload.provider` → header `x-zera-provider` → default `PLUGNOTAS`; parser resolvido via registry.
  5. ✅ Provider explícito nas novas emissões confirmado (D8): `EmitirNfseService` já grava `provider: this.provider.providerName`.
  6. ✅ DI unificado: `FiscalModule` passa a exportar `NfseEmissionRepository` e `ProviderDocumentParsers`; duplicação removida do `WebhooksModule`.
- **Arquivos criados**: `fiscal/domain/provider-document-parser.ts`, `fiscal/domain/provider-document-parsers.ts`, `fiscal/domain/generic-document-parser.ts` (+spec), `fiscal/infra/plugnotas/plugnotas-document-parser.ts` (+spec).
- **Arquivos-alvo alterados**: `fiscal/infra/plugnotas/nfse.mapper.ts` (compat), `fiscal/infra/mongo/repositories/nfse-emission.repository.ts`, `modules/webhooks/webhooks.service.ts`, `modules/webhooks/handlers/webhook.handler.ts`, `modules/webhooks/webhooks.module.ts`, `modules/fiscal/fiscal.module.ts` (+specs atualizados).
- **Testes**: 24 suites / 154 testes verdes; `npm run build` ok; lint sem erros (apenas warnings preexistentes).
- **Aceite**: emissão/consulta/webhook PlugNotas comportam-se exatamente como antes (compat via re-export e fallback genérico).
- **Riscos**: médio (área sensível) — mitigado por testes de regressão e compat preservada.
- **Dependências**: Slice 0.
- **Rollback**: reverter commit (comportamento preservado, fácil).

---

## Slice 2 — Pesquisa oficial da NFS-e Nacional / SEFIN

- **Objetivo**: fixar o contrato LOBONOTAS com base em documentação oficial (D13).
- **Ações** (somente documentação):
  1. Levantar docs oficiais do Ambiente Nacional (SEFIN / ABRASF / CNM) e da Prefeitura de Manaus: especificação DPS, XSD, endpoints Produção Restrita, autenticação (mTLS/certificado), geração e assinatura da DPS.
  2. Documentar em `docs/lobonotas/` cada conclusão com **link/ref oficial**; sem ref → marcar `[PENDENTE]`.
  3. Validar campos canônicos da doc 03 §4.3 contra as specs (preencher os `[PENDENTE]`).
- **Arquivos**: `docs/lobonotas/06-SPEC-AMBIENTE-NACIONAL.md` (criado).
- **Andamento (01/08/2026; atualizado 03/08/2026)**:
  - ✅ XSD oficiais 1.00/1.01 baixados e analisados (DPS, NFS-e, evento, pedRegEvento); nomenclatura canônica confirmada (`nDPS`, `serie`, `TSIdDPS`, `TSIdNFSe`).
  - ✅ Manuais oficiais: Emissor Público Nacional (v1.0, 17/03/2025) e ADN (v1.0, 12/02/2026) — endpoints mapeados.
  - ✅ Anexo II de Eventos: 17 tipos de evento catalogados (código 6 dígitos + tag XML `e######`).
  - ✅ Manaus: Conveniado Ativo, aderente ao Ambiente/Emissor Nacional desde 01/12/2025; obrigatoriedade por Decreto 6.743 (1º/01/2026, base art. 62 LC 214/2025).
  - ✅ `protocolo` e `codigoVerificacao` **não existem** no padrão Nacional (retorno é o XML com `cStat`/`dhProc`/`nDFSe`) — canônicos atualizados na doc 03 §4.3.
  - ✅ mTLS confirmado empiricamente: docs Produção Restrita → 403/496 sem certificado de cliente.
  - ✅ **03/08/2026 — pendências da doc 06 §5 fechadas sem credencial**: DANFSE oficial especificado (**NT 008 v1.02**, layout DANFSe v2.0, §2.5 da doc 06) — **API oficial de geração suspensa em 03/08/2026 → geração própria obrigatória**; leitura direta do Decreto 6.743 realizada (texto integral, R11); prazos de cancelamento/substituição de Manaus resolvidos (art. 8º: cancelamento 90 dias, substituição 9 dias). Restam apenas as `[PENDENTE]` que exigem credencial piloto (URL definitiva de produção, detalhes de handshake mTLS, envelope/cStat reais).
- **Testes**: revisão do owner; checklist de rastreabilidade conclusão↔ref.
- **Aceite**: mapa de endpoints, XSD e assinatura com citação; lista explícita de pendências.
- **Riscos**: docs mudam (Sefin Nacional recente) — controlar por data de consulta e arquivar specs.
- **Rollback**: N/A (documentação).

---

## Slice 3 — Geração e assinatura da DPS

- **Objetivo**: montar DPS válida a partir do domínio neutro e assinar (certificado A1).
- **Ações**:
  1. Modelo DPS (XML) conforme spec oficial (Slice 2).
  2. Assinatura XML (c14n + RSA-SHA256, `xmldsig` com XAdES/standard da Sefin) — usar lib já presente ou aprovar nova dependência (D11).
  3. Ler certificado A1 de `empresa.schema.ts` (`pfxBase64`/`passwordEncrypted`) — ver nota de segurança abaixo.
- **Nota de segurança (D10)**: hoje `pfxBase64` é armazenado sem criptografia adicional (select:false); recomenda-se avaliar cifrar a base64 do .pfx com a mesma rotina AES-256-GCM já usada para a senha (fallback `JWT_SECRET`). **Item aberto para o owner** (pode virar sub-slice).
- **Arquivos-alvo**: `fiscal/domain` (modelo DPS), `fiscal/infra/lobonotas/` (dps builder, signer), empresas (se houver refactor de certificado).
- **Testes**: vetor de assinatura (hash conhecido), validação XSD local, round-trip.
- **Aceite**: DPS gera e assina sem erro; valida XSD; assinatura confere.
- **Andamento (01/08/2026)**:
  - ✅ Dependência aprovada/instalada: `xml-crypto@6.1.2` + `@types/xml-crypto` (D11 resolvida na prática; lib pura JS, sem bindings nativos).
  - ✅ `src/fiscal/infra/sefin/dps-builder.ts` (DPS 1.01): monta `infDPS/@Id` (TSIdDPS, 45 chars), ordem canônica do `TCInfDPS`, `regTrib`/Simples, `serv`/`locPrest`+`cServ`, `valores`/`trib` (tribMun+tribFed?+totTrib), substituição (`subst/chSubstda`+`cMotivo` default `99`), omissão de `pAliq` p/ Simples sem retenção (E0625), `dhEmi` UTC, `dCompet` derivado.
  - ✅ `src/fiscal/infra/sefin/dps-signer.ts`: extrai chave privada + certificado do PFX (node-forge, mesmo padrão de `empresas.service.ts`) e assina enveloped com c14n inclusivo + RSA-SHA256 (`ds:Signature` anexada ao `DPS`, `KeyInfo/X509Data`).
  - ✅ DPS assinada **validada contra `DPS_v1.01.xsd` oficial** (lxml; ver nota de âncoras `^`/`$` abaixo) — gerada/signada em `dps-builder.spec.ts`/`dps-signer.spec.ts` (15 testes).
  - ✅ Fix estrutural descoberto pela validação XSD: `locPrest` pertence a `<serv>` (TCServ), não direto no `infDPS`.
  - ⏳ Pendente: mapeamento da DPS no `SefinNfseProvider` (Slice 4) e leitura do certificado da empresa (persistência real do `pfxBase64`/senha).
- **Nota de validação XSD local**: libxml2/lxml **não suporta âncoras `^`/`$`** nos `<xs:pattern>` (trata como literais); os padrões oficiais SEFAZ usam `^...$`. Para validar localmente, remover `^`/`$` dos patterns (XSD já é implicitamente ancorado) — script em `/tmp/opencode/validate-xsd.py` (fora do repo; não versionado).
- **Riscos**: médio-alto (cripto); mitigado por vetores e validação XSD.
- **Dependências**: Slice 2.
- **Rollback**: desabilitar LOBONOTAS (kill switch); PlugNotasProvider intocado.

---

## Slice 4 — Cliente HTTP do Ambiente Nacional (mTLS/A1)

- **Objetivo**: transmitir DPS para Produção Restrita/homologação e consultar status/protocolo/eventos.
- **Status**: ⏳ **parcialmente implementado** (envelope real e tabela `cStat` dependem da credencial piloto → `[PENDENTE]`).
- **Ações**:
  1. ✅ Cliente baseado em `node:https` com **mTLS** usando o certificado A1 do prestador — `fiscal/infra/sefin/sefin-mtls.http.ts`.
  2. ✅ Config centralizada — `fiscal/infra/sefin/sefin.config.ts` (base URLs Produção Restrita/ADN, `tpAmb` inferido, timeouts/retry, `SEFIN_NFSE_ENVELOPE=xml|json`).
  3. ✅ Mapeador de resposta tolerante a namespace e a XML embutido em JSON — `fiscal/infra/sefin/sefin-mapper.ts` + `sefin-xml.ts`.
  4. ✅ `SefinNfseProvider` implementando `FiscalProvider` (`emitirNfse`, `consultarNfse`, `baixarXmlNfse`, `baixarPdfNfse` stub) — `fiscal/infra/sefin/sefin.provider.ts`.
  5. ✅ Contador atômico de DPS na `Empresa` (`dpsContador`/`dpsSerieContador`) via `findOneAndUpdate` com rollover de série — `EmpresasService.reservarNumeracaoDps`.
  6. ✅ Wiring atrás de flag `SEFIN_ENABLED=false` (default) com PlugNotas como provider ativo — `fiscal.module.ts`.
  7. ✅ Endpoints de evento/cancelamento implementados no Slice 7 — `evento-builder.ts` (TCEvento/e101101 assinado), `SefinMtlsHttp.registrarEvento`/`consultarEventos`, `solicitarCancelamentoNfse`/`consultarSolicitacaoCancelamentoNfse` no provider, roteiro de eventos no stub (mTLS real). Validação do leiaute real do `pedRegEvento_v1.01.xsd`/`evento_v1.01.xsd` fica `[PENDENTE]` (credencial piloto).
  8. ⏳ Envelope real do `POST /nfse` e tabela `cStat` → `[PENDENTE]` até acesso com credencial piloto.
- **Arquivos-alvo**: `fiscal/infra/sefin/*` (implementado) — nomenclatura `sefin` no lugar de `lobonotas`.
- **Testes**: ✅ unit verdes (config, mapper, cliente mTLS, provider, contador); fixtures de resposta oficial aguardam credencial piloto.
- **Aceite**: envio/consulta funcionam contra Produção Restrita com certificado do piloto (ainda não exercitado).
- **Riscos**: endpoints de homologação instáveis; documentação incompleta → `[PENDENTE]`.
- **Dependências**: Slices 2 e 3.
- **Rollback**: kill switch.

---

## Slice 5 — `LobonotasProvider` + resolver (ADR-001) — IMPLEMENTADO (03/08/2026)

- **Objetivo**: registrar o novo provider e implementar o `FiscalProviderResolver`.
- **Ações**:
  1. `LobonotasProvider` implementando `FiscalProvider` (porta atual).
  2. `FiscalProviderResolver` com `FISCAL_PROVIDER_ACTIVE` + allowlist piloto + kill switch (doc 02 §3).
  3. Feature flags no app config (`LOBONOTAS_PILOT_ENABLED`, `LOBONOTAS_CNPJS_MANAUS`).
  4. Polling/status/artifacts/webhook LOBONOTAS ligados ao resolver.
- **Arquivos-alvo**: `fiscal/infra/lobonotas/lobonotas.provider.ts`, `fiscal/infra/lobonotas/fiscal-provider.resolver.ts`, `fiscal.module.ts`, `app.config.ts`.
- **Testes**: unit (resolver), integração (piloto Manaus), fail-closed.
- **Aceite**: `FISCAL_PROVIDER_ACTIVE=LOBONOTAS` com allowlist roteia só os CNPJs do piloto; fora dela não emite LOBONOTAS; kill switch funciona.
- **Riscos**: config errada roteia errado → mitigado por allowlist explícita + fail-closed.
- **Dependências**: Slices 1, 4.
- **Rollback**: `FISCAL_PROVIDER_ACTIVE=PLUGNOTAS`.

> **Nota de implementação (03/08/2026):** entregue conforme Opção B (ADR-001 §3).
> - `LobonotasProvider` = rename de `SefinNfseProvider` (arquivo `fiscal/infra/sefin/sefin.provider.ts`; `sefin/*` permanece como infra interna); `providerName = 'LOBONOTAS'`.
> - `FiscalProviderResolver` em `fiscal/application/fiscal-provider.resolver.ts`: registry por `providerName`, `resolve()` fail-closed (`FISCAL_PROVIDER_UNKNOWN`), `isActive`, `byProviderName`, `resolveProviderForCnpj` (piloto), `pollingProviderNames`.
> - Fábrica do `FiscalModule` passou a ser `useFactory: (resolver) => resolver.resolve()`; `SEFIN_ENABLED=true` segue aceito como forma legada de ativar LOBONOTAS.
> - Roteamento ligado em: `EmitirNfseService` (por CNPJ do prestador), `PollNfseStatusService` (polling por `emission.provider` via `pollingProviderNames`), `SyncNfseArtifactsService` (consulta por `doc.provider`).
> - **Pendência**: webhook LOBONOTAS fica para Slice 6 — o handler atual já resolve `providerName` dinamicamente via `extractWebhookProvider` (fallback `PLUGNOTAS`) e `ProviderDocumentParsers.resolve` cai no `GenericDocumentParser`; o contrato de webhook do Ambiente Nacional ainda é `[PENDENTE]` (doc 06 §5).
> - **Sub-slice de segurança (concluído 03/08/2026)**: `certificado.pfxBase64` passou a ser cifrado em repouso com AES-256-GCM (mesma rotina `encryptSecret`/`decryptSecret` da senha, formato `v1:`), em vez de texto puro; leitura retrocompatível via `decryptPfxBase64` (certificados legados sem cifragem continuam lendo); pontos de leitura decifram antes do uso (`obterMaterialCertificado` — material para assinatura DPS, `syncPlugNotasCadastroFromDoc` — upload PlugNotas com novo erro `PLUGNOTAS_CERTIFICADO_PFX_INVALID`, `inspectLegacyCertificateExpiration` — reparo de `expiresAt`). Validação: `npm test -- --runInBand` (225 testes / 32 suítes), `npm run build`, `npm run lint` (0 erros).
> - **Harness local do ciclo webhook LOBONOTAS + stub mTLS real (concluído 03/08/2026)**: `src/modules/webhooks/webhooks-lobonotas.integration.spec.ts` prova o loop `EmitirNfseService real → LobonotasProvider real (DPS assinada com cert A1 de teste node-forge) → emissão PENDING com dpsId → POST /webhooks/fiscal (header `x-zera-provider: LOBONOTAS`) → AUTHORIZED com chave NFS` usando modelo Mongo in-memory. Contrato do forwarder: **identificação de provider obrigatória** (header ou `provider` no payload); sem ela o webhook cai no fail-safe `PLUGNOTAS` e não atualiza a emissão LOBONOTAS (coberto por teste). Em paralelo, `src/fiscal/infra/sefin/sefin-stub.integration.spec.ts` + `src/fiscal/test-fixtures/sefin-stub-server.ts` provam o **mTLS real** contra um servidor HTTPS localhost que exige certificado de cliente assinado por CA de teste: handshake com CN validado, `emitirNfse` ponta a ponta via POST /nfse real, reconciliação D5 (`GET /dps/{dpsId}` → chave → `GET /nfse/{chave}`) e o teste negativo `SEFIN_VERIFY_CERT=true` → `SEFIN_CERT_VERIFY_FAILED`. Fixtures compartilhadas em `src/fiscal/test-fixtures/` (`test-cert.ts` com `createTestCert`/`toPem`/`createTestPki`, `in-memory-nfse-model.ts`, `sefin-stub-server.ts`). Validação: `npm test -- --runInBand` (234 testes / 34 suítes), `npm run build`, `npm run lint` (0 erros).
> - Validação geral do slice: `npm test -- --runInBand` (234 testes / 34 suítes), `npm run build`, `npm run lint` (0 erros).

---

## Slice 6 — Produção Restrita / piloto Manaus

- **Objetivo**: operar o piloto real com prestadores de Manaus em homologação/Produção Restrita.
- **Ações**:
  1. Cadastrar prestadores piloto com certificado A1.
  2. Emitir DPS → acompanhar até autorização (status, protocolo, nº NFS-e).
  3. **Reconciliação pós-timeout** (D5): fluxo consulta por chave DPS antes de retry.
  4. Validar contrato canônico (doc 03 §6) com dados reais.
- **Prestador piloto** (a confirmar com o owner): **Burgus LTDA** (CNPJ `43521115000134`) é a candidata natural — é o prestador de Manaus com certificado A1 real já operando no fluxo PlugNotas atual, e é a fixture usada nos specs LOBONOTAS (`dps-builder`/`dps-signer`/`sefin.provider`/`emitir-nfse.golden`). Confirmação formal pendente (ver §3).
- **Pré-requisito de segurança já atendido (Slice 5)**: o material do certificado A1 (`pfxBase64`) já é cifrado em repouso (AES-256-GCM, formato `v1:`) com leitura compatível com certificados legados — sem pendência de código para essa parte.
- **Harness local já validado (Slice 5)**: o ciclo `emissão → PENDING (dpsId) → webhook forwarder → AUTHORIZED` está provado por teste de integração com cert A1 de teste (`webhooks-lobonotas.integration.spec.ts`); o **mTLS real** (handshake com certificado de cliente, emissão e reconciliação D5) está provado contra o stub SEFIN local (`sefin-stub.integration.spec.ts` + `sefin-stub-server.ts`). Para o ambiente real falta apenas a **credencial A1 do piloto** e o **contrato real do webhook do Ambiente Nacional** (doc 06 §5 `[PENDENTE]`).
- **Arquivos-alvo**: ajustes incrementais.
- **Testes**: E2E no ambiente oficial; checklist de aceite.
- **Aceite**: emissões autorizadas ponta-a-ponta; dashboard mostra NFS-e reais de Manaus.
- **Riscos**: alto (autoridade fiscal real); mitigado por Produção Restrita e sem fallback.
- **Dependências**: Slice 5.
- **Rollback**: kill switch → PlugNotas (não reenvia emissões já transmitidas — reconciliação manual).

---

## Slice 7 — cancelamento/eventos (sub-slice implementado em 03/08/2026)

> Escopo acordado com o owner: **cancelamento via evento `1 01 1 01` (e101101), consulta de eventos e estado `CANCELED`**, além do mapeamento dos endpoints legados (`POST :id/cancelamento`, `GET cancelamento/:protocol`). **DANFSE, baixarXml do Nacional e substituição ficam para depois** (DANFSE segue `[PENDENTE]`; substituição é nativa do padrão — ver §6 do doc 06).

- **O que foi implementado**:
  1. ✅ Assinatura XML generalizada — `dps-signer.ts` agora expõe `signXmlElement` (reuso da rotina enveloped/c14n inclusiva/SHA-256 usada na DPS) e `signDps` delega a ela.
  2. ✅ Builder do pedido de registro de evento — `fiscal/infra/sefin/evento-builder.ts`: `buildPedidoCancelamento`/`buildPedidoCancelamentoAssinado` geram o **`TCEvento`** (doc 06 §2.3): `infEvento` (`Id="e101101{chNFSe}"`, `verAplic`, `ambGer`=`tpAmb`, `nSeqEvento`, `dhProc` UTC, `nDFSe`) + `pedRegEvento`/`infPedReg` (`Id="pedRegEvento{chNFSe}"`, `tpAmb`, `verAplic`, `dhEvento`, `CNPJAutor`, `chNFSe`, `e101101` com `versao`+`xJust`) + `ds:Signature` enveloped sobre `infEvento`.
  3. ✅ Cliente de eventos — `SefinMtlsHttp.registrarEvento` (`POST /nfse/{chave}/eventos`, `application/xml`) e `consultarEventos` (`GET /nfse/{chave}/eventos[/{tipoEvento}[/{numSeq}]]`) sobre o mTLS existente.
  4. ✅ Provider — `LobonotasProvider.solicitarCancelamentoNfse` (resolve chave, monta/assina o evento com `CNPJAutor` e `nDFSe` da emissão, registra e devolve **`protocol = chave de acesso`** — não há "protocolo de cancelamento" no Nacional, o estado deriva dos eventos da chave, doc 06 §6 — com `aceito`/`nProt`/`cStat` na resposta) e `consultarSolicitacaoCancelamentoNfse` (consulta eventos da chave e mapeia `CANCELED` quando há `e101101`/`e105102`). Removido `SEFIN_EVENTO_NOT_IMPLEMENTED`.
  5. ✅ Mapeador — `sefin-mapper.ts`: detecção de cancelamento (`e101101`/`e105102`/`evCancelamento`) ⇒ `CANCELED`, `mapSefinEventoRegistroResponse` (cStat/nProt/dhRecbto/tipo) e `parseEventosConsulta`; `sefin-xml.ts` ganhou `extractAllTags`.
  6. ✅ Stub SEFIN com mTLS real — `sefin-stub-server.ts` agora expõe a API Eventos com cenários por chave (`NFS7..` cancelada, `NFS8..` inexistente → 404, `NFS9..` não cancelável → cStat 600) e `sefin-stub.integration.spec.ts` provou o fluxo ponta a ponta (assinatura presente, CN do cliente, protocolo, CANCELED).
- **Testes**: ✅ suíte completa verde — **256 testes / 35 suítes** (`npm test -- --runInBand`), `npm run build`, `npm run lint` (0 erros; warnings pré-existentes `no-unsafe-*` aceitáveis).
- **Pendências no sub-slice** (`[PENDENTE]`): leiaute real do `pedRegEvento_v1.01.xsd`/`evento_v1.01.xsd` e tabela real de `cStat` de eventos (validar com credencial piloto). **DANFSe/PDF** e **baixarXml do Nacional** foram implementados no passo seguinte.

---

## Slice 7 — XML/DANFSE, cancelamento e completude

- **Objetivo**: fechar ciclo completo da NFS-e LOBONOTAS.
- **Ações**:
  1. ✅ Baixar XML autorizado e gerar DANFSe v2.0 localmente conforme NT 008 v1.02 (API oficial suspensa em 03/08/2026).
  2. Cancelamento por evento (garantir idempotência e estado `CANCELED` ↔ frontend `CANCELLED`, doc 00 §6).
  3. Sincronização de artifacts (`/nfse/:id/sync-artifacts`) para LOBONOTAS.
   4. Substituição: **nativa no padrão Nacional** (evento `1 05 1 02`; disparada pelo `POST /nfse` com DPS contendo `subst/chSubstda` — doc 06 §1.2/§2.4).
- **Arquivos-alvo**: `lobonotas.provider.ts`, endpoints existentes (sem mudança de rota).
- **Testes**: ciclo completo em homologação; estado coerente.
- **Aceite parcial**: XML/DANFSE/cancelamento funcionais em testes locais; aceite real depende do piloto oficial.
- **Riscos**: especificações de DANFSE podem variar — manter atrás do contrato canônico.
- **Dependências**: Slices 2, 5, 6.
- **Rollback**: kill switch.

---

## Slice 8 — Frontend (migração do shape PlugNotas)

- **Objetivo**: remover dependência de `provider-response`/`inferNfseDataFromProvider`.
- **Ações**:
  1. Frontend passa a consumir `canonico`/`status`/`provider` (doc 03 §5, fases 2-3).
  2. Trocar filtro `provider === 'PLUGNOTAS'` (`services/api.ts:383`) por filtro neutro/`LOBONOTAS`.
  3. Revisar `normalizeEmpresa` (`services/api.ts:12-356`) e a tela do prestador (`EmpresaFormPage.tsx:1046-1122,1228-1260`).
  4. Remover chamadas diretas ao IBGE (`services/location.ts:16`, `PrestacaoServicoSection.tsx:210`) quando houver rota canônica.
  5. Migrar tipos `src/types/api.ts` para contrato canônico (sem gerar do Swagger nesta fase).
- **Arquivos-alvo**: `src/lib/api.ts`, `src/lib/nfse-provider.ts`, `src/services/api.ts`, `src/pages/*`, `src/types/api.ts`, `api/proxy.ts` (intocado, proxy continua → Oracle).
- **Testes**: regressão das telas; componentes de prova com fixtures LOBONOTAS.
- **Aceite**: nenhum componente lê shape PlugNotas; emissões LOBONOTAS renderizam corretamente.
- **Riscos**: médio (telas grandes); mitigado por slices de componentes.
- **Dependências**: Slice 6 (dados reais).
- **Rollback**: feature toggle no frontend (renderiza legado).

---

## Slice 9 — Rollout e rollback operacional

- **Objetivo**: promover LOBONOTAS para o padrão e documentar operação.
- **Ações**:
  1. `FISCAL_PROVIDER_ACTIVE=LOBONOTAS` global (após piloto ok).
  2. Atualizar `docs/OPERACAO-ORACLE-VPS.md` (doc 05) e runbooks.
  3. Definir métricas de rollback (taxa `ERROR`, rejeições, indisponibilidade) e dashboard.
- **Testes**: pós-deploy smoke; BI por provider.
- **Aceite**: emissões novas 100% LOBONOTAS; PlugNotas em modo legado somente consulta.
- **Riscos**: baixo (já validado no piloto).
- **Rollback**: kill switch + redeploy.

---

## 1. Ordem de execução e dependências

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
         └──────────────┘   └───────┘
```
- **Paralelizáveis**: 1 (com 0); 2 (com 1); pesquisa oficial (2) desbloqueia 3 e 4.
- **Gate de produção real**: Slice 6 concluído em Produção Restrita.

## 2. Critérios gerais de pronto (Definition of Done)

- [ ] Testes atualizados e verdes (unit + integração).
- [ ] Contrato canônico respeitado; sem regressão nas rotas públicas.
- [ ] Documentação oficial citada onde o comportamento LOBONOTAS é definido (D13).
- [ ] Kill switch operacional validado.
- [ ] Rollback testado em homologação.
- [ ] Sem dependências novas não aprovadas (D11).

## 3. Itens ainda pendentes de definição

- [ ] Estratégia de cifragem da base64 do .pfx (segurança do certificado).
- [ ] Confirmação formal do prestador piloto do Slice 6 (candidata natural: **Burgus**, CNPJ `43521115000134`).
- [ ] ~~Definição de "substituição" no padrão Nacional~~ → **resolvido**: substituição é nativa (evento `1 05 1 02`; disparada pelo `POST /nfse` quando a DPS traz `subst/chSubstda` — doc 06 §1.2/§2.4).
- [ ] ~~Formato oficial do DANFSE~~ → **resolvido (03/08/2026)**: **NT 008 v1.02** (DANFSe v2.0, Anexo I), doc 06 §2.5; API oficial de geração suspensa em 03/08/2026 → geração própria. Fica a **implementação** do gerador (Slice 7/XML-DANFSE).
- [ ] ~~Nomenclatura oficial SEFIN para os identificadores canônicos~~ → **resolvido** (doc 06 §4 e doc 03 §4.3): `nDPS`, `serie`, `nNFSe`, `TSIdNFSe`.
- [ ] Métricas-limiar de rollback.
