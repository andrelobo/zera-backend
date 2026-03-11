# Contrato Mínimo de B.I.

Atualizado em `2026-03-11`.

Objetivo:
- definir o conjunto canônico mínimo de dados para B.I.;
- separar claramente campos de `emissão`, `analytics` e `dependência contábil`;
- reduzir retrabalho entre backend, frontend e dashboard.

## 1. Princípio canônico

- `Emissão` usa apenas os campos necessários para autorizar e acompanhar a nota.
- `B.I.` usa uma camada mais ampla:
  - dados operacionais persistidos;
  - snapshots derivados seguros;
  - métricas agregadas.
- O frontend não deve inventar regra fiscal para analytics.
- Campos fiscais sem regra validada pelo contador devem ficar:
  - vazios, ou
  - apenas em payload bruto,
  até haver definição formal.

## 2. Entidades mínimas

### 2.1 Empresa

Campos operacionais canônicos:
- `cnpj`
- `razaoSocial`
- `nomeFantasia`
- `inscricaoMunicipal`
- `inscricaoEstadual`
- `suframa`
- `situacaoCadastral`
- `dataSituacaoCadastral`
- `dataInicioAtividade`
- `endereco.*`
- `email`
- `fone`
- `whatsapp`

Campos fiscais canônicos:
- `regimeTributario`
- `cnaeFiscal`
- `cnaeFiscalDescricao`
- `cnaesLista[]`
- `ctnCodigo`
- `nbsCodigo`
- `opcaoPeloSimples`
- `opcaoPeloMei`
- `aliquotaSimplesNacional`
- `apuracaoSimplesNacional`
- `rbt12`
- `parametroMunicipal[]`
- `configOperacionais[]`

Campos derivados seguros:
- `simplesSnapshot`
  - `anexo`
  - `faixa`
  - `aliquotaNominal`
  - `parcelaDeduzir`
  - `aliquotaEfetiva`
  - `issReferencia`
  - `rbt12`
  - `valido`
  - `calculadoEm`

Campos derivados de apoio:
- `biCatalogoResumo`
  - `totalCnaes`
  - `totalFavoritosMunicipais`
  - `totalVinculosMunicipais`
  - `totalConfigOperacionais`

### 2.2 Tomador

Campos canônicos:
- `empresaCnpj`
- `cpfCnpj`
- `razaoSocial`
- `nomeFantasia`
- `inscricaoMunicipal`
- `inscricaoEstadual`
- `suframa`
- `substitutoTributario`
- `email`
- `whatsapp`
- `endereco.*`

Catálogo operacional do tomador:
- `servicos[]`
  - `codigoServico`
  - `descricaoServico`
  - `updatedAt`

### 2.3 Emissão NFSe

Campos canônicos:
- `provider`
- `status`
- `empresaCnpj`
- `tomadorCpfCnpj`
- `tomadorRazaoSocial`
- `tomadorInscricaoMunicipal`
- `tomadorEmail`
- `tomadorMunicipio`
- `tomadorUf`
- `codigoServico`
- `descricaoServico`
- `servicoCodigoMunicipal`
- `servicoCodigoNacional`
- `numeroNfse`
- `competencia`
- `dataEmissao`
- `valorServico`
- `baseCalculo`
- `desconto`
- `aliquotaIss`
- `valorIss`
- `retPis`
- `retCofins`
- `retCsll`
- `retIr`
- `retInss`

Campos analíticos de 1ª classe:
- `localPrestacaoPais`
- `localPrestacaoUf`
- `localPrestacaoMunicipio`
- `tributacaoTotalFederal`
- `tributacaoTotalEstadual`
- `tributacaoTotalMunicipal`

Campos brutos complementares:
- `payload`
- `providerRequest`
- `providerResponse`
- `biSnapshot`

## 3. O que já pode alimentar relatórios

### 3.1 Receita / imposto / retenções

Pronto para relatório:
- faturamento bruto
- base de cálculo
- desconto
- ISS calculado
- retenções por tipo
- ticket médio
- contagem por status

### 3.2 Tributação do prestador

Pronto para relatório:
- regime tributário
- RBT12
- anexo/faixa
- alíquota nominal
- alíquota efetiva
- ISS de referência

### 3.3 Catálogo operacional

Pronto para relatório:
- quantidade de CNAEs cadastrados
- quantidade de favoritos municipais
- quantidade de vínculos municipais
- quantidade de serviços operacionais cadastrados

### 3.4 Localização

Pronto para relatório:
- município/UF da prestação
- município/UF do tomador
- município/UF do prestador

### 3.5 Corte por tomador

Pronto para relatório:
- top tomadores por faturamento
- top tomadores por quantidade de emissões
- concentração por CPF/CNPJ e razão social

## 4. Campos que ainda dependem do contador

Não tratar como verdade analítica até validação formal:
- preenchimento de `tributacaoTotal` a partir de heurística no frontend
- qualquer regra que conclua:
  - repartição fiscal por esfera
  - interpretação contábil de retenções como tributação total
  sem fórmula/critério aprovado

Regra operacional atual:
- manter retenções individuais como fonte confiável;
- só persistir `tributacaoTotal*` quando a origem vier corretamente definida.

## 5. Contrato mínimo para frontend

O frontend deve:
- consumir dados canônicos do backend;
- enviar `localPrestacao` na emissão;
- não inventar `tributacaoTotal`;
- usar `simplesSnapshot` quando precisar de leitura tributária consolidada;
- usar `biCatalogoResumo` quando precisar de contagem/estado do catálogo da empresa.

## 6. Próximos passos recomendados

### Prioridade alta
- expor `simplesSnapshot` e `biCatalogoResumo` em relatórios/exports;
- expor `tributacaoTotal` e `topMunicipiosPrestacao` no consumo analítico;
- validar fórmula de `tributacaoTotal` com contador.

### Prioridade média
- definir dimensão formal de tempo/competência;
- definir exportação analítica consolidada por empresa/tomador/serviço/local.

### Fora do escopo imediato
- webhook como fonte principal de status operacional;
- polling como fallback de reconciliação.
