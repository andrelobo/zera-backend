# ZERA Backend – Current State

Snapshot operacional do backend em **10/03/2026** (ultima atualizacao consolidada).

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
