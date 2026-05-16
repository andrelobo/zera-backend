# Detalhamento de Produto do ZERA

Data: **15/05/2026**

## Objetivo

Este documento organiza, em linguagem de produto, os cenarios possiveis para o ZERA a partir da pergunta central:

**o ZERA sera um unico produto atendendo varias empresas dentro do mesmo ambiente, ou teremos varios "ZERAs", um para cada cliente?**

A ideia aqui e separar claramente:
- o que e empresa prestadora
- o que e cliente
- o que e usuario
- e quais formatos de produto sao possiveis para a evolucao do ZERA

---

## 1. Conceitos basicos

Para evitar confusao, precisamos separar quatro coisas diferentes.

### 1.1 Prestador

Prestador e a empresa que emite a nota.

Exemplos:
- Burgus Ltda
- outra empresa contabil
- outro cliente emissor

### 1.2 Usuario

Usuario e a pessoa que entra no sistema.

Exemplos:
- operador
- analista fiscal
- administrador
- dono da empresa

### 1.3 Cliente

Cliente e quem contrata ou utiliza o ZERA como solucao.

Dependendo do modelo de negocio, o cliente pode ser:
- uma contabilidade operando varios prestadores
- uma empresa individual usando o sistema para si mesma
- um parceiro que quer seu proprio ambiente com sua propria marca

### 1.4 Produto

Produto e a forma como o ZERA e organizado comercial e operacionalmente.

Aqui esta a grande decisao:
- um unico ZERA para varias empresas?
- ou varios ZERAs separados, um para cada cliente?

---

## 2. Modelos de produto possiveis

## Modelo A - Um ZERA para um unico prestador

### Como funciona

- um ambiente
- uma empresa prestadora principal
- usuarios operando apenas essa empresa
- interface simplificada

### Vantagens

- menor complexidade
- fluxo mais simples
- menos risco operacional no inicio
- implementacao mais rapida

### Desvantagens

- nao escala bem para varios prestadores
- obriga retrabalho se o produto crescer
- limita a expansao comercial

### Quando faz sentido

- MVP
- primeira fase do produto
- operacao concentrada em uma unica empresa emissora

### Leitura

Esse foi, na pratica, o modelo dominante ate aqui.

---

## Modelo B - Um unico ZERA com varios prestadores

### Como funciona

- um unico sistema
- varias empresas prestadoras cadastradas
- usuarios operam uma ou mais empresas dentro do mesmo ambiente
- o sistema precisa saber qual prestador esta ativo em cada momento

### O que isso exige

- seletor de prestador
- contexto global de empresa ativa
- filtros por empresa
- tomadores vinculados por empresa
- dashboards por empresa
- emissoes claramente vinculadas ao prestador correto

### Vantagens

- crescimento mais rapido sem multiplicar ambientes
- operacao centralizada
- manutencao mais simples que ter varias instalacoes separadas
- bom encaixe para escritorio contabil, operacao compartilhada ou central de servicos

### Desvantagens

- exige organizacao melhor de permissao e contexto
- aumenta a responsabilidade de segregacao dentro do sistema
- pode ficar confuso se a UX nao for muito clara

### Quando faz sentido

- quando um mesmo time opera varios prestadores
- quando a meta e escalar para dezenas ou centenas de empresas
- quando nao ha necessidade imediata de marca separada por cliente

### Leitura

Se a meta atual e chegar a **120 prestadores**, este e o caminho mais natural como proxima fase.

---

## Modelo C - Um unico ZERA com varios clientes e perfis isolados

### Como funciona

- continua existindo um unico produto
- mas o sistema passa a ter divisao clara por contas, perfis, empresas e acessos
- cada cliente enxerga apenas seu conjunto de dados
- o produto passa a funcionar de modo mais proximo de um SaaS multi-empresa

### O que isso exige

- estrutura de conta ou organizacao
- usuarios vinculados a empresas ou grupos de empresas
- permissao por cliente
- isolamento de visao
- trilha de auditoria mais forte

### Vantagens

- produto mais profissional para escalar comercialmente
- permite atender varios clientes num unico ambiente controlado
- evita criar uma instalacao por cliente logo no inicio

### Desvantagens

- mais complexidade de modelagem
- exige revisao de autenticacao, autorizacao e UX
- maior esforco de governanca

### Quando faz sentido

- quando o sistema sera usado por muitos clientes diferentes
- quando cada cliente precisa ver apenas seus dados
- quando o ZERA quer se consolidar como plataforma e nao apenas como ferramenta interna

### Leitura

Este modelo e mais forte que o Modelo B e pode virar o destino natural do produto.

---

## Modelo D - Varios "ZERAs", um para cada cliente

### Como funciona

- cada cliente teria seu proprio ambiente
- sua propria URL
- sua propria marca ou logo
- seu proprio deploy
- sua propria operacao isolada

### Vantagens

- isolamento total entre clientes
- experiencia personalizada por marca
- menor risco de mistura de dados entre clientes

### Desvantagens

- custo operacional muito maior
- manutencao mais pesada
- deploy mais trabalhoso
- suporte mais dificil
- evolucao de produto mais lenta
- risco de virar um conjunto de copias do mesmo sistema

### Quando faz sentido

- quando ha exigencia comercial de ambiente separado
- quando o cliente precisa de identidade propria obrigatoria
- quando o contrato exige isolamento forte de infraestrutura

### Leitura

Esse modelo pode existir, mas **nao deve ser a primeira resposta para crescer**.

Ter 120 clientes e 120 instalacoes separadas tende a ser ruim em custo, manutencao e governanca.

---

## 3. O que significa "ter perfis" dentro de um unico ZERA

Se optarmos por **um unico ZERA com varias empresas**, o ideal e que o produto passe a trabalhar com camadas como estas:

- **Empresa prestadora**: quem emite a nota
- **Usuario**: quem usa o sistema
- **Perfil/Permissao**: o que esse usuario pode fazer
- **Escopo de acesso**: em quais empresas ele pode atuar

Exemplo:
- usuario A pode operar Burgus e Empresa X
- usuario B pode operar apenas Empresa Y
- usuario C e administrador global

Isso permite que exista **um unico ZERA**, mas com controle de acesso por empresa.

---

## 4. Como pensar a questao da marca

A marca nao precisa ser decidida da mesma forma que a arquitetura.

Podemos ter tres niveis:

### Opcao 1 - Marca unica ZERA

- todo mundo usa ZERA
- mesmo visual
- mesma identidade
- foco em operacao centralizada

### Opcao 2 - Marca ZERA com personalizacao leve por cliente

- mesmo produto
- mesmo ambiente
- possibilidade futura de logo, nome ou cor por cliente
- sem multiplicar instalacoes necessariamente

### Opcao 3 - White-label real

- cliente sente que o produto e dele
- marca, dominio e experiencia mais proprios
- normalmente exige isolamento mais forte

---

## 5. Recomendacao mais segura para o momento

Com base no historico do produto e na meta de crescimento, a recomendacao mais segura e:

## Curto prazo

Adotar o **Modelo B**:

**um unico ZERA com varios prestadores**, operados dentro do mesmo ambiente.

Isso exige:
- seletor de prestador
- empresa ativa
- filtros por empresa
- revisao das telas que ainda assumem prestador unico

### Por que esse e o melhor caminho agora

- resolve a demanda real atual
- evita criar varios ambientes cedo demais
- reduz custo operacional
- simplifica manutencao
- prepara o produto para escalar com menos retrabalho

## Medio prazo

Evoluir do Modelo B para o **Modelo C**, adicionando:
- controle de acesso por empresa
- perfil de usuario mais refinado
- melhor segregacao operacional

## Longo prazo

So considerar o **Modelo D** em casos comerciais especiais, quando realmente fizer sentido ter:
- marca separada
- dominio separado
- ambiente separado
- contrato com exigencia de isolamento forte

---

## 6. Resposta objetiva para a pergunta central

### O ZERA deve ser varios "ZERAs", um para cada cliente?

**Nao como primeira estrategia.**

Isso tende a encarecer muito a operacao, aumentar manutencao e dificultar o crescimento.

### O ZERA pode ser um unico sistema com varias empresas tendo seus perfis?

**Sim.**

Esse e, neste momento, o caminho mais racional e mais escalavel.

Mas para isso o produto precisa evoluir de:
- prestador unico

para:
- varios prestadores
- empresa ativa
- permissao por empresa
- contexto operacional coerente

---

## 7. Fechamento

A melhor leitura de produto para o momento e:

- hoje o ZERA ainda carrega heranca funcional de prestador unico
- para crescer, o caminho mais seguro e virar **um unico ZERA multi-prestador**
- depois, se necessario, virar **um unico ZERA multi-cliente com perfis isolados**
- apenas em casos especiais faria sentido manter **vários ZERAs separados por cliente**

Em resumo:

**a recomendacao nao e multiplicar instalacoes agora; a recomendacao e fortalecer um unico ZERA, preparado para operar varias empresas com governanca.**
