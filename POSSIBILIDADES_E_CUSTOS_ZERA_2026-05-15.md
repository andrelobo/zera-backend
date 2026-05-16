# Possibilidades do Produto ZERA e Seus Custos

Data: **15/05/2026**

## Objetivo

Este documento organiza **todas as possibilidades principais de produto para o ZERA** e apresenta a leitura de **custos de desenvolvimento, infraestrutura, operacao e manutencao** de cada uma.

Importante:
- os custos abaixo nao sao valores financeiros fechados
- eles sao uma leitura de **esforco e impacto** para ajudar a decisao de produto
- quando necessario, foi incluida tambem uma **faixa estimada de horas** para evolucao

---

## 1. Como estamos medindo custo aqui

Para nao reduzir a analise apenas a servidor ou mensalidade, o custo foi separado em cinco dimensoes:

### 1.1 Custo de desenvolvimento

Quanto trabalho de produto e engenharia sera necessario para implantar o modelo.

### 1.2 Custo de infraestrutura

Quanto aumenta a necessidade de ambiente, deploy, dominio, monitoramento e configuracao tecnica.

### 1.3 Custo operacional

Quanto a equipe tera de acompanhar, operar, configurar e corrigir no dia a dia.

### 1.4 Custo de manutencao

Quanto a evolucao do produto fica mais simples ou mais pesada ao longo do tempo.

### 1.5 Custo de crescimento

Quanto esse modelo aguenta crescer sem obrigar uma nova mudanca grande depois.

---

## 2. Matriz resumida das possibilidades

| Modelo | Resumo | Desenvolvimento inicial | Infraestrutura recorrente | Operacao/manutencao | Escalabilidade | Leitura geral |
|---|---|---:|---:|---:|---:|---|
| A. Um ZERA para um prestador | Produto mono-prestador | Baixo | Baixo | Baixo | Baixa | Simples, mas limitado |
| B. Um ZERA com varios prestadores | Multi-prestador em um ambiente | Medio | Baixo a medio | Medio | Boa | Melhor custo-beneficio agora |
| C. Um ZERA com varios clientes e perfis isolados | Multi-cliente dentro do mesmo produto | Alto | Medio | Medio a alto | Muito boa | Mais forte como plataforma |
| D. Varios ZERAs, um por cliente | Uma instalacao por cliente | Medio por cliente, muito alto no conjunto | Alto no conjunto | Alto | Ruim para operar em escala | So faz sentido em casos especiais |

---

## 3. Modelo A - Um ZERA para um unico prestador

## Como funciona

- um ambiente
- uma empresa prestadora principal
- usuarios operando apenas essa empresa
- fluxo simplificado

## Custos

### Desenvolvimento

**Baixo**

Esse modelo praticamente aproveita o desenho atual do sistema.

Faixa estimada adicional:
- `0h a 10h`, se for apenas manter e ajustar pequenos detalhes

### Infraestrutura

**Baixa**

- um unico frontend
- um unico backend
- um unico fluxo de deploy
- uma unica configuracao operacional

### Operacao

**Baixa**

- menor risco de confusao por empresa
- menos necessidade de filtro e contexto

### Manutencao

**Baixa no curto prazo**, mas **cara no medio prazo**

Por que?
Porque toda vez que o produto crescer para mais prestadores, sera necessario abrir nova rodada estrutural.

### Custo de crescimento

**Alto**

Esse modelo parece barato no inicio, mas cobra retrabalho quando a operacao deixa de ser de empresa unica.

## Leitura

Bom para MVP e fase inicial.
Ruim para meta de crescimento com muitos prestadores.

---

## 4. Modelo B - Um unico ZERA com varios prestadores

## Como funciona

- um unico produto
- varias empresas prestadoras no mesmo ambiente
- operacao centralizada
- o sistema precisa saber qual prestador esta ativo

## O que precisa ser feito

- seletor de prestador na emissao normal
- seletor de prestador na emissao rapida
- empresa ativa no sistema
- tomadores por empresa
- dashboards e consultas respeitando a empresa ativa
- filtros por empresa

## Custos

### Desenvolvimento

**Medio**

Faixa estimada para sair do estado atual e chegar numa primeira versao funcional boa:
- `45h a 75h`

Essa faixa cobre, de forma aproximada:
- emissao multi-prestador
- contexto global de prestador ativo
- ajustes nas telas principais
- revisoes de filtro e carregamento por empresa

### Infraestrutura

**Baixa a media**

O custo de infra nao explode, porque continua sendo:
- um unico frontend
- um unico backend
- um unico ambiente por tier

Pode haver pequeno aumento em cache, processamento e observabilidade, mas nao muda a arquitetura de forma dramatica.

### Operacao

**Media**

- aumenta a necessidade de clareza de contexto
- aumenta risco de erro humano se a UX nao for muito boa
- exige governanca melhor de uso por empresa

### Manutencao

**Media**

Ainda e um unico produto, entao a manutencao fica muito mais saudavel do que criar varias instalacoes separadas.

### Custo de crescimento

**Bom**

Esse modelo absorve crescimento melhor e tende a ser o melhor ponto de equilibrio para a meta de 120 prestadores.

## Leitura

Este e o **melhor custo-beneficio para a fase atual**.

---

## 5. Modelo C - Um unico ZERA com varios clientes e perfis isolados

## Como funciona

- um unico produto
- varios clientes dentro do mesmo ambiente
- usuarios enxergam apenas suas empresas
- ha permissao, escopo e segregacao por cliente/empresa

## O que precisa ser feito

Tudo do Modelo B, mais:
- vinculo de usuario com empresa ou grupo de empresas
- isolamento de acesso
- revisao de autenticacao/autorizacao
- auditoria mais forte
- governanca de perfis

## Custos

### Desenvolvimento

**Alto**

Faixa estimada adicional, depois de um bom multi-prestador:
- `60h a 120h`

Se tentarmos sair do estado atual direto para esse modelo, a faixa pode subir ainda mais.

### Infraestrutura

**Media**

Ainda e um unico produto, entao a infra continua controlada.
Mas exige mais:
- monitoramento
- seguranca
- trilha de auditoria
- observabilidade por cliente ou empresa

### Operacao

**Media a alta**

- regras de acesso ficam mais complexas
- suporte fica mais sensivel
- erros de permissao passam a ter impacto maior

### Manutencao

**Media**

Mais complexa que o Modelo B, porem ainda muito melhor do que manter dezenas de instalacoes separadas.

### Custo de crescimento

**Muito bom**

Esse modelo prepara o produto para crescer como plataforma de verdade.

## Leitura

E o modelo mais forte quando o ZERA deixa de ser ferramenta interna e passa a ser produto mais maduro.

---

## 6. Modelo D - Varios ZERAs, um por cliente

## Como funciona

- cada cliente tem seu proprio ambiente
- proprio deploy
- proprio dominio, se necessario
- propria configuracao operacional

## Custos

### Desenvolvimento

**Medio para iniciar, muito alto no conjunto**

Existe um custo para preparar a base e outro para cada novo cliente.

Faixa estimada:
- preparacao inicial do modelo de multiplas instalacoes: `30h a 60h`
- custo operacional por novo cliente: `4h a 12h` ou mais, dependendo de deploy, dominio, configuracao e suporte

### Infraestrutura

**Alta no conjunto**

Mesmo que cada ambiente pareca simples isoladamente, ao multiplicar clientes, cresce:
- quantidade de deploys
- quantidade de dominios
- SSL
- logs
- segredos
- configuracoes de CORS
- suporte de ambiente

### Operacao

**Alta**

- mais pontos de falha
- mais risco de divergencia entre clientes
- mais trabalho para atualizar todo mundo
- mais dificuldade de governanca

### Manutencao

**Alta**

Toda evolucao do produto precisa ser pensada para varios ambientes. O risco de virar uma “familia de copias” do ZERA e grande.

### Custo de crescimento

**Ruim**

Esse modelo cresce mal se a meta e escalar operacao. Ele costuma parecer comercialmente elegante no inicio, mas pode ficar caro e pesado muito rapido.

## Leitura

Deve ser reservado para casos especiais:
- exigencia contratual
- white-label forte
- necessidade de isolamento total

Nao e a melhor primeira estrategia para meta de 120 prestadores.

---

## 7. Possibilidade intermediaria - Um unico ZERA com personalizacao leve por cliente

Existe ainda uma opcao intermediaria entre o Modelo C e o Modelo D.

## Como funciona

- um unico produto
- varios clientes no mesmo ambiente
- possibilidade de alguma personalizacao leve
- logo, nome ou detalhes visuais por cliente
- sem criar uma instalacao separada para cada um

## Custos

### Desenvolvimento

**Medio a alto**

Faixa estimada adicional sobre o Modelo C:
- `20h a 50h`

### Infraestrutura

**Media**

Permanece melhor que instalar um ambiente por cliente.

### Operacao

**Media**

Ha aumento de cuidado com configuracao e consistencia visual, mas ainda muito mais controlado que varios ZERAs separados.

## Leitura

Se a discussao comercial for sobre “meu cliente quer sentir que o ambiente e dele”, essa opcao pode ser muito mais inteligente do que multiplicar instalacoes.

---

## 8. Comparativo de custo por estrategia

## Estrategia mais barata no curtissimo prazo

**Modelo A**

Mas ela cobra retrabalho depois.

## Estrategia com melhor custo-beneficio agora

**Modelo B**

Porque:
- resolve a demanda real atual
- aproveita a base ja existente
- nao explode custo de infra
- nao multiplica ambientes
- prepara crescimento com menos retrabalho

## Estrategia mais forte como plataforma futura

**Modelo C**

Porque:
- organiza cliente, usuario, empresa e permissao
- melhora governanca
- prepara o produto para escala real

## Estrategia mais cara de sustentar ao longo do tempo

**Modelo D**

Porque:
- multiplica deploy
- multiplica manutencao
- multiplica suporte
- multiplica risco operacional

---

## 9. Recomendacao final para o momento do ZERA

A recomendacao mais segura e mais racional e:

### Passo 1

Sair do modelo atual focado em um prestador e evoluir para o **Modelo B**.

### Passo 2

Quando a operacao estiver estavel, evoluir para o **Modelo C**.

### Passo 3

So adotar o **Modelo D** se houver necessidade comercial muito clara e justificada.

---

## 10. Resposta objetiva para decisao de produto

Se a pergunta for:

**“Vamos criar varios ZERAs, um por cliente?”**

A resposta mais segura hoje e:

**nao como estrategia principal.**

Se a pergunta for:

**“Podemos ter um unico ZERA, no qual varias empresas tenham seus perfis?”**

A resposta e:

**sim, e esse e o caminho mais equilibrado em custo, manutencao e crescimento.**

---

## 11. Fechamento executivo

Em resumo:

- **Modelo A** e o mais simples, mas nao sustenta crescimento bem
- **Modelo B** e o melhor custo-beneficio agora
- **Modelo C** e o destino mais forte para o produto
- **Modelo D** deve ser excecao, nao regra

Se a meta e chegar a **120 prestadores**, a melhor estrategia nao e criar 120 ZERAs.

A melhor estrategia e fortalecer **um unico ZERA**, com varias empresas, contexto claro, permissao por empresa e governanca progressiva.
