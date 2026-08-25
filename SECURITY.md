# Segurança

## Relato responsável

Não registre vulnerabilidades, credenciais ou dados pessoais em issues públicas,
pull requests, commits, logs ou documentos de contexto. Use um canal privado da
Muirakitan Tecnologia e informe apenas o local afetado, o impacto e passos de
reprodução sem dados reais.

## Segredos

- segredos pertencem ao GitHub Secrets, ao ambiente de produção ou ao secret
  manager aprovado;
- `.env`, certificados A1, senhas, tokens, chaves privadas e XMLs reais não são
  versionados;
- documentação referencia o nome da variável ou o secret manager, nunca o valor;
- fixtures usam valores sintéticos e inequivocamente falsos;
- qualquer segredo versionado deve ser considerado comprometido e rotacionado.

## Resposta a incidente

1. Revogar ou rotacionar a credencial afetada.
2. Remover o valor da árvore atual sem reproduzi-lo em novos logs ou commits.
3. Identificar commits, branches, tags, forks, caches e artefatos atingidos.
4. Avaliar reescrita coordenada do histórico; nunca fazer force-push sem janela e
   aprovação explícitas.
5. Auditar uso indevido nos provedores envolvidos.
6. Registrar apenas a evidência sanitizada e as medidas preventivas.

## Verificação local

```bash
npm run security:secrets
```

O scanner analisa arquivos rastreados pelo Git e reporta somente arquivo, linha e
tipo da ocorrência. Valores suspeitos nunca são impressos.
