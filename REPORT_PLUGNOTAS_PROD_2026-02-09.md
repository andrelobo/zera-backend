# RELATORIO DE PRODUCAO (09/02/2026) - PlugNotas (Manaus)

Este relatorio consolida os testes feitos em producao com o backend ZERA e a PlugNotas
para NFSe Nacional (Manaus/AM - IBGE 1302603) e registra as rejeicoes oficiais
retornadas pela API.

## Contexto

- Ambiente: producao
- Municipio: Manaus/AM (IBGE 1302603)
- Competencia observada nas respostas: 2026-02-09 (data de emissao/RPS)
- Objetivo: validar emissao com codigos de tributacao para servicos de contabilidade

## Evidencias de testes

### Teste A

- emissionId: 698a59f224e4cd053339c21f
- externalId: 0a294998-f3dc-4544-96f9-ffc7c6908983
- Payload enviado (resumo):
  - servico.codigoNacional: 171901
  - servico.codigoMunicipal: 100
- Resultado:
  - Status: REJECTED
  - Codigo: E0312
  - Mensagem: "codigo de tributacao nacional informado nao esta administrado pelo municipio ... na data de competencia"

### Teste B

- emissionId: 698a5edf24e4cd053339c24d
- externalId: 0b36b977-bbed-459e-95c9-b1dde89ae274
- Payload enviado (resumo):
  - servico.codigoNacional: 171901
  - servico.codigoTributacao: 001
- Resultado:
  - Status: REJECTED
  - Codigo: E0314
  - Mensagem: "codigo de tributacao municipal informado nao existe ou nao esta administrado ... na data de competencia"

### Teste C

- emissionId: 698a61c524e4cd053339c286
- externalId: 301af169-2a2c-42af-bf01-2e2435f12717
- Payload enviado (resumo):
  - servico.codigoNacional: 171901
  - servico.codigoTributacao: 001
  - codigoMunicipal removido no input
- Resultado:
  - Status: REJECTED
  - Codigo: E0314
  - Mensagem: "codigo de tributacao municipal informado nao existe ou nao esta administrado ... na data de competencia"

### Teste D

- emissionId: 698a6ac424e4cd053339c294
- externalId: ffd6e161-1db1-4b81-8dd3-570c4b3362d4
- Payload enviado (resumo):
  - servico.codigoNacional: 171901
  - servico.codigoTributacao: 001
  - tentativa com codigoMunicipal 1719 (contabilidade) no input
- Resultado:
  - Status: REJECTED
  - Codigo: E0314
  - Mensagem: "codigo de tributacao municipal informado nao existe ou nao esta administrado ... na data de competencia"

## Conclusao tecnica

- O backend envia corretamente os dados basicos (prestador, tomador, servico) e a PlugNotas
  aceita o envio, retornando processamento e status final.
- As rejeicoes sao consistentes e indicam **nao administracao** dos codigos de tributacao
  (nacional e/ou municipal) **na competencia atual** do municipio de Manaus.

## Perguntas objetivas para o suporte (PlugNotas)

1. Quais codigos **cTribNac** e **cTribMun** estao **administrados** para Manaus
   (IBGE 1302603) na competencia atual?
2. Existe algum mapeamento automatico entre `codigoTributacao` e `cTribMun` para Manaus?
3. Manaus esta integralmente habilitada no ambiente nacional para NFSe na competencia atual?

