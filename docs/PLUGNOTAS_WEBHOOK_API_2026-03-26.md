# PlugNotas - Webhook API (notas operacionais)

Data: 2026-03-26
Fonte: trecho de documentacao oficial da API PlugNotas compartilhado no contexto desta sessao.
Escopo: esclarecer o que a API da PlugNotas permite em relacao a webhook e como isso conversa com o `zera-backend`.

## 1. O que a documentacao oficial deixa claro

### Escopo organizacional

- a PlugNotas permite cadastrar e administrar um `Webhook/API callback` vinculado a organizacao
- nesse formato, um unico endpoint recebe notificacoes das notas das empresas vinculadas a essa organizacao
- a propria doc recomenda usar a rota de webhook por empresa quando se quiser um endpoint especifico para cada empresa

### Operacoes disponiveis

A doc apresentada deixa claro que existem operacoes para:

- consultar webhook configurado da organizacao
- alterar webhook da organizacao
- cadastrar webhook geral da organizacao
- remover webhook
- testar webhook

### Parametros configuraveis

O webhook pode ser configurado com:

- `url`
- `method`
  - `POST`
  - `PUT`
  - `PATCH`
- parametros adicionais de `nfse`
- `queryString`
- `headers`

### Comportamento operacional informado pela doc

- a PlugNotas tenta reenviar a notificacao por varias horas ate receber `2xx` ou exceder o limite de tentativas
- o webhook e individual por nota
  - mesmo um lote com varias notas gera notificacoes individuais
- notas em `PROCESSANDO` nao disparam webhook
- a doc cita IPs que podem precisar ser liberados para recebimento das notificacoes:
  - `54.144.48.129`
  - `3.210.19.145`

### Implicacao mais importante

O webhook da PlugNotas **precisa ser cadastrado/configurado do lado da PlugNotas**.

Ou seja:

- nao basta o backend do ZERA ter a rota `POST /webhooks/fiscal`
- a PlugNotas precisa saber para qual URL enviar o callback
- essa configuracao pode existir:
  - no nivel da organizacao
  - ou no nivel de empresa, usando a rota especifica por empresa mencionada na propria doc

## 2. O que isso significa para o `zera-backend`

### O que ja existe no codigo

O backend do ZERA ja esta preparado para receber e processar o callback:

- rota de entrada:
  - `POST /webhooks/fiscal`
- validacao opcional por segredo compartilhado:
  - `WEBHOOK_SHARED_SECRET`
  - `WEBHOOK_SHARED_SECRET_HEADER` (padrao: `x-webhook-token`)
- atualizacao de emissao por `externalId`
- observabilidade para diferenciar `webhook` de `polling`
- sync oportunista de XML/PDF quando o webhook chega com status autorizado

Arquivos principais:

- `src/modules/webhooks/webhooks.controller.ts`
- `src/modules/webhooks/handlers/webhook.handler.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/fiscal/fiscal.controller.ts`
- `src/fiscal/application/poll-nfse-status.service.ts`

### O que nao existe hoje no codigo

Na leitura atual do repositorio, o `zera-backend` **nao** implementa cadastro automatico do webhook na API da PlugNotas.

Em outras palavras:

- o backend recebe webhook
- o backend processa webhook
- o backend expone diagnostico e observabilidade
- mas o backend **nao** provisiona o webhook remoto na PlugNotas por conta propria

## 3. Conclusao operacional correta

A duvida principal nao e mais "sera que o ZERA sabe receber webhook?".

Essa parte ja esta pronta.

A pergunta correta passa a ser:

- onde e em qual escopo o webhook da PlugNotas sera configurado para apontar para o ZERA

Pelo trecho da doc compartilhado, a resposta correta e:

- isso pode ser gerenciado pela API da PlugNotas
- existe webhook geral da organizacao
- existe tambem rota especifica por empresa

## 4. Leitura pratica para homologacao do ZERA

Para o callback funcionar de ponta a ponta, a configuracao na PlugNotas precisa apontar para algo como:

- URL do callback:
  - `https://zera-backend.onrender.com/webhooks/fiscal`
- metodo:
  - `POST`
- header:
  - `x-webhook-token: <mesmo valor do WEBHOOK_SHARED_SECRET no backend>`

Depois disso, a validacao correta no ZERA continua sendo:

- `GET /nfse/webhook/diagnostico`
- `GET /nfse/external/:externalId/observability`
- logs do backend procurando:
  - `POST /webhooks/fiscal`
  - `Webhook fiscal recebido`

## 5. Observacao importante

Este documento nao fixa como verdade o path exato de cada operacao administrativa da PlugNotas alem do que apareceu explicitamente no trecho compartilhado.

Ele registra apenas o que ficou objetivamente comprovado:

- a PlugNotas tem administracao de webhook por API
- webhook precisa ser cadastrado/configurado do lado deles
- existe escopo organizacional e escopo por empresa
- o `zera-backend` ja esta pronto para o lado receptor, mas nao faz esse provisionamento automaticamente
