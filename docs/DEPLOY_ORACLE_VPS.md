# Deploy na Oracle VPS com Docker

Guia objetivo para o primeiro deploy do `zera-backend` em uma VPS Oracle Free Tier.

## Premissas

- Este backend deve subir apontando para a base real correta.
- `PLUGNOTAS_API_KEY`, `MONGO_URI`, `JWT_SECRET` e `WEBHOOK_SHARED_SECRET` precisam estar preenchidos antes do `docker compose up`.
- O exemplo abaixo assume Ubuntu na VPS.

## 1. Liberar a porta na Oracle

Abra a porta publica usada pelo backend no Security List / NSG da instancia.

- TCP `3000` para acesso direto ao backend
- ou TCP `80/443` se voce for colocar Nginx/Caddy na frente

## 2. Instalar Docker na VPS

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Abra uma nova sessao SSH apos o `usermod`.

## 3. Subir o codigo na VPS

```bash
git clone <url-do-repositorio> zera-backend
cd zera-backend
cp .env.example .env
```

Preencha o `.env` com os segredos reais antes de continuar.

Campos minimos para o primeiro deploy:

- `MONGO_URI`
- `JWT_SECRET`
- `ADMIN_SETUP_TOKEN`
- `PLUGNOTAS_API_KEY`
- `WEBHOOK_SHARED_SECRET`
- `CORS_ORIGINS`
- `FRONTEND_APP_URL`
- `FRONTEND_URL`

## 4. Subir o backend

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
```

## 5. Validar

No proprio servidor:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/docs-json
```

Se for expor direto por IP publico:

```bash
curl http://SEU_IP_PUBLICO:3000/health
```

## 6. Atualizar depois do primeiro deploy

```bash
git pull
docker compose up -d --build
docker image prune -f
```

## 7. Deploy via GitHub Actions

O repo agora tambem pode publicar na Oracle VPS por workflow.

Arquivo:

- `.github/workflows/deploy-oracle.yml`

Script remoto usado pelo workflow:

- `scripts/deploy-oracle-vps.sh`

### Variaveis do repositorio

Configure em `Settings -> Secrets and variables -> Actions -> Variables`:

- `ORACLE_HOST`
- `ORACLE_USER`
  - opcional; default recomendado: `ubuntu`
- `ORACLE_PORT`
  - opcional; default recomendado: `22`
- `ORACLE_DEPLOY_PATH`
  - opcional; default recomendado: `/home/ubuntu/zera-backend`

### Secrets do repositorio

Configure em `Settings -> Secrets and variables -> Actions -> Secrets`:

- `ORACLE_SSH_KEY`
  - chave privada usada para acessar a VPS
- `ZERA_BACKEND_ENV`
  - conteudo completo do `.env` de producao

### Como o workflow funciona

1. faz checkout do repo
2. instala dependencias e roda `yarn build`
3. prepara SSH no runner
4. sincroniza o repo para a VPS via `rsync`
5. envia o `.env` de producao para a VPS
6. executa `scripts/deploy-oracle-vps.sh` no host remoto
7. valida `GET /health` localmente na VPS

### Como disparar

- automatico em `push` para `main`
- manual em `Actions -> Deploy Oracle VPS -> Run workflow`

## Observacoes operacionais

- Sempre que entrar um novo dominio do frontend, atualize `CORS_ORIGINS` e faca redeploy.
- Se o banco estiver vazio, `/auth/bootstrap` nao responde com `NODE_ENV=production`. Nesse caso, faca o bootstrap inicial antes de travar em producao ou use uma base ja inicializada.
- O `docker-compose.yml` deste repo foi preparado para a Oracle VPS com `restart`, `healthcheck` e logs rotativos.

### Acesso SSH (alias `lobojow`)

- `~/.ssh/config` contem `Host lobojow` (HostName `136.248.90.172`, User `ubuntu`, Port `22`).
- Importante: o `IdentityFile` precisa estar **entre aspas** porque o caminho tem espacos:
  `/home/lobo/Área de trabalho/SSH_KEYS_ORACLE/ssh-key-2026-06-16(1).key`
- Uso: `ssh lobojow`. A chave fica fora do repositório (não versionar).
- O host **não tem `.git`**: o workflow sincroniza por `rsync` + copia do `.env` e roda `scripts/deploy-oracle-vps.sh` (`docker compose up -d --build` + health check local).

### Troubleshooting de deploy vermelho

- Build local no host com Node 22 falha em `yarn build` por engine (`engines.node = "20.x"`). Usar `npx nest build` para validacao local.
- Se o workflow passar no build mas o container ficar em `Restarting (1)` no VPS, a causa quase sempre e erro de boot do Nest (ex.: `UnknownDependenciesException` de injecao de dependencia). Diagnosticar com:
  ```bash
  ssh lobojow 'docker logs --tail 200 zera-backend-api 2>&1 | sed "s/\x1b\[[0-9;]*m//g"'
  ```
- Registrado em 01/08/2026: apos o fix do `yarn.lock`, dois erros de DI de boot quebraram o deploy — `@Optional()` faltando em `NfseEmissionRepository` (`ProviderDocumentParsers`) e `PlugNotasProvider` nao registrado no array `providers` do `FiscalModule`. Ambos corrigidos e o deploy voltou a ficar verde.
- O workflow usa `checkout@v5`/`setup-node@v5` (Node 20 e deprecado nos runners).
