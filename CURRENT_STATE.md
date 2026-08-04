# ZERA Backend – Current State

Snapshot operacional do backend em **21/04/2026** (com atualizações rápidas abaixo).

## 0. RETOMAR DAQUI (04/08/2026) - piloto real LOBONOTAS pausado em E1226 (GZip + Base64 pendente)

Fonte: `logs reais da VPS` + `respostas reais da SEFIN Nacional` + `XML autorizado` + `codigo/testes/build/deploy` + documentacao oficial do Portal Nacional NFS-e.

### Regra imediata ao retomar

- **NAO clicar novamente em `Tentar emitir novamente`** ate concluir o codec GZip/Base64 e a leitura da resposta compactada.
- A NFS-e PlugNotas numero **47**, documento ZERA `6a71420f451c04dbcc7a438c`, foi autorizada e o owner decidiu **mante-la**.
- A tentativa original LOBONOTAS que serve de origem continua sendo `6a70eb85caa874f842b4a576` (R$ 1,00, BURGUS -> LEVACAR, servico `171901`).
- Nenhuma das tentativas diretas LOBONOTAS abaixo gerou NFS-e autorizada.

### Linha do tempo real

1. A primeira reemissao caiu indevidamente no provider padrao `PLUGNOTAS` e gerou a NFS-e 47. Causa: `reemitir` reutilizava o payload, mas o service recalculava o provider pelo ambiente.
2. Fix `c06749f`: reemissao passou a preservar obrigatoriamente `doc.provider`; sem provider original, falha fechada. A idempotencia tambem passou a consultar o provider realmente selecionado.
3. DPS **58**, LOBONOTAS em producao restrita: chamada foi para a raiz errada e recebeu HTML IIS `404`. Nao houve processamento fiscal.
4. Fixes `5722299`/`7ac1ebe`: endpoints oficiais configurados e segredo correto do GitHub Environment `production` atualizado. Container confirmado com `SEFIN_BASE_URL=https://sefin.nfse.gov.br/SefinNacional`, `SEFIN_ENV=producao`, `SEFIN_TP_AMB=1`.
5. DPS **59**, producao: JSON ainda nao estava ativo; SEFIN respondeu que `application/xml` nao era suportado.
6. Fix `446a620`: envelope JSON ativado e confirmado no container (`SEFIN_NFSE_ENVELOPE=json`).
7. DPS **60**, producao, JSON aceito: SEFIN respondeu `E1226 - Estrutura descompactada mal formada`.

### Causa atual confirmada

O codigo envia hoje `JSON.stringify({ dps: signedDps })`, isto e, XML assinado puro dentro de `dps`. O contrato oficial exige que documentos XML trafeguem em **GZip com representacao Base64Binary**. A resposta autorizada tambem pode retornar a NFS-e compactada no JSON; o mapper atual apenas procura XML puro e ainda nao descompacta esse campo.

### Proximo passo tecnico exato

1. Criar codec deterministico para `UTF-8 XML -> gzipSync -> Base64` e `Base64 -> gunzipSync -> UTF-8 XML`.
2. Em `LobonotasProvider.emitirNfse`, enviar `{ dps: gzipBase64(signedDps) }` com `application/json`.
3. Ensinar `mapSefinNfseResponse` (ou camada anterior) a detectar o campo compactado de retorno (`nfse`/campo oficial), descompactar e entao mapear chave, numero e XML.
4. Adicionar testes de round-trip, envelope real e resposta compactada; executar suite focada + suite completa + build.
5. Publicar/deployar; confirmar as quatro variaveis SEFIN no container.
6. Somente entao fazer **uma unica** nova tentativa real e acompanhar o correlationId nos logs.

### Estado de repositorio/deploy ao pausar

- `main` backend: `446a620 fix(sefin): envia DPS em envelope JSON` (deploy `30872158142` concluido com sucesso).
- Config efetiva no container: provider fixado pela reemissao em `LOBONOTAS`, ambiente `producao`, `tpAmb=1`, endpoint `/SefinNacional`, envelope `json`.
- Testes do ultimo ajuste: **23/23** focados verdes; build verde.
- Nao cancelar a NFS-e 47 e nao reemitir novamente antes do codec.

## 0. Atualizacao rapida (03/08/2026) - reemissao segura de erro anterior a transmissao

Fonte: `codigo local` + `registro real de producao` + `testes locais` + `build local`.

Motivacao:
- a emissao LOBONOTAS `6a70eb85caa874f842b4a576` falhou com `externalId=null`, `providerResponse=null` e erro do Mongoose sobre `updatePipeline`
- o erro ocorreu na reserva da numeracao DPS, antes de qualquer transmissao ao Ambiente Nacional; o fix `f8b2bbb` ja esta em producao

Estado atual:
- novo endpoint `POST /nfse/:id/reemitir`, permitido para `admin|manager|user`
- fail-closed: aceita somente emissao `ERROR` sem `externalId` e sem `providerResponse`
- reutiliza o payload fiscal armazenado, cria nova `referenciaExterna` idempotente e nova emissao; a tentativa anterior permanece intacta para auditoria
- tentativas com evidencia de transmissao sao rejeitadas com `REEMISSAO_NAO_SEGURA`

Validacao local:
- controller focado: **18/18 testes** verdes
- suite completa: **271 testes / 36 suites** verdes
- build ok; lint sem erros novos

Leitura operacional correta:
1. a emissao real acima pode ser tentada novamente pelo frontend sem risco de duplicar uma transmissao anterior
2. a nova tentativa pode revelar o proximo contrato real do Ambiente Nacional (mTLS/envelope/cStat), que deve ser diagnosticado pelo novo registro
3. nao reutilizar este endpoint quando existir `externalId` ou resposta do provider

## 0. Atualizacao rapida (03/08/2026) - DANFSe v2.0 gerado localmente conforme NT 008 v1.02

Fonte: `codigo local` + `pesquisa oficial` + `testes locais` + `build local` + `lint local`.

Estado atual:
- `src/fiscal/infra/sefin/danfse.ts` implementa parser do XML autorizado e gerador PDF do **DANFSe v2.0** conforme a NT 008 v1.02, em A4 retrato e pagina unica
- o documento inclui QR Code da consulta publica, dados fiscais canonicos, tributacao municipal/federal/IBS-CBS, totais, ambiente sem validade juridica e marcas d'agua `CANCELADA`/`SUBSTITUIDA`
- `LobonotasProvider.baixarPdfNfse` deixou de retornar vazio: consulta o XML oficial por chave e gera o PDF localmente, pois a API oficial de geracao foi suspensa em 03/08/2026
- `baixarXmlNfse` permanece funcional pela consulta `GET /nfse/{chave}`
- pesquisa oficial consolidada em `docs/lobonotas/06-SPEC-AMBIENTE-NACIONAL.md` (NT 008 v1.02 e Decreto 6.743 de Manaus)

Validacao local:
- testes focados de DANFSe/provider: **29 testes / 2 suites** verdes
- `npm test -- --runInBand` -> **268 testes / 36 suites** verdes
- `npm run build` -> ok
- `npm run lint` -> **0 erros** (223 warnings pre-existentes)

Deploy de producao:
- push da `main` no commit `f991bba`
- GitHub Actions `Deploy Oracle VPS` run `30866860926` -> **success** (build, sync e deploy concluidos)
- health publico apos deploy: `https://manaus-nfse-dashboard.vercel.app/api/health` -> `status: ok`, `env: production`

Leitura operacional correta:
1. DANFSe/PDF deixou de ser pendencia de codigo do Slice 7
2. producao continua no PlugNotas; LOBONOTAS segue protegido por flag/allowlist
3. piloto real, envelope/cStat reais e leiaute real dos eventos ainda dependem de credencial oficial
4. substituicao via DPS/evento `e105102` permanece para um passo posterior

## 0. Atualizacao rapida (03/08/2026) - Slice 7 LOBONOTAS: cancelamento via API Eventos do Ambiente Nacional (e101101) + estado CANCELED

Fonte: `codigo local` + `testes locais` + `build local` + `lint local`.

Estado atual:
- **cancelamento por evento implementado** no provider LOBONOTAS (`src/fiscal/infra/sefin/`), removendo o placeholder `SEFIN_EVENTO_NOT_IMPLEMENTED`:
  - novo `evento-builder.ts` gera o pedido de registro do cancelamento como **`TCEvento`** (doc 06 §2.3): `infEvento` (`Id="e101101{chNFSe}"`, `verAplic`, `ambGer`=`tpAmb`, `nSeqEvento`, `dhProc` UTC, `nDFSe`) + `pedRegEvento`/`infPedReg` (`Id="pedRegEvento{chNFSe}"`, `tpAmb`, `verAplic`, `dhEvento`, `CNPJAutor`, `chNFSe`, `e101101` com `versao`+`xJust`) + `ds:Signature` enveloped sobre `infEvento`
  - `dps-signer.ts` ganhou `signXmlElement` (rotina de assinatura generalizada; `signDps` delega a ela)
  - `SefinMtlsHttp` ganhou `registrarEvento` (`POST /nfse/{chave}/eventos`, `application/xml`) e `consultarEventos` (`GET /nfse/{chave}/eventos[/{tipoEvento}[/{numSeq}]]`)
  - `solicitarCancelamentoNfse(idNota, {codigo, motivo})` resolve a chave (DPS id -> chave se preciso), monta/assina o evento com `CNPJAutor` e `nDFSe` da emissao, registra e devolve **`protocol = chave de acesso`** (o Nacional nao tem protocolo de cancelamento; o estado deriva dos eventos da chave — doc 06 §6) + `aceito`/`nProt`/`cStat` na resposta; 404 -> `notFound`, rejeicao (cStat 4xx/5xx) -> `protocol=null` + `status: REJECTED`
  - `consultarSolicitacaoCancelamentoNfse(protocol)` consulta os eventos da chave e mapeia **`CANCELED`** quando ha `e101101`/`e105102`; 404 -> `status: undefined` + `notFound`
  - `sefin-mapper.ts`: deteccao de cancelamento (`e101101`/`e105102`/`evCancelamento`) => `CANCELED`, novo `mapSefinEventoRegistroResponse` e `parseEventosConsulta`; `sefin-xml.ts` ganhou `extractAllTags`
- **stub SEFIN com API Eventos** (`sefin-stub-server.ts`): `POST/GET /nfse/{chave}/eventos` com cenarios por conteudo da chave — `NFS7..` NFS-e ja cancelada, `NFS8..` inexistente (404), `NFS9..` nao cancelavel (cStat 600), demais aceitas — e integracao mTLS real em `sefin-stub.integration.spec.ts` (evento assinado trafega com CN do cliente validado; consulta devolve e101101)
- contrato dos endpoints legados inalterado: `POST /nfse/:id/cancelamento` e `GET /nfse/cancelamento/:cancellationProtocol` continuam servindo o fluxo (o controller grava `cancelamento.protocol/response` no `providerResponse`)

Validacao local:
- `npm test -- --runInBand` -> **256 testes / 35 suites** verdes (+22)
- `npm run build` ok (inclui copia do catalogo LC116 para `dist`)
- `npm run lint` -> **0 erros** (warnings pre-existentes de tipagem estrita)

Leitura operacional correta:
1. producao segue no PlugNotas; LOBONOTAS continua aditivo protegido por flag/allowlist; nada do fluxo real muda por default
2. cancelamento LOBONOTAS depende do registro do evento no Ambiente Nacional (mTLS com certificado A1 do prestador)
3. `protocol` de cancelamento LOBONOTAS e a **chave de acesso** — o frontend usa esse valor em `GET /nfse/cancelamento/:cancellationProtocol` para consultar os eventos
4. leiaute real de `pedRegEvento_v1.01.xsd`/`evento_v1.01.xsd` e tabela real de `cStat` de eventos seguem `[PENDENTE]` (credencial piloto); DANFSe/PDF e baixarXml do Nacional foram implementados no passo seguinte

## 0. Atualizacao rapida (03/08/2026) - harness local do ciclo LOBONOTAS (emissao -> PENDING -> webhook -> AUTHORIZED) + stub mTLS real do SEFIN

Fonte: `codigo local` + `testes locais` + `build local` + `lint local`.

Estado atual:
- entrou o **harness de integracao** `src/modules/webhooks/webhooks-lobonotas.integration.spec.ts`, provando o loop completo da frente LOBONOTAS sem depender de credencial real:
  - `EmitirNfseService` real (resolver -> `LOBONOTAS` via CNPJ do piloto) + `LobonotasProvider` real (DPS assinada com **certificado A1 de teste autoassinado** via node-forge) + `NfseEmissionRepository` com **model Mongo in-memory**
  - emissao fica **PENDING** com `externalId = DPS + 42 digitos` (dpsId) quando o POST `/nfse` nao confirma (mock de `SefinMtlsHttp.request` rejeita `SEFIN_REQUEST_TIMEOUT` -> caminho de reconciliacao D5 ja exercitado)
  - **webhook forwarder** (`POST /webhooks/fiscal` com header `x-zera-provider: LOBONOTAS`) casa a emissao pelo dpsId e move para **AUTHORIZED**, persistindo a chave `NFS...` como `externalId`, `lastUpdateSource='webhook'`, `lastWebhookAt`, `nextPollAt=null`
- entrou o **stub SEFIN com mTLS real** (`src/fiscal/test-fixtures/sefin-stub-server.ts` + `src/fiscal/infra/sefin/sefin-stub.integration.spec.ts`): servidor HTTPS localhost exigindo certificado de cliente assinado por uma CA de teste, expondo `POST /nfse`, `GET /dps/{dpsId}` e `GET /nfse/{chave}`:
  - prova que `SefinMtlsHttp` faz **handshake TLS genuino** com o certificado A1 de teste (o stub valida o CN `ZERA SEFIN TESTE` do cliente) e que o stub rejeita request sem client cert
  - prova `LobonotasProvider.emitirNfse` **ponta a ponta via mTLS real** (DPS assinada -> POST /nfse real -> AUTHORIZED + chave) e a **reconciliacao D5** (`GET /dps/{dpsId}` -> chave -> `GET /nfse/{chave}`) sem mock de HTTP
  - teste negativo: `SEFIN_VERIFY_CERT=true` contra cert da CA de teste nao confiavel falha com `SEFIN_CERT_VERIFY_FAILED`
- fixtures compartilhadas extraidas para `src/fiscal/test-fixtures/`:
  - `test-cert.ts` — cert A1 autoassinado (`createTestCert`), PFX->PEM via `toPem` (usa `extractKeyAndCert` de producao) e PKI completa `createTestPki` (CA + cert do servidor com SAN localhost/127.0.0.1 + PFX do cliente assinado pela CA)
  - `in-memory-nfse-model.ts` — model Mongo in-memory (movido do spec de webhook; subset de queries do `NfseEmissionRepository`)
  - `sefin-stub-server.ts` — servidor HTTPS mTLS local (fecha sockets com `Connection: close`/`closeIdleConnections` para o Jest sair limpo)
- **endurecimento do cliente mTLS** (`sefin-mtls.http.ts`): o mapeamento de falha de verificacao de certificado passou a incluir `SELF_SIGNED_CERT_IN_CHAIN` e `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` alem de `DEPTH_ZERO_SELF_SIGNED_CERT`/`UNABLE_TO_VERIFY_LEAF_SIGNATURE` -> `SEFIN_CERT_VERIFY_FAILED` (descoberto no teste negativo do stub)
- **correcao de hygiene de teste** (`sefin-mtls.http.spec.ts`): o mock de `https.request` passou a emitir `close` (a pos-resposta e no `destroy`), eliminando o vazamento dos timers de timeout (Jest "did not exit")
- decisao de contrato do webhook LOBONOTAS (validada no harness): o **forwarder real deve identificar o provider** — via header `x-zera-provider: LOBONOTAS` ou `provider: 'LOBONOTAS'` no payload — porque `updateByExternalId` filtra `{ provider: input.provider }` (nfse-emission.repository.ts:213) e o fallback sem identificacao e `PLUGNOTAS`; webhook LOBONOTAS sem identificacao **nao** atualiza a emissao (fail-safe, coberto por teste)
- `GenericDocumentParser` (fallback de LOBONOTAS) ja mapeia `AUTORIZADA`/`CONCLUIDA` -> `AUTHORIZED`, confirmado no harness

Validacao local:
- `npm test -- --runInBand` -> **234 testes / 34 suites** verdes (+6 do stub mTLS; suite sai limpa, sem "did not exit")
- `npm run build` ok (inclui copia do catalogo LC116 para `dist`)
- `npm run lint` -> **0 erros** (warnings pre-existentes de tipagem estrita; fixtures seguem o mesmo padrao `any` dos specs existentes)

Leitura operacional correta:
1. o ciclo LOBONOTAS esta provado localmente em duas camadas: (a) harness webhook com `SefinMtlsHttp` mockado exercitando timeout/reconciliacao D5; (b) stub SEFIN com mTLS real provando handshake, emissao e reconciliacao sem mock de HTTP
2. para operacao real (Slice 6) continua faltando: credencial A1 real do piloto + contrato real do webhook do Ambiente Nacional (doc 06 §5 `[PENDENTE]`)
3. o forwarder LOBONOTAS em producao deve sempre enviar `x-zera-provider: LOBONOTAS` (ou `provider` no payload), senao o webhook cai no fail-safe PLUGNOTAS
4. producao segue no PlugNotas; LOBONOTAS continua aditivo protegido por flag/allowlist

## 0. Atualizacao rapida (03/08/2026) - Slice 5 LOBONOTAS implementado: resolver de provider + piloto Manaus por CNPJ

Fonte: `codigo local` + `testes locais` + `build local` + `lint local`.

Estado atual:
- o provider fiscal ativo em producao continua **`PLUGNOTAS`**; a frente LOBONOTAS avancou para o **Slice 5** do roadmap (`docs/lobonotas/04-ROADMAP-DE-IMPLEMENTACAO.md`), sem mudar comportamento em runtime por default
- entrou o **`FiscalProviderResolver`** (`src/fiscal/application/fiscal-provider.resolver.ts`), camada unica de escolha de provider:
  - registry `PLUGNOTAS` / `LOBONOTAS` (`src/fiscal/domain/provider-names.ts`)
  - `FISCAL_PROVIDER_ACTIVE` define o provider ativo (valores `PLUGNOTAS|LOBONOTAS`); `SEFIN_ENABLED=true` continua aceito como forma legada de ativar LOBONOTAS
  - fail-closed: valor desconhecido lanca `FISCAL_PROVIDER_UNKNOWN` em vez de cair para fallback
  - `resolveProviderForCnpj(cnpj)`: CNPJ do piloto Manaus resolve para LOBONOTAS, demais caem para o provider ativo
  - `pollingProviderNames()`: lista de providers para o polling (ativo + LOBONOTAS quando o piloto estiver ligado)
- a classe `SefinNfseProvider` foi renomeada para **`LobonotasProvider`** (`src/fiscal/infra/sefin/sefin.provider.ts`) com `providerName='LOBONOTAS'`; os arquivos `sefin/*` seguem como infra interna do Ambiente Nacional
- config de piloto em **`LobonotasConfig`** (`src/fiscal/infra/sefin/lobonotas.config.ts`):
  - `LOBONOTAS_PILOT_ENABLED` (default `false`)
  - `LOBONOTAS_CNPJS_MANAUS` (lista separada por virgula; aceita mascara, normaliza 14 digitos, ignora invalidos)
  - `isPilotoCnpj(cnpj)` exige flag ligada + CNPJ na allowlist (fail-closed)
- roteamento por CNPJ ligado em:
  - `EmitirNfseService` (`providerFor`): escolhe provider pelo CNPJ do prestador
  - `PollNfseStatusService`: polling multi-provider por `emission.provider` (via `pollingProviderNames` + dedup)
  - `SyncNfseArtifactsService`: consulta/downloads pelo `doc.provider`
- DI (`fiscal.module.ts`): o token `FiscalProvider` agora vem do resolver via `useFactory: (resolver) => resolver.resolve()`
- `.env.example` documenta as novas variaveis (`FISCAL_PROVIDER_ACTIVE`, `LOBONOTAS_PILOT_ENABLED`, `LOBONOTAS_CNPJS_MANAUS`)
- webhook LOBONOTAS continua **pendente -> Slice 6** (depende do contrato real do Ambiente Nacional, doc 06 §5); o handler atual resolve providerName dinamicamente com fallback `PLUGNOTAS`

Validacao local:
- `npm test -- --runInBand` -> **224 testes / 32 suites** verdes
- `npm run build` ok (inclui copia do catalogo LC116 para `dist`)
- `npm run lint` -> **0 erros** (warnings pre-existentes de tipagem estrita)
- `npm run test:e2e` -> 16 testes verdes (nao exercita `FiscalModule`)

Leitura operacional correta:
1. producao segue no PlugNotas; LOBONOTAS e aditivo protegido por flag/kill switch + allowlist
2. para ativar o piloto Manaus: `LOBONOTAS_PILOT_ENABLED=true` + `LOBONOTAS_CNPJS_MANAUS` com os CNPJs do piloto
3. para ligar LOBONOTAS em geral: `FISCAL_PROVIDER_ACTIVE=LOBONOTAS` (ou `SEFIN_ENABLED=true`, legado)
4. Slice 6 (operacao real com certificado A1, DPS -> autorizacao e webhook LOBONOTAS) depende do contrato real do Ambiente Nacional

## 0. Atualizacao rapida (03/08/2026) - sub-slice seguranca: material do certificado (pfx) cifrado em repouso

Fonte: `codigo local` + `testes locais` + `build local` + `lint local`.

Estado atual:
- o conteudo do certificado A1 (`certificado.pfxBase64`) passou a ser cifrado em repouso com a **mesma rotina AES-256-GCM** ja usada na senha (`encryptSecret`/`decryptSecret` em `empresas.service.ts`), eliminando o texto puro em banco
- `importCertificado` grava `pfxBase64` no formato `v1:` (antes gravava o base64 do arquivo em texto puro)
- **leitura retrocompativel**: certificados legados (base64 sem cifragem) continuam sendo lidos normalmente; `decryptPfxBase64` passa o valor como esta quando nao tem prefixo `v1:`
- pontos de leitura ajustados para decifrar o material antes do uso:
  - `obterMaterialCertificado` (material para assinatura DPS / LOBONOTAS, consumido por `LobonotasProvider`)
  - `syncPlugNotasCadastroFromDoc` (upload do certificado na PlugNotas; novo erro `PLUGNOTAS_CERTIFICADO_PFX_INVALID` quando o material nao pode ser recuperado)
  - `inspectLegacyCertificateExpiration` (reparo de `expiresAt` de certificado legado)
- specs atualizadas/novas:
  - import passou a exigir `pfxBase64: /^v1:/` (antes validava apenas a senha)
  - novo teste de round-trip: import cifra o pfx e `obterMaterialCertificado` recupera o base64 e a senha originais
  - teste de material com certificado legado em texto puro continua verde (retrocompatibilidade)

Validacao local:
- `npm test -- --runInBand` -> **225 testes / 32 suites** verdes
- `npm run build` ok
- `npm run lint` -> **0 erros** (warnings pre-existentes de tipagem estrita)

Leitura operacional correta:
1. certificados ja armazenados em producao (texto puro) continuam funcionais; novos imports ja nascem cifrados
2. a cifragem usa `EMPRESA_CERT_ENCRYPTION_KEY` (fallback `JWT_SECRET`); trocar a chave exige reimportar certificados
3. o sub-slice cobre o requisito de seguranca do Slice 6 (credencial A1) sem depender de credencial real

## 0. Atualizacao rapida (01/08/2026) - LOBONOTAS slices 1-4 implementados + deploy Oracle VPS verde

Fonte: `codigo local` + `testes locais` + `build local` + `execucao real do GitHub Actions` + `VPS via SSH`.

Estado atual:
- o provider fiscal ativo em producao continua **`PLUGNOTAS`**; a frente LOBONOTAS (NFS-e Padrao Nacional / SEFIN) foi implementada como codigo aditivo atras de flag `SEFIN_ENABLED=false`, sem mudar comportamento em runtime
- slices 1-4 do roadmap (`docs/lobonotas/04-ROADMAP-DE-IMPLEMENTACAO.md`) implementados:
  - Slice 1: `ProviderDocumentParsers` (registry `providerName → parser`) + `GenericDocumentParser` + `PlugNotasDocumentParser`; DI unificado em `FiscalModule` (exporta `NfseEmissionRepository` e `ProviderDocumentParsers`); `nfse.mapper.ts` virou re-export de compat
  - Slice 3: DPS builder (`src/fiscal/infra/sefin/dps-builder.ts`, DPS 1.01) e signer (`dps-signer.ts`, xml-crypto@6.1.2, c14n+RSA-SHA256) — DPS assinada validada contra `DPS_v1.01.xsd` oficial
  - Slice 4: cliente mTLS `sefin-mtls.http.ts`, config centralizada `sefin.config.ts`, `sefin-mapper.ts`/`sefin-xml.ts` tolerantes a namespace, `SefinNfseProvider` implementando `FiscalProvider`, contador atomico de DPS (`dpsContador`/`dpsSerieContador`) em `EmpresasService.reservarNumeracaoDps`, wiring com `SEFIN_ENABLED=false`
- Slice 2 (pesquisa oficial) consolidado em `docs/lobonotas/06-SPEC-AMBIENTE-NACIONAL.md` (XSD 1.00/1.01, Emissor Publico Nacional v1.0, ADN v1.0, 17 eventos, Manaus conveniado ativo; pendencias em doc 06 §5)

CI/deploy (Oracle VPS via GitHub Actions):
- o deploy esta **verde** (runs de 01/08/2026); container `zera-backend-api` Up healthy; `GET /health` → `{"status":"ok","env":"production"}`
- 2 fixes de DI de boot que quebravam o deploy apos o fix do `yarn.lock`:
  - `d211546`: `@Optional()` no `ProviderDocumentParsers` de `NfseEmissionRepository` (erro `UnknownDependenciesException` no boot)
  - `a48e99e`: `PlugNotasProvider` adicionado ao array `providers` do `FiscalModule` (usado no factory do `FiscalProvider` mas nao registrado)
- `d3c4ed7`: upgrade `actions/checkout@v5` + `actions/setup-node@v5` (Node 20 deprecado nos runners); sem warnings de Node 20
- historico da main (topo→base): `d3c4ed7` → `a48e99e` → `d211546` → `b83885d` → `af02548` → `7de473f` → ...

Acesso VPS (configurado nesta rodada):
- alias SSH `lobojow` em `~/.ssh/config` (HostName `136.248.90.172`, User `ubuntu`, IdentityFile com aspas — o path tem espacos)
- chave: `/home/lobo/Área de trabalho/SSH_KEYS_ORACLE/ssh-key-2026-06-16(1).key` (fora do repo; `(2)` e `(3)` tambem autenticam)
- host sem `.git`: deploy e por copia de arquivos + `docker compose up -d --build`; o caminho canonico passou a ser o workflow

Validacao local:
- `npx nest build` ok (host local tem Node 22; `yarn build` falha por engine `20.x`)
- `npx jest --runInBand` → **207 testes / 30 suites** verdes

Leitura operacional correta:
1. producao segue no PlugNotas; LOBONOTAS e aditivo protegido por flag/kill switch
2. em deploy vermelho, olhar `docker logs zera-backend-api` (erros de DI de boot aparecem como `UnknownDependenciesException`) antes de culpar o ambiente
3. qualquer novo dominio do frontend exige `CORS_ORIGINS` + redeploy (regra de 14/05 mantida)

## 0. Atualizacao rapida (19/05/2026) - nova role `readonly` entrou para testes de visualizacao segura

Fonte: `codigo local` + `teste local focado` + `build local`.

Estado atual:
- o backend reconhece `readonly` como role valida de usuario
- `readonly` pode fazer login e consumir apenas rotas de leitura
- `readonly` nao pode:
  - emitir NFSe normal
  - emitir NFSe rapida
  - substituir/cancelar
  - sincronizar artifacts
  - criar/editar/excluir tomadores
  - criar/editar/excluir prestadoras
  - importar certificado
  - sincronizar PlugNotas
  - gerenciar usuarios
- DTOs de criacao, convite e edicao de usuario passaram a aceitar esse novo perfil

Leitura operacional correta:
1. investidor/teste visual nao deve mais usar `user`
2. `user` segue operacional
3. `readonly` virou a role canonica de visualizacao segura
4. o fechamento de permissao acontece primeiro no backend e depois na UI

## 0. Atualizacao rapida (18/05/2026) - segundo prestador validado com emissao real e lacuna operacional restante no provider

Fonte: `execucao real` + `codigo local` + `teste local focado`.

Estado atual:
- o novo prestador conseguiu atravessar cadastro local, sincronizacao com a PlugNotas e emissao real autorizada
- o bloqueio `PLUGNOTAS_SYNC_INCOMPLETE` por `endereco.codigoMunicipio` foi superado com resolucao progressiva por endereco local, `providerData` e `cidade + UF` via IBGE
- a tentativa antiga por rota dedicada retornou `404`, por isso a automacao passou a usar `PATCH /empresa/{CNPJ}` com a configuracao minima documentada para NFS-e Nacional
- a empresa apareceu no painel da PlugNotas e so ficou operacional apos configuracao manual da aba `NFS-e`
- a sincronizacao explicita do ZERA agora deve tratar esse cenario como sucesso com pendencia manual, e nao como falha total do cadastro da empresa
- os itens manuais observados como necessarios foram:
  - ativar emissao de NFSe Nacional
  - ativar consulta automatica de DF-e
  - marcar consultas por prestador, tomador e intermediario
  - configurar serie e numeracao inicial de RPS

Leitura operacional correta:
1. o ZERA ja prova onboarding multi-prestador ate a emissao real
2. ainda falta absorver no produto a configuracao operacional da aba `NFS-e` da PlugNotas
3. erro de rota inexistente nessa etapa nao deve ser lido como falha total do cadastro da empresa
4. a proxima frente canonica e modelar ou assumir explicitamente essa configuracao operacional do provider

## 0. Atualizacao rapida (18/05/2026) - onboarding operacional de novo prestador via PlugNotas

Fonte: `codigo local` + `teste local focado` + `build local`.

Estado atual:
- o backend ganhou `POST /empresas/:id/plugnotas/sync`
- o backend ganhou `POST /empresas/cnpj/:cnpj/plugnotas/sync`
- a sincronizacao sobe o certificado para a PlugNotas quando ainda nao existe `providerCertificadoId` local
- apos isso, tenta cadastrar a empresa no provider e faz a habilitacao complementar de NFSe Nacional
- o diagnostico de certificado por CNPJ agora tambem informa o `providerCertificadoId` armazenado localmente

Leitura operacional correta:
1. multi-prestador funcional exige banco + certificado + sincronizacao PlugNotas
2. a nova rota explicita de sincronizacao e a borda segura desta rodada
3. `create/update` de empresa continuam locais; a automacao total de provider ficou deliberadamente adiada
4. o objetivo imediato e homologar com 2 prestadores antes de escalar para 4

## 0. Atualizacao rapida (14/05/2026) - dominio `zera.net.br` confirmou dependencia operacional de `CORS_ORIGINS`

Fonte: `execucao real` + `codigo local`.

Estado atual:
- o backend continua com CORS configurado em `src/main.ts`
- as origens padrao nao incluem automaticamente novos dominios publicos do frontend
- apos a publicacao de `https://zera.net.br`, o navegador passou a falhar em requests `OPTIONS` para `/health` e `/auth/login`
- a normalizacao ocorreu apos incluir a nova origem em `CORS_ORIGINS` e redeployar o backend

Leitura operacional correta:
1. `CORS_ORIGINS` e a fonte real da allowlist de navegador neste projeto
2. `FRONTEND_URL` e `FRONTEND_APP_URL` nao substituem CORS
3. cada novo dominio do frontend exige alinhamento explicito da allowlist no backend
4. o sintoma mais comum dessa divergencia e `OPTIONS` quebrando antes das rotas de negocio

## 0. Atualizacao rapida (12/05/2026) - auditoria das integracoes externas excluindo PlugNotas

Fonte: `codigo local` + `docs locais`.

Estado atual:
- o backend centraliza a trilha principal de integracoes externas para:
  - CPF de tomadores PF via Hub do Desenvolvedor
  - CNPJ via CNPJá, com apoio de BrasilAPI e ReceitaWS
  - CEP via ViaCEP
  - municipios por UF via IBGE Localidades
- a direcao canonica continua sendo manter o backend do ZERA como fachada unica dessas integracoes

Leitura operacional correta:
1. CPF, CNPJ e CEP ja estao centralizados pelo backend
2. municipios por UF tambem ja possuem borda interna no backend
3. a centralizacao ainda nao esta completa na pratica porque o frontend mantem duas chamadas diretas ao IBGE no fluxo ativo da emissao
4. qualquer movimento para fornecedor principal unico deve preservar essa fachada interna do backend

## 0. Atualizacao rapida (11/05/2026) - primeira camada oficial de IA entrou como diagnostico read-only

Fonte: `codigo local` + `teste local focado` + `build local`.

Estado atual:
- foi criada a primeira camada `src/ai/*` no backend
- a frente inicial nao toca no motor fiscal nem em regras tributarias
- o primeiro agente oficial implementado foi o `DiagnoseAgent`
- o comportamento atual e totalmente deterministico, sem dependencia de provider LLM em runtime
- o endpoint inicial exposto e:
  - `POST /ai/diagnostics/emission`
- o endpoint aceita:
  - `emissionId?`
  - `externalId?`
- a resposta segue o formato estruturado definido no `AI_CONTEXT.md`, incluindo:
  - `severity`
  - `probableLayer`
  - `probableCause`
  - `summary`
  - `recommendedActions`
  - `confidence`
  - `evidence`
  - `references`

Leitura operacional correta:
- esta primeira entrega deve ser lida como camada de triagem e explicacao operacional
- ela reutiliza apenas dados ja existentes do sistema:
  - emissao
  - timeline de observabilidade
  - polling
  - auditoria de webhook
  - artefatos
- ela nao altera emissao, nao aciona provider fiscal e nao grava efeito colateral operacional
- e uma implementacao alinhada ao `AI_CONTEXT.md`:
  - IA como copiloto operacional
  - engine fiscal continua sendo a verdade
  - nenhuma regra tributaria foi movida para IA

Heuristicas iniciais cobertas:
1. emissao saudavel fechada por webhook
2. emissao autorizada, mas fechada por polling
3. indisponibilidade transitoria da cadeia externa NFS-e / provider
4. divergencia de segredo compartilhado no webhook (`invalid_shared_secret`)
5. artefatos incompletos apos autorizacao
6. emissao pendente ainda em processamento

Validacao:
- `npm test -- --runInBand src/ai/agents/diagnose.agent.spec.ts src/ai/ai.controller.spec.ts`
- `npm run build`

## 0. Atualizacao rapida (21/04/2026) - controle de cadastro do tomador na emissao padrao

Fonte: `codigo local` + `testes locais` + `build local`.

Estado atual:
- `POST /nfse/emitir` aceita `syncTomadorCadastro?: boolean`
- `syncTomadorCadastro: false` impede o upsert do tomador no cadastro principal
- `syncTomadorCadastro: true` ou ausencia da flag preserva o comportamento de sincronizacao da emissao normal
- a flag e removida antes do payload enviado ao provider fiscal
- `POST /nfse/quick` continua usando `syncTomadorCadastro: false` por padrao interno

Leitura operacional:
- a DANFSE padrao pode emitir para tomador manual sem necessariamente criar cadastro
- a decisao de cadastrar ou nao cadastrar o tomador fica na UI
- o backend continua exigindo dados fiscais completos do tomador para emissao normal
- a regra nao altera PlugNotas, calculos de ISS, webhook, polling ou cadastro de prestador

Validacao:
- `npm test -- src/modules/fiscal/dtos/emitir-nfse.dto.spec.ts src/fiscal/application/emitir-nfse.service.spec.ts src/fiscal/application/emitir-nfse-quick.service.spec.ts`
- `npm run build`

## 0. Atualizacao rapida (21/04/2026) - onboarding seguro por convite

Fonte: `codigo local` + `git log local`.

Estado atual:
- administradores podem gerenciar usuarios pelas rotas `/users`
- `/users` permanece protegido por JWT + `RolesGuard` com role `admin`
- existem dois modos de criacao:
  - manual, preservando o fluxo antigo com senha definida pelo admin
  - convite, recomendado para primeiro acesso

Fluxo de convite:
- `POST /users/invite` cria usuario `inactive` com `onboardingStatus = invited`
- o backend gera token aleatorio, salva somente `inviteTokenHash` e retorna `inviteToken`
- `inviteUrl` e retornado quando `FRONTEND_APP_URL` ou `FRONTEND_URL` estiver configurado
- TTL padrao do convite: 72 horas via `USER_INVITE_TTL_HOURS`
- `POST /auth/accept-invite` valida token, expiracao e status
- ao aceitar, o usuario define senha propria, vira `active` e recebe `accessToken`

Regra operacional correta:
1. senha nao trafega por e-mail
2. convite e de uso unico
3. token bruto nao deve aparecer em listagem/consulta posterior
4. o fluxo de usuarios nao interfere em emissao fiscal

## 0. Atualizacao rapida (20/04/2026) - quick sem cadastro de tomador e catalogo LC116 protegido no build

Fonte: `codigo local` + `testes locais` + `diagnostico em producao`.

Leitura consolidada:
- `POST /nfse/quick` continua sendo o fluxo de emissao rapida com payload minimo
- a quick agora envia controle interno `syncTomadorCadastro: false` para o service de emissao
- `EmitirNfseService` respeita essa flag e nao chama o upsert de tomador quando ela vem falsa
- a flag e removida antes do payload final enviado ao provider fiscal
- novos tomadores manuais/por emissao normal passam a ter `origemCadastro` para rastreabilidade futura

Catalogo LC116:
- o runtime do Render pode nao ter o arquivo do catalogo na raiz se ele nao for copiado no build
- o build copia `servicos_lc116_v2.json` para `dist`
- `GET /nfse/servicos/diagnostico` expõe a saude do catalogo carregado

Regra operacional correta:
1. quick emite, mas nao cadastra tomador no seletor da DANFSE
2. tomadores antigos vindos da quick sao legado de dados, nao regressao da regra nova
3. erro de codigo valido na quick deve primeiro checar `/nfse/servicos/diagnostico`

## 0. Atualizacao rapida (16/04/2026) - tomadores ganharam lookup CPF assistido

Fonte: `codigo local` + `testes locais` + `build local`.

Leitura consolidada:
- o backend agora exibe `GET /tomadores/lookup/cpf?cpf=`
- a rota consulta `cadastropf` do Hub do Desenvolvedor e devolve payload normalizado para o frontend
- a regra de seguranca da rodada foi manter a frente estritamente em `tomadores`, sem tocar `prestador` ou degradar o fluxo existente de `CNPJ`

Comportamento atual:
- CPF invalido retorna erro de validacao
- CPF encontrado com dados uteis retorna nome, contato e endereco normalizados
- payload mascarado por LGPD retorna `found`, mas `usefulData = false` e `maskedByLgpd = true`

Regra operacional correta agora:
1. consulta externa por CPF deve passar sempre pelo backend
2. a resposta e assistiva, nao bloqueante
3. mascaramento LGPD nao pode ser tratado como dado bom para autopreenchimento
4. o contrato atual nao substitui nem concorre com as fontes de PJ

## 0. Atualizacao rapida (09/04/2026) - kit local de skills criado para desenvolvimento fiscal seguro

Fonte: `estrutura local em .codex/skills` + `validacao com quick_validate.py`.

Leitura consolidada:
- o backend agora possui um conjunto local de skills focadas no coracao fiscal do produto
- a intencao desta rodada foi transformar aprendizado operacional recente em guias reutilizaveis para desenvolvimento, diagnostico e teste

Skills disponiveis localmente:
- `zera-diagnose-emission`
- `zera-feature-safe-builder`
- `zera-payload-builder`
- `zera-provider-diagnose`
- `zera-webhook-debug`
- `zera-polling-analysis`

Leitura correta desse kit:
- nao e documentacao de negocio para usuario final
- e infraestrutura de trabalho para agentes e desenvolvimento assistido
- foi desenhado para:
  - reduzir chute
  - melhorar triagem
  - separar diagnostico por camada
  - preservar a regra de producao sem regressao

Validacao executada:
- `quick_validate.py` em todas as skills locais
- resultado:
  - todas validas

Regra operacional desta rodada:
1. usar `zera-diagnose-emission` para triagem inicial
2. usar skills especializadas quando o caso cair claramente em:
   - implementacao segura
   - payload fiscal
   - provider
   - webhook
   - polling
3. manter `CURRENT_STATE.md` como fonte de verdade do estado recente, acima de memoria antiga embutida em skill

## 0. Atualizacao rapida (08/04/2026) - webhook homologado em producao com callback real aplicado

Fonte: `payload real da PlugNotas` + `diagnostico real do webhook` + `observabilidade real no frontend`.

Leitura consolidada:
- o webhook da PlugNotas agora esta **homologado na pratica** no ambiente produtivo
- a causa raiz do bloqueio anterior foi identificada e fechada:
  - `invalid_shared_secret`
  - `tokenAccepted: false`
  - descompasso entre `WEBHOOK_SHARED_SECRET` no Render e `x-webhook-token` configurado na PlugNotas
- depois do alinhamento do segredo, uma nova emissao real de **08/04/2026** passou a mostrar:
  - `Ultima Origem: webhook`
  - `WEBHOOK_RECEIVED`
  - `ARTIFACTS_SYNCED`
  - `Tentativas de Polling: 0`

Evidencia operacional final:
- emissao criada: `13:20:54`
- callback aplicado: `13:21:07`
- emissao finalizada no ZERA: `13:21:09`
- tempo ponta a ponta observado no app:
  - cerca de `15 segundos`

Conclusao operacional correta agora:
1. a rota `POST /webhooks/fiscal` esta recebendo callback real em producao
2. o segredo compartilhado esta validando corretamente apos o ajuste
3. o update da emissao por webhook esta funcionando
4. o sync oportunista de XML/PDF tambem funcionou nessa emissao homologada
5. `polling` deve continuar ligado apenas como fallback, nao como trilha principal esperada

## 0. Atualizacao rapida (08/04/2026) - auditoria de recebimento do webhook adicionada para fechar homologacao

Fonte: `payload real da PlugNotas em 08/04` + `observabilidade real` + `codigo local` + `testes locais`.

Leitura consolidada:
- a PlugNotas continuou mostrando evidencia de callback real no lado deles
- a emissao observada no ZERA ainda terminou com:
  - `Ultima Origem: polling`
  - sem `WEBHOOK_RECEIVED`
- isso manteve a homologacao do webhook como `pendente`

Mudanca aplicada no backend local:
- foi adicionada uma auditoria resumida de entregas do webhook em colecao separada
- o handler agora registra, em modo best-effort:
  - callback recebido
  - callback rejeitado por segredo invalido
  - callback processado com sucesso ou sem match
  - `requestExternalId`
  - lista de `candidateExternalIds`
  - `providerStatus`
  - `mappedStatus`
  - `matchedBy`
  - `resolvedExternalId`
- o endpoint `GET /nfse/webhook/diagnostico` agora expõe:
  - `lastAudit`
  - `lastSuccess`
  - `lastFailure`

Validacao executada:
- `npm test -- src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/fiscal/fiscal.controller.spec.ts src/modules/webhooks/webhooks.service.spec.ts src/fiscal/infra/mongo/repositories/nfse-emission.repository.spec.ts`
- resultado:
  - `33 passed, 33 total`
- `npm run build`
- build ok

Leitura operacional correta agora:
1. a proxima emissao real deve ser lida primeiro pelo diagnostico enriquecido
2. se `lastAudit` nao mudar, o callback nao chegou ao backend
3. se `lastFailure` mudar para `invalid_shared_secret`, o problema e token/header
4. se `lastSuccess` aparecer mas a emissao seguir em `polling`, o problema vira match/update residual
5. `polling` continua ligado ate aparecer prova real de `WEBHOOK_RECEIVED`

## 0. Atualizacao rapida (07/04/2026) - webhook pronto por dentro, ainda nao comprovado ponta a ponta

Fonte: `observabilidade real` + `logs reais do Render` + `codigo local` + `testes locais`.

Leitura consolidada:
- o backend continua tecnicamente pronto para webhook:
  - segredo configurado
  - header configurado
  - diagnostico exposto
  - observabilidade por `externalId` funcionando
  - `polling` preservado como fallback
- mas, no estado atual, a prova operacional final ainda nao apareceu

O que foi observado de forma real:
- a observabilidade mostrou:
  - `Segredo: Configurado`
  - `Polling Fallback: Ativo`
  - `Sync Autorizado: Ativo`
- emissões recentes continuaram terminando com:
  - `Ultima Origem: polling`
  - sem `WEBHOOK_RECEIVED`
- os logs reais compartilhados do Render nao mostraram `POST /webhooks/fiscal` no recorte analisado

Leitura operacional correta agora:
1. o backend esta pronto internamente
2. o `polling` continua sendo quem fecha as emissoes reais observadas
3. ainda nao e correto afirmar "webhook 100% homologado"
4. a frente atual e operacional:
   - revisar PlugNotas com `CHECKLIST_WEBHOOK_PLUGNOTAS_PRODUCAO.md`
   - emitir nova nota
   - confirmar:
     - `POST /webhooks/fiscal`
     - `WEBHOOK_RECEIVED`
     - `lastUpdateSource = webhook`

## 0. Atualizacao rapida (26/03/2026) - callback real comprovado, match do webhook endurecido

Fonte: `documentacao oficial da API PlugNotas` + `configuracao real na PlugNotas` + `payload real capturado` + `codigo local` + `testes locais` + `build local`.

Leitura consolidada:
- o webhook da PlugNotas deixou de ser hipotese e passou a ter evidencia operacional concreta
- a configuracao do callback organizacional foi aceita pela API da PlugNotas
- a consulta de configuracao passou a retornar:
  - `url = https://zera-backend.onrender.com/webhooks/fiscal`
  - `method = POST`
  - header `x-webhook-token`
- houve captura de payload real de callback da PlugNotas em producao com:
  - `idIntegracao`
  - `protocol`
  - `id`
  - `status = CONCLUIDO`
  - `retorno.situacao = AUTORIZADA`

O que esse payload real provou:
- a PlugNotas esta sim disparando callback
- a ausencia de `WEBHOOK_RECEIVED` na observabilidade daquela emissao especifica nao significou mais "callback inexistente"
- o problema real observado no dia passou a ser:
  - match insuficiente do webhook no backend antes do patch

Causa raiz consolidada:
- o callback real pode chegar com mais de um identificador relevante:
  - chave de correlacao do ZERA:
    - `idIntegracao`
  - identificadores finais do provider:
    - `protocol`
    - `id`
    - `idNota`
- a ordem anterior do parser/atualizacao do webhook priorizava identificadores do provider cedo demais
- isso podia impedir o match da emissao ainda pendente, que inicialmente estava correlacionada por `referenciaExterna` / `idIntegracao`
- quando isso acontecia, a emissao acabava sendo fechada logo depois por `polling`

Mudanca aplicada no codigo local:
- o webhook agora tenta multiplos candidatos de match
- a prioridade operacional ficou mais segura para o caso real:
  - `externalId`
  - `idIntegracao`
  - depois identificadores finais do provider
- quando o webhook encontra a emissao, o backend passa a persistir o identificador final do provider como `externalId`
- nenhuma mudanca foi feita em:
  - contrato do endpoint `POST /webhooks/fiscal`
  - fallback por `polling`
  - regra de emissao

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/fiscal/infra/mongo/repositories/nfse-emission.repository.spec.ts`
- resultado:
  - `15 passed, 15 total`
- `npm run build`
- build ok

Leitura operacional correta agora:
1. callback real da PlugNotas esta comprovado
2. o gargalo de 26/03 nao era mais "cadastro de webhook ausente"
3. o gargalo virou robustez de match entre callback real e emissao pendente
4. o backend local foi endurecido para esse caso real sem desligar `polling`
5. a homologacao final ainda depende de:
   - deploy dessa rodada
   - nova emissao real
   - observabilidade mostrando:
     - `WEBHOOK_RECEIVED`
     - `lastUpdateSource = webhook`

Documentacao local criada nesta rodada:
- `docs/PLUGNOTAS_WEBHOOK_API_2026-03-26.md`

## 0. Atualizacao rapida (25/03/2026) - webhook pronto internamente, pendente externamente

Fonte: `observabilidade real em producao` + `logs do backend` + `documentacao local`.

Leitura consolidada:
- o backend ja tem estrutura suficiente para operar webhook em producao
- segredo/configuracao interna ja foram validados
- endpoints de diagnostico e observabilidade ja existem
- `polling` continua ativo e hoje ainda e quem fecha as emissoes reais

Estado pratico atual:
- o principal gargalo nao e mais codigo
- o principal gargalo e a configuracao/ativacao do callback real na PlugNotas
- ainda nao houve evidencia operacional forte de:
  - `POST /webhooks/fiscal`
  - `WEBHOOK_RECEIVED`
  - `lastUpdateSource = webhook` em emissao real concluida por callback

Regra operacional consolidada:
1. backend continua pronto para homologacao
2. polling continua fallback obrigatorio
3. nao desligar polling
4. nao tratar ausencia de callback como bug automatico de codigo antes de validar configuracao externa

## 0. Atualizacao rapida (24/03/2026) - webhook com lote, diagnostico e observabilidade por externalId

Fonte: `codigo local` + `testes locais`.

Leitura consolidada:
- o webhook continua em homologacao controlada
- o `polling` continua obrigatorio como fallback
- o backend agora lida melhor com payloads reais em array e oferece endpoints melhores para verificacao operacional

O que isso significa na pratica:
- webhook aceita:
  - objeto unico
  - array com 1 item
  - array com varios itens
- quando vier lote, o backend responde com:
  - `batch: true`
  - `okCount`
  - `failedCount`
  - `results`
- agora tambem existem endpoints autenticados para homologacao:
  - `GET /nfse/webhook/diagnostico`
  - `GET /nfse/external/:externalId/observability`

Leitura arquitetural correta agora:
1. webhook continua camada aditiva
2. polling continua rede de seguranca
3. webhook ainda **nao** e a malha principal unica de request/response
4. esta rodada melhora compatibilidade com payload real, rastreabilidade e velocidade de homologacao

Leitura complementar sobre tributacao:
- `E0312` / `E0314` seguem registrados no historico do repositorio
- mas, com a evidencia raiz de payload aceito e com emissoes recentes reportadas, essa frente nao deve mais ser tratada automaticamente como gargalo principal atual
- a prioridade atual do backend esta em:
  - callback real
  - diagnostico
  - observabilidade
  - transicao segura entre webhook e polling

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/webhooks.controller.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/fiscal/fiscal.controller.spec.ts`
- resultado: `30 passed, 30 total`
- `npm run build`
- build ok

## 0. Atualizacao rapida (23/03/2026) - webhook com sync oportunista de artefatos

Fonte: `codigo local` + `testes locais`.

Leitura consolidada:
- o webhook continua em homologacao controlada
- o `polling` continua obrigatorio como fallback
- quando o callback chega ja com status autorizado, o backend agora tenta sincronizar XML/PDF imediatamente

O que isso significa na pratica:
- callback autorizado pode acelerar disponibilidade de artefatos
- falha nesse sync **nao** derruba o webhook
- o fluxo continua resiliente porque o `polling` segue cobrindo reconciliacao

Resposta operacional do webhook agora ficou mais clara:
- `externalId`
- `providerStatus`
- `mappedStatus`
- `artifactSync`

Leitura arquitetural correta agora:
1. webhook continua camada aditiva
2. polling continua rede de seguranca
3. webhook ainda **nao** e a malha principal unica de request/response
4. esta rodada melhora tempo de artefatos e rastreabilidade, sem mudar regra fiscal

## 0. Atualizacao rapida (21/03/2026) - portal nacional, prestador e continuidade do webhook

Fonte: `codigo local` + `testes locais`.

Leitura consolidada:
- o cadastro de prestador no frontend foi ajustado para refletir os identificadores corretos da ultima emissao no card `Portal Nacional`
- esses campos passaram a ser lidos como espelho do retorno real do provider, e nao mais como verdade primaria do cadastro
- o backend continua com webhook tecnicamente pronto, mas ainda em fase de homologacao operacional controlada

Portal Nacional / Prestador:
- valores corretos esperados a partir da emissao:
  - `NFS-e Nº` <- `retorno.numeroNfse`
  - `DPS Nº` <- `dps.numero`
  - `Serie DPS Nº` <- `dps.serie`
- leitura correta:
  - esses campos sao recebidos do provider
  - nao alteram a regra de emissao
  - nao devem ser tratados como payload canônico da emissao

Webhook:
- continua como frente prioritara do backend
- ainda **nao** virou malha principal unica de request/response
- `polling` segue obrigatorio como fallback ate:
  - callback real comprovado em producao
  - segredo validado em runtime
  - match confiavel por `externalId`
  - observabilidade confirmando `lastUpdateSource = webhook`

## 0. Atualizacao rapida (18/03/2026) - consolidado do dia

Fonte: `codigo local` + `validacao local` + `evidencia operacional reportada`.

Frentes realmente mexidas hoje:
- **infra/percepcao de velocidade**
- **ajustes visuais no front**
- **experiencia da DANFSe**
- **reorganizacao da rota Gestor AI**
- **otimizacoes conservadoras de carregamento**
- **estabilizacao do cadastro de prestador**
- **documentacao de contexto operacional**

### Infra + velocidade percebida

- upgrade para plano pago da Render associado a **melhora perceptivel de performance**
- leitura consolidada:
  - parte importante da lentidao vinha de **infraestrutura/ambiente**
  - nao ha evidencia atual de regressao recente como causa principal da lentidao geral
- no front, tambem entraram melhorias conservadoras para reduzir sensacao de travamento:
  - lazy loading de rotas pesadas
  - reaproveitamento de snapshot/cache recente do dashboard
  - corte de processamento repetido no dashboard
  - limpeza de peso morto no bundle

Resultado pratico:
1. o app ficou visivelmente mais rapido para abrir e navegar
2. a primeira tela apos login tende a responder melhor
3. o ganho de velocidade passou a vir de duas frentes:
   - infra melhor
   - front menos custoso

### Ajustes visuais entregues no front

- alinhamentos pontuais e de baixo risco no cadastro/regime:
  - `Cnae Anexo`
  - `Apuracao SNe.`
  - tabela/anexo e labels correlatos
- experiencia de DANFSe reorganizada:
  - acoes rapidas na listagem
  - acoes principais no topo da tela detalhada
  - contraste/hover dos botoes ajustados
  - downloads locais concentrados no topo
- lista de tomadores recebeu o mesmo padrao visual de botoes

Regra operacional mantida:
- **nao mexer em regras fiscais**
- **nao mexer em payload**
- **nao mexer em integracao backend**

### Gestor AI

- a tabela passou a representar **tomadores com os valores das notas emitidas para eles**
- leitura por linha:
  - tomador
  - quantidade de notas
  - valores das notas
  - total emitido
  - ticket medio
  - percentual do faturamento
- houve regressao percebida mostrando "Nenhuma nota fiscal emitida ainda"
- causa mais provavel identificada:
  - filtro excessivamente rigido em `useDashboardData`, aceitando apenas itens com `provider === "PLUGNOTAS"`
- ajuste aplicado:
  - manter preferencia por itens `PLUGNOTAS`
  - mas cair para a lista completa quando esse filtro zerar tudo

Resultado pratico:
1. o Gestor AI volta a enxergar notas legadas/sem `provider` explicito
2. a rota preserva a visao por tomador sem sumir com o dataset inteiro
3. a intencao de performance continua, mas sem sacrificar leitura de negocio

### Cadastro de prestador - estabilizacao do comportamento

- parte do trabalho saiu da trilha de performance pura e entrou em **estabilizacao de UX/comportamento do cadastro**
- problemas tratados:
  - `whatsapp` brigando com digitacao por mascaramento no `onChange`
  - `localidade / uf` parseando cedo demais com `trim`
  - `email` dependente do comportamento nativo do browser
  - `numero` do endereco aceitando caracteres indevidos
  - campos de identificacao do Portal Nacional ajustados para aceitarem preenchimento manual e permanecerem opcionais

Resultado pratico:
1. `whatsapp` passou a ficar cru durante digitacao e a formatar so no `blur`
2. `localidade / uf` passou a aceitar texto livre durante digitacao e so separar `cidade/uf` ao sair do campo
3. o cadastro ficou menos sujeito a cursor pulando, espaco sumindo e input brigando com o usuario
4. nenhum desses ajustes mexeu em regra de negocio do backend

### Webhook fiscal continua como foco backend

- em paralelo a essas frentes de UX/performance, o projeto segue em **inicio de rollout/implementacao de webhooks fiscais**
- leitura atual:
  - backend com base tecnica de webhook pronta
  - polling ainda como fallback
  - principal pendencia continua sendo homologacao operacional fim a fim em producao

Validacao executada nesta frente de hoje:
- `src/hooks/useDashboardData.test.ts`
- `src/components/prestador/prestador-cards.test.tsx`
- `src/pages/empresa-form.save-reload.test.ts`
- `npm run build`

## 0. Atualizacao rapida (18/03/2026) - infra mais rapida + rollout inicial de webhook

Fonte: `evidencia operacional reportada`.

Leitura consolidada de hoje:
- upgrade para plano pago da Render associado a **melhora perceptivel de performance**
- leitura atual: parte relevante da lentidao percebida vinha de **infra/ambiente**, nao de regressao funcional recente
- em paralelo, o projeto ja entrou na fase de **inicio de rollout/implementacao de webhooks fiscais**

Implicacao pratica:
1. performance geral do app melhorou com a nova camada de infraestrutura
2. o foco de fechamento continua sendo a homologacao operacional do webhook em producao
3. atraso de atualizacao de status da NFSe ainda deve ser acompanhado junto com:
   - webhook produtivo
   - calibragem final do polling
4. a leitura mais provavel agora e:
   - infraestrutura estabilizada/melhorada
   - backend com base tecnica de webhook pronta
   - pendencia principal concentrada na validacao operacional fim a fim

## 0. Resumo curto de rollout (17/03/2026)

Estado atual:
- **~85% concluido**
- implementacao de webhook: **pronta e testada**
- pendente para fechamento: **homologacao operacional em producao + ajuste final de polling**

Pendencias objetivas para encerrar:
1. validar callback produtivo do provedor em `POST /webhooks/fiscal`
2. confirmar segredo compartilhado em runtime (`WEBHOOK_SHARED_SECRET`)
3. homologar com payload real PlugNotas
4. validar em `GET /nfse/:id/observability`:
   - timeline com `WEBHOOK_RECEIVED`
   - `lastUpdateSource = webhook`
5. recalibrar polling apos homologacao:
   - curto durante rollout
   - fallback permanente

## 0. Delta critico de hoje (17/03/2026)

Fonte: `codigo local` + `execucao local`.

### Webhook vs polling agora distinguiveis na observabilidade

- `NfseEmission` agora registra tambem:
  - `lastWebhookAt`
  - `lastUpdateSource`
- objetivo:
  - diferenciar explicitamente se a ultima mudanca de status veio de:
    - `webhook`
    - `polling`

Arquivos:
- `src/fiscal/infra/mongo/schemas/nfse-emission.schema.ts`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
- `src/fiscal/application/poll-nfse-status.service.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/fiscal/fiscal.controller.ts`
- `src/modules/fiscal/fiscal.controller.spec.ts`

Comportamento confirmado:
- webhook grava:
  - `lastWebhookAt`
  - `lastUpdateSource = "webhook"`
- polling grava:
  - `lastUpdateSource = "polling"`
- `GET /nfse/:id/observability` agora expõe:
  - `observability.webhook.lastWebhookAt`
  - `observability.webhook.lastUpdateSource`
  - evento `WEBHOOK_RECEIVED` na timeline quando aplicavel

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/fiscal/fiscal.controller.spec.ts src/fiscal/application/emitir-nfse.service.spec.ts`
  - `3/3` suites
  - `19/19` testes passando

### Webhook fiscal auditado e coberto por teste

- O modulo de webhook fiscal ja existia no backend e foi auditado:
  - `src/modules/webhooks/webhooks.controller.ts`
  - `src/modules/webhooks/handlers/webhook.handler.ts`
  - `src/modules/webhooks/webhooks.service.ts`
- Endpoint atual:
  - `POST /webhooks/fiscal`
- Regras confirmadas:
  - aceita payload bruto do provider
  - valida `WEBHOOK_SHARED_SECRET` quando configurado
  - extrai `externalId` do payload
  - mapeia status PlugNotas para status de dominio
  - atualiza emissao por `externalId`
  - mantem polling como fallback; nao substitui o fluxo principal de emissao

Cobertura adicionada:
- `src/modules/webhooks/webhooks.controller.spec.ts`
- `src/modules/webhooks/handlers/webhook.handler.spec.ts`
- `src/modules/webhooks/webhooks.service.spec.ts`

Cenarios validados:
- segredo ausente
- segredo invalido
- segredo valido
- payload autorizado
- payload rejeitado
- payload nested com `documents[0].idNota`
- payload sem `externalId`
- status desconhecido preservado como `PENDING`

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/webhooks/webhooks.controller.spec.ts src/fiscal/application/emitir-nfse.service.spec.ts`
  - `4/4` suites
  - `13/13` testes passando

Observacao operacional:
- o webhook hoje entra como **camada aditiva** de atualizacao de status;
- polling continua sendo a rede de seguranca;
- nao houve mudanca no fluxo principal de emissao nesta rodada.

## 0. Delta critico de hoje (16/03/2026)

Fonte: `codigo local` + `execucao local`.

### Resumo de prontidao para B.I.

- `src/modules/empresas/empresas.service.ts`
  - `normalizeEmpresaOutput()` agora expõe:
    - `prontoParaBi`
    - `percentualCompletudeBi`
    - `camposFaltantesBi`
- a regra de B.I. é separada de:
  - `statusCadastro`
  - `prontoParaEmitir`

Cobertura atual de `camposFaltantesBi`:
- base cadastral:
  - `cnpj`, `razaoSocial`, `nomeFantasia`
  - `inscricaoMunicipal`
  - `email`, `whatsapp`
  - endereco completo
- base tributaria:
  - `regimeTributario`
  - `cnaeFiscal`
  - `cnaeFiscalDescricao`
  - `ctnCodigo`
  - `nbsCodigo`
  - `parametroMunicipal`
  - `cnaesLista`
  - `configOperacionais`
- base operacional:
  - `certificado.uploadedAt`
- condicionais do Simples:
  - `rbt12`
  - `aliquotaSimplesNacional`
  - `apuracaoSimplesNacional`
  - `simplesSnapshot`

Validacao:
- `npm test -- src/modules/empresas/empresas.service.spec.ts` -> `19/19`
- `npx eslint src/modules/empresas/empresas.service.ts src/modules/empresas/empresas.service.spec.ts`
  - sem erros
  - warnings antigos de tipagem continuam

## 0. Delta critico de hoje (14/03/2026)

Fonte: `codigo local` + `execucao local` + validacao em producao.

### Observabilidade de emissao

- Novo endpoint:
  - `GET /nfse/:id/observability`
- Retorna trilha completa da emissao:
  - `payload` recebido
  - `biSnapshot`
  - `providerRequest`
  - `providerResponse`
  - `poll` (`attempts`, `lastPolledAt`, `nextPollAt`, `lastPollError`)
  - `artifactSyncAudit`
  - `timeline` cronologica dos eventos relevantes

Arquivos:
- `src/modules/fiscal/fiscal.controller.ts`
- `src/modules/fiscal/fiscal.controller.spec.ts`

Validacao:
- `npm run build` -> passando
- `npm test` -> `12/12` suites, `57/57` testes

### Contrato golden de payload (anti-regressao)

- Fixture canonica adicionada para travar contrato de emissao:
  - `src/fiscal/test-fixtures/emitir-nfse.golden.ts`
- Testes de emissao e provider atualizados para consumir a fixture.

### Higiene de repositório

- JSONs legados de debug/manual removidos da raiz (payloads/token/config ad-hoc sem uso runtime).

### Diagnostico operacional (producao)

- Falha de emissao com `500` foi rastreada por `provider-response` como:
  - `PLUGNOTAS_API_KEY not set`
- Conclusao:
  - erro de ambiente/runtime no backend alvo da requisicao, nao regressao de layout/frontend.

### Performance de retorno de status

- Delay de ~5 min observado e explicado por configuracao de polling atual:
  - `NFSE_POLLING_INTERVAL_MS=300000`
- Acao curta recomendada:
  - reduzir para `60000` enquanto webhook nao entra em producao.

## 0. Delta critico de hoje (11/03/2026)

Fonte: `codigo local` + `execucao local`.

Melhorias pequenas e aditivas para B.I. aplicadas no backend:

- `src/modules/empresas/schemas/empresa.schema.ts`
  - novo campo `simplesSnapshot` em `Empresa`.
- `src/modules/empresas/empresas.service.ts`
  - save/update da empresa agora calcula e persiste snapshot tributario do Simples Nacional quando houver base suficiente (`regimeTributario`, `rbt12`, `cnaesLista[].anexo`).
- `src/fiscal/infra/mongo/schemas/nfse-emission.schema.ts`
  - emissao passou a ter campos analiticos de 1a classe:
    - `localPrestacaoPais`
    - `localPrestacaoUf`
    - `localPrestacaoMunicipio`
    - `tomadorInscricaoMunicipal`
    - `tomadorEmail`
    - `tomadorMunicipio`
    - `tomadorUf`
    - `servicoCodigoMunicipal`
    - `servicoCodigoNacional`
    - `tributacaoTotalFederal`
    - `tributacaoTotalEstadual`
    - `tributacaoTotalMunicipal`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
  - `getBiSummary()` passou a expor:
    - `tributacaoTotal` agregado por esfera
    - `topMunicipiosPrestacao`
    - `topTomadores`
- `src/modules/empresas/empresas.service.ts`
  - `normalizeEmpresaOutput()` passou a expor `biCatalogoResumo`.
- `docs/BI_CONTRATO_MINIMO.md`
  - contrato mínimo de B.I. formalizado para backend.

Validacao executada:
- `npm test -- src/modules/empresas/empresas.service.spec.ts` -> `16/16`
- `npm test -- src/fiscal/application/emitir-nfse.service.spec.ts` -> `5/5`
- `npm test -- src/modules/fiscal/fiscal.controller.spec.ts` -> `9/9`

Delta adicional validado depois:
- `src/fiscal/application/emitir-nfse.service.ts`
  - emissao agora persiste tambem os 6 campos novos de tomador/servico como 1a classe.
- `npm test -- src/fiscal/application/emitir-nfse.service.spec.ts` -> `5/5` novamente apos essa ampliacao.

Observacao canônica:
- `localPrestacao` e `simplesSnapshot` entram como melhoria de persistencia analitica/B.I.;
- nao foram tratados como requisito fiscal obrigatorio de autorizacao no fluxo atual.

## 0. Delta critico de hoje (10/03/2026)

Fonte: `codigo local` + `execucao local`.

Correcoes tecnicas aplicadas para estabilizar build/deploy:
- `src/fiscal/domain/types/emitir-nfse.types.ts`
  - adicionado `localPrestacao?` em `EmitirNfseInput` (`pais`, `uf`, `municipio`) para compatibilizar uso no `EmitirNfseService`.
- `src/modules/empresas/empresas.service.ts`
  - ajuste de casting de `existingWithCert.toObject()` para `as unknown as Record<string, unknown>` em trechos de merge.

Resultado local:
- `npm run build` -> passando.

Observacao operacional:
- erro de build em deploy nao derruba automaticamente a versao ja em producao no Render; a release estavel anterior permanece ativa ate novo deploy valido.

## 1. Delta crítico (07/03/2026)

Diagnóstico validado em produção:
- `GET /empresas` estava devolvendo, para o prestador Burgus:
  - `cnaeFiscal: "8650003"`
  - `parametroMunicipal: []`
  - `ctnCodigo: "040101"`
  - `nbsCodigo: "1.2301.22.00"`

Impacto:
- o frontend de emissão/DANFSE passava a mostrar `04.01.01 / Medicina`, mesmo quando a tela de parâmetros municipais aparentava `Psicologia/Psicanálise`.

Conclusão canônica:
- o problema principal estava no **save do prestador**, não na renderização da emissão.

Correção aplicada:
- `src/modules/empresas/empresas.service.ts`
  - `update()` agora reconcilia `parametroMunicipal`, `ctnCodigo` e `nbsCodigo` com os defaults canônicos por CNAE quando o patch vier vazio ou incoerente.
- `src/modules/empresas/empresas.service.spec.ts`
  - novo teste cobrindo explicitamente o caso `8650003 + parametroMunicipal vazio + ctn legado 040101`.

Defaults oficiais vigentes:
- `8650003`
  - `041601 / Psicologia. / 1.2301.98.00 / Serviços de psicologia`
  - `041501 / Psicanálise. / 1.2301.13.00 / Serviços psiquiátricos`

Validação executada:
- `npm test -- src/modules/empresas/empresas.service.spec.ts`
- resultado: `15/15` testes passando

## 2. Objetivo do documento

Este arquivo resume o **estado atual** para operação, produto e integração frontend.

Para histórico detalhado (decisões, incidentes, cronologia), usar `CONTEXT.md`.

## 3. Estado atual (alto nível)

* Backend NestJS + TypeScript em Node 20.
* Provider fiscal ativo: **PlugNotas**.
* Fluxo NFSe em produção (Manaus) validado ponta a ponta:
  * emissão assíncrona
  * transição para `AUTHORIZED`
  * persistência/consulta de XML e PDF

## 4. Fluxos principais em produção

### 4.1 Emissão padrão

* Cria emissão com `idIntegracao` (idempotência).
* Salva status inicial (`PENDING`) e metadados do provider.
* Polling com backoff consulta status até estado final.
* Em `AUTHORIZED`, baixa e persiste artifacts (XML/PDF).

### 4.2 Emissão rápida

Endpoint:
* `POST /nfse/quick`

Payload mínimo:
* `cnpj`
* `cpfTomador`
* `valor`

Opcional:
* `codigoServico` (6 dígitos), com inferência por catálogo LC116.

### 4.3 Cadastro de tomadores (novo)

Endpoints:
* `POST /tomadores`
* `GET /tomadores`
* `GET /tomadores/{id}`
* `PATCH /tomadores/{id}`
* `DELETE /tomadores/{id}`

Regra de vínculo:
* tomador vinculado por `empresaCnpj` (isolamento por prestador)
* unicidade por `empresaCnpj + cpfCnpj`

Autocomplete para emissão no frontend:
* `GET /tomadores/autocomplete?empresaCnpj=&q=&limit=`
* busca por CPF/CNPJ ou nome
* `limit` default `10` e máximo `50`

## 5. Segurança e robustez já aplicadas

* `JWT_SECRET` obrigatório no boot (fail-fast).
* ValidationPipe global ativa (`whitelist` + `transform`).
* DTOs com `class-validator` nos módulos principais.
* `FiscalController` protegido por `JwtAuthGuard` e `RolesGuard`.
* Contrato global de erro padronizado: `{ code, message, correlationId }`.

## 6. Idempotência e artifacts

* Índice único parcial para idempotência por provider + chave.
* Tratamento de resposta PlugNotas com `HTTP 400` + `protocol` como aceite em processamento (`PENDING`).
* Sync manual de artifacts disponível:
  * `POST /nfse/{id}/sync-artifacts`
  * com rate limit por emissão e trilha de auditoria.

## 7. Catálogo de serviços

Fonte única:
* `servicos_lc116_v2.json` (catálogo LC116/NFS-e Nacional)

Endpoints:
* `GET /nfse/servicos/autocomplete?q=&limit=`
* `GET /nfse/servicos/{codigo}`

## 8. Certificado digital (empresa)

* Importação via `POST /empresas/certificado/import` (`.pfx`/`.p12`).
* Certificado vinculado por CNPJ.
* Senha protegida com AES-256-GCM.
* Cadastro de empresa nova/incompleta exige certificado prévio (`CERTIFICADO_REQUIRED`).

## 9. Variáveis críticas de ambiente

Obrigatórias/recomendadas:
* `JWT_SECRET`
* `MONGODB_URI`
* `PLUGNOTAS_BASE_URL`
* `PLUGNOTAS_API_KEY`
* `NFSE_CMUN_IBGE`
* `EMPRESA_CERT_ENCRYPTION_KEY` (recomendado)

Importantes para quick flow:
* `QUICK_NFSE_CODIGO_NACIONAL`
* `QUICK_NFSE_CODIGO_TRIBUTACAO`
* `QUICK_NFSE_DESCRICAO_PADRAO`
* `QUICK_NFSE_OP_SIMP_NAC` (opcional override)
* `QUICK_NFSE_REG_AP_TRIB_SN` (opcional override)
* `QUICK_NFSE_REG_ESP_TRIB` (opcional override)

## 10. Gaps conhecidos

* Pré-requisitos NFSe Nacional foram implementados em modo seguro por flag (`off|warn|enforce`), com default `off`; rollout produtivo ainda depende de ativação gradual.
* Estratégia recomendada de rollout: `off` (baseline) -> `warn` (observabilidade sem bloqueio) -> `enforce` (bloqueio por pré-requisito validado).
* Webhook com validação por token compartilhado; assinatura criptográfica ainda não implementada.

## 11. Atualizações recentes relevantes (fev/2026)

* Regressão DANFSE com rejeição `E0312` foi mitigada no backend com fallback defensivo para `servico.codigoTributacao` no provider PlugNotas.
* Ordem de fallback aplicada:
  * `input.servico.codigoTributacao`
  * `NFSE_CODIGO_TRIBUTACAO_PADRAO`
  * `QUICK_NFSE_CODIGO_TRIBUTACAO`
  * default final `"100"`
* Teste de regressão adicionado em `src/fiscal/infra/plugnotas.provider.spec.ts` para garantir que o payload siga com `codigoTributacao` mesmo quando o frontend não envia o campo.

* Cadastro de prestador passou a expor resumo de completude:
  * `statusCadastro`, `prontoParaEmitir`, `percentualCompletude`, `camposFaltantes`, `camposFaltantesEmissao`.
* Emissões foram protegidas por prontidão cadastral:
  * `POST /nfse/emitir` bloqueia com `PRESTADOR_INCOMPLETO` quando necessário.
  * `POST /nfse/quick` bloqueia com `QUICK_PRESTADOR_INCOMPLETO` quando necessário.

## 12. Referências

* Histórico completo: `CONTEXT.md`
* Detalhes de produção: `REPORT_PLUGNOTAS_PROD_2026-02-06.md`, `REPORT_PLUGNOTAS_PROD_2026-02-09.md`
* Endpoints PlugNotas: `endpoints-plug-notas.md`
* Evidência da regressão/correção: seção `ATUALIZAÇÃO (25/02/2026)` em `CONTEXT.md`

## 13. Atualização operacional (26/02/2026)

* Sincronização de branch concluída: `main` local e `origin/main` alinhados no commit `b0d68cb`.
* Ajustes de emissão/NFSe e tomadores preservados no remoto (sem perda de alterações locais).
* Bateria de validação executada:
  * `npm test` ✅ (`10 suites`, `31 testes`)
  * `npm run test:cov` ✅
  * `npm run test:e2e` ✅ (`1 suite`, `2 testes`)
  * `npm run build` ✅
* Lint executado com autofix: sem erros bloqueantes; warnings remanescentes de `@typescript-eslint` seguem como dívida técnica de tipagem.

## 14. Atualização operacional (28/02/2026)

* Endpoints de lookup para frontend disponíveis e ativos:
  * `GET /empresas/lookup/municipios?uf=XX`
  * `GET /empresas/lookup/cep/:cep`
* Hardening anti-E0625 no provider:
  * omissão de `iss.aliquota` para Simples sem retenção (`opSimpNac=3`, `regApTribSN=1`, `iss.retido=false`).
* Completude cadastral implementada no backend para cenários de cadastro em etapas/interrupção:
  * empresa pode ficar `PENDENTE` até finalizar dados;
  * emissão bloqueada até `prontoParaEmitir=true`.
* Validação executada:
  * `npm run test` ✅
  * `npm run build` ✅
  * `npm run test:e2e` ✅

## 15. Checklist MVP -> BI (operacional)

* [ ] Contrato canônico de dados definido (empresa/tomador/serviço/tributação/localização/datas).
* [ ] Origem dos dados registrada (`source` e `updatedAt` por campo crítico).
* [ ] Persistência dupla ativa (normalizado + `providerData` bruto).
* [ ] Autocomplete backend-first para CNPJ/CEP/municípios.
* [ ] Campos fiscais mínimos garantidos (`cnaeFiscal`, `ctnCodigo`, `nbsCodigo`, `regimeTributario`, `opcaoPeloSimples`).
* [ ] Histórico/snapshot cadastral habilitado para auditoria.
* [ ] Indicador de completude por empresa calculado.
* [ ] Eventos-chave instrumentados (`empresa_preview`, `empresa_updated`, `nfse_emitida`, `nfse_rejeitada`, `tomador_criado`).
* [ ] Monitoramento de qualidade de dados ativo (vazios, divergências, taxa de autocomplete).
* [ ] Compatibilidade com emissão preservada e validada continuamente.

## 16. Atualização operacional (28/02/2026) – Reforço de testes

* Cobertura de controller fiscal ampliada com spec dedicada:
  * `src/modules/fiscal/fiscal.controller.spec.ts`
  * validação de `INVALID_PAGE`, `INVALID_LIMIT`, `INVALID_STATUS` e forwarding de filtros.
* Cobertura e2e de empresas validada nesta rodada:
  * `test/empresas-cadastro-validation.e2e-spec.ts`
  * `test/empresas-authorization.e2e-spec.ts`
* Bateria de validação executada:
  * `npm test` ✅ (`11 suites`, `39 testes`)
  * `npm run test:e2e` ✅ (`3 suites`, `14 testes`)

Estado: backend estável com reforço de segurança de contrato em cadastro/autorização/listagem NFSe.

## 17. Atualização operacional (03/03/2026)

* Ciclo focado em clone visual de telas no `zera-frontend` (prestador/tomador/emissão) concluído sem alteração contratual obrigatória no backend.
* APIs de suporte usadas pelo frontend permaneceram estáveis:
  * `empresas` (cadastro/edição/listagem/preview),
  * `tomadores` (CRUD + autocomplete),
  * `nfse` (emissão normal/rápida/listagem/detalhe/artifacts).
* Compatibilidade mantida com payload de emissão contendo `numeroNfse` (quando informado pelo frontend).
* Sem regressões de contrato reportadas neste ciclo para integração frontend-backend.

## 18. Snapshot canônico (05/03/2026)

Fonte: `codigo local` + `git log` em `main` (sem alterações locais).

### 17.1 Estado vigente para operação

- Branch `main` sincronizada com `origin/main`.
- Ciclo recente consolidado (commits de 02/03 a 05/03):
  - `197a38d`: cancelamento PlugNotas + nota substituta com testes.
  - `6b27784`: persistência de `numeroNfse` na emissão e exposição na listagem.
  - `f6cb117` e `6fb4779`: persistência de `cnaesLista`, `parametroMunicipal` e `configOperacionais`.
  - `9db0989`: tomadores com campos completos para emissão e BI.
  - `2f86eb9`: expansão de campos fiscais da emissão e resumo consolidado para BI.

### 17.2 Contrato operacional backend que sustenta o front atual

- Empresas:
  - cadastro/edição com dados cadastrais, regime e parâmetros fiscais.
  - lookup/preview para autocomplete com estratégia de normalização e fallback.
- Tomadores:
  - CRUD completo + autocomplete por empresa.
- NFSe:
  - emissão normal e rápida;
  - listagem com filtros (incluindo recorte por data) e detalhamento;
  - artefatos XML/PDF locais/remotos;
  - cancelamento e consulta de cancelamento;
  - base para nota substituta já introduzida no ciclo recente.

### 17.3 Situação de qualidade técnica

- Bateria de testes reportada no ciclo:
  - unit, e2e e build executando com sucesso.
- Lint:
  - sem erros bloqueantes;
  - warnings de tipagem `any` permanecem como dívida técnica mapeada.

### 17.4 Gaps operacionais ainda abertos

- Pré-requisitos NFSe Nacional continuam por flag (rollout gradual pendente).
- Webhook com token compartilhado ativo, mas sem assinatura criptográfica.
- Cobertura global ainda baixa em módulos não críticos (auth/users/infra), apesar de evolução no fiscal.

### 17.5 Próximo passo recomendado

1. Fechar contrato canônico de dados para BI (campos obrigatórios + origem por campo).
2. Endurecer tipagem (`no-unsafe-*`) nas camadas fiscal/empresas para reduzir warnings estruturais.
3. Evoluir segurança de webhook (assinatura/HMAC) e trilha de auditoria de eventos.

### 17.6 Rastreabilidade

- Última atualização: 2026-03-05T09:30:00-04:00
- Responsável: Codex (GPT-5)
- Tipo de atualização: consolidação canônica do estado pós-ciclo de emissão/cancelamento/BI.
