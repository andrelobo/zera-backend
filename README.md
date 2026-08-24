<div align="center">
  <img src="./docs/brand/jupati-readme.svg" width="760" alt="Jupati — sua operação, bem conectada." />
</div>

<p align="center">
  Plataforma brasileira de operação e inteligência para empresas e contabilidades,<br />
  com núcleo fiscal próprio integrado à NFS-e Padrão Nacional.
</p>

<p align="center">
  <strong>Backend oficial</strong> · NestJS · TypeScript · MongoDB · LOBONOTAS · IA assistiva
</p>

---

## Jupati

**Jupati** conecta empresas, pessoas, clientes, serviços, documentos, dados e
inteligência em uma operação fiscal segura e compreensível. A emissão de NFS-e é
uma capacidade central, mas não limita o produto: a plataforma também cobre
onboarding fiscal, gestão multiempresa, observabilidade, B.I., relatórios e
diagnóstico operacional assistido.

> **Sua operação, bem conectada.**

Este repositório conserva o nome técnico histórico `zera-backend`. A marca do
produto é Jupati; renomear repositórios, rotas, collections ou contratos depende de
um plano de migração próprio e não faz parte do rebranding visual.

### Arquitetura de marca

| Camada | Nome | Papel |
|---|---|---|
| Plataforma | **Jupati** | Produto percebido pelo usuário |
| Motor fiscal | **LOBONOTAS** | Integração própria com o Ambiente Nacional |
| Empresa | **Muirakitan Tecnologia** | Responsabilidade institucional e jurídica |
| Provider histórico | **PlugNotas** | Compatibilidade histórica; `LEGACY_DISABLED` |

## Identidade visual

A identidade combina fibras entrelaçadas da jupati, o fluxo dos rios amazônicos e
módulos de dados conectados. Ela comunica confiança, clareza operacional, conexão,
inteligência e origem amazônica contemporânea — sem competir com os dados fiscais.

| Token | Cor | Uso |
|---|---:|---|
| `night-950` | `#071020` | Fundo institucional |
| `forest-700` | `#384E37` | Marca em fundo claro |
| `leaf-500` | `#6CA65D` | Destaque, foco e seleção |
| `sage-400` | `#829B7F` | Informação secundária |
| `silver-300` | `#C3C5B6` | Trama, divisores e detalhes |
| `ivory-100` | `#EBE6DE` | Texto e superfícies de marca |
| `warm-50` | `#F7F5F0` | Fundo operacional claro |

O símbolo representa uma trama resistente de elementos conectados. A assinatura
técnica deste repositório está em
[`docs/brand/jupati-readme.svg`](./docs/brand/jupati-readme.svg).

## LOBONOTAS

**LOBONOTAS** é o motor fiscal próprio da Jupati. Ele integra o backend diretamente
ao Ambiente Nacional da NFS-e, sem delegar a operação a um provider comercial.

O ciclo validado em produção compreende:

1. validação do prestador e reserva atômica da numeração da DPS;
2. construção e assinatura da DPS 1.01 com certificado A1;
3. transmissão mTLS para a SEFIN em envelope GZip + Base64;
4. autorização e reconciliação por webhook ou polling;
5. persistência do XML oficial assinado;
6. geração local do DANFSe v2.0;
7. cancelamento por eventos do Ambiente Nacional.

A primeira emissão LOBONOTAS real foi autorizada no Ambiente Nacional em agosto de
2026. XML e DANFSe foram validados no backend, no proxy Vercel e no domínio público.

### Política fiscal vigente

- provider operacional ativo e exclusivo: **LOBONOTAS**;
- PlugNotas está permanentemente **`LEGACY_DISABLED`**;
- PlugNotas nunca pode ser fallback, reemissão, cancelamento, sincronização ou
  download remoto;
- parsers, testes e registros PlugNotas permanecem como evidência histórica;
- documentos PlugNotas persistidos no MongoDB não são alterados;
- timeout após transmissão exige reconciliação — nunca reenvio cego.

## Arquitetura

```text
Jupati Web (React + Vite, Vercel)
        |
        | HTTPS / proxy /api
        v
Jupati Backend (NestJS, Oracle VPS, Docker)
        |
        +-- MongoDB Atlas
        |
        +-- LOBONOTAS
              |
              | DPS 1.01 + assinatura A1 + mTLS
              v
        SEFIN / Ambiente Nacional da NFS-e
```

O backend é a fachada das integrações externas. Ele normaliza contratos, aplica
regras determinísticas, protege segredos, persiste a trilha fiscal e orquestra o
LOBONOTAS.

## Capacidades

### Operação fiscal

- emissão normal e rápida de NFS-e;
- idempotência e reemissão fail-closed antes da transmissão;
- webhook, polling e reconciliação pós-timeout;
- cancelamento, substituição e histórico de eventos;
- XML oficial, DANFSe e regeneração controlada de artefatos;
- catálogo LC116 e contrato canônico neutro de provider.

### Plataforma multiempresa

- cadastro e completude fiscal de prestadores;
- certificado A1 por empresa, cifrado em repouso;
- tomadores, serviços e parâmetros isolados por prestador;
- lookups de CNPJ, CPF, CEP, municípios e CNAE;
- perfis `admin`, `manager`, `user` e `readonly`;
- onboarding por convite com expiração.

### Inteligência e governança

- observabilidade e timeline por emissão;
- indicadores de faturamento, ISS, retenções, tomadores e localidades;
- snapshots do Simples Nacional e prontidão para B.I.;
- diagnóstico determinístico e read-only de emissões;
- nenhuma heurística de IA altera emissão ou substitui validação fiscal/contábil.

## IA na Jupati

A IA é uma camada assistiva e governada. Ela interpreta evidências, explica falhas
e organiza contexto; não decide regra fiscal, não assina DPS e não transmite ou
cancela documentos por conta própria.

### Capacidades e maturidade

| Capacidade | Estado | Evidência / direção |
|---|---|---|
| Contexto canônico | **Em uso** | `AI_CONTEXT.md`, `CURRENT_STATE.md` e `CONTEXT.md` |
| Skills especializadas | **Em uso no desenvolvimento** | instruções locais por domínio e risco |
| `DiagnoseAgent` | **Implementado** | diagnóstico determinístico e read-only de emissão |
| Tool calling | **Governado** | somente ferramentas explícitas, tipadas e auditáveis |
| Memória operacional | **Documentada / incremental** | estado recente separado de histórico e evidência |
| RAG | **Planejado** | recuperação de normas, contratos e evidências com fonte |
| Workflows de IA | **Planejados** | cadeias supervisionadas de diagnóstico e recomendação |
| Multiagentes | **Arquitetura futura** | agentes especializados, sem autonomia fiscal irreversível |
| Provider LLM | **Opcional / desacoplado** | o core fiscal não depende de LLM em runtime |

### Skills

Skills encapsulam instruções especializadas para tarefas como contexto fiscal,
segurança, testes, documentação, observabilidade e operação. Elas tornam o processo
repetível sem transformar conhecimento em permissão irrestrita.

Regras:

- selecionar a skill pelo domínio da tarefa;
- ler integralmente suas instruções antes de agir;
- preservar escopo e guardrails do repositório;
- validar toda alteração com evidência proporcional ao risco;
- nunca usar uma skill para contornar autorização, segredo ou regra fiscal.

### Agentes e multiagentes

O agente implementado hoje é o `DiagnoseAgent`, exposto de forma read-only por
`POST /ai/diagnostics/emission`. A evolução prevê agentes especializados para
payloads rejeitados, comparação com emissões aceitas, provider, artefatos e B.I.

Multiagentes só fazem sentido quando as subtarefas são independentes e auditáveis.
Um orquestrador deve consolidar resultados, resolver conflitos e manter decisão
humana em qualquer ação fiscal irreversível.

### RAG e memória

O RAG planejado deve recuperar somente fontes identificáveis — legislação, manuais
SEFIN, XSDs, ADRs, contratos e evidências operacionais — com metadados de versão,
data e origem. Conteúdo recuperado apoia explicação; não substitui o motor fiscal.

A memória é separada em:

- **curto prazo:** contexto da sessão e operação atual;
- **operacional:** decisões, incidentes e estado vigente;
- **longo prazo:** documentação versionada e evidências estáveis.

Dados pessoais, certificados, senhas, tokens e XML bruto não devem compor memória
de IA nem logs de prompts.

## SDD — Specification-Driven Development

O projeto usa **SDD** para transformar contexto operacional em mudanças pequenas,
rastreáveis e verificáveis. A especificação versionada vem antes da implementação;
o código e os testes demonstram aderência à decisão registrada.

```text
Contexto canônico
      ↓
Especificação / ADR / contrato
      ↓
Slice pequeno em branch própria
      ↓
Testes + build + lint
      ↓
Pull request e revisão
      ↓
Deploy controlado
      ↓
Evidência operacional e atualização do contexto
```

Princípios:

- especificar regra, contrato e critério de aceite antes de alterar;
- uma mudança de risco por slice;
- usar fonte oficial, versão e data para regras fiscais;
- marcar `[PENDENTE]` quando não existir evidência suficiente;
- preservar compatibilidade de forma aditiva;
- operar em fail-closed diante de incerteza pós-transmissão;
- fechar o ciclo com testes, CI, health check e evidência real.

Documentos centrais:

- [`AGENTS.md`](./AGENTS.md) — workflow e gates de qualidade;
- [`CURRENT_STATE.md`](./CURRENT_STATE.md) — snapshot operacional;
- [`CONTEXT.md`](./CONTEXT.md) — handover e linha do tempo;
- [`AI_CONTEXT.md`](./AI_CONTEXT.md) — arquitetura e limites da IA;
- [`docs/lobonotas/`](./docs/lobonotas/) — specs, ADR, contrato e operação;
- [`docs/BI_CONTRATO_MINIMO.md`](./docs/BI_CONTRATO_MINIMO.md) — contrato analítico.

## Stack

- Node.js 20.x
- NestJS + TypeScript
- MongoDB Atlas + Mongoose
- Jest
- Docker + Docker Compose
- GitHub Actions
- Oracle Cloud VPS

## Desenvolvimento local

```bash
cp .env.example .env
npm install
npm run start:dev
```

A API responde por padrão em `http://localhost:3000`. Nunca grave credenciais reais
em documentação, fixtures ou commits.

### Qualidade

```bash
npm test -- --runInBand
npm run build
npm run lint
```

Baseline validado em **24/08/2026**:

- **304 testes** aprovados em 38 suítes;
- build NestJS aprovado, incluindo o catálogo LC116;
- lint com zero erros;
- deploy Oracle VPS concluído em 5min15s;
- container `zera-backend-api` saudável em produção.

## Endpoints principais

| Domínio | Superfície |
|---|---|
| Saúde | `GET /health` |
| Autenticação | `/auth/login`, `/auth/me`, `/auth/accept-invite` |
| Usuários | `/users`, `/users/invite` |
| Empresas | `/empresas`, certificado e lookups |
| Tomadores | `/tomadores`, autocomplete e lookup de CPF |
| Emissão | `POST /nfse/emitir`, `POST /nfse/quick`, `POST /nfse/:id/reemitir` |
| Eventos | cancelamento e substituição em `/nfse/:id/*` |
| Artefatos | XML, PDF e `sync-artifacts` em `/nfse/:id/*` |
| Observabilidade | timeline e diagnóstico fiscal em `/nfse/*` |
| B.I. | `GET /nfse/bi/summary` |
| IA | `POST /ai/diagnostics/emission` |
| Webhook | `POST /webhooks/fiscal` |

## Deploy

Produção usa Docker Compose na Oracle VPS. O GitHub Actions valida, sincroniza o
projeto por SSH, reconstrói o container e confirma `/health`.

- [`docs/DEPLOY_ORACLE_VPS.md`](./docs/DEPLOY_ORACLE_VPS.md)
- [`docs/lobonotas/05-OPERACAO-ORACLE-VPS.md`](./docs/lobonotas/05-OPERACAO-ORACLE-VPS.md)

## Segurança operacional

- JWT e autorização por papel;
- validação global de DTOs e erros com `correlationId`;
- certificado A1 e senha cifrados em repouso com AES-256-GCM;
- CORS com allowlist explícita;
- redaction de certificados, senhas e XMLs em logs;
- kill switch e barreira dupla contra uso operacional de PlugNotas;
- segredos somente em `.env` ou secret manager.

---

<p align="center">
  <strong>Jupati</strong> · Sua operação, bem conectada.<br />
  Uma solução Muirakitan Tecnologia.
</p>
