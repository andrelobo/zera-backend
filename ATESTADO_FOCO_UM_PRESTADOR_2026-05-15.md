# Atestado de Foco Inicial em Um Prestador

Data: **15/05/2026**

## Objetivo

Este documento registra, de forma objetiva, que o desenvolvimento funcional do ZERA, ate o momento desta analise, foi conduzido com foco operacional em **um unico prestador principal**.

Nao se trata de limitacao absoluta do backend para armazenar mais de uma empresa, mas sim de uma decisao funcional e de experiencia de uso que orientou o produto e a interface nas etapas ja entregues.

## Conclusao executiva

A conclusao desta analise e:

**o ZERA foi desenvolvido e ajustado, nas rotas principais de operacao, para trabalhar como produto de prestador unico**.

Isso aparece principalmente na emissao, no carregamento automatico de dados e em telas satelite que assumem uma empresa principal ativa sem oferecer selecao explicita de prestador.

## Evidencias principais

### 1. Emissao Rapida foi simplificada para prestador unico

Na implementacao atual da Emissao Rapida:
- o prestador e carregado automaticamente
- existe preferencia explicita por uma empresa principal
- o fluxo nao foi desenhado para o usuario escolher entre varios prestadores na tela

Na pratica, isso confirma que a experiencia foi intencionalmente simplificada para um prestador operacional dominante.

### 2. Emissao normal tambem nao foi desenhada para troca explicita de prestador

Na emissao normal de NFS-e:
- os dados do prestador sao hidratados automaticamente
- a empresa utilizada e escolhida internamente pela aplicacao
- nao ha seletor funcional de prestador no fluxo principal

Isso demonstra que o sistema foi conduzido para operar com um prestador assumido como principal, e nao com multiplos prestadores sendo escolhidos pelo usuario a cada emissao.

### 3. Outras telas do produto tambem assumem empresa principal

A mesma linha de desenho aparece em outras partes do frontend, como:
- cadastro de tomadores
- dashboards
- consultas auxiliares
- areas de apoio operacional

Em diversos pontos, a aplicacao parte da primeira empresa disponivel, de uma empresa padrao ou de uma empresa escolhida automaticamente pelo sistema.

Isso reforca que o produto nao estava, ate aqui, modelado como operacao multi-prestador plena.

### 4. A propria documentacao funcional ja registrava essa decisao

Os documentos canonicos do projeto ja vinham refletindo esse entendimento operacional:
- a Emissao Rapida foi tratada como fluxo de **prestador unico**
- o seletor multi-prestador foi deixado para evolucao futura
- a simplificacao foi adotada para reduzir ambiguidade enquanto havia um unico prestador operacional principal

## Leitura tecnica correta

Tecnicamente, o backend ja possui bases que permitem evoluir para mais de um prestador.

Porem, isso **nao muda o fato de que o produto, como experiencia entregue ate aqui, foi focado em um prestador**.

Ou seja:
- o cadastro de varias empresas pode existir
- partes do backend podem aceitar empresa por CNPJ
- mas a experiencia principal do sistema ainda foi desenhada como **mono-prestador**

## Implicacao pratica

Por isso, quando um novo prestador foi cadastrado, ele nao passou automaticamente a participar do fluxo correto de emissao.

Isso nao caracteriza erro isolado de cadastro.
Caracteriza, sim, que o produto ainda carrega uma decisao estrutural anterior:

**o ZERA foi implementado e refinado considerando um prestador principal de operacao.**

## Fechamento

Diante da analise funcional e da leitura do codigo e dos contextos canonicos, fica atestado que:

**o desenvolvimento do ZERA, nas entregas realizadas ate o momento, foi orientado para um unico prestador principal, e nao para uma operacao multi-prestador completa.**

A evolucao para varios prestadores exige nova rodada de desenho funcional, principalmente na emissao, no contexto global da empresa ativa e nas permissoes de acesso.
