# Ambiente local, CI e publicação

Referência atual: F7, `0.7.0`. Site, CMS, publicação, busca e relacionamento têm implementação local. E-mails/antispam são simulados explicitamente, storage é local e analytics/indexação começam desabilitados. Hosting, homologação externa e produção dependem de gates próprios; o estado dos checks executados fica em `../relate.md`.

## Pré-requisitos e configuração local

Usar as versões fixadas em [architecture.md](architecture.md), Docker com suporte a Linux containers e Docker Compose v2. O README da raiz é o procedimento de instalação e contém os comandos oficiais do projeto. O estado efetivamente verificado, incluindo plataforma e versões, fica em `../relate.md`.

Na primeira configuração, `pnpm setup:local` gera somente arquivos locais ignorados a partir de exemplos, com placeholders para integrações inativas e segredos locais aleatórios. Ele recusa sobrescrever arquivos existentes. Não editar nem imprimir segredos nos relatórios; corrigir somente a configuração local necessária. Uma URL de banco gerada deve apontar ao serviço isolado deste projeto, jamais a um banco de outro projeto.

Os exemplos por app/infraestrutura são a referência dos nomes exatos de variáveis. Seus grupos incluem:

| Grupo                        | Uso                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Ambiente, host e portas      | `APP_ENV`, `NODE_ENV`, Web/API locais e distinção entre ambiente de dados e modo de build                                 |
| URLs pública/interna e banco | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_BASE_PATH`, `API_INTERNAL_URL` e conexão privada `DATABASE_URL`                  |
| Cookies, JWT e refresh       | Segredos/TTLs server-only para sessão administrativa                                                                      |
| Storage local e R2/buckets   | `STORAGE_DRIVER`, caminhos locais e buckets públicos/privados distintos                                                   |
| Resend e webhook             | Credenciais server-only, `MAIL_ENCRYPTION_KEY`, `MAIL_LOCAL_PATH` e allowlist de staging                                  |
| Turnstile                    | Site key pública, segredo/hostname esperado privados; actions verificadas por fluxo                                       |
| Preview e revalidação        | Segredos privados, TTL e timeout do CMS                                                                                   |
| Mocks e integrações          | `MOCK_CONTENT`, `MOCK_INTEGRATIONS`, `NEXT_PUBLIC_MOCK_INTEGRATIONS`, `R2_ENABLED`, `RESEND_ENABLED`, `TURNSTILE_ENABLED` |
| Relacionamento e retenção    | `RELATIONSHIP_ENABLED`, `RELATIONSHIP_WORKER_ENABLED`, versões dos avisos, destinatário de contato e prazos de retenção   |
| Analytics e indexação        | `GA4_ENABLED`, `GA4_ENHANCED_MEASUREMENT_DISABLED`, ID público e `SEO_INDEXING_ENABLED`, negados por padrão               |

`APP_ENV` identifica o ambiente de dados/operação. `NODE_ENV` também controla o modo de build/runtime das ferramentas; portanto, build local de produção mantém `APP_ENV=development`. Em `APP_ENV=production`, mocks são proibidos e HTTPS/cookies seguros são obrigatórios.

Placeholder de fornecedor inativo não obriga criar conta. Os adaptadores R2/Resend/Turnstile existem, mas habilitar exige as respectivas credenciais/configuração e autorização do ambiente externo. Mocks só funcionam em desenvolvimento local e não podem ser misturados com Resend/Turnstile reais. Fora de desenvolvimento, relacionamento começa desabilitado; habilitá-lo exige Resend/Turnstile, destinatário válido e versões de aviso aprovadas. Staging Resend exige `RESEND_TEST_RECIPIENTS`, também aplicado pelo worker antes da entrega.

`NEXT_PUBLIC_SITE_URL` e `WEB_PUBLIC_URL` devem ter a mesma origem pública usada pelo navegador; o BFF e a API validam isso independentemente. Builds QA usam origem/portas próprias, porque rewrites Next são fixados no build. Segredos de revalidação web/API também precisam concordar; não imprimir os valores ao verificar.

GA4 só carrega em produção com consentimento, flags e ID válidos. `GA4_ENHANCED_MEASUREMENT_DISABLED=true` registra confirmação operacional, não altera a propriedade remota: comprovar a desativação da coleta automática antes de habilitar. `SEO_INDEXING_ENABLED=true` só é aceito em produção e exige o gate de lançamento; enquanto false, sitemap XML fica vazio e robots bloqueia o site. Não ativar nenhuma dessas flags para concluir um teste local.

## Serviços e persistência

| Serviço | Endereço local          | Execução                           |
| ------- | ----------------------- | ---------------------------------- |
| Web     | `http://127.0.0.1:3000` | Next.js no host                    |
| API     | `http://127.0.0.1:3001` | NestJS no host                     |
| Banco   | `127.0.0.1:5434`        | Compose, projeto `filaretti-local` |

O Compose contém PostgreSQL com imagem fixada, healthcheck e volume nomeado persistente. Web/API não são contêineres na F1. O volume é preservado ao parar serviços; não remover volume nem fazer reset para repetir um smoke.

O procedimento de aceite é: instalar pelo lockfile, gerar/configurar ambiente local, iniciar o banco com `docker compose up -d`, iniciar apps com `pnpm dev`, consultar `/health` e executar lint/typecheck/testes/build. Testar indisponibilidade com parada/reinício do serviço do próprio projeto, preservando o volume. As respostas esperadas estão em [api.md](api.md).

Conferir a porta antes de iniciar e diagnosticar conflito em vez de encerrar serviços alheios. Uma falha do PostgreSQL deve produzir health `503`, sem expor conexão/stack. Não registrar sucesso de banco real com base em mock ou somente em container iniciado.

## Migrations e testes locais

Depois da subida saudável do Compose, executar `pnpm db:generate`, `pnpm db:migrate` e `pnpm db:seed:development`. O migrate deploy aplica somente migrations pendentes, sem reset. O seed preserva registros existentes e fica bloqueado fora de desenvolvimento. O procedimento de produção estrutural e primeiro ADMIN está em [database.md](database.md); nenhuma conta externa é criada pela F2.

`pnpm test:integration` exige PostgreSQL real e uma conexão de desenvolvimento/CI com permissão de criar bancos. O runner cria um banco com nome aleatório `filaretti_test_*`, aplica migrations em banco novo, repete seeds e verifica contagens, executa HTTP/autorização e remove exclusivamente o banco criado por ele. Credenciais ficam no ambiente do processo e a saída do runner é sanitizada. Não usar credenciais de produção neste runner.

A F7 acrescenta uma migration aditiva de relacionamento; aplicá-la com `pnpm db:migrate` antes da nova API, sem reset/reseed. O worker de relacionamento inicia junto da API e a cada minuto, salvo flag desabilitada ou NODE_ENV=test. Outbox e retenção exigem instância continuamente ativa; tarefas pendentes e leases vencidos são recuperados quando a API retorna. Reinício não equivale a entrega imediata garantida; monitorar/exercitar retries e exaustão na F8.

`pnpm test:relationship` usa PostgreSQL/HTTP/Edge locais, banco temporário, storage/mailbox/fixtures próprias e portas 3026/3027. Artefato QA e tsconfig temporário são removidos ao terminar; evidências sanitizadas ficam ignoradas em `.local/f7-qa-smoke.json` e `.local/f7-qa-evidence`. Esse smoke usa development, adaptadores locais e GA4false; testes separados de componente usam provider simulado. Nenhum desses resultados certifica envio real, scanner, propriedade GA4 ou navegadores remotos. Reprodução em [relationship.md](relationship.md) e resultados no relatório.

## Pipeline CI

CI instala com `pnpm install --frozen-lockfile`, gera o cliente Prisma e executa lint → typecheck → testes unitários → `pnpm test:integration` → build. Vitest cobre configuração; o runner nativo do Node verifica HTTP/erros, autenticação e domínio com PostgreSQL real. O ambiente de verificação usa configurações locais/de teste; nenhuma credencial de fornecedor externo é necessária. O relatório deve identificar o PostgreSQL e os checks efetivamente executados.

Hooks locais e lint-staged dão feedback antes do commit, sem substituir CI. O pipeline não faz deploy, release, push nem publicação em registry. O commit local de uma fase é feito pelo agente principal após integração/revisão, conforme `../AGENTS.md`; ações remotas dependem de autorização própria.

## Ambientes futuros

Vercel para web e Railway para API/worker/PostgreSQL, com Cloudflare, são propostas do plano. Compatibilidade, limites, custo, orçamento e credenciais serão confirmados antes da contratação. A F1 não provisiona esses serviços.

Homologação na F8 exigirá autorização externa, acesso protegido, noindex, dados/buckets/segredos isolados e e-mails restritos a destinatários de teste. R2, Resend, assinatura de webhook/Turnstile reais, scanner e estado VERIFIED, tarefas contínuas e restauração precisarão de evidências próprias. Comprovar proxy confiável para rate limits por visitante, destinatário administrativo, versões de aviso/prazos de retenção e entrega de confirmação/descadastro/recuperação. Sem essas evidências, homologação permanece parcial.

## Release e recuperação futuras

Antes do corte da F10: aprovação de conteúdo e ambientes, artefato de commit identificado, backup verificado, plano revisável de DNS/tráfego, rollback e ADMIN provisionado sem senha padrão. A ordem prevista é migrations compatíveis → lote estrutural/aprovado → API/worker e readiness → web → smoke controlado → corte autorizado.

Rollback deverá considerar compatibilidade de schema; revert de código não equivale a desfazer migration. Backup diário, retenção e recuperação de arquivos serão definidos/testados na F8. Não presumir recuperação de mídia por versionamento nativo do R2. Nenhum backup, restore, deploy ou rollback de produção é declarado validado pela F1.
