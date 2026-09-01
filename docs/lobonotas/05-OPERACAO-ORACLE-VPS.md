# LOBONOTAS — 05. Operação na Oracle VPS

> Estado atual conhecido da infraestrutura, acesso seguro, diretórios/containers esperados, health/logs, deploy/rollback e limites operacionais da frente LOBONOTAS.
> Ultima verificacao: **31/08/2026**.

---

## 1. Estado atual (o que sabemos)

> **Incidente encerrado em 31/08/2026**: o workflow `Deploy Oracle VPS` run `33180713358` foi cancelado em 28/08 durante a etapa remota, depois da sincronizacao dos arquivos, deixando o Compose sem o container `zera-backend-api`. O sintoma publico foi `502` no health e no login. O servico foi restaurado manualmente com `docker compose up -d --build`; container, health local, proxy Vercel e dominio publico voltaram a responder. Producao permanece na `main` `d946c43`; a branch multiempresa ainda nao foi publicada.

> **Verificação ao vivo (01/08/2026)**: `https://manaus-nfse-dashboard.vercel.app/login` respondeu HTTP 200 e `…/api/health` respondeu HTTP 200 — a cadeia **frontend (Vercel) → proxy → Oracle :3000** está operante. Esse domínio já consta no CORS do backend (`src/main.ts:16`, `vercelPreviewPattern`) e em `render.yaml:18`.

| Item | Valor | Fonte | Status |
|---|---|---|---|
| Host | Oracle Cloud VPS `lobojow` | SSH (01/08/2026) | **verificado** |
| IP | `136.248.90.172` | `api/proxy.ts` (`DEFAULT_UPSTREAM`), docs | configurado |
| Usuário | `ubuntu` | SSH | **funcional** |
| Path app | `/home/ubuntu/zera-backend` | SSH (01/08/2026) | **verificado** |
| Container | `zera-backend-api` | `docker ps` | **Up (healthy)** — restaurado 31/08/2026 via Compose |
| Porta | `3000` (`0.0.0.0:3000->3000/tcp`) | `docker ps` | **verificado** |
| Health | `GET /health` → `{"status":"ok","env":"production"}` | SSH/curl (31/08/2026) | **verificado** |
| Portainer | `portainer` (`9000`, `9443`) | `docker ps` | **verificado** |
| Frontend | Vercel (`VITE_API_BASE_URL=/api` + proxy) | frontend | — |
| Frontend URL | `https://manaus-nfse-dashboard.vercel.app` | Vercel | **verificado 01/08/2026** |
| Login | `https://manaus-nfse-dashboard.vercel.app/login` | Vercel | **HTTP 200 (verificado)** |
| Health via proxy | `https://manaus-nfse-dashboard.vercel.app/api/health` | Vercel → Oracle | **HTTP 200 (verificado 31/08/2026)** |
| OS | Ubuntu 20.04.6 LTS (kernel 5.15.0-1081-oracle) | SSH | **verificado** |
| Recursos | 952MB RAM (≈508MB avail), 2GB swap, 45GB disco (39GB avail), 2 vCPU | SSH | **verificado** |
| Git no host | **sem `.git`** (`NO_GIT_DIR`) — deploy é por cópia de arquivos + `docker compose up -d --build` | SSH | **verificado** |
| Provider fiscal | LOBONOTAS / SEFIN Nacional | politica operacional vigente | **unico provider operacional; PlugNotas desativado** |

## 2. Acesso (estado real do ambiente de trabalho)

- **SSH FUNCIONAL (01/08/2026)** com a chave do owner:
  ```bash
  ssh -i "/home/lobo/Área de trabalho/SSH_KEYS_ORACLE/ssh-key-2026-06-16(1).key" ubuntu@136.248.90.172
  ```
- Alias configurado em `~/.ssh/config` (mais curto e sem risco de aspas):
  ```bash
  ssh lobojow
  ```
  (HostName `136.248.90.172`, User `ubuntu`, IdentityFile **entre aspas** — o path tem espaços).
- Chave: RSA (PEM) privada, permissões `600`, na pasta `SSH_KEYS_ORACLE/` (há 3 pares: `(1)`, `(2)`, `(3)` — `(1)` confirmada funcional).
- O bloqueio anterior (`Permission denied (publickey)`) está **resolvido** com a disponibilização da chave.
- Observação: a chave fica fora do repositório (não versionar); documentada aqui apenas como referência operacional.
- Deploy documentado: **GitHub Actions** (push em `main` → `deploy-oracle.yml`) ou manual via SSH. **Importante**: o host não tem `.git`, então o fluxo manual é copiar/extrair os arquivos atualizados em `/home/ubuntu/zera-backend` e rodar `docker compose up -d --build`.

## 3. Itens verificados em 01/08/2026 (checklist fechado)

- [x] Hostname/OS real: `lobojow` / Ubuntu 20.04.6 LTS.
- [x] Path do app: `/home/ubuntu/zera-backend` (com `.env`, `docker-compose.yml`, `Dockerfile`).
- [x] Container e estado: `zera-backend-api` Up (healthy) — redeployado 01/08/2026 via GitHub Actions; `portainer` também ativo.
- [x] Health local: `{"status":"ok","env":"production"}`.
- [x] Politica fiscal: LOBONOTAS e o provider operacional exclusivo; configuracoes e credenciais permanecem no `.env`/secret manager e nao sao exibidas no runbook.
- [x] Recursos: RAM 952MB (≈508 avail), swap 2GB, disco 45GB (39GB avail), 2 vCPU.
- [ ] Commit em produção vs `be18106`: **N/A** — host sem `.git`; impossível comparar por git. Comparar por build/`dist` ou hash de arquivos se necessário.
- [ ] Logs: `docker logs --tail 200 zera-backend-api` (não inspecionados nesta sessão).
- [ ] Reverse proxy/firewall: porta 3000 exposta conforme `docker ps`; sem nginx/htaccess mapeado.

## 4. Comandos operacionais padrão

```bash
# pré-requisito: rodar via SSH (alias lobojow ou comando com a chave do owner)
SSH="ssh lobojow"
# equivalente longo: SSH="ssh -i '/home/lobo/Área de trabalho/SSH_KEYS_ORACLE/ssh-key-2026-06-16(1).key' ubuntu@136.248.90.172"

# status
docker ps --filter name=zera-backend-api
docker compose -f docker-compose.yml ps

# health
curl -s http://localhost:3000/health

# logs
docker logs --tail 200 --follow zera-backend-api

# deploy (host SEM .git — deploy é por cópia de arquivos, não git pull)
# 1) enviar arquivos atualizados (ex.: rsync do repositório local)
# 2) rebuild:
docker compose up -d --build

# rollback de aplicacao deve restaurar uma imagem/versao anterior conhecida.
# Nunca usar PlugNotas como fallback ou kill switch operacional.
```

### 4.1 Recuperacao de `502` no proxy Vercel

O `502` com corpo `Oracle backend proxy request failed` significa que a Function da Vercel nao conseguiu conectar ao upstream; nao e uma resposta de autenticacao ou autorizacao do NestJS.

```bash
# 1. Confirmar cadeia publica
curl -i https://manaus-nfse-dashboard.vercel.app/api/health

# 2. Confirmar container e health na VPS
ssh lobojow
cd /home/ubuntu/zera-backend
docker compose ps -a
curl -i http://127.0.0.1:3000/health

# 3. Se o Compose estiver vazio, reconstruir os arquivos ja sincronizados
docker compose up -d --build

# 4. Encerrar somente depois dos tres checks
docker compose ps
curl -i http://127.0.0.1:3000/health
curl -i https://www.zera.net.br/api/health
```

Depois de qualquer workflow cancelado ou falho, verificar `docker compose ps -a`. Nao presumir que o container anterior foi preservado. Na VPS de 1 GB, `nest build` pode levar cerca de quatro minutos e usar swap; ausencia temporaria de output nao significa travamento se o processo continua consumindo CPU.

## 5. Limites operacionais da frente LOBONOTAS

- **Provider exclusivo**: LOBONOTAS/SEFIN Nacional e o unico caminho operacional. Falhas seguem para `ERROR`/reconciliacao e **nunca** sao reenviadas para PlugNotas.
- **Timeout pós-DPS** ⇒ **reconciliar com a autoridade fiscal** (consultar por chave/protocolo) antes de qualquer retry (D5).
- **PlugNotas desativado permanentemente**: codigo e registros historicos permanecem para leitura, parser e auditoria; nao reativar emissao, download remoto, sincronizacao ou fallback.
- **Ambiente Nacional**: Produção Restrita (homologação) primeiro; produção real só após piloto Manaus aprovado (roadmap Slice 6). URLs/credenciais ficam no `.env` do host, **não** no código nem no Git.
- **Certificados A1**: administrados via API de empresas (schema `CertificadoDigital`). Nenhuma chave/senha/certificado em logs ou docs.

## 6. Itens proibidos em operação (checklist LOBONOTAS)

- [ ] Não alterar `.env` da VPS sem PR/registro (segredos fora do Git).
- [ ] Não emitir/cancelar nota em produção sem piloto aprovado.
- [ ] Não reenviar DPS já transmitida sem reconciliação.
- [ ] Não remover módulo PlugNotas (legado) nesta fase.
- [ ] Não logar `pfxBase64`, senha do certificado, XML integral ou payload do provider.

## 7. Fora do Git / não versionado

- `.env` da VPS e do dev (segredos, URLs da Sefin, credenciais).
- Certificados digitais dos prestadores (guardados no MongoDB via API, cifrados conforme config — ver roadmap Slice 3 sobre cifragem do `.pfx`).
- Chave SSH da VPS: `/home/lobo/Área de trabalho/SSH_KEYS_ORACLE/ssh-key-2026-06-16(1).key` (fora do repositório; referenciada aqui apenas como operação).
