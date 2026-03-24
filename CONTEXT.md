# ZERA Backend – Project Context

> Leitura rápida operacional: veja `CURRENT_STATE.md` (snapshot atual).
> Este documento (`CONTEXT.md`) permanece como histórico completo e linha do tempo.

## PREMISSA CANONICA DE OPERACAO

- o ZERA backend deve ser tratado como **sistema em producao**
- qualquer analise, review, refactor ou nova feature deve partir da premissa de:
  - usuarios reais
  - emissoes reais
  - risco real de regressao operacional/fiscal
- quando houver duvida entre "parece ambiente de teste" vs "ja esta rodando", a leitura canonica correta para este repositorio e:
  - **ja esta em PROD**
- por isso, a prioridade padrao e:
  - preservar emissao
  - preservar integracoes
  - preservar observabilidade
  - evitar regressao

Regra de interpretacao deste documento:
- melhorias em webhook, polling, cadastro, BI e UX devem ser lidas como evolucoes sobre uma base ja produtiva
- homologacao descrita aqui nao significa "produto fora de producao"; significa ajuste controlado de uma frente especifica dentro de operacao real

## ATUALIZACAO RAPIDA (2026-03-24) - WEBHOOK COM LOTE E DIAGNOSTICO POR EXTERNAL ID

Fonte: `codigo local` + `testes automatizados locais`.

Resumo executivo:
- o backend ganhou mais uma rodada conservadora de endurecimento do webhook fiscal
- payloads em array agora sao tratados corretamente
- a homologacao operacional ficou mais simples por causa de novos endpoints autenticados de diagnostico e observabilidade

O que mudou:
- `POST /webhooks/fiscal` agora aceita:
  - objeto unico
  - array com 1 item
  - array com varios itens
- quando o payload chega em lote:
  - o backend processa item a item
  - devolve `batch: true`
  - devolve `okCount`, `failedCount` e `results`
- o parser de status passou a normalizar payload em array antes de extrair `status`
- entrou `GET /nfse/webhook/diagnostico`
- entrou `GET /nfse/external/:externalId/observability`

Leitura arquitetural correta:
- webhook continua **aditivo**
- polling continua **fallback obrigatorio**
- a novidade desta rodada foi:
  - melhorar compatibilidade com payload real do provider
  - reduzir atrito de homologacao
  - permitir leitura operacional por `externalId` sem depender primeiro do `id` interno

Leitura importante sobre codigos de tributacao:
- `E0312` / `E0314` continuam documentados no repositorio como gargalo historico real
- mas a leitura correta em 24/03/2026 e:
  - isso nao deve mais ser tratado automaticamente como principal gargalo atual do projeto
  - ha evidencia root de payload aceito em `PAYLOADS_PLUGNOTAS_ACEITO_2026-02-10.md`
  - o foco backend atual esta em webhook, homologacao e observabilidade
- ressalva operacional:
  - isso nao significa que qualquer combinacao de servico/competencia/municipio esteja livre de rejeicao
  - significa apenas que o bloqueio central do momento ja nao e mais, por padrao, esse historico de fevereiro

Como homologar agora:
1. consultar `GET /nfse/webhook/diagnostico`
2. validar:
   - segredo configurado
   - header esperado
   - rota de callback
3. usar o `externalId` da emissao real
4. consultar `GET /nfse/external/:externalId/observability`
5. confirmar:
   - timeline com `WEBHOOK_RECEIVED`
   - `lastUpdateSource = webhook` quando o callback realmente aplicar update

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/webhooks.controller.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/fiscal/fiscal.controller.spec.ts`
- resultado: `30 passed, 30 total`
- `npm run build`
- build ok

## ATUALIZACAO RAPIDA (2026-03-23) - WEBHOOK COM SYNC OPORTUNISTA DE ARTEFATOS

Fonte: `codigo local` + `testes automatizados locais`.

Resumo executivo:
- o webhook fiscal recebeu mais um endurecimento conservador
- quando o callback chega com status autorizado, o backend agora tenta sincronizar XML/PDF imediatamente
- isso foi feito sem transformar o webhook em dependencia dura e sem desligar o `polling`

O que mudou:
- o parser de `externalId` do webhook ficou mais robusto para formatos aninhados:
  - `documents.protocol`
  - `documents.protocolo`
  - `documents.idIntegracao`
- a resposta do webhook ficou mais rastreavel e agora pode devolver:
  - `externalId`
  - `providerStatus`
  - `mappedStatus`
  - `artifactSync`
- quando o status mapeado e `AUTHORIZED`, o webhook tenta localizar a emissao mais recente por `externalId` e chama o sync de artefatos

Leitura arquitetural correta:
- o webhook continua **aditivo**
- o `polling` continua **fallback obrigatorio**
- falha de sync de XML/PDF **nao derruba** o processamento do webhook
- o objetivo desta rodada foi:
  - reduzir tempo para artefatos aparecerem
  - melhorar homologacao
  - aumentar rastreabilidade de callback
  - preservar resiliencia

Regra consolidada apos esta rodada:
- webhook pode antecipar status e artefatos quando producao ajudar
- `polling` segue como rede de seguranca para reconciliacao e cobertura de falhas
- ainda **nao** tratar webhook como malha principal unica ate haver evidencia real em producao

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/webhooks.controller.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts`
- resultado: `14 passed, 14 total`
- `npm run build`
- build ok

## ATUALIZACAO RAPIDA (2026-03-21) - portal nacional espelhado pela emissao e webhook ainda em homologacao

Fonte: `codigo local` + `testes automatizados locais`.

Resumo executivo:
- o cadastro de prestador passou a refletir melhor os identificadores do Portal Nacional sem transformar esses campos em regra de negocio
- o webhook continua como frente principal do backend, mas **ainda nao** virou fonte primaria unica de status

Prestador / Portal Nacional:
- `NFS-e Nº`, `DPS Nº` e `Serie DPS Nº` devem ser lidos como reflexo da ultima emissao autorizada
- a origem correta desses dados e o retorno do provider:
  - `retorno.numeroNfse`
  - `dps.numero`
  - `dps.serie`
- backend e frontend foram alinhados para parar de confiar como fonte primaria nos valores antigos salvos no cadastro da empresa

Webhook / polling:
- o webhook segue como camada aditiva e preferencial em evolucao
- `polling` continua como fallback obrigatorio neste momento
- leitura operacional correta em 2026-03-21:
  - webhook tecnicamente pronto e mais endurecido
  - homologacao operacional real ainda pendente
  - **nao** tratar webhook como malha principal unica ate haver evidencia real em producao

Regra consolidada:
- sem desligar polling antes de producao provar callback real, match por `externalId`, segredo valido e atualizacao confirmada em observabilidade

## ATUALIZACAO RAPIDA (2026-03-19) - ENDURECIMENTO CONSERVADOR DO WEBHOOK

Fonte: `codigo local` + `testes automatizados locais`.

Resumo executivo:
- foi aplicado um endurecimento de baixo risco no webhook fiscal
- objetivo:
  - melhorar observabilidade
  - evitar falso positivo silencioso
  - preservar o fluxo principal sem regressao

O que mudou:
- o handler passou a aceitar leitura robusta do header de segredo tambem quando o runtime entregar o valor em formato de array
- o service passou a distinguir:
  - webhook processado com emissao elegivel encontrada
  - webhook recebido sem emissao elegivel para atualizar
- o repositorio passou a devolver `matchedCount` e `modifiedCount` no update por `externalId`

Leitura operacional:
- nao houve mudanca de contrato do endpoint
- nao houve substituicao do polling
- nao houve mudanca de regra fiscal
- o ganho principal foi parar de tratar como "sucesso opaco" um webhook que chega mas nao encontra nada para atualizar

Validacao executada:
- `yarn test src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts`
- resultado: `9 passed, 9 total`

Complemento consolidado da mesma rodada:
- `polling` passou a registrar de forma mais fiel a origem operacional dos updates:
  - `lastPolledAt` agora fica restrito a eventos realmente originados por polling
  - erros fatais de polling agora preservam `lastUpdateSource = "polling"`
  - quando o polling nao consegue mais atualizar uma emissao por falta de match elegivel, isso passa a gerar sinal explicito de observabilidade
- `sync-artifacts` manual deixou de contaminar `lastPolledAt`, preservando a leitura correta entre:
  - polling automatico
  - webhook
  - recovery manual
- `PollNfseStatusService` passou a extrair corretamente `error.message` quando o provider devolve erro estruturado, evitando persistencia/log como `[object Object]`
- `EmitirNfseQuickService` passou a rejeitar `valor <= 0` e `NaN` antes de montar payload para emissao rapida

Leitura operacional complementar:
- esta rodada nao mudou regra fiscal
- esta rodada nao trocou contrato do endpoint de webhook
- esta rodada nao promoveu webhook a fonte unica de status
- o efeito principal foi aumentar confiabilidade de observabilidade e endurecer validacoes de entrada em pontos sensiveis de producao

## ATUALIZACAO RAPIDA (2026-03-18) - CONSOLIDADO DO DIA

Fonte: `codigo local` + `validacao local` + `evidencia operacional reportada`.

Resumo executivo:
- houve **ganho perceptivel de velocidade** apos melhoria de infraestrutura na Render
- o front tambem recebeu uma rodada relevante de:
  - organizacao visual
  - melhoria de UX da DANFSe
  - ajustes conservadores de performance
  - estabilizacao do cadastro de prestador
- em paralelo, o produto entrou na fase de **inicio de implementacao/rollout de webhooks fiscais**

Leitura consolidada de estado:
1. a resposta geral melhor do app passou a ser explicada por duas frentes:
   - infraestrutura melhor
   - front menos pesado e mais previsivel
2. o foco backend continua sendo fechar a homologacao operacional do webhook fiscal em producao
3. o foco frontend do dia foi melhorar experiencia percebida sem tocar em regra fiscal
4. a palavra de ordem da rodada foi:
   - **sem regressao**
   - **sem quebrar integracao**
   - **sem mexer no motor fiscal**

### Ajustes visuais e de UX entregues

- alinhamentos pontuais no cadastro/regime tributario
- experiencia da DANFSe reorganizada:
  - acoes rapidas na listagem
  - acoes principais no topo da tela detalhada
  - contraste/hover dos botoes melhorado
  - downloads locais movidos para a area principal do detalhe
- lista de tomadores padronizada visualmente
- rota `Gestor AI` reorganizada para mostrar carteira de tomadores com os valores das notas emitidas para cada um

### Performance do front

- lazy loading de rotas pesadas
- cache/snapshot recente para melhorar a primeira abertura do dashboard
- reducao de processamento redundante no dashboard
- limpeza de peso morto no bundle

Leitura operacional:
- ainda ha espaco para evolucao de performance comparando com apps maduros de mercado
- mas o ganho de velocidade ja e percebido sem troca de regra fiscal

### Cadastro de prestador - problemas comportamentais tratados

- `whatsapp` parou de ser remascarado no `onChange` do cadastro principal
- `localidade / uf` deixou de parsear com `trim` a cada tecla e passou a separar `cidade/uf` so no `blur`
- `email` deixou de depender de comportamento invasivo do navegador no input
- `numero` do endereco passou a ser mais restrito na digitacao
- campos `NFS-e Nº`, `DPS Nº` e `Serie DPS Nº` foram mantidos como preenchimento manual opcional para persistencia/B.I.

Regra consolidada dessa rodada:
- nao houve mudanca de payload fiscal canônico
- nao houve mudanca de regra de emissao
- nao houve mudanca de integracao backend por causa desses ajustes

### Gestor AI - regressao identificada e corrigida

- problema observado:
  - tela mostrando "Nenhuma nota fiscal emitida ainda"
- causa mais provavel:
  - filtro tecnico excessivamente rigido no hook compartilhado do dashboard
- correcao aplicada:
  - preferir itens `PLUGNOTAS`
  - mas fazer fallback para lista completa quando esse recorte zerar tudo

Leitura de negocio:
- o `Gestor AI` nao pode sacrificar leitura operacional so para ganhar performance
- a prioridade correta ali e preservar a visao por tomador sem perder notas legadas

### Webhook fiscal

- o webhook segue como frente mais relevante do backend para reduzir dependencia do polling
- quadro consolidado:
  - infra melhor
  - webhook iniciado e tecnicamente pronto na base atual
  - validacao operacional ainda pendente

## ATUALIZACAO RAPIDA (2026-03-17) - STATUS DE ROLLOUT WEBHOOK

Fonte: `codigo local` + `docs operacionais`.

Resumo executivo:
- etapa atual estimada: **~85% concluida**
- implementacao tecnica do webhook: **pronta e testada**
- pendencia para fechar producao: **homologacao operacional + ajuste final de polling**

O que ja esta pronto:
- endpoint `POST /webhooks/fiscal` ativo
- parser de `externalId` e status cobrindo formatos nested
- atualizacao de emissao por webhook
- observabilidade distinguindo origem (`webhook` vs `polling`)
- testes automatizados de controller/handler/service

O que falta para concluir rollout de producao:
1. confirmar configuracao de callback do provedor para `/webhooks/fiscal`
2. validar segredo compartilhado em runtime (`WEBHOOK_SHARED_SECRET` + header)
3. homologar com payload real/representativo da PlugNotas em ambiente produtivo
4. confirmar em `GET /nfse/:id/observability`:
   - evento `WEBHOOK_RECEIVED`
   - `observability.webhook.lastUpdateSource = "webhook"`
5. ajustar polling final:
   - manter curto (`60000`) enquanto valida webhook
   - depois calibrar para reduzir dependencia sem perder fallback

## ATUALIZACAO RAPIDA (2026-03-17)

Fonte: `codigo local` + `execucao local`.

### Webhook vs polling agora ficam distinguiveis

- Foi aplicado um endurecimento minimo de observabilidade para parar a ambiguidade entre:
  - atualizacao de status por webhook
  - atualizacao de status por polling

Arquivos:
- `src/fiscal/infra/mongo/schemas/nfse-emission.schema.ts`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
- `src/fiscal/application/poll-nfse-status.service.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/fiscal/fiscal.controller.ts`

Campos novos na emissao:
- `lastWebhookAt`
- `lastUpdateSource`

Semantica:
- webhook:
  - `lastWebhookAt = now`
  - `lastUpdateSource = "webhook"`
- polling:
  - `lastUpdateSource = "polling"`

Observability:
- `GET /nfse/:id/observability` agora retorna tambem:
  - `observability.webhook.lastWebhookAt`
  - `observability.webhook.lastUpdateSource`
- timeline agora pode incluir:
  - `WEBHOOK_RECEIVED`

Validacao executada:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/fiscal/fiscal.controller.spec.ts src/fiscal/application/emitir-nfse.service.spec.ts`
- resultado: `19/19` testes

### Webhook fiscal: auditoria e cobertura minima fechadas

- O backend ja possuia modulo de webhook fiscal ativo:
  - `POST /webhooks/fiscal`
- A rodada de hoje nao mudou o fluxo principal de emissao.
- O objetivo foi endurecer confianca do modulo existente.

Arquivos auditados:
- `src/modules/webhooks/webhooks.controller.ts`
- `src/modules/webhooks/handlers/webhook.handler.ts`
- `src/modules/webhooks/webhooks.service.ts`

Comportamento confirmado:
- valida segredo compartilhado por header quando configurado
- aceita payload bruto do provider
- extrai `externalId` de diferentes formatos do payload
- converte status PlugNotas para status de dominio
- atualiza emissao por `externalId`
- mantem polling como fallback; webhook nao substitui a malha atual

Cobertura adicionada:
- `src/modules/webhooks/webhooks.controller.spec.ts`
- `src/modules/webhooks/handlers/webhook.handler.spec.ts`
- `src/modules/webhooks/webhooks.service.spec.ts`

Validacao executada em conjunto com emissao:
- `npm test -- src/modules/webhooks/webhooks.service.spec.ts src/modules/webhooks/handlers/webhook.handler.spec.ts src/modules/webhooks/webhooks.controller.spec.ts src/fiscal/application/emitir-nfse.service.spec.ts`
- resultado: `13/13` testes

Leitura operacional:
- vale ativar webhook como fonte primaria de status **somente** mantendo polling ligado;
- a base existente ja esta boa para um `webhook v1` conservador;
- ainda e recomendado homologar com payload real/representativo da PlugNotas antes de depender dele em producao.

## ATUALIZACAO RAPIDA (2026-03-16)

Fonte: `codigo local` + `execucao local`.

### Prontidao analitica do prestador (B.I.)

- `EmpresasService.normalizeEmpresaOutput()` agora expõe tambem:
  - `prontoParaBi`
  - `percentualCompletudeBi`
  - `camposFaltantesBi`
- Objetivo:
  - separar explicitamente:
    - `statusCadastro` / `prontoParaEmitir`
    - completude analitica para B.I.

Campos base considerados em `camposFaltantesBi`:
- identificacao:
  - `cnpj`, `razaoSocial`, `nomeFantasia`
- inscricoes/contato:
  - `inscricaoMunicipal`, `email`, `whatsapp`
- endereco:
  - `endereco.logradouro`, `endereco.numero`, `endereco.bairro`, `endereco.cidade`, `endereco.uf`, `endereco.cep`
- tributario:
  - `regimeTributario`, `cnaeFiscal`, `cnaeFiscalDescricao`, `ctnCodigo`, `nbsCodigo`
- catalogo:
  - `parametroMunicipal`, `cnaesLista`, `configOperacionais`
- operacional:
  - `certificado.uploadedAt`

Campos condicionais quando `regimeTributario = simples_nacional`:
- `rbt12`
- `aliquotaSimplesNacional`
- `apuracaoSimplesNacional`
- `simplesSnapshot`

Validacao executada:
- `npm test -- src/modules/empresas/empresas.service.spec.ts` -> `19/19`

## ATUALIZACAO RAPIDA (2026-03-14)

Fonte: `codigo local` + `execucao local` + validacao em producao.

### Observabilidade adicionada para NFSe

- Endpoint novo:
  - `GET /nfse/:id/observability`
- Objetivo:
  - diagnosticar emissao ponta a ponta sem depender de dashboard.
- Dados retornados:
  - `payload`, `biSnapshot`, `providerRequest`, `providerResponse`
  - estado de polling (`attempts`, `lastPolledAt`, `nextPollAt`, `lastPollError`)
  - `artifactSyncAudit`
  - `timeline` de eventos

Arquivos:
- `src/modules/fiscal/fiscal.controller.ts`
- `src/modules/fiscal/fiscal.controller.spec.ts`

### Contrato canônico anti-regressão (golden payload)

- Fixture canônica criada:
  - `src/fiscal/test-fixtures/emitir-nfse.golden.ts`
- Testes que passaram a depender do contrato:
  - `src/fiscal/application/emitir-nfse.service.spec.ts`
  - `src/fiscal/infra/plugnotas.provider.spec.ts`

### Limpeza de artefatos legados

- JSONs manuais/temporários removidos da raiz (`emitir*.json`, `empresa*.json`, `nfse*.json`, `token.json`) para reduzir ruído operacional.

### Evidência operacional importante (produção)

- Erro real de emissão confirmado em `provider-response`:
  - `PLUGNOTAS_API_KEY not set`
- Conclusão canônica:
  - quando este erro aparece, a requisição caiu em backend/instância sem env válida de PlugNotas.

### Performance de status

- Comportamento observado de atraso (~5 min) compatível com polling atual:
  - `NFSE_POLLING_INTERVAL_MS=300000`
- Mitigação imediata recomendada:
  - `NFSE_POLLING_INTERVAL_MS=60000` até entrada de webhook produtivo.

## ATUALIZACAO RAPIDA (2026-03-11)

Fonte: `codigo local` + `execucao local`.

### Base analítica reforçada sem alterar fluxo fiscal principal

Arquivos principais:
- `src/modules/empresas/schemas/empresa.schema.ts`
- `src/modules/empresas/empresas.service.ts`
- `src/fiscal/infra/mongo/schemas/nfse-emission.schema.ts`
- `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
- `src/fiscal/application/emitir-nfse.service.ts`
- `docs/BI_CONTRATO_MINIMO.md`

Melhorias canônicas desta rodada:
- `Empresa` passou a persistir `simplesSnapshot`.
- `normalizeEmpresaOutput()` passou a expor `biCatalogoResumo`.
- `NfseEmission` passou a persistir, como campos de 1a classe:
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
- `getBiSummary()` passou a expor:
  - `tributacaoTotal`
  - `topMunicipiosPrestacao`
  - `topTomadores`

Regra operacional consolidada:
- `Emissão` continua sendo o subconjunto mínimo para autorização da nota.
- `B.I.` passa a consumir uma camada mais ampla e canônica de persistência.
- `tributacaoTotal*` só deve ser tratada como analítica confiável quando a origem fiscal estiver validada; o backend apenas persiste o que receber de forma explícita.

Validações executadas nesta frente:
- `npm test -- src/modules/empresas/empresas.service.spec.ts`
- `npm test -- src/fiscal/application/emitir-nfse.service.spec.ts`
- `npm test -- src/modules/fiscal/fiscal.controller.spec.ts`

## ATUALIZACAO RAPIDA (2026-03-07)

Fonte: `codigo local` + `execucao local` + `validacao funcional em producao`.

### Correcao canonica do fluxo Prestador -> Emissao

Diagnostico validado em producao:
- `GET /empresas` estava retornando, para o prestador Burgus:
  - `cnaeFiscal: "8650003"`
  - `parametroMunicipal: []`
  - `ctnCodigo: "040101"`
  - `nbsCodigo: "1.2301.22.00"`
- Efeito observado no frontend:
  - DANFSE/emissao preenchia `04.01.01` e `Medicina`, apesar da tela de `Parâmetros Municipais` aparentar `Psicologia/Psicanálise`.

Conclusao canonica:
- o problema principal nao era renderizacao da emissao;
- o problema estava no **save do prestador**, que persistia `ctnCodigo/nbsCodigo` legados e deixava `parametroMunicipal` vazio.

### Ajuste aplicado no backend

Arquivos:
- `src/modules/empresas/empresas.service.ts`
- `src/modules/empresas/empresas.service.spec.ts`

Regra nova:
- `EmpresasService.update()` agora reconcilia os parametros municipais canonicos antes de persistir.
- Para CNAEs com defaults oficiais (atualmente `8650003`), se o patch vier vazio/incoerente:
  - reconstrói `parametroMunicipal`
  - alinha `ctnCodigo`
  - alinha `nbsCodigo`

Defaults oficiais atuais:
- `8650003`:
  - `041601 / Psicologia. / 1.2301.98.00 / Serviços de psicologia`
  - `041501 / Psicanálise. / 1.2301.13.00 / Serviços psiquiátricos`

### Teste executado

- `npm test -- src/modules/empresas/empresas.service.spec.ts`
- resultado: `15/15` passando

### Estado esperado apos deploy

Depois de salvar `Prestador > Parâmetros Fiscais`, a API deve devolver:
- `parametroMunicipal` preenchido
- `ctnCodigo = "041601"`
- `nbsCodigo = "1.2301.98.00"`

Se DANFSE continuar mostrando `04.01.01`, a verificacao correta e sempre:
1. inspecionar `GET /empresas`
2. confirmar se o retorno da API ja esta canonico
3. so depois investigar frontend

## ATUALIZACAO RAPIDA (2026-03-05)

Fonte: `codigo local` + `execucao local` + validacao funcional reportada em producao.

- CNPJA continua como fonte primaria do autocomplete de CNPJ no backend (`EmpresasService.fetchProviderData`).
- Foi aplicado ajuste no cliente CNPJA para autenticacao resiliente:
  - `CNPJA_AUTH_SCHEME=auto` (tenta `raw`; em `401`, tenta `bearer`).
  - arquivo: `src/modules/empresas/cnpja-cnpj.api.ts`.
- `.env.example` atualizado para documentar `CNPJA_AUTH_SCHEME=auto`.
- Teste local executado e passando para fluxo de empresas:
  - `npm test -- src/modules/empresas/empresas.service.spec.ts` (12/12).

Diagnostico operacional importante (producao):
- Se resposta de `/empresas/preview` vem com `fonteConsulta: "receitaws"`, a instancia em runtime ainda esta em fallback.
- Com `CNPJA_STRICT_PRIMARY=true`, fallback deve ser bloqueado; em falha de CNPJA deve retornar erro `CNPJA_PRIMARY_FAILED`.
- Se mesmo assim retorna `receitaws`, revisar:
  1. servico/URL de backend correto no Render,
  2. variaveis aplicadas no servico correto (`CNPJA_API_KEY`, `CNPJA_AUTH_SCHEME=auto`, `CNPJA_STRICT_PRIMARY=true`),
  3. deploy efetivamente realizado apos salvar envs.

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

---

## ATUALIZAÇÃO OPERACIONAL (PROD) – 2026-02-21

### Problema atual (cadastro de empresas)
- O frontend consegue chamar `POST /empresas/preview`, mas alguns campos ainda chegam vazios para autopreenchimento em produção.
- Campos reportados como pendentes no preenchimento:
  - `dataSituacaoCadastral`
  - `dataInicioAtividade`
  - `cnaeFiscal`
  - `cnaeFiscalDescricao`
  - `porte`
  - `regimeTributario` (marcação da opção/“bolinha” no front)
  - `aliquotaSimplesNacional`
  - `apuracaoSimplesNacional`

### Contrato esperado para `POST /empresas/preview`
- Resposta deve priorizar contrato normalizado para o frontend:
  - `cnpj`, `razaoSocial`, `nomeFantasia`, `inscricaoMunicipal`
  - `situacaoCadastral`, `dataSituacaoCadastral`, `dataInicioAtividade`
  - `cnaeFiscal`, `cnaeFiscalDescricao`, `porte`
  - `opcaoPeloSimples`, `opcaoPeloMei`
  - `regimeTributario`, `aliquotaSimplesNacional`, `apuracaoSimplesNacional`
  - `endereco` normalizado
- `providerData` pode ser mantido para auditoria/fallback, mas o front não deve depender dele para campos essenciais.

### Regra de derivação mínima recomendada (backend)
- Quando `opcaoPeloSimples=true` e `regimeTributario` vier ausente do provedor, retornar `regimeTributario="simples_nacional"`.
- Para CNAE descrição, usar fallback de `atividade_principal[0].descricao` quando `cnaeFiscalDescricao` não vier explícito.
- Datas devem sair em formato consistente (`YYYY-MM-DD` ou ISO) para evitar perda no input `type="date"` do front.

### Checklist backend (produção)
1. Validar payload real de `POST /empresas/preview` para um CNPJ conhecido.
2. Confirmar quais campos vêm do provedor e quais precisam ser derivados/mapeados.
3. Garantir resposta normalizada com os campos acima.
4. Revalidar fluxo no frontend (`/empresas/nova`) sem fallback manual.

### Resumo dos commits recentes (backend)
- `a79c9f1` `fix(empresas): amplia mapeamento de preview e parse de datas cadastrais`
- `b06a096` `fix(empresas): fallback de consulta CNPJ (BrasilAPI -> PlugNotas) no preview`
- `4a63c91` `fix(auth): evita 500 no login para hash inválido`
- `20b544d` `feat(empresas): usar BrasilAPI no preview/cadastro por CNPJ`
- `f1f4e88` `fix(empresas): normaliza busca/autocomplete com suporte a campos legados no backend`

Observação:
- O problema atual não é mais indisponibilidade do endpoint; é completude/normalização de campos específicos no preview para autopreenchimento total do cadastro.
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

---

## HANDOVER 2026-03-02

### 1. Ajustes aplicados no backend hoje
- Empresas/Cadastro:
  - Correção para persistir campos fiscais que estavam sendo descartados pela validação com `whitelist: true`:
    - `regimeTributario`
    - `aliquotaSimplesNacional`
    - `apuracaoSimplesNacional`
    - `ctnCodigo`
    - `nbsCodigo`
  - Arquivos afetados:
    - `src/modules/empresas/dtos/create-empresa.dto.ts`
    - `src/modules/empresas/dtos/update-empresa.dto.ts`
    - `src/modules/empresas/schemas/empresa.schema.ts`
- Consulta CNPJ:
  - Estratégia operacional definida como `CNPJA primária + fallback automático`.
  - Ordem atual efetiva no serviço:
    1. CNPJA
    2. BrasilAPI + ReceitaWS (merge)
    3. BrasilAPI
    4. ReceitaWS
    5. PlugNotas
  - Mensagem de erro consolidada para cenário de indisponibilidade geral.

### 2. Esclarecimentos funcionais confirmados
- Campos `dps` (ex.: `dps.numero`, `dps.serie`, `dps.id`) não são enviados no payload inicial.
- Esses dados só ficam disponíveis após processamento do provider (resposta assíncrona/webhook/polling), via `providerResponse`.

### 3. Estado atual para retomada
- Objetivo de negócio mantido:
  - cadastro do prestador deve abrir com dados existentes;
  - completar pendências fiscais no banco para sair de `PENDENTE`.
- Após deploy backend, é necessário salvar novamente o prestador para recalcular completude com os campos fiscais persistidos.

### 4. Próximos passos recomendados
1. Deploy das mudanças de DTO/schema/serviço de empresas.
2. Revalidar cadastro do prestador em produção:
   - confirmar remoção de pendências `apuracaoSimplesNacional` e `aliquotaSimplesNacional` quando preenchidas.
3. Opcional: adicionar testes específicos de persistência desses campos no módulo `empresas`.
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

---

# ATUALIZAÇÃO (25/02/2026) – Regressão DANFSE com `E0312` e correção de payload

## 1) Incidente observado

Durante emissão via formulário DANFSE (frontend), houve rejeições com:
* `Codigo: E0312`
* `Descricao: cTribNac não administrado pelo município na competência`

Mesmo com código já validado anteriormente (`060101`).

## 2) Causa raiz encontrada

Comparando payload rejeitado atual com payloads históricos aceitos, foi identificado:
* o fluxo DANFSE estava enviando `servico.codigo` sem `servico.codigoTributacao`.

Referências locais usadas na análise:
* `PAYLOADS_PLUGNOTAS_ACEITO_2026-02-10.md`
* `evidencias-suporte/plugnotas-provider-request-2026-02-10.json`

## 3) Correção aplicada (backend)

No provider PlugNotas (`src/fiscal/infra/plugnotas.provider.ts`):
* adicionado fallback defensivo para `codigoTributacao`:
  1. `input.servico.codigoTributacao`
  2. `NFSE_CODIGO_TRIBUTACAO_PADRAO`
  3. `QUICK_NFSE_CODIGO_TRIBUTACAO`
  4. default final: `"100"`

Com isso, emissões não dependem exclusivamente do frontend para preencher o campo.

## 4) Teste de regressão adicionado

Arquivo:
* `src/fiscal/infra/plugnotas.provider.spec.ts`

Cobertura nova:
* valida que, sem `input.servico.codigoTributacao`, o payload enviado ao provider recebe `codigoTributacao = "100"` (ou valor configurado).

## 5) Validação técnica executada

Executado em Node 20:
* `yarn build` ✅
* `yarn test --runInBand src/fiscal/infra/plugnotas.provider.spec.ts` ✅

---

# ATUALIZAÇÃO (26/02/2026) – Sincronização com remoto e validação completa

## 1) Estado de sincronização

Após sincronização local/remoto, o backend ficou alinhado em:
* branch: `main`
* commit: `b0d68cb` (`feat/fix: ajustes NFSe e tomadores`)
* status: `main...origin/main` (sem divergência)

## 2) Confirmação do conteúdo funcional

As mudanças locais relevantes de emissão (ajustes em NFSe e tomadores) foram preservadas e publicadas no mesmo commit `b0d68cb`, incluindo:
* `src/fiscal/application/emitir-nfse.service.ts`
* `src/fiscal/infra/mongo/repositories/nfse-emission.repository.ts`
* `src/modules/fiscal/dtos/emitir-nfse.dto.ts`
* `src/modules/tomadores/tomadores.service.ts`

## 3) Validação técnica executada (backend)

Executado em Node 20:
* `npm test` ✅ (`10 suites`, `31 testes`)
* `npm run test:cov` ✅
* `npm run test:e2e` ✅ (`1 suite`, `2 testes`)
* `npm run build` ✅

Observação operacional:
* `npm run lint` foi executado com `--fix`; o backend ficou sem erros bloqueantes de lint (restaram warnings de tipagem estrita/variáveis não usadas).

---

# CHECKLIST (MVP -> BI) – Verificação operacional

## Objetivo
Garantir estabilidade do MVP de emissão enquanto o produto passa a capturar dados reais e úteis para BI.

## Itens

* [ ] Contrato canônico de dados definido para `empresa`, `tomador`, `servico`, `tributacao`, `localizacao` e `datas`.
* [ ] Origem de campos críticos registrada (`source` + `updatedAt`).
* [ ] Persistência dupla ativa: dados normalizados + `providerData` bruto.
* [ ] Autocomplete backend-first (CNPJ/CEP/municípios sem dependência direta no frontend).
* [ ] Campos fiscais mínimos preenchidos (`cnaeFiscal`, `ctnCodigo`, `nbsCodigo`, `regimeTributario`, `opcaoPeloSimples`).
* [ ] Estratégia de histórico/snapshot cadastral definida.
* [ ] Indicador de completude cadastral por empresa implementado.
* [ ] Eventos-chave instrumentados (`empresa_preview`, `empresa_updated`, `nfse_emitida`, `nfse_rejeitada`, `tomador_criado`).
* [ ] Monitoramento de qualidade de dados ativo (campos vazios, divergências entre fontes, taxa de sucesso do autocomplete).
* [ ] Compatibilidade com emissão preservada em testes e validação operacional.

## Critério de saída

* [ ] Zero regressões no fluxo de emissão em produção.
* [ ] Dados essenciais para BI coletados em >80% das empresas ativas.
* [ ] Rastreabilidade rápida de origem/confiabilidade dos campos principais.

---

# ATUALIZAÇÃO (28/02/2026) – Contrato Front/Backend e correções PROD

## 1) Endpoints de lookup adicionados em `empresas`

Foram adicionados endpoints consumidos pelo frontend para autocomplete e preenchimento:

* `GET /empresas/lookup/municipios?uf=XX`
* `GET /empresas/lookup/cep/:cep`

Detalhe técnico:
* municípios consultados via IBGE (`servicodados.ibge.gov.br`)
* CEP consultado via ViaCEP (`viacep.com.br`)
* timeout externo configurável por `EXTERNAL_LOOKUP_TIMEOUT_MS` (default `8000ms`)
* erros retornam contrato padronizado (`code/message/details`)

## 2) Hardening de payload contra rejeição E0625

No provider PlugNotas, para cenário de Simples Nacional sem retenção:
* se `opSimpNac=3`, `regApTribSN=1` e `iss.retido=false`,
* o backend passa a **omitir `iss.aliquota`** no payload enviado ao provider.

Objetivo:
* evitar rejeição fiscal `E0625` ("não é permitido informar alíquota quando não há retenção...").

Cobertura de teste:
* novo teste unitário em `src/fiscal/infra/plugnotas.provider.spec.ts` validando omissão de alíquota nesse cenário.

## 3) Validação executada em 28/02/2026

Executado localmente após as mudanças:
* `npm run test` -> **10 suites / 32 testes passando**
* `npm run test:e2e` -> **1 suite / 2 testes passando**
* `npm run build` -> **ok**
* `npm run lint` -> sem erros bloqueantes (warnings existentes de tipagem estrita)

Conclusão operacional:
* backend apto para consumo do frontend em produção nos fluxos de:
  * autocomplete de municípios/CEP
  * emissão NFSe com proteção contra E0625

---

# ATUALIZAÇÃO (28/02/2026) – Cadastro de prestador em etapas + bloqueio seguro de emissão

## 1) Problema atacado

Com o frontend dividido em múltiplas seções de cadastro do prestador, havia risco operacional de:
* salvar apenas parte dos dados (queda de energia/internet/interrupção de sessão);
* tentar emitir NFSe com cadastro incompleto.

## 2) Mudanças no backend

### 2.1 Resumo de completude no cadastro de empresa

A resposta normalizada de empresa passou a incluir:
* `statusCadastro`: `PENDENTE | COMPLETO`
* `prontoParaEmitir`: `boolean`
* `percentualCompletude`: `number`
* `camposFaltantes`: `string[]`
* `camposFaltantesEmissao`: `string[]`

Esse resumo é calculado no backend e reflete pendências cadastrais e pendências mínimas para emissão.

### 2.2 Bloqueio de emissão quando prestador está incompleto

Fluxos protegidos:
* `POST /nfse/emitir` -> retorna `PRESTADOR_INCOMPLETO` quando `prontoParaEmitir=false`
* `POST /nfse/quick` -> retorna `QUICK_PRESTADOR_INCOMPLETO` quando `prontoParaEmitir=false`

Payload de erro inclui `details` com:
* `statusCadastro`
* `percentualCompletude`
* `camposFaltantes`
* `camposFaltantesEmissao`

Objetivo:
* impedir emissão “quebrada” por cadastro parcial.

## 3) Resultado operacional esperado

Mesmo com interrupções durante cadastro:
* dados já salvos permanecem;
* empresa fica marcada como `PENDENTE` enquanto faltar informação;
* emissão só libera quando requisitos mínimos forem concluídos.

## 4) Validação técnica executada (28/02/2026)

* `npm run test` ✅
* `npm run build` ✅
* `npm run test:e2e` ✅

# ATUALIZAÇÃO (28/02/2026) – Cobertura de testes (perfil tester)

## 1) Escopo desta rodada

Objetivo operacional desta rodada:
* ampliar cobertura de testes para validações de cadastro e autorização;
* validar regras de query/paginação/status em `GET /nfse`;
* executar bateria completa local (unit + e2e + build já validado na rodada anterior).

## 2) Novas coberturas adicionadas

Arquivos de teste adicionados/validados:
* `src/modules/fiscal/fiscal.controller.spec.ts`
* `test/empresas-cadastro-validation.e2e-spec.ts`
* `test/empresas-authorization.e2e-spec.ts`

Cobertura técnica destacada:
* `FiscalController.list` com validação explícita de:
  * `INVALID_PAGE`
  * `INVALID_LIMIT`
  * `INVALID_STATUS`
* repasse correto de filtros para repositório (`page`, `limit`, `provider`, `status`)
* shape de retorno de listagem (`items` + `meta`)
* validação de autorização por perfil em rotas de empresas (`admin/manager/user`)
* validações de payload de cadastro de empresas em cenários inválidos e válidos

## 3) Validação executada em 28/02/2026

Executado localmente:
* `npm test` -> **11 suites / 39 testes passando**
* `npm run test:e2e` -> **3 suites / 14 testes passando**

Observação operacional:
* a suíte e2e depende de bind de porta local; em ambiente restrito pode exigir execução com permissão ampliada.

## 4) Resultado

Conclusão:
* backend validado com cobertura ampliada para cenários críticos de cadastro, autorização e listagem fiscal.
* sem regressão observada nas suítes executadas nesta rodada.

---

# ATUALIZACAO (06/03/2026) - Certificado digital: diagnostico e remocao segura

## 1) Problema operacional atacado

Em ambiente de producao foi identificado risco de certificado residual/incorreto associado a prestador, com impacto potencial em emissao.
Necessidade: identificar rapidamente qual certificado esta no banco e qual identificador aparece na ultima emissao ao provedor.

## 2) Mudancas implementadas em `empresas`

Novos endpoints:

* `DELETE /empresas/:id/certificado`
  - remove certificado digital por `id` da empresa.
* `DELETE /empresas/cnpj/:cnpj/certificado`
  - remove certificado digital por `cnpj`.
* `GET /empresas/cnpj/:cnpj/certificado/diagnostico`
  - retorna diagnostico combinado:
    - metadados do certificado no banco (`filename`, `uploadedAt`, `sha256`, `size`, flags de segredo presente);
    - dados da ultima emissao da empresa;
    - `providerCertificadoId` observado no retorno do provedor (quando disponivel);
    - CNPJ do prestador enviado no `providerRequest`.

## 3) Estrategia tecnica

* `EmpresasModule` passou a carregar `NfseEmission` schema para cruzar empresa x ultima emissao.
* `EmpresasService` ganhou funcoes:
  - `removeCertificadoById`
  - `removeCertificadoByCnpj`
  - `diagnosticarCertificadoByCnpj`
* Remocao limpa campos legado e atual:
  - `certificado`
  - `certificado_digital`
  - `certificadoDigital`

## 4) Validacao executada

* `npm run build` -> ok
* `npm test -- --runInBand src/modules/empresas/empresas.service.spec.ts` -> passando

## 5) Resultado operacional esperado

Com os endpoints acima, operacao consegue:

1. diagnosticar rapidamente se o certificado em uso confere com o esperado da empresa;
2. remover certificado incorreto sem intervencao manual em banco;
3. reimportar o certificado correto e revalidar antes da proxima emissao.
