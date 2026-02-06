# Relatorio tecnico - NFSe Nacional Manaus (PlugNotas)
Data: 2026-02-06
Ambiente: Producao (PlugNotas)

## 1) Contexto
- Backend ZERA (NestJS) emitindo NFSe Nacional via PlugNotas.
- Municipio: Manaus/AM (IBGE 1302603).
- Prestador: CNPJ 43.521.115/0001-34, IM 51754301.

## 2) Problema inicial
- Erro E0116: IM obrigatoria na DPS.

### Ajustes realizados
- Envio de IM no payload do PlugNotas:
  - emitente.inscricaoMunicipal
  - prestador.inscricaoMunicipal
- Persistencia do payload enviado no Mongo (campo providerRequest).

### Resultado
- E0116 deixou de ocorrer (IM confirmada no payload enviado).

## 3) Problema atual (producao)
- Erro E0312: codigo de tributacao nacional nao administrado na competencia.
- Erro E0314: codigo de tributacao municipal inexistente/nao administrado.

## 4) Tentativas de codigo
- cTribNac 171901 (contabilidade) -> E0312.
- cTribNac 172001 (consultoria) -> E0312.
- cTribNac 170101 (assessoria/consultoria) -> E0312.
- cTribNac 171901 + cTribMun 100 (do XML do Portal Nacional em homologacao) -> E0312 ou E0314.
- cTribNac 171901 sem cTribMun -> E0312.
- cTribNac 171901 + cTribMun 100 + codigoTributacao 001 -> E0314.

## 5) Evidencia do Portal Nacional (homologacao)
- XML autorizado (Portal Nacional) com:
  - cTribNac = 171901
  - cTribMun = 100
  - Competencia: 2026-01-21
- Em producao, os mesmos codigos retornam E0312/E0314.

## 6) Conclusao tecnica
- O payload esta correto e inclui IM.
- O bloqueio atual e a tabela de codigos valida em producao para Manaus (competencia atual).
- Necessario obter cTribNac/cTribMun validos em producao (contador/prefeitura/PlugNotas).

## 7) Proximos passos
- Confirmar com contador/prefeitura os codigos validos para Manaus em producao.
- Ajustar payload com os codigos validos e reenviar.

