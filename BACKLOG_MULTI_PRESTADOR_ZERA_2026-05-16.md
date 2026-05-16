# BACKLOG_MULTI_PRESTADOR_ZERA_2026-05-16

Data: **16/05/2026**

## Objetivo

Organizar a evolucao do ZERA de um fluxo historicamente focado em **um prestador principal** para um fluxo capaz de operar com **varios prestadores emitindo corretamente**, sem regressao fiscal e sem perda de coerencia entre emissao, tomadores, servicos e contexto operacional.

## Premissas canonicas

1. O ZERA foi conduzido ate aqui com foco funcional em **prestador unico**.
2. O backend ja possui base relevante para receber e emitir por mais de um `CNPJ` de prestador.
3. O principal bloqueio atual esta na **orquestracao funcional e de frontend**, nao no core fiscal.
4. A recomendacao de produto, neste momento, e fortalecer **um unico ZERA multi-prestador**, e nao criar varios ZERAs separados.
5. O lema desta frente continua sendo: **sem quebrar, sem regredir, uma coisa de cada vez**.

---

## Epico 1 - Emissao multi-prestador funcional

### Historia 1.1 - Seletor de prestador na Nova DANFSE

**Objetivo**
Permitir que o usuario escolha explicitamente o prestador na emissao normal.

**Entregas**
- adicionar seletor de prestador na `Nova DANFSE`
- remover a escolha silenciosa por heuristica
- carregar o card do prestador conforme a empresa selecionada
- garantir que a emissao use o `CNPJ` escolhido

**Criterios de aceite**
- o usuario consegue escolher entre pelo menos 2 prestadores cadastrados
- a tela mostra os dados do prestador correto apos a troca
- a emissao usa exatamente o prestador selecionado
- a Burgus deixa de ser assumida implicitamente

**Estimativa**
- `4h a 6h`

### Historia 1.2 - Seletor de prestador na Emissao Rapida

**Objetivo**
Permitir que a Emissao Rapida opere com mais de um prestador.

**Entregas**
- remover a preferencia hardcoded pelo prestador padrao
- trocar o bloco atual por seletor explicito de prestador
- manter o contrato atual do payload, apenas enviando o `cnpj` correto

**Criterios de aceite**
- a Emissao Rapida lista os prestadores cadastrados
- o usuario escolhe o prestador antes de emitir
- o payload continua valido para o backend atual
- nao ha mais travamento na Burgus

**Estimativa**
- `3h a 5h`

### Historia 1.3 - Emissao validada com dois prestadores reais

**Objetivo**
Provar que o fluxo funciona com 2 empresas emissoras.

**Entregas**
- teste funcional com 2 prestadores reais cadastrados
- validacao de payload, certificado e prestador da nota emitida
- checagem de nao regressao no prestador original

**Criterios de aceite**
- ambos os prestadores conseguem emitir
- o prestador A nao contamina o prestador B
- o prestador historico continua emitindo normalmente

**Estimativa**
- `2h a 3h`

**Subtotal do Epico 1**
- `9h a 14h`

---

## Epico 2 - Dados dependentes do prestador correto

### Historia 2.1 - Tomadores por empresa prestadora

**Objetivo**
Garantir que a emissao carregue os tomadores da empresa certa.

**Entregas**
- amarrar autocomplete e buscas de tomador ao `empresaCnpj` selecionado
- impedir que a troca de prestador mantenha tomadores de outra empresa

**Criterios de aceite**
- ao trocar o prestador, a busca de tomadores respeita a empresa ativa
- nao ha sugestao cruzada de tomador entre empresas

**Estimativa**
- `3h a 4h`

### Historia 2.2 - Servicos favoritos e lista de servicos por prestador

**Objetivo**
Garantir que servicos venham do cadastro do prestador escolhido.

**Entregas**
- recarregar `Servicos Favoritos` por prestador
- recarregar `Lista Servico` por prestador
- impedir uso de favoritos da empresa errada

**Criterios de aceite**
- o select de servicos muda conforme o prestador escolhido
- dois prestadores com cadastros diferentes enxergam seus proprios servicos

**Estimativa**
- `3h a 4h`

### Historia 2.3 - Parametros e prontidao do prestador correto

**Objetivo**
Garantir que certificado, prontidao e parametros fiscais sejam da empresa ativa.

**Entregas**
- revisar hidratação de certificado e status de prontidao
- impedir que a tela exiba dados de outra empresa

**Criterios de aceite**
- o prestador selecionado mostra seu proprio estado cadastral
- bloqueios de emissao respeitam a empresa correta

**Estimativa**
- `2h a 4h`

**Subtotal do Epico 2**
- `8h a 12h`

---

## Epico 3 - Contexto global de prestador ativo

### Historia 3.1 - Criar conceito de prestador ativo

**Objetivo**
Fazer o sistema inteiro saber qual empresa esta em operacao.

**Entregas**
- criar estado global de `prestador ativo`
- persistir selecao no frontend
- exibir empresa ativa no header, menu ou area equivalente

**Criterios de aceite**
- o usuario consegue identificar claramente a empresa em operacao
- o contexto permanece coerente entre telas principais

**Estimativa**
- `4h a 6h`

### Historia 3.2 - Abertura coerente das telas com base no prestador ativo

**Objetivo**
Fazer telas centrais abrirem no contexto certo.

**Entregas**
- DANFSE abre usando o prestador ativo
- Emissao Rapida abre usando o prestador ativo
- Tomadores abrem usando o prestador ativo

**Criterios de aceite**
- o usuario nao precisa reescolher a empresa em toda navegacao
- o sistema nao volta sozinho para a Burgus ou para a primeira empresa

**Estimativa**
- `4h a 6h`

### Historia 3.3 - Troca segura de contexto

**Objetivo**
Evitar que o usuario troque de empresa sem perceber impactos.

**Entregas**
- revisar limpeza de dependencias ao trocar empresa ativa
- redefinir selects, dados de tomador e dados de servico quando necessario

**Criterios de aceite**
- trocar de empresa nao deixa residuos do contexto anterior
- nao ha contaminacao de prestador, tomador ou servico

**Estimativa**
- `2h a 4h`

**Subtotal do Epico 3**
- `10h a 16h`

---

## Epico 4 - Adequacao das telas satelite

### Historia 4.1 - Dashboard por empresa

**Objetivo**
Fazer o Dashboard respeitar o prestador ativo.

**Entregas**
- carregar metricas da empresa correta
- impedir leitura agregada indevida quando a tela for por empresa

**Estimativa**
- `2h a 3h`

### Historia 4.2 - Gestor AI e telas auxiliares por empresa

**Objetivo**
Alinhar ferramentas auxiliares ao contexto correto.

**Entregas**
- ajustar `Gestor AI`
- ajustar `Dash2`
- revisar consultas auxiliares que ainda assumem primeira empresa

**Estimativa**
- `3h a 5h`

### Historia 4.3 - Listagens e filtros de NFS-e por empresa

**Objetivo**
Melhorar a coerencia entre emissao e listagem.

**Entregas**
- revisar filtro por `empresaCnpj`
- permitir leitura mais clara do que pertence a cada prestador

**Estimativa**
- `3h a 6h`

**Subtotal do Epico 4**
- `8h a 14h`

---

## Epico 5 - Permissoes por empresa

### Historia 5.1 - Definir regra de acesso por empresa

**Objetivo**
Decidir quem pode operar quais empresas.

**Entregas**
- definir se usuario pode acessar todas ou apenas algumas empresas
- documentar o modelo de permissao

**Estimativa**
- `2h a 4h`

### Historia 5.2 - Vincular usuario a empresa(s)

**Objetivo**
Preparar o produto para operacao com governanca real.

**Entregas**
- incluir relacao entre usuario e empresa
- restringir seletores e visoes conforme escopo

**Estimativa**
- `6h a 10h`

### Historia 5.3 - Auditoria operacional por empresa

**Objetivo**
Melhorar rastreabilidade de quem fez o que.

**Entregas**
- registrar melhor usuario x empresa x emissao
- preparar leitura mais segura para suporte e governanca

**Estimativa**
- `4h a 8h`

**Subtotal do Epico 5**
- `12h a 22h`

---

## Fases recomendadas

### Fase 1 - Fazer mais de um prestador emitir

Escopo:
- Epico 1
- Epico 2

**Faixa estimada**
- `17h a 26h`

### Fase 2 - Fazer o fluxo ficar coerente no dia a dia

Escopo:
- Epico 3
- partes prioritarias do Epico 4

**Faixa estimada**
- `18h a 30h`

### Fase 3 - Evoluir governanca e produto

Escopo:
- restante do Epico 4
- Epico 5

**Faixa estimada**
- `20h a 36h`

---

## Leitura executiva final

Se a demanda for:

### “Quero mais um prestador emitindo”

O backlog minimo e:
- Epico 1
- Epico 2

**Faixa segura:** `17h a 26h`

### “Quero o fluxo certo de multi-prestador”

O backlog adequado e:
- Epico 1
- Epico 2
- Epico 3
- partes principais do Epico 4

**Faixa segura:** `35h a 56h`

### “Quero o ZERA preparado para escalar com governanca”

O backlog completo e:
- Epico 1
- Epico 2
- Epico 3
- Epico 4
- Epico 5

**Faixa segura:** `47h a 78h`

---

## Fechamento

Este backlog parte de uma premissa importante:

**o ZERA nao esta quebrado; ele foi desenhado para um contexto anterior, de prestador unico.**

Por isso, a entrada de multiplos prestadores nao deve ser tratada como um ajuste visual simples, e sim como uma evolucao funcional controlada do produto.
