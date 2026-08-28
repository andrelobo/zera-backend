# Auditoria estratégica — Jupati / LOBONOTAS

**Data de corte:** 28/08/2026  
**Escopo:** `zera-backend`, `zera-frontend2`, documentação, segurança, operação fiscal, IA, acessibilidade e prontidão comercial.  
**Método:** inspeção de código e configuração, execução dos gates locais e confronto fiscal com fontes oficiais vigentes.

> Este documento registra o estado encontrado. Propostas não devem ser interpretadas como funcionalidades já entregues. Nenhuma correção P0 descrita aqui foi implementada sem aprovação do owner.

## 1. Resumo executivo

O produto possui uma base funcional relevante: emissão NFS-e, persistência e consulta de emissões, assinatura de DPS, integração LOBONOTAS por mTLS, reconciliação por polling, webhook, DANFSe, cadastro de empresas e tomadores, dashboards, autenticação JWT e documentação OpenAPI.

Apesar disso, o estado atual **não está pronto para expansão comercial multiempresa nem para operar sem supervisão fiscal**. Quatro riscos dominam o cenário:

1. **Isolamento multiempresa ausente na autorização:** o usuário/JWT não possui vínculo de tenant e diversas consultas confiam em CNPJ ou ID enviados pelo cliente. Isso pode permitir acesso cruzado a dados, XML, PDF, respostas do provider e observabilidade.
2. **CNPJ alfanumérico incompatível:** backend e frontend removem letras e exigem 14 dígitos. O primeiro CNPJ alfanumérico real já foi emitido pela Receita Federal em 31/07/2026; portanto, não é apenas dívida futura.
3. **Reforma tributária incompleta:** o DANFSe lê e exibe parte de IBS/CBS, mas DTO, domínio e builder da DPS não emitem os grupos exigidos pelos leiautes novos.
4. **Segurança e operação ainda frágeis:** credenciais antigas permanecem no histórico Git, webhook pode operar em modo fail-open, JWT permanece válido com papel antigo, deploy não exige testes e a observabilidade não possui métricas, tracing ou alertas integrados.

## 2. Legenda de classificação

| Estado | Significado |
|---|---|
| `IMPLEMENTADO` | Existe no código ativo e possui evidência verificável |
| `PARCIAL` | Existe, mas faltam caminhos, garantias ou cobertura relevantes |
| `EXPERIMENTAL` | Protótipo ou implementação ainda não adequada a compromisso operacional |
| `DOCUMENTADO` | Está descrito, porém não implementado |
| `AUSENTE` | Não foi encontrado no código ou operação |
| `BLOQUEADO` | Depende de credencial, validação externa ou decisão do owner |
| `RISCO` | Condição capaz de produzir incidente, perda ou não conformidade |

## 3. Evidências dos gates

### Backend

- Testes: **304/304**, 38 suítes — passou.
- Build TypeScript/NestJS — passou.
- Scan de segredos do estado rastreado atual — passou.
- Integração LOBONOTAS/mTLS com stub local — passou.
- Dependências de produção: **13 vulnerabilidades conhecidas** (8 altas, 4 moderadas e 1 baixa) no momento da auditoria.

### Frontend

- Testes: **152/152**, 28 arquivos — passou.
- Build Vite — passou; bundle principal observado em aproximadamente 526 KB minificado.
- Lint — passou sem erro, mas com **40 avisos**, incluindo dependências omitidas de hooks.
- Dependências: 3 avisos moderados relacionados ao React Router no momento da auditoria.
- Não existe gate automatizado de acessibilidade com Axe, Lighthouse, WAVE ou equivalente.

## 4. Matriz consolidada

| Área | Estado | Evidência resumida | Impacto |
|---|---|---|---|
| Emissão e consulta NFS-e | `IMPLEMENTADO` | Serviços, provider, repositório e testes | Base operacional existente |
| LOBONOTAS exclusivo | `IMPLEMENTADO` | Resolver força LOBONOTAS; PlugNotas sem fallback de emissão | Alinha a decisão canônica |
| Idempotência de emissão | `IMPLEMENTADO` | `referenciaExterna`, reserva prévia e índice único | Reduz duplicidade |
| Assinatura DPS | `IMPLEMENTADO` | RSA-SHA256, SHA-256 e testes | Base criptográfica adequada |
| mTLS | `PARCIAL` | Verificação de certificado ativa por padrão; parâmetros montados em URL temporária não chegam à requisição efetiva | Divergência de contrato possível |
| Retry HTTP LOBONOTAS | `DOCUMENTADO` | Configuração de tentativas/delay existe, mas não há loop de retry equivalente ao legado | Menor resiliência |
| Polling | `PARCIAL` | Backoff e limite de tentativas; `setInterval` por processo sem lease distribuído | Duplicidade em escala horizontal |
| Sincronização de artefatos | `PARCIAL` | XML/PDF são obtidos e persistidos; concorrência pode repetir trabalho | Custo e inconsistência |
| Armazenamento XML/PDF | `RISCO` | Base64 no mesmo documento Mongo | Limite de 16 MB e crescimento caro |
| CNPJ alfanumérico | `AUSENTE` | `replace(/\D/g, '')`, `onlyDigits`, máscaras numéricas e validações de 14 dígitos em ambos os repositórios | Defeito de produção/P0 |
| Leitura IBS/CBS | `PARCIAL` | Parser e DANFSe reconhecem parte dos grupos | Visualização, não emissão completa |
| Emissão IBS/CBS | `AUSENTE` | DTO/tipos/builder da DPS não geram os grupos | Janela fiscal curta |
| Notas de ajuste NT 009 | `AUSENTE` | Sem modelo/fluxo correspondente | Lacuna de evolução fiscal |
| Correlação Anexo VIII | `EXPERIMENTAL` | Há dados frontend; fonte oficial ainda não autoriza regra de negócio baseada na correlação | Não automatizar decisão fiscal |
| Autenticação JWT | `PARCIAL` | Login/guards/roles existem; papel e status ficam obsoletos até expiração | Revogação insuficiente |
| Isolamento multiempresa | `AUSENTE` | Usuário/JWT sem empresas permitidas; filtros vêm da requisição | Possível IDOR/vazamento crítico |
| Webhook seguro | `PARCIAL` | Segredo compartilhado suportado; ausência pode aceitar requisição e não há proteção de replay | Falsificação/repetição |
| Certificado A1 em repouso | `PARCIAL` | AES-256-GCM e `select:false`; fallback de chave e leitura legada em claro | Migração/gestão de chaves pendente |
| Gestão de segredos | `PARCIAL` | Árvore atual saneada e scan em CI; segredo histórico ainda recuperável | Rotação e rewrite pendentes |
| Observabilidade | `PARCIAL` | correlation ID, logs JSON e timeline fiscal; sem métricas, tracing e alertas | Diagnóstico reativo |
| Health/readiness | `PARCIAL` | `/health` responde estado do processo, sem provar Mongo e dependências essenciais | Falso positivo operacional |
| CI backend | `PARCIAL` | Secret scan existe; deploy faz build, mas não testes/lint/audit | Regressão pode chegar ao deploy |
| CI frontend | `AUSENTE` | Nenhum workflow versionado encontrado | Gates dependem de execução manual |
| Acessibilidade | `PARCIAL` | Radix e foco visível ajudam; sem skip link/gate, 102 labels visuais sem associação e botões sem nome acessível | Barreiras a teclado/leitor de tela |
| Responsividade | `PARCIAL` | Layouts responsivos coexistem com textos de 7–10 px e áreas densas | Legibilidade e zoom comprometidos |
| DiagnoseAgent | `IMPLEMENTADO` | Endpoint e testes; resultado declara `mode: deterministic` | Automação diagnóstica útil |
| IA generativa/LLM | `AUSENTE` | Nenhum cliente/modelo LLM encontrado | Não anunciar como IA generativa |
| RAG | `DOCUMENTADO` | Proposta existe; sem embeddings, chunks, índice ou retrieval | Não implementado |
| Memória/tool calling/planejamento | `DOCUMENTADO` | Arquitetura proposta, sem runtime | Não implementado |
| Multiagentes | `DOCUMENTADO` | Apenas visão futura | Não implementado |
| Swagger/OpenAPI | `IMPLEMENTADO` | Documento gerado e autenticação Bearer | Bom contrato interno |
| API pública para parceiros | `AUSENTE` | Sem API keys, quotas, escopos, portal e versionamento comercial | Não pronta para ecossistema |
| Sandbox do produto | `PARCIAL` | Produção Restrita/stub técnico; sem ambiente self-service isolado | Onboarding externo manual |
| Billing/planos/trial | `AUSENTE` | Não encontrados | SaaS comercial incompleto |
| SLA/termos/privacidade | `AUSENTE` | Não encontrados como artefatos operacionais/publicáveis | Risco comercial e LGPD |

## 5. Achados críticos

### P0-01 — Isolamento multiempresa e IDOR

O modelo `User` e o payload JWT não estabelecem uma lista de empresas/tenant autorizados. Endpoints de empresas, tomadores, NFS-e, provider response e observabilidade recebem IDs ou CNPJs do cliente e consultam diretamente esses valores.

**Risco:** um usuário autenticado pode tentar enumerar identificadores e acessar dados fiscais de outra empresa. XML, PDF e payload do provider podem conter dados pessoais e fiscais.

**Critério de correção:** toda consulta deve derivar o escopo permitido do usuário autenticado; administradores precisam de regra explícita e auditada. Testes E2E devem provar negação cruzada para leitura, escrita, artefatos e diagnósticos.

### P0-02 — CNPJ alfanumérico já em produção

Há normalização numérica em dezenas de pontos. Exemplos centrais:

- backend: emissão completa e rápida, empresas, tomadores, DPS, eventos e filtros fiscais;
- frontend: `validators.ts`, formulário de empresa, emissão, certificado, tomadores, filtros e serviços HTTP;
- mensagens e testes fixam “14 dígitos”.

A Receita Federal informou a geração do primeiro CNPJ alfanumérico em 31/07/2026, com manutenção da validade dos CNPJs numéricos existentes. A adaptação deve preservar os 14 caracteres, aceitar letras nas posições previstas e calcular os dígitos verificadores conforme o manual oficial.

**Critério de correção:** uma função canônica compartilhada por camada para normalizar, formatar e validar; migração de índices/dados; contratos OpenAPI; integrações externas; testes com o exemplo oficial e com CNPJs numéricos legados.

### P0-03 — Segredos históricos e rotação

O estado rastreado atual foi saneado e possui scan, mas valores sensíveis já versionados continuam recuperáveis no histórico Git.

**Critério de correção:** inventariar todos os valores expostos sem registrá-los no relatório, revogar/rotacionar na origem, invalidar sessões/tokens relacionados, reescrever histórico com procedimento coordenado e validar clones/PRs/caches. Rewrite sem rotação não resolve o incidente.

### P0-04 — Webhook fail-open e replay

Quando o segredo compartilhado não está configurado, o handler pode aceitar entregas. Também não há nonce/timestamp ou armazenamento de identificador de entrega para impedir repetição.

**Critério de correção:** produção deve falhar ao iniciar sem segredo; comparação em tempo constante; janela temporal/nonce ou chave de entrega idempotente; auditoria sem payload sensível; testes negativos.

## 6. Aderência fiscal 2026–2027

As conclusões abaixo usam apenas fontes oficiais consultadas em 28/08/2026:

- A Receita Federal [gerou o primeiro CNPJ alfanumérico em 31/07/2026](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-gera-o-primeiro-cnpj-em-formato-alfanumerico) e mantém [documentação técnica do cálculo do DV](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj).
- A NFS-e publicou a [Nota Técnica 007](https://www.gov.br/nfse/pt-br/noticias/publicada-nota-tecnica-se-cgnfs-e-no-007-com-atualizacoes-e-esclarecimentos/) com grupos IBS/CBS e novos indicadores.
- A [Nota Técnica 009](https://www.gov.br/nfse/pt-br/noticias/publicada-a-nota-tecnica-009-da-nfs-e/) altera CNPJ para caractere e acrescenta finalidade, ajustes, Simples Nacional, consumidor final, imóveis, bens móveis e pagamento vinculado.
- O portal mantém a [página oficial de RTC e versões dos anexos](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc).
- A orientação oficial informa que a ausência de IBS/CBS não causa rejeição até 31/12/2026, mas há [prazos específicos a partir de 01/12/2026](https://www.gov.br/nfse/pt-br/noticias/cgnfs-e-orienta-sobre-os-prazos-para%20destaque-de-ibs-cbs-nas-notas-fiscais-de-servico).
- Para contribuintes do Simples Nacional, o cronograma oficial aponta obrigatoriedade nos DF-e a partir de [01/01/2027 e leiautes em 01/09/2026](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/julho/receita-federal-e-comite-gestor-do-ibs-publicam-o-cronograma-de-implementacao-dos-documentos-fiscais-eletronicos-da-reforma-tributaria-do-consumo).

**Conclusão:** a tolerância temporária à ausência de IBS/CBS não deve ser confundida com conformidade. O prazo depende do regime e do tipo de serviço de cada cliente; o produto precisa armazenar essa decisão por empresa e competência, não em defaults globais.

## 7. Roadmap proposto

### P0 — antes de ampliar clientes ou exposição

1. Implementar autorização multiempresa derivada do usuário e testes anti-IDOR.
2. Adaptar CNPJ alfanumérico ponta a ponta, inclusive integrações, índices e migração.
3. Rotacionar segredos comprometidos e coordenar a limpeza do histórico.
4. Tornar webhook fail-closed e resistente a replay.
5. Remover reset administrativo inseguro por padrão e definir revogação de sessão/JWT.
6. Corrigir proxy para upstream TLS/privado e eliminar detalhes internos das respostas 502.
7. Incluir testes, lint, secret scan e auditoria de dependências como pré-condição de deploy.

### P1 — conformidade fiscal e confiabilidade

1. Implementar contrato completo IBS/CBS/NT 009 com versionamento por leiaute.
2. Validar DPS e eventos contra XSD oficial em CI e Produção Restrita.
3. Implementar retry LOBONOTAS seguro, respeitando `Retry-After` e reconciliação antes de reenvio.
4. Corrigir propagação de query params no cliente mTLS.
5. Adicionar lease/claim atômico para polling e sincronização de artefatos.
6. Retirar XML/PDF do documento principal para armazenamento apropriado, com retenção e acesso autorizado.
7. Criar readiness real, métricas, alertas, SLOs e runbooks testados.
8. Tratar vulnerabilidades de dependências após análise de compatibilidade.

### P2 — qualidade do produto

1. Adicionar CI do frontend e gate Axe/Lighthouse.
2. Associar labels/inputs, nomear botões de ícone, incluir skip link e validar teclado/leitor de tela.
3. Remover tipografia abaixo do mínimo legível e testar zoom/reflow em 320 px e 200%.
4. Resolver avisos de hooks por risco, não por supressão.
5. Dividir `EmpresasService`, controller fiscal e `EmpresaFormPage` por responsabilidade.
6. Remover a pilha PlugNotas desativada após confirmar ausência de dependências operacionais.
7. Definir políticas LGPD, retenção, exportação, exclusão e masking.

### P3 — expansão comercial e IA verificável

1. Definir planos, quotas, billing, trial, suporte, SLA, termos e privacidade.
2. Criar sandbox self-service e portal de desenvolvedor com API keys escopadas e rotação.
3. Só chamar uma capacidade de “agente de IA” quando houver objetivo, ferramentas, memória/estado, guardrails, observabilidade e avaliação.
4. Para RAG fiscal: fontes oficiais versionadas, chunking, embeddings, filtros por vigência/município/regime, citações e avaliação de recuperação.
5. Manter ações fiscais irreversíveis determinísticas e sujeitas à confirmação humana.

## 8. Sequência recomendada de execução

| Janela | Entrega | Dependência |
|---|---|---|
| Dias 1–2 | Tenant model, autorização central e testes anti-IDOR | Decisão do owner sobre vínculo usuário–empresa |
| Dias 2–4 | CNPJ alfanumérico canônico e migração | Homologação com integrações externas |
| Dias 3–4 | Segredos, webhook e sessão/admin reset | Acesso aos consoles para rotação |
| Dias 4–6 | CI/deploy seguro e correções críticas de infraestrutura | Variáveis GitHub/VPS |
| Semanas 2–3 | IBS/CBS/NT 009 e Produção Restrita | Matriz de regimes/clientes e credenciais |
| Semanas 3–4 | Polling distribuído, artefatos e observabilidade | Escolha de mecanismo de lease/storage |
| Semanas 4–5 | Acessibilidade, refatoração e dívida de dependências | Baseline visual/QA |
| Posterior | Oferta comercial, sandbox e IA/RAG | P0/P1 estabilizados |

Os intervalos são estimativas de engenharia, não promessa comercial. As frentes com acesso externo podem ser bloqueadas por rotação, credenciais ou homologação.

## 9. Decisão solicitada ao owner

Antes de implementar os P0, confirmar:

1. qual é o modelo desejado de vínculo entre usuário e empresa: uma empresa, várias empresas ou organização com empresas;
2. se administradores podem acessar todas as empresas e como esse acesso será auditado;
3. autorização para rotação e rewrite coordenado do histórico Git;
4. quais clientes/regimes/serviços precisam cumprir IBS/CBS em 01/12/2026 versus 01/01/2027;
5. se o próximo ciclo deve priorizar segurança multiempresa ou CNPJ alfanumérico — a recomendação é iniciar ambos em paralelo, com segurança como bloqueador de expansão.

