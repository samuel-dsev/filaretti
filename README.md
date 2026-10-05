# Filaretti — desenvolvimento local

Monorepo do portal institucional/editorial planejado em [plan.md](plan.md). Versão única **0.8.0**, definida pelo `package.json` raiz e alinhada nos oito manifests privados. Site institucional, portal editorial e CMS usam a API real, preservando o Design System aprovado da F3. A F7 acrescenta contato com anexos privados, newsletter com confirmação/descadastro, recuperação de senha, busca em português, FAQ, SEO e preferências de cookies. A F8 implementa hardening, QA integrado e recuperação local; homologação externa permanece parcial. E-mails e antispam são explicitamente simulados no desenvolvimento local. Situação e validações efetivamente executadas: [relate.md](relate.md).

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
pnpm db:generate
pnpm db:migrate
pnpm db:seed:development
pnpm dev
```

`setup:local` gera `.env`, `apps/api/.env` e `apps/web/.env.local` ignorados pelo Git, com segredos aleatórios exclusivamente locais. Recusa sobrescrever qualquer um desses arquivos e não imprime valores. Exemplos versionados contêm placeholders; nunca usar esses placeholders em produção. Nenhuma conta externa é necessária. Os pacotes compartilhados são compilados automaticamente antes dos apps pelo Turbo, inclusive no primeiro `pnpm dev`.

Abra `http://127.0.0.1:3000` para o site institucional com dados fictícios da API e `/dev/design-system` para a biblioteca visual; `/dev/design-system/admin` apresenta o layout administrativo. As demonstrações exigem `APP_ENV=development` e Host de loopback, retornando 404 fora dessas condições. O build otimizado local também permite a revisão com `APP_ENV=development`. Fonte e contratos dos componentes: [docs/design-system.md](docs/design-system.md). Rotas, dados, estados e cache: [docs/public-site.md](docs/public-site.md).

API em `http://127.0.0.1:3001`; Swagger local em `/api/docs`. `/admin/login` abre o CMS. A web encaminha suas chamadas por `/api/cms/*`, preservando cookies HttpOnly e header CSRF nas mutações; a origem do navegador deve corresponder a `WEB_PUBLIC_URL`. Em checkout anterior à F6, executar `pnpm setup:cms-local` uma vez para alinhar o segredo de revalidação ignorado e reiniciar os apps. Contratos e procedimentos: [docs/api.md](docs/api.md) e [docs/cms.md](docs/cms.md). Nenhuma conexão de banco ou segredo usa prefixo `NEXT_PUBLIC_`.

O seed usa somente contas e conteúdo explicitamente fictícios. Credenciais locais e procedimento do primeiro ADMIN sem senha padrão em produção: [docs/database.md](docs/database.md). Não executar seed de desenvolvimento fora de `APP_ENV=development`; `seed-production` contém apenas configuração estrutural. Confirmação da newsletter, descadastro e recuperação usam tokens de uso único e entrega transacional persistida. No desenvolvimento, o worker salva a mensagem criptografada em `.local/mail`, sem envio externo ou tokens em logs. Com a API compilada, `pnpm mail:local` lista UUID/tipo/data das capturas; `pnpm mail:local <UUID>` cria um HTML local da mensagem escolhida para abrir o link. Procedimento e limites em [docs/relationship.md](docs/relationship.md).

`APP_ENV` define o ambiente de dados; `NODE_ENV` define modo de execução/build. Build local otimizado usa `APP_ENV=development`, mesmo com `NODE_ENV=production`. Staging e production exigem URLs públicas HTTPS, cookies Secure e ingress assinado/configurado; production também rejeita conteúdo mock. R2, Resend e Turnstile têm adaptadores implementados e configuração validada; a comprovação externa fica na F8. Desenvolvimento usa storage local, `MOCK_INTEGRATIONS`/`NEXT_PUBLIC_MOCK_INTEGRATIONS` em loopback e nenhum fornecedor externo é ativado automaticamente. Relacionamento fica desabilitado por padrão fora do desenvolvimento até configurar seus gates. Analytics e indexação também começam desabilitados.

## Verificação

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:design-system
pnpm build
pnpm test:institutional
pnpm test:editorial
pnpm test:cms
pnpm test:relationship
pnpm format:check
pnpm --filter @filaretti/api db:validate
```

Testes de configuração usam Vitest. A API usa o test runner do Node com TypeScript previamente compilado e HTTP real. A integração exige PostgreSQL real e permissão local/CI de criar bancos: cria um banco temporário próprio, aplica migrations, repete o seed, verifica idempotência e executa testes de auth/domínio/health. Ao final remove somente esse banco temporário, preservando o banco de desenvolvimento e seu volume. Não pula checks se o banco estiver indisponível. `db:validate` verifica o schema; CI gera o cliente Prisma e roda lint → typecheck → testes → integração PostgreSQL → build, sem deploy.

`test:institutional` exige build existente, PostgreSQL local e Playwright já disponível (configurar `PLAYWRIGHT_MODULE_PATH` se necessário), com Edge por padrão. Usa outro banco temporário, API/Next em portas próprias, fixture raster substituível e revisão de seis templates em cinco larguras, sem modificar o banco de desenvolvimento. Não instala navegador/pacotes; detalhes e opção explícita de alcance HTTP em [docs/public-site.md](docs/public-site.md). O smoke visual é local, não foi acrescentado ao CI sem infraestrutura de navegador correspondente.

`test:editorial` usa o mesmo isolamento para verificar listagem/leitura, filtros combinados, URLs compartilháveis, visibilidade, retirada de publicação, sumário, compartilhamento, PDF, XSS e recuperação da API. Requer portas 3014/3015 livres e inspeciona o Edge em cinco larguras; dados/arquivos temporários são próprios. Política de cache, reprodução e limites em [docs/editorial.md](docs/editorial.md).

Consulte `http://127.0.0.1:3001/health`: banco disponível retorna HTTP **200** e `{"status":"ok","database":"up"}`; indisponível retorna **503** e `{"status":"error","database":"down"}`. Ambas as respostas têm `Cache-Control: no-store` e não mostram credenciais/stack. Para testar a mudança de estado somente no banco deste projeto:

```powershell
docker compose stop postgres
# Consultar /health e confirmar 503.
docker compose start postgres
# Aguardar healthcheck do container, consultar /health e confirmar 200.
```

O volume `filaretti-local_postgres_data` persiste; não executar `down -v`/reset para repetir verificações. Os apps rodam no host com bind local; apenas PostgreSQL está no Compose.

O smoke `test:cms` usa PostgreSQL/HTTP/Edge reais em banco temporário, storage isolado e portas 3024/3025; verifica login, upload, preview, publicação/retirada e permissões. Pré-requisitos e limites: [docs/cms.md](docs/cms.md). Os testes de integração cobrem concorrência/recovery do worker, conflito de edição, arquivos inválidos, mídia em uso e redirects. O teste local não comprova R2 real.

`test:relationship` usa banco PostgreSQL temporário próprio, API/Next em 3027/3026, storage/mailbox/fixtures e build de QA isolados. Exige build, banco e Playwright/Edge já disponíveis; não instala navegador nem acessa fornecedores reais. Verifica contato/anexo privado, confirmação/descadastro, recuperação, busca/FAQ, políticas públicas e administração, com telas nas cinco larguras do Design System. O ambiente é development com GA4 desabilitado: negação local e testes de política não comprovam GA4 habilitado ou configuração da conta externa. A evidência do último run fica em `.local/f7-qa-smoke.json`; resultados e limitações no relatório da fase.

## Estrutura e continuidade

| Caminho                                       | Responsabilidade                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/web`                                    | Next.js App Router/React/Tailwind; páginas institucionais/editoriais SSR e estados     |
| `apps/api`                                    | NestJS; Prisma, autenticação/roles, API de domínio, logs sanitizados, Swagger e health |
| `packages/ui`                                 | Tokens CSS, controles, formulários, diálogos e estados compartilhados da F3            |
| `packages/types`                              | Contratos de autenticação e domínio; sem modelos Prisma/segredos                       |
| `packages/config`                             | Configuração validada por ambiente; exclusivamente no servidor                         |
| `packages/eslint-config`, `packages/tsconfig` | Regras e TypeScript estrito compartilhados                                             |
| `docs`                                        | Decisões/contratos iniciais, futuros e gates por etapa                                 |

Todos os pacotes são privados. Não há publicação npm; bump funcional da etapa acontece na raiz e nos workspaces, acompanhado de plano/relatório e lockfile. Husky/lint-staged formatam arquivos staged; CI e checks completos continuam obrigatórios.

Ler `AGENTS.md`, `plan.md` inteiro e situação/último relatório de `relate.md` antes de retomar. A autorização desta entrega cobre F8 e commit local. F9, push, PR, homologação externa e produção dependem de autorização própria.

## Referências

Compatibilidade verificada nas documentações oficiais de [Next.js](https://nextjs.org/docs/app/getting-started/installation), [NestJS](https://docs.nestjs.com/first-steps), [Prisma](https://www.prisma.io/docs/orm/v7/reference/system-requirements) e [Node.js LTS](https://nodejs.org/en/about/previous-releases), com versões dos pacotes conferidas no npm registry. PostgreSQL **17.11** segue a [política oficial de versões](https://www.postgresql.org/support/versioning/); Compose e CI fixam também o digest da imagem oficial.

## F8 — validação local e homologação parcial

Versão corrente: `0.8.0`. Consulte o checkpoint em [plan.md](plan.md), as evidências e inventário no [RP-009](relate.md) e os procedimentos de [operação/recuperação](docs/operations.md) e [QA integrado](docs/f8-qa.md). A fase inclui hardening de tráfego, scanner privado, health/filas, testes de componentes e ensaio real de restauração local. Providers e ambiente externo permanecem sujeitos aos gates registrados; F9 ainda não autorizada.
