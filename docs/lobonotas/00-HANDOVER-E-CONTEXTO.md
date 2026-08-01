# LOBONOTAS — 00. Handover e Contexto

> Frente: **LOBONOTAS** — novo motor fiscal do ZERA para integração direta com a NFS-e Padrão Nacional / SEFIN Nacional.
> Etapa: **Documentação as-is (etapa 1)**. Nenhum código foi alterado nesta rodada.
> Data de referência: **01/08/2026**.
> Autor: Arquiteto de Software (auditoria assistida por IA sobre os dois repositórios locais).

---

## 1. O que é o ZERA

O ZERA é um produto composto por dois repositórios que formam **um único sistema**:

| Componente | Repositório | Stack | Hospedagem |
|---|---|---|---|
| Backend | `andrelobo/zera-api` | NestJS + Node 20 + TypeScript + Mongoose + MongoDB Atlas | Oracle Cloud VPS (Docker) |
| Frontend | `andrelobo/zera-front` | React + Vite + TypeScript | Vercel |

Objetivo do produto: emissão ultra-simplificada de NFS-e (Padrão Nacional 2026) para microempreendedores e pequenas empresas, abstraindo a complexidade fiscal.

Premissa canônica (registrada em `README.md:24-31` e `AI_CONTEXT.md:7-22`): **sistema já em produção**, com usuários reais e emissões reais. Qualquer mudança parte da premissa de evitar regressão operacional/fiscal.

---

## 2. O que é o LOBONOTAS

O **LOBONOTAS** será o **novo motor fiscal** do ZERA para integração **direta** com o **Ambiente Nacional da NFS-e** (DPS + autoridade fiscal nacional).

### Objetivos iniciais

1. **Substituir o PlugNotas** no fluxo fiscal do ZERA.
2. Começar por **prestadores de Manaus/AM**.
3. Operar inicialmente **para o próprio ZERA**.
4. Expandir depois para **municípios do Amazonas compatíveis com a NFS-e Nacional**.
5. **Preservar a API pública atual** (`/nfse/*`, `/empresas/*`, `/tomadores/*`).
6. Manter o PlugNotas apenas como **implementação legada e referência histórica**.

### Situação do PlugNotas

- O PlugNotas **não está mais ativo comercial ou operacionalmente** (informação do owner).
- Módulos, mappers, testes, relatórios, payloads e integrações do PlugNotas **não serão apagados** nesta fase.
- Devem permanecer preservados como **legado/inativo**, **sem nenhuma chamada externa acidental**.

---

## 3. Decisões já tomadas (diretrizes do projeto)

| # | Decisão | Consequência |
|---|---|---|
| D1 | Preservar as rotas públicas `/nfse/*` sempre que possível | A troca de provider não pode quebrar o contrato HTTP |
| D2 | Separar mudança de rota HTTP de mudança de roteamento fiscal interno | Primeiro mexer no interno, depois (se necessário) no HTTP |
| D3 | Criar contrato de domínio independente do JSON PlugNotas e do XML SEFIN | Contrato canônico neutro de provider |
| D4 | PlugNotas inativo e **nunca** fallback automático | Fail-closed; não haver reenvio automático por outro provider |
| D5 | Timeout pós-transmissão de DPS: **não reenviar por outro provider**; reconciliar primeiro com a autoridade fiscal | Regra fiscal crítica |
| D6 | Preservar idempotência, polling, artifacts, timeline, auditoria, BI e emissão rápida | Nenhuma capacidade atual pode ser perdida |
| D7 | Preservar histórico de emissões antigas com `provider: PLUGNOTAS` | Compatibilidade de documentos históricos |
| D8 | Novas emissões devem identificar claramente o novo provider | Rastreabilidade por provider |
| D9 | Certificado A1 continua obrigatório para emissão automática pela API Nacional | Requisito mantido |
| D10 | Certificados, senhas e XMLs nunca podem aparecer em logs | Redaction obrigatório |
| D11 | Não redesenhar infraestrutura com PostgreSQL, Redis ou novo serviço de hospedagem | Banco continua MongoDB Atlas; VPS continua Oracle |
| D12 | LOBONOTAS nasce logicamente isolado dentro da estrutura atual | Sem microserviço prematuro; extração futura facilitada |
| D13 | Toda conclusão sobre API Nacional, DPS, assinatura, mTLS, XSD, IBS/CBS exige citação de versão/data da documentação oficial | Se não houver doc oficial → marcar pendente, nunca inventar contrato |

---

## 4. Escopo e não-escopo desta etapa (etapa 1)

### Escopo (entregue nesta rodada)

- Leitura e verificação do estado real de backend, frontend e banco (por código).
- Tentativa de inspeção **read-only** da VPS (resultado: **bloqueada** — ver seção 6 e `05-OPERACAO-ORACLE-VPS.md`).
- Auditoria de dados (Atlas) **pelo código** (schemas, índices, idempotência, acoplamentos).
- Criação de `docs/lobonotas/00..05`.

### Não-escopo (proibido nesta rodada)

- Alterar arquivos `.ts`, `.tsx`, `.js`, Dockerfile, docker-compose, workflows, infraestrutura.
- Alterar rotas HTTP.
- Instalar dependências.
- Fazer deploy.
- Emitir ou cancelar nota.
- Escrever no banco.
- Apagar ou mover módulos PlugNotas.
- Expor segredos (MONGO_URI, JWT_SECRET, chaves, certificados, tokens, conteúdo de `.env`).

---

## 5. Infraestrutura real (documentada)

### Frontend

- Hospedagem: **Vercel**.
- Domínio principal: `https://zera.net.br` (CURRENT_STATE.md do front, atualização 2026-05-14).
- O frontend **não chama o backend direto pelo IP**: usa proxy de função Vercel `api/proxy.ts` → `DEFAULT_UPSTREAM = http://136.248.90.172:3000`, com `VITE_API_BASE_URL=/api` em produção.
- **Alteração de domínio exige atualização de `CORS_ORIGINS` no backend** (`src/main.ts:18-21`).

### Backend (Oracle VPS) — valores **documentados/esperados, NÃO verificados em runtime**

| Item | Valor esperado (docs) |
|---|---|
| Hostname | `lobojow` |
| IP público | `136.248.90.172` |
| Sistema | Ubuntu Server 20.04 |
| Recursos | 1 OCPU, ~952 MB RAM, 2 GB swap, 45 GB SSD |
| Container | `zera-backend-api` |
| Porta interna | `3000` |
| Health check | `GET /health` |
| Usuário SSH esperado | `ubuntu` (não confirmado — acesso bloqueado) |
| Caminho do projeto | `/home/ubuntu/zera-backend` (documentado; não verificado) |

> **BLOQUEIO**: não foi possível acessar a VPS. Detalhes em `05-OPERACAO-ORACLE-VPS.md`, seção "Estado observado".

### Banco

- **MongoDB Atlas** externo. **Não existe MongoDB local na VPS** e não deve ser instalado.
- Não instalar PostgreSQL na VPS. Não introduzir Redis, filas pesadas, Chromium, Playwright, IA local ou outros serviços pesados sem ADR, medição de recursos e aprovação.

### Deploy

- Fluxo manual esperado: `git pull && docker compose up -d --build`.
- Existe `.github/workflows/deploy-oracle.yml` (push em `main` + dispatch manual).
- Existe `scripts/deploy-oracle-vps.sh` (valida `/health` após deploy).
- Existe `docs/DEPLOY_ORACLE_VPS.md`.
- **Nenhum deploy foi feito nesta etapa.**

---

## 6. Acesso à VPS — resultado da inspeção

- Comando tentado: `ssh ubuntu@136.248.90.172` (BatchMode, chave local padrão).
- Resultado: `Permission denied (publickey)`.
- Verificação local: `~/.ssh` contém **apenas `known_hosts`**; **nenhuma chave privada** (`id_ed25519`/`id_rsa`) existe no ambiente local.
- **Decisão:** interrompida a inspeção de VPS (regra: não contornar autenticação). A documentação da VPS permanece como "esperado por documentação", com flag de não verificado.

---

## 7. Restrições fiscais e operacionais vigentes

1. Certificado A1 é pré-condição para emissão (`assertPrestadorHasCertificate` em `src/fiscal/application/emitir-nfse.service.ts:287-316`).
2. Emissões bloqueadas quando prestador incompleto (`PRESTADOR_INCOMPLETO` / `QUICK_PRESTADOR_INCOMPLETO`).
3. Rejeições E0312/E0314 já documentadas (histórico) como bloqueio de **tabela municipal**, não de payload.
4. Polling é **fallback obrigatório**; webhook é trilha preferencial, mas não única (regra `AI_CONTEXT.md:96-110`).
5. Não desligar polling sem homologação comprovada.
6. Multi-prestador é **capacidade validada** (2º prestador emitiu em 18/05/2026 após sync PlugNotas).

---

## 8. Documentos-mãe e leitura obrigatória

Backend:
- `CURRENT_STATE.md` (snapshot), `CONTEXT.md` (histórico), `AI_CONTEXT.md` (premissas de IA), `README.md`.
- `docs/DEPLOY_ORACLE_VPS.md`, `docker-compose.yml`, `Dockerfile`, `scripts/deploy-oracle-vps.sh`.
- `src/fiscal/domain/fiscal-provider.interface.ts`, `src/fiscal/application/*`, `src/fiscal/infra/plugnotas*`.
- `src/modules/empresas/*`, `src/modules/tomadores/*`, `src/modules/webhooks/*`, `src/ai/*`.

Frontend:
- `CURRENT_STATE.md`, `CONTEXT.md`, `src/lib/api.ts`, `src/lib/nfse-provider.ts`, `src/services/api.ts`, `src/types/api.ts`, `api/proxy.ts`, páginas de emissão/listagem/detalhe/prestador.

---

## 9. Leitura canônica do contexto para IA

Ordem de prioridade definida em `AI_CONTEXT.md:146-158`:

1. `AI_CONTEXT.md`
2. `CURRENT_STATE.md`
3. Observabilidade runtime
4. Skills locais
5. Documentação operacional
6. `CONTEXT.md`
7. Histórico legado

`CURRENT_STATE.md` tem prioridade sobre histórico antigo quando houver conflito.
