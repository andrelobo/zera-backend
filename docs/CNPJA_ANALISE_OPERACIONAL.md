# CNPJá – Análise Operacional para o ZERA

Data: 2026-03-05  
Escopo: integração de autocomplete/cadastro por CNPJ no `zera-backend` e impacto no `zera-frontend`.

## 1. Resumo Executivo

A CNPJá deve ser a fonte primária do fluxo de `POST /empresas/preview`.  
Se ela falhar (chave inválida/ausente, rate limit, créditos insuficientes, timeout ou erro de integração), o backend cai em fallback (BrasilAPI/ReceitaWS), o que reduz a completude dos dados.

No contexto atual do ZERA, respostas em formato ReceitaWS/BrasilAPI indicam que a consulta não está fechando na CNPJá para aquele request.

## 2. Capacidades Relevantes da API CNPJá (para nosso produto)

A API comercial da CNPJá pode fornecer, além do cadastro básico de estabelecimento:

- Situação cadastral
- Endereço, email, telefone
- CNAE principal/secundários
- Quadro societário (QSA)
- Simples Nacional e SIMEI (parâmetro `simples=true`)
- Inscrições estaduais (parâmetro `registrations=...`)
- SUFRAMA (parâmetro `suframa=true`)
- Geocodificação (`geocoding=true`)
- Comprovantes PDF (RFB/Simples/CCC/Suframa)

Isso é aderente ao objetivo do ZERA de autocomplete fiscal mais completo para cadastro e BI.

## 3. Autenticação e Erros Críticos

Autenticação:
- Header obrigatório: `Authorization: [chave-de-api]`

Erros esperados:
- `401 invalid authentication` -> chave inválida/formato incorreto
- `429 not enough credits` -> créditos insuficientes
- `429 rate limit exceeded` -> limite por minuto excedido

## 4. Crédito e Limite de Uso (impacto direto no ZERA)

A CNPJá controla acesso por:

- Créditos por consulta online
- Rate limit por minuto

Consequência prática:
- Falhas de crédito/rate limit disparam fallback no backend
- Campos como IE/SUFRAMA/Simples podem deixar de vir
- UX de autocomplete no front fica inconsistente entre CNPJs

## 5. Parâmetros que o ZERA deve usar na consulta primária

Para maximizar completude cadastral, o request de escritório deve incluir:

- `simples=true`
- `suframa=true`
- `registrations=ORIGIN` (ou `ALL`, conforme custo/necessidade)
- estratégia de cache adequada (`strategy`, `maxAge`, `maxStale`)

No código atual do ZERA backend, esses parâmetros já são montados via env:
- `CNPJA_INCLUDE_SIMPLES`
- `CNPJA_INCLUDE_SUFRAMA`
- `CNPJA_REGISTRATIONS_MODE`
- `CNPJA_CACHE_STRATEGY`
- `CNPJA_CACHE_MAX_AGE_DAYS`
- `CNPJA_CACHE_MAX_STALE_DAYS`

## 6. Estratégia de Cache – recomendação para produção

Recomendação padrão para ZERA:
- `strategy=CACHE_IF_ERROR`
- `maxAge=45`
- `maxStale=365`

Motivo:
- equilíbrio entre custo, latência e resiliência
- protege operação quando a fonte online oscila

Quando precisar mais frescor:
- reduzir `maxAge` (ex.: 7 ou 1)
- monitorar impacto em créditos

## 7. Diagnóstico objetivo para “CNPJá não está sendo usada”

Checklist:

1. Confirmar env no provedor (Render):
- `CNPJA_API_KEY` presente e sem espaços/aspas inválidas
- redeploy após alteração de env

2. Verificar formato de autenticação aceito pelo plano:
- `Authorization: <apiKey>`
- se exigido pelo provider, ajustar para `Authorization: Bearer <apiKey>`

3. Auditar logs do preview:
- tentativa CNPJá
- status HTTP de erro (401/429/5xx/timeout)
- motivo da queda para fallback

4. Confirmar consumo no painel CNPJá:
- se consumo seguir zerado, requisição não está fechando na CNPJá

## 8. Implicações para campos do formulário

- IM (Inscrição Municipal): frequentemente não vem de fontes públicas -> manter manual
- IE/SUFRAMA: podem vir da CNPJá quando disponíveis via `registrations`/`suframa`
- Nome Fantasia: pode vir vazio na fonte; não é bug quando `"fantasia": ""`
- Logradouro/complemento/email/telefone: se vierem na resposta e não preencherem, o problema tende a ser no front/merge de estado

## 9. Recomendação de hardening no ZERA

1. Expor origem da consulta no preview (observabilidade):
- `sourceUsed: cnpja | brasilapi | receitaws | plugnotas`

2. Expor diagnóstico mínimo quando fallback ocorrer:
- `cnpjaStatus: ok|error`
- `cnpjaHttpStatus` (sem vazar segredo)

3. Criar alerta operacional:
- taxa de fallback CNPJá > X% em janela de tempo

4. Teste de contrato contínuo:
- garantir mapeamento de IE/SUFRAMA quando CNPJá retornar `registrations`/`suframa`

## 10. Comandos úteis (validação rápida)

Exemplo de consulta direta:

```bash
curl --request GET \
  --url 'https://api.cnpja.com/office/04337168000148?simples=true&suframa=true&registrations=ORIGIN' \
  --header 'Authorization: [chave-de-api]'
```

Teste do backend ZERA:

```bash
curl -X POST 'https://SEU_BACKEND/empresas/preview' \
  -H 'Authorization: Bearer SEU_JWT' \
  -H 'Content-Type: application/json' \
  -d '{"cnpj":"04337168000148"}'
```

## 11. Conclusão

Para o objetivo do ZERA (autocomplete fiscal robusto), CNPJá é a escolha correta como primária.  
O ponto de controle não é só “ter chave no ambiente”, mas garantir observabilidade de source/fallback e telemetria de erro para evitar operar cegamente no fallback.
