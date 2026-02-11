# Payloads aceitos - PlugNotas (producao, 10/02/2026)

## 1) Payload de entrada (Swagger/backend)

```json
{
  "prestador": {
    "cnpj": "43521115000134",
    "inscricaoMunicipal": "51754301",
    "razaoSocial": "BURGUS LTDA",
    "regimeTributarioSn": {
      "opSimpNac": 3,
      "regApTribSN": 1,
      "regEspTrib": 0
    },
    "endereco": {
      "logradouro": "Saldanha Marinho",
      "numero": "606",
      "bairro": "Centro",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69010040"
    }
  },
  "tomador": {
    "cpfCnpj": "61020788100",
    "razaoSocial": "ANDRE AUGUSTO DE HOLANDA LOBO",
    "endereco": {
      "logradouro": "R FREI JOSE DE LEONISSA",
      "numero": "758",
      "bairro": "NOVA CIDADE",
      "municipio": "Manaus",
      "uf": "AM",
      "cep": "69017020"
    }
  },
  "servico": {
    "codigoNacional": "171901",
    "codigoTributacao": "100",
    "descricao": "Consulta IR 2024...",
    "valor": 150
  },
  "referenciaExterna": "nfse-prod-150-20260210-06"
}
```

## 2) Payload efetivo enviado ao PlugNotas (`providerRequest.payload[0]`)

```json
{
  "idIntegracao": "nfse-prod-150-20260210-06",
  "regimeApuracaoTributaria": 1,
  "emitente": {
    "tipo": 1,
    "codigoCidade": "1302603",
    "inscricaoMunicipal": "51754301"
  },
  "prestador": {
    "cpfCnpj": "43521115000134",
    "inscricaoMunicipal": "51754301",
    "opSimpNac": 3,
    "regApTribSN": 1,
    "regEspTrib": 0
  },
  "tomador": {
    "cpfCnpj": "61020788100",
    "razaoSocial": "ANDRE AUGUSTO DE HOLANDA LOBO"
  },
  "servico": [
    {
      "codigo": "171901",
      "codigoTributacao": "100",
      "discriminacao": "Consulta IR 2024...",
      "valor": {
        "servico": 150
      }
    }
  ]
}
```
