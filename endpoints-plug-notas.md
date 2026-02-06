# Endpoints PlugNotas – Resumo Operacional

## Ambiente de Emissao
- Homologacao: `config.producao` deve ser `false`.
- Producao: `config.producao` deve ser `true`.

Exemplo:
```json
"config": {
  "producao": false
}
```

## Autenticacao
- Header obrigatorio em todas as rotas:
  - `x-api-key`: token da Software House.

---

## Certificados via API
### POST `https://api.plugnotas.com.br/certificado`

**Headers**
- `x-api-key`: token da Software House.

**Body (form-data)**
- `arquivo`: certificado digital (A1, `.pfx` ou `.p12`) **obrigatorio**
- `senha`: senha do certificado **obrigatorio**
- `email`: email para notificacoes (opcional)

**Resposta 200 (exemplo)**
```json
{
  "message": "Cadastro efetuado com sucesso",
  "data": { "id": "5ecc441a4ea3b318cec7f999" }
}
```

**Resposta 400 (exemplo)**
```json
{
  "error": {
    "message": "A senha utilizada na tentativa de upload do Certificado esta incorreta.",
    "data": { "senha": "xxxx" }
  }
}
```

Possiveis erros: `400` ou `401`.

---

## Empresas via API
### POST `https://api.plugnotas.com.br/empresa`

**Headers**
- `x-api-key`: token da Software House
- `Content-Type: application/json`

**Body (exemplo)**
```json
{
  "cpfCnpj":"29062609000177",
  "inscricaoMunicipal":"8214100099",
  "inscricaoEstadual":"1234567850",
  "razaoSocial":"Tecnospeed S/A",
  "nomeFantasia":"Tecnospeed",
  "certificado":"5af59d271f6e8f409178fbf3",
  "simplesNacional":true,
  "regimeTributario":1,
  "incentivoFiscal":true,
  "incentivadorCultural":true,
  "regimeTributarioEspecial":5,
  "endereco":{
    "tipoLogradouro":"Avenida",
    "logradouro":"Duque de Caxias",
    "numero":"882",
    "complemento":"17 andar",
    "tipoBairro":"Zona",
    "bairro":"Zona 01",
    "codigoPais":"1058",
    "descricaoPais":"Brasil",
    "codigoCidade":"4115200",
    "descricaoCidade":"Maringa",
    "estado":"PR",
    "cep":"87020-025"
  },
  "telefone":{
    "ddd":"44",
    "numero":"3037-9500"
  },
  "email":"empresa@plugnotas.com.br",
  "nfse":{
    "ativo":true,
    "tipoContrato":0,
    "config":{
      "producao":true,
      "rps":{
        "serie":"RPS",
        "numero":1,
        "lote":1
      },
      "prefeitura":{
        "login":"teste",
        "senha":"teste123"
      },
      "email":{
        "envio":true
      }
    }
  },
  "nfe":{
    "ativo":true,
    "tipoContrato":0,
    "config":{
      "producao":true,
      "impressaoFcp":true,
      "impressaoPartilha":true,
      "serie":1,
      "numero":1,
      "dfe":{
        "ativo":true
      },
      "email":{
        "envio":true
      }
    }
  },
  "nfce":{
    "ativo":true,
    "tipoContrato":0,
    "config":{
      "producao":true,
      "serie":1,
      "numero":1,
      "email":{
        "envio":true
      },
      "sefaz":{
        "idCodigoSegurancaContribuinte":"string",
        "codigoSegurancaContribuinte":"string"
      }
    }
  }
}
```

**Resposta 200 (exemplo)**
```json
{
  "message": "Cadastro efetuado com sucesso",
  "data": { "cnpj": "23995875000176" }
}
```

**Resposta 400 (exemplo)**
```json
{
  "error": {
    "message": "Falha na validacao do JSON de Empresa",
    "data": {
      "fields": { "certificado": "Preenchimento obrigatorio" }
    }
  }
}
```

Possiveis erros: `400`, `401`, `409`.

---

## Cadastro pela Interface
### Certificados
- Somente modelo A1.
- Caminho: menu **Certificado** > **Novo**.
- Informar senha e fazer upload do arquivo (pode arrastar).
- Email opcional para notificacoes (ex.: vencimento).

### Empresas
- Caminho: menu **Empresas** > **Novo**.
- Campos variam conforme o documento marcado.

---

## Fluxo de Emissao (Assincrono)
1. Envio do JSON via API PlugNotas.
2. PlugNotas busca o cadastro da empresa, calcula impostos/valores se necessario, monta XML e envia a SEFAZ.
3. A API retorna o **ID** da nota imediatamente.
4. Consultar a nota para saber o status:
   - **CONCLUIDO** = autorizada
   - **REJEITADO** = rejeitada
   - **PROCESSANDO** = pendente
5. Em autorizacao, opcionalmente solicitar PDF/XML.
6. Em rejeicao, corrigir e reenviar.
7. Em pendente, repetir consultas periodicas.
