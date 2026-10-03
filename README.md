# Filaretti — fundação local

Monorepo do portal institucional/editorial planejado em [plan.md](plan.md). Versão única **0.1.0**, definida pelo `package.json` raiz e alinhada nos oito workspaces privados. A F1 entrega scaffolding, configuração, health e CI; entidades, autenticação, CMS, site e integrações serão implementados nas etapas seguintes. Situação e validações reais: [relate.md](relate.md).

## Pré-requisitos

- Node.js **24.18.0 LTS** (também registrado em `.node-version`).
- pnpm **11.25.0** (`packageManager`); com Corepack disponível, usar `corepack pnpm` ou disponibilizar essa versão no PATH. Não usar npm/yarn para gerar outro lockfile.
- Docker Desktop com Linux containers/WSL2 funcional; Docker Compose **v2 ou superior**. A virtualização do firmware, a Plataforma de Máquina Virtual do Windows e o hipervisor precisam estar disponíveis. Caso WSL retorne `HCS_E_HYPERV_NOT_INSTALLED`, corrigir o ambiente antes de validar o banco.
- Portas locais livres: web **3000**, API **3001**, PostgreSQL **5434**.

Versões fixadas e decisões: [docs/architecture.md](docs/architecture.md). RTK é o wrapper usado nesta máquina conforme `AGENTS.md`; não é dependência da aplicação. Exemplos abaixo usam comandos usuais; agentes neste workspace devem prefixá-los com `rtk`/`rtk proxy`.

## Primeira execução

Na raiz deste repositório (`C:\Users\Samuel\Documents\Projetos\Filaretti` nesta máquina):

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait
pnpm dev
```

`setup:local` gera `.env`, `apps/api/.env` e `apps/web/.env.local` ignorados pelo Git, com segredos aleatórios exclusivamente locais. Recusa sobrescrever qualquer um desses arquivos e não imprime valores. Exemplos versionados contêm placeholders; nunca usar esses placeholders em produção. Nenhuma conta externa é necessária. Os pacotes compartilhados são compilados automaticamente antes dos apps pelo Turbo, inclusive no primeiro `pnpm dev`.

Abra `http://127.0.0.1:3000` para a página fictícia da fundação. API em `http://127.0.0.1:3001`; Swagger local em `/api/docs`. As URLs internas/externas são separadas; nenhuma conexão de banco ou segredo usa prefixo `NEXT_PUBLIC_`. Não há encaminhamento `/api/v1` no web ainda: o contrato de domínio entra na F2.

`APP_ENV` define o ambiente de dados; `NODE_ENV` define modo de execução/build. Build local otimizado usa `APP_ENV=development`, mesmo com `NODE_ENV=production`. `APP_ENV=production` rejeita mocks, cookies inseguros e URLs públicas sem HTTPS. Flags R2/Resend/Turnstile ficam desligadas e sua ativação é rejeitada na F1, pois os adaptadores ainda não existem.

## Verificação

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm format:check
pnpm --filter @filaretti/api db:validate
```

Testes de configuração usam Vitest. A API usa o test runner do Node com TypeScript previamente compilado e HTTP real; a integração exige PostgreSQL real e não pula a verificação caso esteja indisponível. `db:validate` verifica somente o datasource Prisma vazio; migrations e modelos estão reservados à F2. CI roda lint → typecheck → testes → integração PostgreSQL → build e não faz deploy.

Consulte `http://127.0.0.1:3001/health`: banco disponível retorna HTTP **200** e `{"status":"ok","database":"up"}`; indisponível retorna **503** e `{"status":"error","database":"down"}`. Ambas as respostas têm `Cache-Control: no-store` e não mostram credenciais/stack. Para testar a mudança de estado somente no banco deste projeto:

```powershell
docker compose stop postgres
# Consultar /health e confirmar 503.
docker compose start postgres
# Aguardar healthcheck do container, consultar /health e confirmar 200.
```

O volume `filaretti-local_postgres_data` persiste; não executar `down -v`/reset para repetir verificações. Os apps rodam no host com bind local; apenas PostgreSQL está no Compose.

## Estrutura e continuidade

| Caminho                                       | Responsabilidade                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web`                                    | Next.js App Router/React/Tailwind; página local e tratamento inicial de erro/404        |
| `apps/api`                                    | NestJS; validação, erros, logs sanitizados, Swagger de desenvolvimento e probe de banco |
| `packages/ui`                                 | Primitivo inicial compartilhado; Design System completo na F3                           |
| `packages/types`                              | Contratos públicos mínimos; sem modelos Prisma/dados internos                           |
| `packages/config`                             | Configuração validada por ambiente; exclusivamente no servidor                          |
| `packages/eslint-config`, `packages/tsconfig` | Regras e TypeScript estrito compartilhados                                              |
| `docs`                                        | Decisões/contratos iniciais, futuros e gates por etapa                                  |

Todos os pacotes são privados. Não há publicação npm; bump funcional da etapa acontece na raiz e nos workspaces, acompanhado de plano/relatório e lockfile. Husky/lint-staged formatam arquivos staged; CI e checks completos continuam obrigatórios.

Ler `AGENTS.md`, `plan.md` inteiro e situação/último relatório de `relate.md` antes de retomar. A autorização cobre somente F1 e seu commit local após verificações; F2, push, PR, homologação e produção dependem de autorização própria.

## Referências

Compatibilidade verificada nas documentações oficiais de [Next.js](https://nextjs.org/docs/app/getting-started/installation), [NestJS](https://docs.nestjs.com/first-steps), [Prisma](https://www.prisma.io/docs/orm/v7/reference/system-requirements) e [Node.js LTS](https://nodejs.org/en/about/previous-releases), com versões dos pacotes conferidas no npm registry. PostgreSQL **17.11** segue a [política oficial de versões](https://www.postgresql.org/support/versioning/); Compose e CI fixam também o digest da imagem oficial.
