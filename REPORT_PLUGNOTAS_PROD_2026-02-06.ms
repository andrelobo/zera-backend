.TL
Relatorio tecnico - NFSe Nacional Manaus (PlugNotas)
.AU
ZERA Backend
.AB
Data: 2026-02-06
Ambiente: Producao (PlugNotas)
.AE

.SH
Contexto
.IP \(bu 2
Backend ZERA (NestJS) emitindo NFSe Nacional via PlugNotas.
.IP \(bu 2
Municipio: Manaus/AM (IBGE 1302603).
.IP \(bu 2
Prestador: CNPJ 43.521.115/0001-34, IM 51754301.

.SH
Problema inicial
.IP \(bu 2
Erro E0116: IM obrigatoria na DPS.

.SH
Ajustes realizados
.IP \(bu 2
Envio de IM no payload do PlugNotas:
.br
- emitente.inscricaoMunicipal
.br
- prestador.inscricaoMunicipal
.IP \(bu 2
Persistencia do payload enviado no Mongo (campo providerRequest).

.SH
Resultado
.IP \(bu 2
E0116 deixou de ocorrer (IM confirmada no payload enviado).

.SH
Problema atual (producao)
.IP \(bu 2
Erro E0312: codigo de tributacao nacional nao administrado na competencia.
.IP \(bu 2
Erro E0314: codigo de tributacao municipal inexistente/nao administrado.

.SH
Tentativas de codigo
.IP \(bu 2
cTribNac 171901 (contabilidade) -> E0312.
.IP \(bu 2
cTribNac 172001 (consultoria) -> E0312.
.IP \(bu 2
cTribNac 170101 (assessoria/consultoria) -> E0312.
.IP \(bu 2
cTribNac 171901 + cTribMun 100 (do XML do Portal Nacional em homologacao) -> E0312 ou E0314.
.IP \(bu 2
cTribNac 171901 sem cTribMun -> E0312.
.IP \(bu 2
cTribNac 171901 + cTribMun 100 + codigoTributacao 001 -> E0314.

.SH
Evidencia do Portal Nacional (homologacao)
.IP \(bu 2
XML autorizado (Portal Nacional) com:
.br
- cTribNac = 171901
.br
- cTribMun = 100
.br
- Competencia: 2026-01-21
.IP \(bu 2
Em producao, os mesmos codigos retornam E0312/E0314.

.SH
Conclusao tecnica
.IP \(bu 2
O payload esta correto e inclui IM.
.IP \(bu 2
O bloqueio atual e a tabela de codigos valida em producao para Manaus (competencia atual).
.IP \(bu 2
Necessario obter cTribNac/cTribMun validos em producao (contador/prefeitura/PlugNotas).

.SH
Proximos passos
.IP \(bu 2
Confirmar com contador/prefeitura os codigos validos para Manaus em producao.
.IP \(bu 2
Ajustar payload com os codigos validos e reenviar.
