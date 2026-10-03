# Filaretti Advocacia — situação atual e relatórios

## Situação atual

| Campo                | Estado                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Última atualização   | 02/10/2026 — RP-001                                                                                    |
| Etapa                | **F1 parcial — base local validada; aguardando reinício/Docker para aceite real do banco**             |
| Versão               | `0.1.0` no package.json raiz e workspaces privados                                                     |
| Código/aplicação     | Web/API/pacotes/configuração/health/CI implementados; sem domínio/auth/CMS                             |
| Ambiente             | Windows; web/API e smoke local aprovados; PostgreSQL/Compose não iniciaram por hipervisor indisponível |
| Git                  | `dev`, `origin/dev`, remoto samuel-dsev/filaretti; baseline `6c84b6a`                                  |
| Commit desta entrega | Commit local parcial da base previsto; SHA real informado após commit e registrado na retomada         |
| Próxima etapa        | Concluir F1 após reinício/Docker disponível                                                            |
| Autorização          | F1 já autorizada; usuário pediu aguardar reinício; F2 aguarda confirmação após F1                      |
| Checkpoint           | RP-001 abaixo e quadro inicial de plan.md                                                              |

Este documento distingue implementação, validação e pendências externas. Atualizar este quadro em toda entrega ou interrupção e acrescentar uma entrada ao histórico, preservando as anteriores. Datas e horários informados ao usuário seguem America/Sao_Paulo.

## Histórico

### RP-001 — 02/10/2026 — F1 — Fundação local; aceite PostgreSQL pendente

**Escopo autorizado:** iniciar e concluir somente F1, com Git já preparado pelo usuário. Durante a execução, o usuário pediu: "Quando terminar aguarde o reinicio do computador, para o docker disponibilizar". Preparação/checks independentes concluídos; aguardando reinício para finalizar o aceite, sem iniciar F2.

**Estado:** **parcial**. Código da fundação e checks locais aprovados; a etapa inteira não está concluída porque PostgreSQL/Compose e health 200 reais não foram comprovados.

**Versão:** `0.0.0` documental → `0.1.0`; referência na raiz e oito workspaces privados alinhados. Não há mudança de contrato de produção preexistente.

**Git/cwd:** pasta atual `C:\Users\Samuel\Documents\Projetos\Filaretti`; antiga `Projeto` ausente. Repositório inicialmente limpo, branch `dev` acompanhando `origin/dev`; remoto `https://github.com/samuel-dsev/filaretti.git`. Baseline do usuário `6c84b6a9d06d10cc48a104525f99b377d3eaef41`. Nenhum repositório/branch/remoto foi criado. Commit local previsto da base: `feat(foundation): prepara base local da F1 (v0.1.0)`; SHA real será informado após o commit e registrado na próxima retomada. Este commit parcial não equivale ao aceite completo da F1.

#### Arquivos criados e alterados

Arquivos versionáveis criados nesta preparação (70):

- `.editorconfig`
- `.env.example`
- `.gitattributes`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.husky/pre-commit`
- `.node-version`
- `.prettierignore`
- `.prettierrc.json`
- `README.md`
- `apps/api/.env.example`
- `apps/api/eslint.config.mjs`
- `apps/api/package.json`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/common/sanitized-logger.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.service.ts`
- `apps/api/src/main.ts`
- `apps/api/test/foundation.test.ts`
- `apps/api/test/health.integration.test.ts`
- `apps/api/test/helpers.ts`
- `apps/api/tsconfig.json`
- `apps/api/tsconfig.test.json`
- `apps/web/.env.example`
- `apps/web/eslint.config.mjs`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/tsconfig.json`
- `compose.yaml`
- `docs/api.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/deployment.md`
- `docs/design-system.md`
- `docs/security.md`
- `docs/seo.md`
- `package.json`
- `packages/config/eslint.config.mjs`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/test/environment.test.ts`
- `packages/config/tsconfig.json`
- `packages/config/tsconfig.test.json`
- `packages/eslint-config/base.js`
- `packages/eslint-config/package.json`
- `packages/tsconfig/base.json`
- `packages/tsconfig/nextjs.json`
- `packages/tsconfig/package.json`
- `packages/types/eslint.config.mjs`
- `packages/types/package.json`
- `packages/types/src/index.ts`
- `packages/types/tsconfig.json`
- `packages/ui/eslint.config.mjs`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `packages/ui/src/panel.tsx`
- `packages/ui/tsconfig.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/setup-local.mjs`
- `turbo.json`

Arquivos preexistentes alterados: `plan.md` e `relate.md`, para checkpoint, versão, estado real do Git e histórico. `AGENTS.md` preservado. Nenhum arquivo do baseline foi removido. Prettier normalizou apresentação de documentos sem apagar o histórico RP-000.

Arquivos locais ignorados gerados: `.env`, `apps/api/.env`, `apps/web/.env.local`, pacotes instalados/builds, tipos Next e evidências `.local/smoke.cjs`, `.local/smoke-mobile.png` e `.local/smoke-desktop.png`. Contêm somente ambiente local de desenvolvimento; segredos aleatórios não foram exibidos/versionados. Os arquivos `apps/web/AGENTS.md`/`CLAUDE.md`, gerados automaticamente pelo Next durante o smoke, foram lidos e removidos; `agentRules: false` evita regeneração e mantém as regras canônicas na raiz.

#### Implementação e decisões

- Monorepo na mesma base, pnpm/Turbo, Next App Router/React/Tailwind e NestJS. Pacotes config/types compilam antes de dev/build; UI usa fonte TypeScript transpilada pelo Next. TypeScript estrito, ESLint/Prettier, Husky/lint-staged e lockfile únicos.
- Configuração de servidor validada, APP_ENV obrigatório distinto de NODE_ENV, flags booleanas exatas, mocks proibidos em produção, URLs HTTPS/cookies seguros exigidos nesse ambiente. Turbo inclui APP_ENV/configuração pública no repasse e no hash, também para typecheck. Campos de integrações existem como contratos inativos; habilitar fornecedores sem adaptadores falha explicitamente.
- Exemplos por app/Compose e gerador local sem overwrite; senhas/chaves de desenvolvimento aleatórias. pnpm 11 usa allowBuilds explícito para scripts nativos necessários; telemetria de instalação Scarf/Nest bloqueada. ESLint 9 foi mantido por compatibilidade declarada com plugins React/JSX do Next selecionado; o registry o marca sem suporte, exigindo revisão de atualização quando esses plugins suportarem ESLint 10. Não há vulnerabilidade conhecida de produção no audit executado.
- PostgreSQL 17.11-alpine fixado por digest oficial `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` no Compose e CI; projeto filaretti-local, bind127.0.0.1:5434, volume persistente e healthcheck. Manifest da imagem confirmado no Docker Hub; imagem/serviço não puderam ser iniciados nesta máquina.
- API GET /health usa SELECT1, pool limitado e timeouts; retorna 200/up ou503/down, no-store. Request IDs sempre gerados pela API; respostas genéricas e logger por campos permitidos descartam corpo, headers, URLs e exceções. Swagger só em APP_ENV/NODE_ENV development; validação global e limite JSON64kb preparados.
- Web contém página local fictícia, noindex, skip link, erro/404 e primitivo Panel; sem site institucional/admin/CRUD/proxy de domínio. Prisma tem somente datasource/config, sem entidades/migrations/client de domínio. CI executa lint→typecheck→testes→integração PostgreSQL→build, sem publicação.
- Subagentes trabalharam em apps/web+ui e docs isoladamente, conforme AGENTS; principal integrou e revisou. A revisão identificou/corrigiu bootstrap ^build, repasse/hash de APP_ENV, variáveis CI no typecheck, ignore de dist-test e divergências documentais. Nenhum subagente fez commit/operação externa.

#### Validação executada

| Check                                    | Resultado/evidência                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline/cwd/branch/remoto               | dev limpo inicialmente, baseline 6c84b6a, remoto confirmado; caminho Filaretti                                                                                        |
| Compatibilidade/versões                  | Registry npm e docs oficiais Next/Nest/Prisma/Node; Node24.18.0/pnpm11.25.0; digest PostgreSQL oficial conferido                                                      |
| pnpm install --frozen-lockfile           | Passou; instalação inicial teve timeout de rede, resolvido aumentando timeout/concurrency somente no comando; instalação frozen final padrão também passou            |
| Setup local / proteção contra overwrite  | Passou; geração sem imprimir valores; repetição recusada e hashes dos três arquivos preservados                                                                       |
| docker compose config --quiet            | Passou; validação de configuração somente, sem comprovar serviço                                                                                                      |
| pnpm lint                                | Passou sem erros/warnings após correções                                                                                                                              |
| pnpm typecheck                           | Passou nos apps/pacotes e testes; erros iniciais de tipagem dos JSON HTTP foram corrigidos                                                                            |
| pnpm test                                | Dez testes passaram: sete Vitest de configuração e três Node/HTTP de API; sem mocks do banco para indisponibilidade, conexão real a porta fechada                     |
| Proteção contra config inválida          | Teste encontrou refine URL lançando TypeError; corrigido com parser protegido. Testes finais confirmam campo público sem segredo e rejeição de protocolo inválido     |
| pnpm build                               | API/pacotes e Next otimizado passaram; páginas / e /_not-found geradas                                                                                                |
| pnpm --filter @filaretti/api db:validate | Datasource/schema vazio Prisma válido; não comprova conexão nem migration                                                                                             |
| pnpm audit --prod --audit-level=high     | Nenhuma vulnerabilidade conhecida reportada pelo registry                                                                                                             |
| pnpm dev                                 | Iniciou web em127.0.0.1:3000 e API em127.0.0.1:3001; processos desta sessão encerrados depois do smoke                                                                |
| Smoke HTTP/browser                       | Edge headless real: web200, noindex, APIhealth503/down sem DB; inspeção visual PNGs em375x812 e1440x1000, sem overflow horizontal e skip link por teclado funcionando |
| Git ignore/segredos                      | .env reais, evidências, builds e dist-test ignorados; somente placeholders e credenciais explicitamente de teste nos arquivos versionáveis                            |

`pnpm format:check` e `git diff --check` passaram; arquivos de staging revisados explicitamente antes do commit. A tentativa inicial de commit encontrou `pnpm: command not found` no shell do hook Git/Windows; o hook foi ajustado para invocar a CLI local de lint-staged diretamente por Node, sem depender do wrapper `.cmd` do pnpm. A lista acima registra verificações locais, sem alegar execução do workflow no GitHub. Nenhum push/PR/deploy/envio externo ou conta de fornecedor foi executado.

#### Bloqueio do ambiente e retomada exata

Docker client29.7.2 e Compose5.4.0 disponíveis, contexto desktop-linux. Docker Desktop permaneceu stopped/API500. Tentativa de iniciar WSL Ubuntu24.04 retornou `Wsl/Service/CreateInstance/CreateVm/HCS/HCS_E_HYPERV_NOT_INSTALLED`. Consulta Windows confirmou `VirtualizationFirmwareEnabled=True` e `HypervisorPresent=False`; leitura de feature/BCD exigiu elevação e foi negada. Nenhuma configuração de BIOS/boot/Windows foi alterada e nenhum reinício foi solicitado por ferramenta. O usuário providenciará o reinício.

**Não executados/pendentes:** Docker Compose up real, download/inicialização do container/volume, `pnpm test:integration` com PostgreSQL real, health200 e transição200→503→200 com stop/start preservando volume; workflow remoto. Banco/schema/queries de domínio são escopo F2, não pendência de implementação da F1.

Após o reinício, nesta mesma pasta/branch:

1. Reler AGENTS.md, plan.md completo e este checkpoint; conferir cwd/Git e registrar o SHA real do commit local anterior.
2. Confirmar `rtk proxy docker info` e que Docker está disponível; executar `rtk proxy pnpm install --frozen-lockfile`. Não repetir setup:local sobre env existentes.
3. Executar `rtk proxy docker compose up -d --wait` e verificar healthcheck; não alterar/remover volumes de outros projetos.
4. Executar `rtk proxy pnpm test:integration`, iniciar `rtk proxy pnpm dev` e confirmar /health200; parar/iniciar somente postgres deste Compose para verificar503/200, preservando o volume.
5. Resolver eventual falha pertinente, registrar RP-002, marcar F1 concluída somente se todo o aceite passar e commitar o fechamento local verificado. Aguardar confirmação do usuário antes de F2; a autorização da F1 continua válida para esta retomada.

**Ponto de parada:** aguardando reinício/Docker para terminar F1. **F2 não iniciada e não autorizada.**

### RP-000 — 02/10/2026 — Planejamento inicial

**Escopo autorizado:** converter o plano mestre fornecido pelo usuário em um planejamento técnico cronológico; criar os arquivos de continuidade e regras na raiz. Sem implementação de aplicação ou operações externas.

**Versão:** referência inicial `0.0.0`; esse número ainda não representa release executável.

#### Arquivos criados

| Arquivo     | Conteúdo                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan.md`   | Dez grandes atualizações, dependências, entregáveis, aceite, arquitetura, modelo de dados mínimo, riscos/gates, versões previstas e checkpoint                     |
| `AGENTS.md` | Leitura obrigatória do plano/relatório, preservação das regras RTK, escopo por autorização, segurança, subagentes, validação, SemVer, commits e pausa entre etapas |
| `relate.md` | Situação inicial, histórico da entrega e modelo de relatório para continuidade                                                                                     |

Nenhum arquivo preexistente foi alterado/removido. O nome canônico `AGENTS.md` permite descoberta automática das regras; em Windows não deve ser criado outro arquivo `agents.md` com conteúdo diferente.

#### Decisões incorporadas

- Manter a stack oficial Next.js/NestJS/PostgreSQL/Prisma e os fornecedores do plano; usar a raiz atual como monorepo.
- Consolidar a implementação em F1–F10, com versão funcional de desenvolvimento ao término da F7, homologação na F8, migração na F9 e produção na F10.
- Modelar FAQ, páginas institucionais, tokens de recuperação/confirmação/preview e tarefas persistidas, que eram necessárias aos fluxos mas não constavam integralmente da lista inicial de tabelas.
- Separar autor profissional de usuário administrativo, ativos públicos de anexos privados e mocks de dados reais.
- Prever publicação agendada com trava/idempotência, atualização de cache, double opt-in/descadastro, validação server-side do antispam, recuperação de senha e rollback com ordem correta de migrations/API/web.
- Registrar que contas, materiais aprovados, privacidade/retenção, infraestrutura e produção são gates próprios; desenvolvimento local utiliza adaptadores explicitamente simulados quando necessário.
- Reservar o primeiro commit/setup Git ao usuário. Após esse baseline, etapas autorizadas incluem o commit local explicativo correspondente; avanço de etapa, push, merge e deploy não são automáticos.

#### Validação e evidências

- Plano mestre lido do anexo fornecido; escopo público, editorial, administrativo, operação e exclusões incorporados.
- Cwd confirmado: `C:\Users\Samuel\Documents\Projetos\Projeto`; listagem inicial sem arquivos.
- `RTK.md` lido; RTK `0.42.4` identificado. Consulta Git executada com configuração apenas no processo e confirmou **“Not a git repository”**. Não foi executado `git init`.
- Documentação oficial de Next.js, NestJS, Turnstile, R2, Resend e SemVer consultada para as decisões citadas em `plan.md`.
- Revisão documental: ordem/dependências, cobertura do plano mestre, links internos, estados/versões e coerência das pausas; leitura final dos três arquivos e verificação UTF-8 sem caracteres de substituição.
- Não há lint, build ou testes funcionais de aplicação a executar nesta entrega: nenhum código/dependência foi criado ou instalado. A leitura documental não comprova funcionalidades futuras.

#### Limitações e pendências

- Aplicação, migrations, API, UI, CMS, infraestrutura e integrações permanecem **planejados**, sem implementação.
- Nenhum commit, branch, remoto, conta, upload, envio de e-mail, publicação ou alteração de DNS foi realizado.
- Versões de bibliotecas serão selecionadas/verificadas na F1; domínios/hosting são propostas a confirmar antes de uso externo.
- Materiais institucionais e regras finais de privacidade/retenção serão aprovados pelo responsável do escritório nas etapas indicadas.

**Ponto de parada:** documentação inicial concluída. **Próxima ação:** aguardar confirmação do usuário para F1; ao retomar, conferir o baseline Git preparado por ele e reler os documentos. Não iniciar bootstrap nesta entrega.

## Modelo para próximas entradas

Copiar este modelo para o histórico e preencher somente fatos verificados. Atualizar também o quadro de situação atual e o checkpoint de `plan.md`.

```markdown
### RP-NNN — DD/MM/AAAA — F# — Nome da entrega

Escopo autorizado:
Estado: concluída tecnicamente / parcial / bloqueada no item descrito
Versão anterior → versão atual:
Branch e commit-base verificados:
Commit de entrega: assunto previsto; SHA real informado após o commit

Arquivos criados:
Arquivos alterados:
Arquivos removidos:
Funcionalidades e mudanças de comportamento:
Decisões e motivo:
Migrations/configuração/impacto operacional, se houver:

Validação:

- Comando ou procedimento executado, ambiente e resultado.
- Distinguir PostgreSQL/fornecedores reais de mocks e adaptadores simulados.
- Registrar falhas, limites e checks não executados.

Pendências técnicas e externas:
Riscos ou limitações materiais:
Ponto exato de retomada em caso de interrupção:
Próxima etapa e dependências:
Confirmação para avançar: aguardando usuário.
```

O SHA do commit de entrega pode ser registrado no início da próxima retomada após consultar o Git. Não inventar hash nem criar commit adicional exclusivamente para inserir o próprio hash neste arquivo.
