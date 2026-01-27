# Relatório de emissão NFSe – 27/01/2026

## Contexto
- Backend: ZERA (NestJS)
- Ambiente NuvemFiscal: production
- Município (IBGE): 1302603 (Manaus)
- Scope OAuth NuvemFiscal: empresa nfse
- Data/hora local: 27/01/2026

## Payload enviado (POST /nfse/emitir)
```json
{
  "prestador": {
    "cnpj": "43521115000134",
    "inscricaoMunicipal": "51754301"
  },
  "tomador": {
    "cpfCnpj": "00000000000000",
    "razaoSocial": "CLIENTE TESTE LTDA",
    "email": "cliente@teste.com",
    "endereco": {
      "logradouro": "RUA TESTE",
      "numero": "100",
      "bairro": "CENTRO",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69017020"
    }
  },
  "servico": {
    "codigoMunicipal": "100",
    "codigoNacional": "171901",
    "descricao": "SERVICO DE IRPF 2025/2024.",
    "valor": 500.0
  },
  "referenciaExterna": "prod-final-001"
}
```

## 1) Auth na API (backend)
- Endpoint: `POST /auth/login`
- Resultado: `201 Created`
- Retorno: `accessToken` (redatado)

## 2) Emissão via backend
- Endpoint: `POST /nfse/emitir`
- Resultado (27/01/2026 15:42:56Z):
```json
{
  "emissionId": "6978dcff85af94555ead4d56",
  "result": {
    "status": "PENDING",
    "provider": "NUVEMFISCAL",
    "externalId": "nfs_3a1f17727f4c4da28b4b650b28e46bba",
    "providerResponse": {
      "id": "nfs_3a1f17727f4c4da28b4b650b28e46bba",
      "created_at": "2026-01-27T15:42:56.829Z",
      "status": "processando",
      "ambiente": "producao",
      "referencia": "prod-final-001",
      "DPS": {},
      "mensagens": []
    }
  }
}
```

## 3) OAuth direto na NuvemFiscal
- Endpoint: `POST https://auth.nuvemfiscal.com.br/oauth/token`
- Resposta (token redatado):
```json
{
  "access_token": "<redacted>",
  "token_type": "bearer",
  "scope": "empresa nfse",
  "expires_in": 2592000
}
```

## 4) Consulta direta na NuvemFiscal (GET /nfse/{id})
- Endpoint: `GET https://api.nuvemfiscal.com.br/nfse/nfs_3a1f17727f4c4da28b4b650b28e46bba`
- Resposta (27/01/2026 15:45:12Z):
```json
{
  "id": "nfs_3a1f17727f4c4da28b4b650b28e46bba",
  "created_at": "2026-01-27T15:42:56.829Z",
  "status": "negada",
  "ambiente": "producao",
  "referencia": "prod-final-001",
  "DPS": {
    "serie": "NF",
    "nDPS": "1"
  },
  "mensagens": [
    {
      "codigo": "E403",
      "descricao": "Lote de RPS recebido e foram detectados erros ao processar.",
      "correcao": "Recuperar a relação dos erros"
    }
  ]
}
```

## 5) Tentativas de obter detalhe do erro
- `GET /nfse/{id}/erros` → `404 UrlInfoError` (Unknown path)
- `GET /nfse/{id}/xml` → `404 NfseXmlNotFound`

## 6) Polling do backend (atualização interna)
- Polling habilitado com `intervalMs=300000`, `jitterMs=15000`.
- O backend consultou a NuvemFiscal às 16:03:04Z e atualizou o status interno.
- Provider-response do backend (27/01/2026 16:03:15Z):
```json
{
  "found": true,
  "id": "6978dcff85af94555ead4d56",
  "provider": "NUVEMFISCAL",
  "externalId": "nfs_3a1f17727f4c4da28b4b650b28e46bba",
  "status": "REJECTED",
  "providerResponse": {
    "id": "nfs_3a1f17727f4c4da28b4b650b28e46bba",
    "created_at": "2026-01-27T15:42:56.829Z",
    "status": "negada",
    "ambiente": "producao",
    "referencia": "prod-final-001",
    "DPS": { "serie": "NF", "nDPS": "1" },
    "mensagens": [
      {
        "codigo": "E403",
        "descricao": "Lote de RPS recebido e foram detectados erros ao processar.",
        "correcao": "Recuperar a relação dos erros"
      }
    ]
  },
  "error": null,
  "createdAt": "2026-01-27T15:42:55.391Z",
  "updatedAt": "2026-01-27T16:03:04.696Z"
}
```

## Resumo do problema
- A emissão foi criada com sucesso via `/nfse/dps`, mas o status final na NuvemFiscal é **negada** com **E403**.
- A mensagem pede “recuperar a relação dos erros”, porém não há endpoint evidente que retorne os detalhes.
- O backend confirmou a **negação** após o ciclo de polling e marcou a emissão como `REJECTED`.

## Perguntas para o suporte NuvemFiscal
1) Qual endpoint ou mecanismo correto para obter **a relação detalhada dos erros** quando ocorre `E403`?
2) Para o CNPJ/IM informados (Manaus), há validação específica que gere esse `E403`? Qual o erro raiz?
3) Há alguma configuração adicional de lote/RPS/DPS necessária para evitar a negação?
