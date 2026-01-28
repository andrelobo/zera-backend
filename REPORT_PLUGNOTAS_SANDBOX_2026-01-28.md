# Relatório de emissão NFSe – PlugNotas Sandbox (28/01/2026)

## Contexto
- Backend: ZERA (NestJS)
- Provider: PlugNotas (Sandbox)
- Data/hora local: 28/01/2026

## Emissão (NFSe Nacional) – Evidências
- **emissionId (backend):** `697a42749dcd4a6b7ec357c3`
- **externalId/protocol (PlugNotas):** `614a0e6c-432b-4643-803f-6dcc22cfe2a5`
- **idNota (PlugNotas):** `697a42780d7bf8bc1b0d4d10`
- **idIntegracao:** `teste-cli-001`

### Status no PlugNotas (consulta direta)
- `status`: **CONCLUIDO**
- `retorno.situacao`: **AUTORIZADA**
- `retorno.mensagemRetorno`: **RPS Autorizada com sucesso**
- `numeroNfse`: `2600`
- `codigoVerificacao`: `5278FE6A7`
- `dataAutorizacao`: `2026-01-28T17:08:08.675Z`

## Observações técnicas
- O backend inicialmente marcou como **ERROR** por falha de download (404) com endpoints antigos de XML/PDF.
- Endpoints corretos de download (NFSe Nacional):
  - `GET /nfse/xml/{idNota}`
  - `GET /nfse/pdf/{idNota}`
- Com `idNota` e `x-api-key`, XML/PDF foram baixados com sucesso no sandbox.

## Evidências práticas (comandos)
```bash
# Consulta direta na PlugNotas (status)
curl -sS https://api.sandbox.plugnotas.com.br/nfse/614a0e6c-432b-4643-803f-6dcc22cfe2a5 \
  -H 'Accept: application/json' \
  -H "x-api-key: $PLUGNOTAS_API_KEY"

# Download direto na PlugNotas (XML/PDF)
curl -sS https://api.sandbox.plugnotas.com.br/nfse/xml/697a42780d7bf8bc1b0d4d10 \
  -H 'Accept: application/xml' \
  -H "x-api-key: $PLUGNOTAS_API_KEY" \
  -o nfse.xml

curl -sS https://api.sandbox.plugnotas.com.br/nfse/pdf/697a42780d7bf8bc1b0d4d10 \
  -H 'Accept: application/pdf' \
  -H "x-api-key: $PLUGNOTAS_API_KEY" \
  -o nfse.pdf
```
