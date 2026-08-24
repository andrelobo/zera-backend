# Backend da plataforma (`zera-backend`)

Backend da plataforma fiscal ainda mantido no repositório histórico `zera-backend`.
O sistema opera em produção, atende múltiplas empresas prestadoras e tem o
**LOBONOTAS** como motor fiscal próprio para a NFS-e Padrão Nacional.

Emissão e gestão de NFS-e formam o núcleo operacional do produto, mas não o
resumem. A plataforma também cobre onboarding fiscal, tomadores, observabilidade,
B.I., relatórios e diagnóstico operacional assistido.

## Estado canônico

Política vigente desde **05/08/2026**:

- provider operacional ativo e exclusivo: **LOBONOTAS (SEFIN Nacional)**;
- PlugNotas está permanentemente **`LEGACY_DISABLED`**;
- PlugNotas nunca é fallback de emissão, reemissão, cancelamento, sincronização
  ou download remoto;
- código, parsers, testes, registros e artefatos PlugNotas antigos permanecem
  preservados somente para compatibilidade histórica e auditoria;
- registros MongoDB de emissões PlugNotas não devem ser alterados ou removidos.

O LOBONOTAS já concluiu em produção o ciclo de construção e assinatura da DPS,
transmissão mTLS, autorização no Ambiente Nacional e obtenção de XML e DANFSe. A
NFS-e 48 foi autorizada em **04/08/2026**, e seus artefatos foram validados nas
camadas backend direto, proxy Vercel e domínio público. A validação visual do fluxo
de download no frontend depende do deploy registrado no `CURRENT_STATE.md` do front.

Este é um sistema fiscal em produção. Toda mudança deve preservar integridade
fiscal, idempotência, rastreabilidade e continuidade operacional.

## O produto

A plataforma é um SaaS de operação inteligente para empresas e contabilidades.
Seus eixos atuais são:

- operação multi-prestador, com dados e certificado isolados por empresa;
- emissão normal e rápida de NFS-e;
- motor fiscal próprio integrado diretamente ao Ambiente Nacional;
- gestão de empresas, tomadores, usuários e convites;
- reconciliação por webhook e polling;
- XML, DANFSe, cancelamento e trilha de observabilidade;
- contrato analítico para dashboards, B.I. e inteligência tributária;
- diagnóstico operacional read-only, sem delegar decisões fiscais à IA.

A regra arquitetural é: **IA interpreta e explica; o motor determinístico continua
sendo a fonte da verdade fiscal**.

## Naming em avaliação

**JUPATI** é o candidato principal para a marca comercial, com a assinatura
proposta **"Jupati — sua operação, bem conectada."**. O nome representa os elementos
conectados da plataforma: empresas, pessoas, clientes, serviços, documentos, dados,
inteligência, automações e operação fiscal.

O naming ainda **não está congelado**. Antes da migração de marca, permanecem
pendentes a busca formal de marcas semelhantes no INPI — especialmente nas classes
9, 35 e 42 — e a verificação de domínios, redes sociais e variações relevantes.

Arquitetura de marca proposta:

| Camada | Nome |
|---|---|
| Plataforma comercial | **JUPATI** — candidato principal, pendente de validação |
| Motor fiscal próprio | **LOBONOTAS** |
| Empresa responsável | **Muirakitan Tecnologia** |
| Provider histórico | **PlugNotas — `LEGACY_DISABLED`** |

O candidato anterior **MMIT/EMMIT/EMIT está descartado**: restringe a percepção do
produto ao ato de emitir e apresenta colisão mercadológica no setor fiscal. Ele não
deve ser usado em novos textos, interfaces ou artefatos de marca.

Decisão e critérios completos: [`../documentacao/md/05-naming-jupati.md`](../documentacao/md/05-naming-jupati.md).

## Arquitetura

```text
zera-frontend2 (React/Vite, Vercel)
        |
        | HTTPS / proxy /api
        v
zera-backend (NestJS, Oracle VPS, Docker)
        |
        +-- MongoDB Atlas
        |
        +-- LOBONOTAS
              |
              | mTLS + certificado A1 do prestador
              v
        SEFIN / Ambiente Nacional da NFS-e
```

O frontend usa o backend como fachada para os serviços externos. O backend
normaliza os contratos, aplica as regras determinísticas, persiste a trilha fiscal e
orquestra o LOBONOTAS.

### Ciclo fiscal LOBONOTAS

1. O backend valida o prestador e reserva a numeração da DPS de forma atômica.
2. O LOBONOTAS constrói a DPS 1.01 e a assina com o certificado A1.
3. A DPS segue para a SEFIN por mTLS, em envelope GZip + Base64.
4. Webhook ou polling reconcilia o documento até o estado final.
5. O XML oficial é persistido e o DANFSe v2.0 é gerado localmente.
6. Timeout após transmissão exige reconciliação; nunca reenvio cego.

## Capacidades implementadas

### Fiscal

- emissão normal (`POST /nfse/emitir`) e rápida (`POST /nfse/quick`);
- reemissão fail-closed apenas quando não há evidência de transmissão;
- idempotência, status, webhook, polling e reconciliação pós-timeout;
- cancelamento por evento do Ambiente Nacional;
- substituição e preservação do vínculo com o documento anterior;
- sincronização e regeneração de XML/DANFSe;
- catálogo LC116 e autocomplete de serviços;
- contrato canônico neutro de provider.

### Operação multiempresa

- cadastro e completude fiscal de prestadores;
- certificado A1 por empresa, cifrado em repouso;
- tomadores isolados por `empresaCnpj`;
- lookup de CNPJ, CPF, CEP, municípios e CNAE;
- perfis `admin`, `manager`, `user` e `readonly`;
- onboarding por convite com expiração.

### Observabilidade, B.I. e IA

- timeline de emissão, origem da atualização e auditoria de artefatos;
- resumo analítico de faturamento, ISS, retenções, tomadores e localidades;
- snapshots do Simples Nacional e indicadores de completude para B.I.;
- diagnóstico determinístico e read-only de emissões em
  `POST /ai/diagnostics/emission`;
- nenhuma heurística de IA altera emissão ou substitui regra contábil/fiscal.

## Stack

- Node.js 20.x
- NestJS e TypeScript
- MongoDB Atlas e Mongoose
- Jest
- Docker e Docker Compose
- GitHub Actions
- Oracle VPS

## Desenvolvimento local

### Pré-requisitos

- Node.js 20.x
- npm
- MongoDB acessível

### Configuração

```bash
cp .env.example .env
npm install
```

Preencha o `.env` com valores locais ou segredos fornecidos pelo ambiente. Nunca
grave credenciais reais em documentação, exemplos, fixtures ou commits.

Variáveis centrais incluem:

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_SETUP_TOKEN`
- `EMPRESA_CERT_ENCRYPTION_KEY`
- `WEBHOOK_SHARED_SECRET`
- `CORS_ORIGINS`
- `FISCAL_PROVIDER_ACTIVE=LOBONOTAS`
- configurações `SEFIN_*`

Variáveis PlugNotas permanecem no ambiente apenas por compatibilidade histórica.
Elas não reativam o provider: chamadas externas continuam bloqueadas pelo kill
switch `PLUGNOTAS_DISABLED`.

### Execução

```bash
npm run start:dev
```

A API local responde, por padrão, em `http://localhost:3000`.

### Validação

```bash
npm test -- --runInBand
npm run build
npm run lint
```

O `build` também copia o catálogo LC116 para `dist/`. O lint roda com `--fix`; revise
o diff depois da execução.

O último baseline registrado em **05/08/2026** foi de 303 testes verdes, build OK
e lint sem erros, com warnings preexistentes de tipagem estrita.

## Docker e deploy

Execução local com Docker:

```bash
docker compose up -d --build
```

Produção usa Oracle VPS com Docker Compose. O deploy automatizado está em
`.github/workflows/deploy-oracle.yml`; o host não funciona como checkout Git.

Consulte:

- [`docs/DEPLOY_ORACLE_VPS.md`](./docs/DEPLOY_ORACLE_VPS.md)
- [`docs/lobonotas/05-OPERACAO-ORACLE-VPS.md`](./docs/lobonotas/05-OPERACAO-ORACLE-VPS.md)

## Endpoints principais

| Domínio | Endpoints |
|---|---|
| Saúde | `GET /health` |
| Autenticação | `/auth/login`, `/auth/me`, `/auth/accept-invite` |
| Usuários | `/users`, `/users/invite` |
| Empresas | `/empresas`, `/empresas/preview`, `/empresas/certificado/import` |
| Lookups | `/empresas/lookup/municipios`, `/empresas/lookup/cep/:cep`, `/empresas/lookup/cnae-anexo` |
| Tomadores | `/tomadores`, `/tomadores/autocomplete`, `/tomadores/lookup/cpf` |
| Emissão | `POST /nfse/emitir`, `POST /nfse/quick`, `POST /nfse/:id/reemitir` |
| Eventos | `POST /nfse/:id/cancelamento`, `POST /nfse/:id/substituicao` |
| Artefatos | `GET /nfse/:id/xml`, `GET /nfse/:id/pdf`, `POST /nfse/:id/sync-artifacts` |
| Observabilidade | `GET /nfse/:id/observability`, `GET /nfse/webhook/diagnostico` |
| B.I. | `GET /nfse/bi/summary` |
| IA operacional | `POST /ai/diagnostics/emission` |
| Webhook fiscal | `POST /webhooks/fiscal` |

As rotas remotas preservadas para documentos PlugNotas históricos não fazem
chamada externa: o backend responde `PLUGNOTAS_DISABLED`. XML e PDF antigos só são
servidos quando já estiverem persistidos.

## Segurança operacional

- JWT obrigatório e autorização por papel;
- DTOs validados e contrato de erro com `correlationId`;
- certificado A1 e senha cifrados em repouso com AES-256-GCM;
- token bruto de convite nunca persistido;
- CORS com allowlist explícita;
- kill switch e barreira dupla contra uso operacional de PlugNotas;
- segredos somente em `.env` local ou secret manager.

Se uma credencial aparecer em documentação versionada, trate como comprometida:
remova-a do conteúdo atual, rotacione-a e faça a limpeza do histórico Git em uma
frente de segurança coordenada.

## Hierarquia documental

Use esta ordem ao resolver divergências:

1. [`AGENTS.md`](./AGENTS.md) e o topo de [`CURRENT_STATE.md`](./CURRENT_STATE.md)
   para política e estado operacional vigente;
2. [`CONTEXT.md`](./CONTEXT.md) para handover recente e linha do tempo;
3. [`AI_CONTEXT.md`](./AI_CONTEXT.md) para limites da camada de IA;
4. [`docs/lobonotas/`](./docs/lobonotas/) para contrato e operação do motor fiscal;
5. [`docs/BI_CONTRATO_MINIMO.md`](./docs/BI_CONTRATO_MINIMO.md) para o contrato
   analítico;
6. relatórios PlugNotas e seções antigas datadas somente como evidência histórica.

Quando uma entrada histórica disser que PlugNotas estava ativo, ela descreve aquele
momento da migração e não revoga a política vigente. PlugNotas permanece
permanentemente `LEGACY_DISABLED`.
