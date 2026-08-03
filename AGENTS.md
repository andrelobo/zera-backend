# ZERA Backend – Convenções de trabalho

> Leitura canonica de estado/produto: `CONTEXT.md` e `CURRENT_STATE.md`.

## Git workflow (branch por step)

- Cada slice/step trabalha em uma branch própria, com nome descritivo:
  - `feat/<escopo>-slice-N` (ex.: `feat/lobonotas-slice-6`)
  - `fix/<escopo>-<descricao>` (ex.: `fix/sefin-tls-map`)
  - `test/<escopo>-<descricao>` (ex.: `test/harness-webhook`)
  - `chore/<descricao>` / `docs/<descricao>`
- Nao commitar direto na `main`.
- A branch so mergeia na `main` apos validacao completa:
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm run lint` (0 erros; warnings pre-existentes de `no-unsafe-*` sao aceitaveis)
- Preferir commits pequenos e com foco unico, no estilo conventional commits ja usado no repo:
  - `feat(sefin):`, `fix(empresas):`, `test(fiscal):`, `docs:`, `chore:`
- Ao commitar um arquivo que mistura mudancas de concerns diferentes, dividir com `git add -p`
  (ou reconstruir versoes parciais do arquivo) para manter cada commit atomico.
- Push somente quando solicitado pelo usuario. Depois do push, remover a branch local.

## Validacao

- Node 20.x (engines do package.json).
- Suite completa: `npm test -- --runInBand`
- Build: `npm run build` (copia o catalogo LC116 para `dist/`).
- Lint: `npm run lint` (roda com `--fix`).

## Regras de producao

- Tratar o ZERA como sistema em producao (usuarios e emissoes reais).
- Preservar emissao, integracoes, observabilidade; evitar regressao.
- Producao fiscal segue PLUGNOTAS (`FISCAL_PROVIDER_ACTIVE` ausente/vazio). Nao remover codigo PlugNotas.
- Nao commitar segredos; guardar chaves em `.env` / secret manager.
