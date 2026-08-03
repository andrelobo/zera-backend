# LOBONOTAS — 06. Spec do Ambiente Nacional NFS-e (SEFIN)

> Pesquisa oficial do Slice 2 (doc 04). Fonte de verdade para o contrato LOBONOTAS, com **citação de documentação oficial** em cada conclusão (regra D13).
> Data de consulta: **01/08/2026** (atualizado em **03/08/2026**: R10 NT 008 v1.02 DANFSe e R11 texto integral do Decreto 6.743). Ambientes testados: **Produção Restrita** (`sefin.producaorestrita` / `adn.producaorestrita`).
> Regra: sem referência oficial → marcado `[PENDENTE]`.

---

## 0. Referências oficiais usadas

| Ref | Documento | Versão/Data | Origem |
|---|---|---|---|
| R1 | Esquemas XSD do Sistema Nacional NFS-e (`esquemas_xsd`) — Schemas 1.00 e 1.01 | zip oficial (download direto) | gov.br NFS-e → Biblioteca → Documentação Técnica |
| R2 | Manual dos Contribuintes — Emissor Público Nacional (API Sefin Nacional NFS-e) | v1.0, 17/03/2025 | gov.br NFS-e |
| R3 | Manual dos Contribuintes — ADN NFS-e (APIs de consulta) | v1.0, 12/02/2026 | gov.br NFS-e |
| R4 | Anexo I — Lista Nacional de Serviços (LC 116/03) e regras de incidência | planilha oficial | gov.br NFS-e |
| R5 | Anexo II — Leiautes de Regras de Negócio dos Eventos de NFS-e (4 planilhas) | planilha oficial | gov.br NFS-e |
| R6 | Tabela de Municípios Conveniados / Monitoramento de Adesões | atualizada 10/07/2026 | gov.br NFS-e (`municipiosaderentes20260710.xlsx`) |
| R7 | Decreto nº 6.743 da Prefeitura de Manaus (adoção NFS-e Padrão Nacional) | DOM 16/12/2025 | Prefeitura de Manaus / imprensa |
| R8 | Portaria nº 3/2026-SUBREC/SEMEF (regras de adoção integral) | 10/04/2026 | Prefeitura de Manaus |
| R9 | LC nº 214, de 16/01/2025 (reforma tributária; NFS-e Padrão Nacional) | 2025 | Planalto |
| R10 | **Nota Técnica nº 008 SE/CGNFS-e — DANFSe (especificações técnicas)** | **v1.02, 14/07/2026** | gov.br NFS-e → Documentação Técnica (PDF oficial) |
| R11 | Decreto nº 6.743 — **texto integral** (DOM Manaus 16/12/2025) | DOM 16/12/2025 | Prefeitura de Manaus (via LegisWeb, republicação) |

Artefatos arquivados em `/tmp/opencode/lobonotas/oficial/` (fora do repo, para consulta):
`esquemas-xsd-producao.zip` (→ `esquemas/Schemas/1.00|1.01/`), `anexo-i-dps.xlsx`, `anexo-ii-eventos.xlsx`, `manual-adn-contribuintes.pdf`, `manual-contribuintes-emissor-publico.pdf`, `municipios-aderentes.xlsx`, `nt008-danfse-v1-02.pdf` (+ `.txt` extraído), `decreto-6743-manaus.md`.

---

## 1. Endpoints oficiais (API do Emissor Público Nacional / Sefin Nacional NFS-e)

Fonte: R2 (Manual Emissor Público, §1.2–1.5). Mensagens de comunicação com a API em **JSON**; o leiaute do DF-e (DPS/NFS-e/evento) em **XML com assinatura digital** (R2 §1.5.2).

### 1.1 API Parâmetros Municipais (R2 §1.2.1)

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/parametros_municipais/{codigoMunicipio}/convenio` | Parâmetros do convênio do município |
| GET | `/parametros_municipais/{codigoMunicipio}/{codigoServico}` | Alíquotas, regimes especiais, deduções/reduções por subitem |
| GET | `/parametros_municipais/{codigoMunicipio}/{CPF/CNPJ}` | Retenções que o contribuinte deve recolher |
| GET | `/parametros_municipais/{codigoMunicipio}/{CPF/CNPJ}` | Benefícios municipais do contribuinte |

### 1.2 API NFS-e (R2 §1.3)

| Método | Endpoint | Objetivo |
|---|---|---|
| POST | `/nfse` | **Geração síncrona da NFS-e** a partir da DPS; valida e rejeita (mensagem de erro) ou devolve **o XML da NFS-e gerada**; caso a DPS contenha chave de NFS-e a substituir, gera **Evento de Cancelamento por Substituição** e devolve a substituta (R2 §1.3.2a) |
| GET | `/nfse/{chaveAcesso}` | Consulta NFS-e pela chave de acesso (R2 §1.3.2b) |

> **Nota (sem `protocolo`)**: o retorno da emissão é o **XML da NFS-e** (com `cStat`, `dhProc`, `nDFSe`), e não um "protocolo" à moda dos municípios/ABRASF (R2 §1.3.2a; R1 `TCInfNFSe`). Ver §4.

### 1.3 API DPS (R2 §1.4)

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/dps/{id}` | Recupera a **chave de acesso da NFS-e** a partir do identificador da DPS (sigilo fiscal: só se o certificado da conexão for Prestador/Tomador/Intermediário da NFS-e) |
| HEAD | `/dps/{id}` | Informa se a NFS-e foi gerada a partir do identificador da DPS (qualquer usuário com certificado válido) |

Identificador da DPS = Código IBGE do Município Emissor (7) + Tipo Inscrição (1) + Inscrição Federal (14, CPF com zeros à esquerda) + Série DPS (5) + Núm. DPS (15) (R2 §1.4.1).

### 1.4 API Eventos (R2 §1.5)

| Método | Endpoint | Objetivo |
|---|---|---|
| POST | `/nfse/{chaveAcesso}/eventos` | Registro de evento (modelo genérico; pedido de registro de evento com parte genérica + parte específica por tipo) |
| GET | `/nfse/{chaveAcesso}/eventos` | Consulta todos os eventos da NFS-e |
| GET | `/nfse/{chaveAcesso}/eventos/{tipoEvento}` | Consulta eventos por tipo |
| GET | `/nfse/{chaveAcesso}/eventos/{tipoEvento}/{numSeqEvento}` | Consulta evento específico por tipo + sequencial |

### 1.5 API ADN (consulta) — R3 (Manual ADN, v1.0)

| Método | Endpoint | Objetivo |
|---|---|---|
| GET | `/DFe/{NSU}` | Consulta de DF-e no ADN por NSU |
| GET | `/NFSe/{ChaveAcesso}/Eventos` | Consulta eventos de uma NFS-e no ADN |

### 1.6 Ambiente de Produção Restrita (testes)

| Ref | URL |
|---|---|
| R2 §1.6 (Swagger) | `https://adn.producaorestrita.nfse.gov.br/contribuintes/docs/index.html` |
| Testado | `https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional/docs/index` → **HTTP 403** |
| Testado | `https://adn.producaorestrita.nfse.gov.br/contribuintes/swagger/v1/swagger.json` → **HTTP 496 SSL Certificate Required** |

**Conclusão operacional**: o acesso exige **certificado digital de cliente (mTLS)**. Sem certificado, as URLs de docs/Swagger não abrem. Endpoints definitivos de produção/homologação para integração: `[PENDENTE]` (dependem de credencial do piloto/Produção Restrita; as rotas relativas acima são as oficiais).

---

## 2. Leiaute XSD oficial (v1.01) — R1

Namespace: `http://www.sped.fazenda.gov.br/nfse`. Schemas principais: `DPS_v1.01.xsd`, `NFSe_v1.01.xsd`, `evento_v1.01.xsd`, `pedRegEvento_v1.01.xsd`, `tiposComplexos_v1.01.xsd`, `tiposSimples_v1.01.xsd`.

### 2.1 DPS (`TCDPS` / `TCInfDPS`)

- Estrutura: `DPS` (`infDPS` + `ds:Signature` **opcional**) + atributo `versao`.
- `TCInfDPS` campos: `tpAmb` (1 Produção; 2 Homologação), `dhEmi` (UTC `AAAA-MM-DDThh:mm:ssTZD`), `verAplic`, `serie` (máx. 5, pattern `^0{0,4}\d{1,5}$`), `nDPS` (máx. 15, pattern `[1-9]{1}[0-9]{0,14}`), `dCompet` (`AAAAMMDD`), `tpEmit` (1 Prestador; 2 Tomador; 3 Intermediário), `cMotivoEmisTI?`, `chNFSeRej?`, `cLocEmi` (IBGE 7), `subst?` (`TCSubstituicao`), `prest`, `toma?`, `interm?`, `serv`, `valores`, `IBSCBS?`.
- Atributo `@Id` = **`TSIdDPS`**: `"DPS"` + Cód.Mun(7) + Tipo Inscrição(1) + Inscrição Federal(14) + Série DPS(5) + Núm. DPS(15) = **45 posições**, pattern `DPS[0-9]{42}`.
- `TCServ` (serviço): `locPrest` (**TCLocPrest** → `cLocPrestacao` IBGE 7) + `cServ` (**TCCServ** → `cTribNac` 6, `cTribMun?`, `xDescServ`) + opcionais (`comExt?`, `obra?`, `atvEvento?`, `infoCompl?`).
- `valores` = **`TCInfoValores`**: `vServPrest` (`vServ`), `vDescCondIncond?`, `vDedRed?`, `trib` (**`TCInfoTributacao`** = `tribMun` + `tribFed?` + `totTrib`).
- `TCTribMunicipal` ordem: `tribISSQN`, `cPaisResult?`, `tpImunidade?`, `exigSusp?`, `BM?`, `tpRetISSQN`, `pAliq?`.
- **Assinatura (implementada no Slice 3)**: `ds:Signature` é **opcional** no XSD da DPS, mas a Sefin exige assinatura do emissor para a DPS de emissor próprio/WS. Padrão implementado: enveloped, c14n **inclusivo** (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`), `Reference` apontando `#TSIdDPS` para `infDPS`, digest **SHA-256** e assinatura **RSA-SHA256**, `KeyInfo/X509Data` com o certificado A1 — ver `src/fiscal/infra/sefin/dps-signer.ts`.

### 2.2 NFS-e (`TCNFSe` / `TCInfNFSe`)

- Estrutura: `NFSe` (`infNFSe` + `ds:Signature` **obrigatória**) + atributo `versao`.
- `TCInfNFSe` campos: `xLocEmi`, `xLocPrestacao`, `nNFSe` (número sequencial gerado pela Sefin por emitente), `cLocIncid?`, `xLocIncid?`, `xTribNac`, `xTribMun?`, `xNBS?`, `verAplic`, `ambGer` (1 Sistema próprio do município; 2 Sefin Nacional; 3 ADN), `tpEmis` (1 app do contribuinte/WS; 2 Web fisco; 3 App fisco), `procEmi?`, **`cStat`** (código de status da mensagem), **`dhProc`** (data/hora da validação da DPS e geração da NFS-e, UTC), **`nDFSe`** (número sequencial do documento gerado por ambiente gerador de DFSe), `emit`, `valores`, `xOutInf?`, `IBSCBS?`, `DPS`.
- Atributo `@Id` = **`TSIdNFSe`** (chave de acesso): `"NFS"` + Cód.Mun(7) + Amb.Ger(1) + Tipo Inscrição(1) + Inscrição Federal(14) + Nº NFS-e(13) + AnoMes Emissão(4) + Cód.Num(9) + DV(1) = **53 posições**, pattern `NFS[0-9]{50}`.

### 2.3 Evento (`evento_v1.01.xsd` + Anexo II — R5)

- `TCEvento`: `infEvento` (`verAplic`, `ambGer`, `nSeqEvento` 1–3 dígitos, `dhProc` UTC, `nDFSe` 1–13, `pedRegEvento`) + `ds:Signature` **obrigatória** no envio à API.
- `pedRegEvento`: `infPedReg` (`id` 59, `tpAmb`, `verAplic`, `dhEvento` UTC, `CNPJAutor`/`CPFAutor`, `chNFSe` 50, parte específica por tipo `e######`, `Signature?`).

### 2.4 Catálogo de eventos (Anexo II — planilha "TIPO EVENTOS DE NFSe")

Código do evento = 6 dígitos, formado por 4 grupos: **categoria (1) + autor (2) + ambiente (3) + sequencial (4)** (R5). Tag XML = `e` + 6 dígitos.

| Categoria | Evento | Código | Tag XML |
|---|---|---|---|
| 1 Cancelamentos | Cancelamento de NFS-e | `1 01 1 01` | `e101101` |
| 1 | Cancelamento por Substituição | `1 05 1 02` | `e105102` |
| 1 | Solicitação de Análise Fiscal | `1 01 1 03` | `e101103` |
| 1 | Cancelamento Deferido por Análise Fiscal | `1 05 1 04` | `e105104` |
| 1 | Cancelamento Indeferido por Análise Fiscal | `1 05 1 05` | `e105105` |
| 2 Manifestações | Confirmação do Prestador | `2 02 2 01` | `e202201` |
| 2 | Confirmação do Tomador | `2 03 2 02` | `e203202` |
| 2 | Confirmação do Intermediário | `2 04 2 03` | `e204203` |
| 2 | Confirmação Tácita | `2 05 2 04` | `e205204` |
| 2 | Rejeição do Prestador | `2 02 2 05` | `e202205` |
| 2 | Rejeição do Tomador | `2 03 2 06` | `e203206` |
| 2 | Rejeição do Intermediário | `2 04 2 07` | `e204207` |
| 2 | Anulação da Rejeição | `2 05 2 08` | `e205208` |
| 3 Ofícios | Cancelamento por Ofício | `3 05 1 01` | `e305101` |
| 3 | Bloqueio por Ofício | `3 05 1 02` | `e305102` |
| 3 | Desbloqueio por Ofício | `3 05 1 03` | `e305103` |

Regras de negócio por evento (aceite/rejeição, autor, assinatura, precedência entre eventos) constam nas planilhas "RN EVENTOSxEVENTOS" e "RN EVENTO_PED.REG.EVENTO" (R5).

### 2.5 DANFSe — Documento Auxiliar da NFS-e (R10)

Fonte: **Nota Técnica nº 008 SE/CGNFS-e, v1.02, de 14/07/2026** (especificações técnicas do DANFSe). Histórico: v1.0 (→) → v1.01 (30/06/2026, alteração da data de suspensão da API de geração) → v1.02 (14/07/2026, alteração da data de suspensão; quantidade de caracteres dos campos; ajuste em `vPis`/`vCofins`/`tpRetPisCofins`; outras correções).

- **Suspensão da API oficial de geração**: a API `https://adn.nfse.gov.br/danfse/docs/index.html` é **sobrestada (suspensa) em 03/08/2026** — a geração do DANFSe passa a ser feita **pelos próprios sistemas de emissão** (ERP/sistemas fiscais), conforme a NT 008.
- **Finalidade**: documento auxiliar impresso em papel para consulta resumida dos dados da NFS-e e apoio a processos administrativos/financeiros do destinatário não credenciado. Impresso em **uma única via**, em qualquer papel exceto jornal; **obrigatoriamente em uma única página**, modo retrato, tamanho mínimo **A4** (210×297 mm); margens laterais 0,15–0,20 cm; linhas divisórias 0,5 pt e borda de página 1 pt; cabeçalho/títulos de blocos e os campos "Emitente da NFS-e" e "Valor Líquido da NFS-e + IBS/CBS" com sombreamento cinza claro 5%.
- **Modelo**: o **Anexo I** define a disposição dos campos (obrigatória). Fontes: **Arial** (títulos/labels) e **Microsoft Sans Serif** (conteúdo), preto sólido K100. Tamanhos: títulos de blocos 7 pt negrito caixa alta; labels de campos 6 pt negrito (7 pt caixa alta nos blocos de identificação); conteúdo 7 pt normal. Cabeçalho: logo NFS-e (canto esquerdo), ao centro **"DANFSe v2.0"** + "Documento Auxiliar da NFS-e" (9 pt negrito Arial), à direita nome do município/ambiente gerador/tipo de ambiente; **QR Code** (mín. 1,52×1,52 cm, em X 17,48/Y 1,67) apontando para `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=<ChaveDeAcesso>`.
- **Ambiente de homologação**: NFS-e com `tpAmb=2` → incluir, no cabeçalho, abaixo de "Documento Auxiliar da NFS-e", a expressão **"NFS-e SEM VALIDADE JURÍDICA"** em vermelho sólido (M100/Y100), 9 pt negrito Arial.
- **Campos do DANFSe (seções 2.1.1–2.1.13)**: Chave de Acesso (50 dígitos); Identificação da NFS-e (número, competência, data/hora da emissão, número/série/data da DPS, emitente, situação, finalidade); Prestador/Fornecedor (CNPJ/CPF/NIF, Inscrição, telefone, nome, município/UF, código IBGE/CEP, endereço, e-mail, Simples Nacional na competência, regime de apuração); Tomador/Adquirente; Destinatário da Operação; Intermediário da Operação; Serviço Prestado (cód. tributação Nacional/Municipal, NBS, local da prestação, descrições); Tributação Municipal ISSQN; Tributação Federal (exceto CBS: IRRF, contribuição previdenciária retida, contribuições sociais retidas, PIS/COFINS); Tributação IBS/CBS (CST/cClassTrib, indicador de operação, exclusões/reduções, alíquotas e valores apurados IBS Estadual/Municipal e CBS); Valor Total da NFS-e (vServ, descontos, total retenções, valor líquido, total IBS/CBS, valor líquido + IBS/CBS); Informações Complementares (obrigatória a linha **"Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais/Estaduais/Municipais"**, separadas por `|`); Canhoto (opcional).
- **Supressões permitidas (2.3)**: blocos de Tomador/Destinatário/Intermediário/Tributação Municipal podem ser substituídos por textos fixos ("...NÃO IDENTIFICADO NA NFS-e" / "O DESTINATÁRIO É O PRÓPRIO TOMADOR/ADQUIRENTE..." / "TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN"), redistribuindo a altura para "Descrição do Serviço"/"Informações Complementares". Campos sem dados no XML devem ser preenchidos com **traço (–)** (nota 12).
- **Marca d'água (2.5)**: **"CANCELADA"** quando houver cancelamento; **"SUBSTITUÍDA"** quando houver substituição; na diagonal, Arial, mín. 50 pt, cinza K35.
- **Leiaute real dos campos (2.4.5)**: tabela com caminho XML, tamanho (alt./larg.) e posição (X/Y) em centímetros de cada campo — ver PDF arquivado (`nt008-danfse-v1-02.pdf`); requisito de 1 página em A4 com ~29 blocos fixos.
- **Notas aplicáveis à implementação**: linha de tributação federal "PIS/COFINS" imprime só até competência 31/12/2026 (nota 6); `vPis`/`vCofins`/`tpRetPisCofins`: quando `tpRetPisCofins=1` (Retido) as contribuições retidas somam-se em "Contribuições Sociais – Retidas" e `vPis`/`vCofins` zeram (ajuste da v1.02); ops. com fatos geradores IBS/CBS sem documento fiscal (NT 007 seção 3.a) terão NT específica do DANFSe (a publicar).

---

## 3. Situação oficial de Manaus (piloto)

### 3.1 Adesão ao Padrão Nacional (R6)

Linha Manaus (1302603) na tabela oficial de municípios aderentes (gov.br, atualização 10/07/2026):

| Campo | Valor |
|---|---|
| StatusConvênioSEFIN | **Conveniado Ativo** |
| AderenteAmbienteNacional | **Sim** |
| AderenteEmissorNacional | **Sim** |
| AderenteMAN | Não |
| AtivoNaBase / AtivoÚltimoPeríodo | Sim / Sim |
| Publicação | 23/09/2022 |
| **Início de Vigência** | **01/12/2025** |

### 3.2 Obrigatoriedade (R7/R8/R9/R11)

- **Decreto nº 6.743** (Prefeitura de Manaus, publicado no DOM em 16/12/2025; texto integral lido — R11): adoção **obrigatória e exclusiva** da NFS-e Padrão Nacional a partir de **1º/01/2026** (art. 1º), para todos os prestadores estabelecidos em Manaus contribuintes do ISSQN (ainda que imunes, isentos ou Simples Nacional), substituindo todos os demais modelos de documentos fiscais de serviços vigentes. Emissão exclusivamente pelos emissores do Portal Nacional — web, mobile ou **API** (art. 3º). Acesso/autenticação (certificado digital, gov.br ou login/senha), habilitação e leiautes seguem as normas do Portal Nacional (art. 4º).
- **Recolhimento do ISSQN** (art. 5º): até o **dia 10 do mês subsequente** ao da competência, com guia gerada no portal "Nota Manaus"; optantes do Simples Nacional recolhem via **DAS/PGDAS-D** (exceto impedidos/sublimite → regra geral); responsável solidário do setor público apura em **regime de caixa** (§2º). Emissão constitui **confissão de dívida** (art. 6º).
- **Cancelamento e substituição** (arts. 7º–8º): cancelamento/substituição **no mesmo sistema** em que o documento foi emitido (art. 7º). Prazos para NFS-e Padrão Nacional (art. 8º): substituição em até **9 dias**; cancelamento solicitado em até **90 dias** (365 dias quando tomador = responsável solidário do setor público); o pedido de cancelamento **não suspende o débito** — exige formalização de processo administrativo via SIGED. Notas "Nota Manaus" (inclusive retroativas pós 01/01/2026) cancelam-se por processo administrativo.
- **"Nota Manaus"** (arts. 11–13): sistemas municipais desativados para fatos geradores a partir de 01/01/2026; a partir dessa data a NFS-e Padrão Nacional é o **único documento válido** e fica vedada a emissão pelo Nota Manaus para fatos geradores novos; o sistema legado permanece apenas para retroativa (fato gerador anterior), consulta/cancelamento/substituição das próprias notas e geração das **guias do ISSQN**.
- **Portaria nº 3/2026-SUBREC/SEMEF** (10/04/2026): regras para adoção integral, revogando a IN 001/2012-GS/SEMEF.
- Adequação técnica (contribuintes/ERP): sistemas próprios de emissão (API) devem se comunicar com o Sistema da Nota Nacional **até 31/12/2025** (art. 14); ERPs devem migrar de RPS para **DPS** do padrão nacional.

> Observação (03/08/2026): a leitura direta do texto do Decreto 6.743 foi realizada (R11, republicação do DOM Manaus 16/12/2025 via LegisWeb) e a pendência de fonte primária foi **resolvida** — ver §5.

---

## 4. Resolução dos identificadores canônicos (doc 03 §4.3)

| Conceito | Nome canônico | LOBONOTAS (Nacional/SEFIN) | Ref |
|---|---|---|---|
| Chave de correlação do ZERA | `idempotencyKey` / `referenciaExterna` | `idIntegracao` (legado PlugNotas) **↔** Nacional usa o **`Id` da DPS** (`TSIdDPS`) como chave única do documento; envio síncrono via `POST /nfse` não prevê lote | R2, R1 |
| Id do provider | `externalId` | **Chave de acesso da NFS-e** = `TSIdNFSe` (`"NFS"` + 50 dígitos); recuperável a partir do `Id` da DPS via `GET /dps/{id}` | R1, R2 §1.4 |
| Protocolo | `protocolo` | **Não existe no padrão Nacional.** O retorno da emissão é o XML da NFS-e com `cStat`/`dhProc`/`nDFSe`. Campo canônico permanece `[PENDENTE]`/N/A para LOBONOTAS (legado PlugNotas/municipal) | R1, R2 §1.3.2a |
| Nº NFS-e | `numeroNfse` | `TCInfNFSe/nNFSe` (número sequencial por emitente) | R1 |
| Nº DPS | `dpsNumero` | `TCInfDPS/nDPS` (`TSNumDPS`, máx. 15) | R1 |
| Série DPS | `dpsSerie` | `TCInfDPS/serie` (`TSSerieDPS`, máx. 5) | R1 |
| Código verificação | `codigoVerificacao` | **Não existe campo próprio na NFS-e Nacional.** Existe apenas `TSCodVerificacao` (1–9 alfanum) para `cVerifNFSeMun` em dedução de "outras NFS-e municipais" (`TCDocOutNFSe`). A chave `TSIdNFSe` embute Cód.Num(9)+DV(1) | R1 |
| Status | `status` | `cStat` + `dhProc` na NFS-e; eventos alteram situação (cancelamento/manifestações) | R1, R5 |

**Decisão de mapeamento (a validar com owner):**
1. `numeroNfse` → `nNFSe`; `dpsNumero` → `nDPS`; `dpsSerie` → `serie` (nomenclatura oficial do XSD). Compatível com os nomes legados já expostos (`numeroNfse`, `dpsNum`, `serieDpsNum`).
2. `externalId` → chave de acesso `TSIdNFSe` (a "referência de documento" canônica no Nacional).
3. `protocolo` e `codigoVerificacao` ficam **N/A para emissões LOBONOTAS** (campos legados PlugNotas persistem para as emissões antigas).

---

## 5. Pendências oficiais (`[PENDENTE]`)

- [ ] URL base definitiva de **Produção** para emissão/consulta via API (produção restrita confirmada apenas para testes; ver R2 §1.6).
- [ ] Fluxo de **autenticação mTLS** detalhado (headers/cert chain) — R3 menciona certificado com CNPJ raiz do contribuinte consultado; detalhes técnicos de handshake para o piloto.
- [ ] Regras de **prazo/cancelamento** parametrizáveis por município (R5 menciona prazos e valores parametrizados pelo município emissor) — **Manaus resolvida (R11)**: substituição até 9 dias e cancelamento até 90 dias (365 p/ responsável solidário do setor público), cancelamento/substituição no mesmo sistema, pedido não suspende débito (art. 8º). Outros municípios `[PENDENTE]`.
- [ ] Leitura direta do texto do Decreto 6.743 no DOM (confirmação pontual da obrigatoriedade) — **resolvida (03/08/2026)**: texto integral via R11; ver §3.2.
- [ ] Geração/validação do **DANFSE** oficial da Sefin Nacional — **resolvida (03/08/2026)**: especificação oficial na **NT 008 v1.02 (R10)**, §2.5; **API oficial de geração suspensa em 03/08/2026** → geração deve ser própria (ERP/sistema fiscal); modelo no Anexo I.

**Resolvidas no Slice 3 (01/08/2026):**
- ✅ Dependência de assinatura XML aprovada e instalada: `xml-crypto@6.1.2` (lib pura JS) + `@types/xml-crypto`.
- ✅ `dps-builder.ts` + `dps-signer.ts` implementados (detalhes na §2.1 e no doc 04/Slice 3).
- ✅ DPS assinada validada contra `DPS_v1.01.xsd` oficial (lxml; libxml2 não suporta âncoras `^`/`$` nos `xs:pattern` — removidas para a validação local, pois o XSD já é implicitamente ancorado).
- ✅ Fix estrutural detectado na validação: `locPrest` pertence a `serv` (`TCServ`), não direto no `infDPS`.

**Resolvidas no Slice 4 (01/08/2026):**
- ✅ Cliente mTLS (A1) via `node:https` — `sefin-mtls.http.ts` (timeout → `SEFIN_REQUEST_TIMEOUT`, cert verify → `SEFIN_CERT_VERIFY_FAILED`, HTTP status → `SEFIN_HTTP_ERROR` com `retryAfterMs`).
- ✅ Config `sefin.config.ts`: base URLs de Produção Restrita/ADN, `tpAmb` inferido (1 produção / 2 demais), `cLocEmi`, série DPS, timeouts/retry, `SEFIN_NFSE_ENVELOPE=xml|json`.
- ✅ Mapeador `sefin-mapper.ts` + helpers `sefin-xml.ts`: extração de `cStat`/`xMotivo`/`chaveAcesso`/`dhProc`/`nNFSe`/`nDFSe`, tolerante a prefixo de namespace e a XML embutido em JSON; `cStat` 4xx/5xx ⇒ `REJECTED`, 1xx/2xx ⇒ `PENDING`, presença de `infNFSe` ⇒ `AUTHORIZED`.
- ✅ `SefinNfseProvider`: emissão síncrona `POST /nfse` (DPS assinada), timeout pós-DPS ⇒ `PENDING` com `transmitidoSemConfirmacao` e `externalId = Id da DPS` (reconciliação D5 via `GET /dps/{id}`), consulta `GET /nfse/{chave}`, `baixarXmlNfse` na mesma trilha, `baixarPdfNfse` vazio (DANFSE = Slice 7), cancelamento/eventos ⇒ `SEFIN_EVENTO_NOT_IMPLEMENTED` (Slice 7).
- ✅ Numeração atômica da DPS na `Empresa` (`dpsContador` + `dpsSerieContador`) com rollover de série; seed inicial a partir do campo espelho `dpsNum`.
- ✅ Wiring atrás de `SEFIN_ENABLED` (default `false`) no `FiscalModule`; PlugNotas segue provider ativo na ausência/false.

**Ainda pendentes (`[PENDENTE]`):**
- [ ] **Envelope real do `POST /nfse`** (XML puro vs JSON com DPS) e **tabela real de `cStat`** — confirmar com credencial piloto; por isso `SEFIN_NFSE_ENVELOPE` é configurável e o mapeador aceita ambos.
- [ ] **Leiaute real do evento** (`pedRegEvento_v1.01.xsd`/`evento_v1.01.xsd` — campos exatos da parte específica `e101101`, formato do `@Id`, `nSeqEvento`/`nDFSe` obrigatórios) e **tabela real de `cStat` de eventos** — estrutura atual do `TCEvento` em `evento-builder.ts` é a interpretação documentada da §2.3/§2.4, a validar com credencial piloto.
- [ ] Teste real de handshake mTLS contra Produção Restrita (certificado do piloto).
- [ ] Confirmação do prestador piloto (candidata natural: **Burgus LTDA**, CNPJ `43521115000134` — prestador Manaus com certificado A1 real no fluxo PlugNotas atual).

**Resolvidas no Slice 7 (03/08/2026) — cancelamento/eventos:**
- ✅ `evento-builder.ts` implementa o pedido de registro do cancelamento (`e101101`) como **`TCEvento`** (§2.3): `infEvento` (`Id="e101101{chNFSe}"`, `verAplic`, `ambGer`=`tpAmb`, `nSeqEvento`, `dhProc` UTC, `nDFSe`) + `pedRegEvento`/`infPedReg` (`Id="pedRegEvento{chNFSe}"`, `tpAmb`, `verAplic`, `dhEvento`, `CNPJAutor`, `chNFSe`, `e101101` com `versao`+`xJust`) + `ds:Signature` enveloped sobre `infEvento` (mesma rotina c14n inclusiva/SHA-256 da DPS).
- ✅ `SefinMtlsHttp.registrarEvento` (`POST /nfse/{chave}/eventos`, `application/xml`) e `consultarEventos` (`GET /nfse/{chave}/eventos[/{tipoEvento}[/{numSeq}]]`).
- ✅ `LobonotasProvider.solicitarCancelamentoNfse`/`consultarSolicitacaoCancelamentoNfse` (removido `SEFIN_EVENTO_NOT_IMPLEMENTED`); mapeamento de `CANCELED` por eventos no `sefin-mapper`; stub SEFIN com API Eventos (cenários `NFS7..` cancelada / `NFS8..` inexistente / `NFS9..` não cancelável) + integração mTLS real.
- ✅ **Decisão de mapeamento do "protocolo" de cancelamento (§6)**: como o Nacional não tem protocolo de cancelamento, `solicitarCancelamentoNfse` devolve **`protocol = chave de acesso`** (o `nProt` do evento fica na `providerResponse`). Assim `GET /nfse/cancelamento/:cancellationProtocol` consulta os eventos da chave.
- ⏳ Leiaute real de `pedRegEvento_v1.01.xsd`/`evento_v1.01.xsd` e tabela real de `cStat` de eventos → `[PENDENTE]` (credencial piloto).

---

## 6. Implicações para os slices seguintes

- **Slice 3 (DPS)**: usar `TCInfDPS` + `TSIdDPS` (XSD 1.01) e assinar `DPS` (Signature **opcional** na DPS, mas a NFS-e gerada sempre vem assinada pela Sefin; no envio por WS o **evento/pedRegEvento** exige assinatura). Validação com os XSD arquivados. **Status: concluído** (builder + signer + validação XSD — doc 04 §Slice 3).
- **Slice 4 (cliente)**: endpoints relativos de R2 (emissão/consulta/eventos) + ADN (R3); mTLS com certificado A1 do prestador; Produção Restrita em `*.producaorestrita.nfse.gov.br`. **Status: implementado em `fiscal/infra/sefin/*`** (cliente, config, mapper, provider, contador DPS, wiring `SEFIN_ENABLED`) — envelope real e tabela `cStat` permanecem `[PENDENTE]` até acesso com credencial piloto.
- **Slice 7 (cancelamento/substituição)**: via **API Eventos** (`POST /nfse/{chave}/eventos`) com código `1 01 1 01` (cancelamento) e `1 05 1 02` (por substituição — gerado automaticamente no `POST /nfse` quando a DPS traz `subst/chSubstda`). **Status do cancelamento: implementado** (ver "Resolvidas no Slice 7" na §5); substituição é **nativa do padrão** e fica para um próximo passo (diferente do que se supunha no doc 04 §"Itens pendentes").
- **Cancelamento legado vs Nacional**: o frontend expõe `POST /nfse/:id/cancelamento` e `GET /nfse/cancelamento/:cancellationProtocol` (doc 03 §1); no Nacional não há "protocolo de cancelamento" — o estado deriva dos **eventos** da chave de acesso (R5). Ponto de mapeamento a resolver no Slice 7.
- **DANFSe / PDF (Slice 7)**: geração própria implementada em `fiscal/infra/sefin/danfse.ts` e ligada ao `LobonotasProvider.baixarPdfNfse`. O gerador consome o XML da NFS-e e produz DANFSe v2.0 em A4/página única conforme NT 008 v1.02 (§2.5 + Anexo I), com QR Code, marca d'água CANCELADA/SUBSTITUÍDA e "NFS-e SEM VALIDADE JURÍDICA" quando `tpAmb=2`; testes cobrem parsing, campos tributários, eventos, XML mínimo e PDF de uma página.
