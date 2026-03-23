# ZERA Backend – Current State

Snapshot operacional do backend em **23/03/2026** (ultima atualizacao consolidada).

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
