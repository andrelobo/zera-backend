# Checklist - Webhook PlugNotas em Producao

Data de consolidacao: 2026-03-25
Escopo: `zera-backend` em producao

## Objetivo

Fechar a homologacao operacional do webhook fiscal, mantendo:
- webhook como atualizacao preferencial
- polling como fallback

## Estado atual confirmado

- backend pronto para receber callback em:
  - `POST /webhooks/fiscal`
- segredo configurado no backend:
  - `WEBHOOK_SHARED_SECRET`
- header esperado:
  - `x-webhook-token`
- polling fallback:
  - ativo
- sync oportunista de artefatos em `AUTHORIZED`:
  - ativo

## O que ja foi comprovado

- o backend responde em:
  - `GET /nfse/webhook/diagnostico`
  - `GET /nfse/external/:externalId/observability`
- as ultimas emissoes consultadas ainda fecharam por:
  - `polling`
- nos logs do backend ainda nao apareceu:
  - `POST /webhooks/fiscal`

Leitura correta:
- o backend esta pronto
- o segredo esta configurado
- o callback da PlugNotas ainda precisa ser validado/configurado no painel correto

## Checklist no painel da PlugNotas

Procurar por algo como:
- `Webhook`
- `API Callback`
- `Notificacoes`
- `URL de retorno`

Conferir:

1. Ambiente correto
- a configuracao precisa estar no ambiente oficial/producao
- nao basta existir no sandbox

2. Contexto correto
- validar se o webhook esta sendo configurado no nivel certo:
  - software house
  - empresa/emitente

3. URL exata do callback
- `https://zera-backend.onrender.com/webhooks/fiscal`

4. Metodo correto
- `POST`

5. Header do segredo
- nome: `x-webhook-token`
- valor: exatamente o mesmo de `WEBHOOK_SHARED_SECRET` no Render

6. Eventos finais habilitados
- autorizado/concluido
- rejeitado
- cancelado
- denegado

7. Historico de entregas/tentativas
- verificar se o painel mostra:
  - chamadas realizadas
  - status HTTP recebido
  - timeout
  - erro de autenticacao

8. Persistencia da configuracao
- salvar
- reabrir a tela
- confirmar que:
  - URL ficou salva
  - header ficou salvo
  - ambiente correto permaneceu selecionado

## O que esperar depois da configuracao correta

Ao emitir uma nova NFSe, a tela `Observabilidade Fiscal` deve mostrar:
- `Segredo: Configurado`
- `Ultimo webhook`: preenchido
- `Ultima Origem: webhook`
- timeline com:
  - `WEBHOOK_RECEIVED`

Os logs do backend devem mostrar algo como:
- `POST /webhooks/fiscal`
- `Webhook fiscal recebido`

## Sinais de problema e interpretacao

Se aparecer:
- `Ultima Origem: polling`
- `Ultimo webhook: —`
- sem `WEBHOOK_RECEIVED`

entao o webhook ainda nao fechou operacionalmente.

Leituras possiveis:
- callback nao configurado no painel correto
- callback configurado no ambiente errado
- token/header nao salvo corretamente
- PlugNotas nao disparando o callback

## Fonte de verdade para validar

1. `Observabilidade Fiscal`
2. logs do backend no Render
3. historico de tentativas do proprio painel da PlugNotas, se existir
