# Banco de dados

Complemento F6: mídia recebe versão para controle de concorrência e identificação do adaptador de storage em nova migration. Preview e outbox passam a executar os fluxos documentados em [cms.md](cms.md), com hash de token, trava PostgreSQL, lease e retries persistidos. Migrations F2 aplicadas não foram reescritas. Aceite real da F6: RP-007 de `../relate.md`.

F2, 03/10/2026. Schema, duas migrations, seeds e serviço Prisma implementados. As evidências de execução com PostgreSQL real e o aceite integrado ficam em `../relate.md`; validação estática do schema não comprova aplicação de migrations.

## Ambiente e acesso

PostgreSQL `17.11-alpine`, em Compose isolado `filaretti-local`, com imagem/digest fixados, healthcheck e volume persistente. A porta do host é `127.0.0.1:5434`; no Compose, o serviço usa `postgres:5432`. `DATABASE_URL` pertence à API, nunca aos contratos do navegador.

Prisma `7.10.0` gera `@prisma/client` em `node_modules`, a partir de `apps/api/prisma/schema.prisma`. `DatabaseModule.register(environment)` exporta globalmente `PrismaService`, com adapter PostgreSQL, pool limitado e encerramento por `$disconnect`. A conexão é aberta sob demanda; `/health` mantém sua sondagem PostgreSQL independente e limitada.

Não executar `prisma migrate reset`, `db push` para substituir o histórico, `docker compose down --volumes`, exclusão de volume ou carga sobre dados compartilhados para resolver erros. Migrations aplicadas não devem ser reescritas. O runner de integração cria bancos temporários novos no PostgreSQL local e não migra o banco de desenvolvimento existente.

## Modelo implementado

As 26 tabelas usam nomes `snake_case`. Identificadores de entidades são UUID; as exceções são a chave opaca do rate limit e a configuração singleton `site`. Datas são `timestamptz(3)`, em UTC; a interface exibirá America/Sao_Paulo. Campos editoriais mutáveis possuem `version`, usado pelo backend para detectar edição concorrente.

| Grupo              | Tabelas                                                                                                            | Regras                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade         | `users`, `sessions`, `refresh_tokens`, `password_reset_tokens`, `login_rate_limits`                                | E-mail normalizado único, roles ADMIN/EDITOR/AUTHOR, ativação e hashes Argon2id. `session.id` identifica a família de refresh; CSRF, tokens, expiração, consumo e revogação são persistidos. Rate limit permanece compartilhado entre processos.                                                                      |
| Institucional      | `professionals`, `practice_areas`, `professional_practice_areas`, `pages`, `faqs`, `site_settings`                 | Profissional público é distinto de usuário administrativo. Bio/descrição/resposta usam JSON TipTap; formação, experiência e serviços são arrays. Página contém seções `{key, heading, body}`. FAQ pode ser global ou por área. Configuração singleton contém somente campos públicos permitidos.                      |
| Editorial          | `articles`, `categories`, `tags`, `article_categories`, `article_tags`, `article_practice_areas`, `preview_tokens` | Tipo ARTICLE/UPDATE/GUIDE; slug único; autor profissional e usuário criador explícitos; estado DRAFT/SCHEDULED/PUBLISHED/ARCHIVED; datas, SEO, destaque, leitura, imagens/PDF e relações com integridade. Preview mantém somente hash, validade e revogação; seu fluxo pertence à F6.                                 |
| Arquivos e contato | `media`, `contacts`, `contact_attachments`                                                                         | Mídia registra proprietário, MIME, bytes, chave, visibilidade, alt, origem/licença e `isMock`. Mídia privada não admite URL pública. Triggers impedem vínculo privado em artigo/foto e vínculo público em anexo de contato, inclusive mudança posterior de visibilidade. Uploads/downloads completos entram na F6/F7. |
| Newsletter         | `newsletter_subscribers`, `newsletter_tokens`                                                                      | E-mail normalizado único; PENDING/ACTIVE/UNSUBSCRIBED; versão/instante de consentimento, confirmação e descadastro. Tokens de CONFIRM/UNSUBSCRIBE persistem hash, finalidade, expiração e uso. Fluxo completo na F7.                                                                                                  |
| Operação           | `redirects`, `outbox_tasks`, `audit_events`                                                                        | Caminhos internos e códigos 301/302/307/308; chaves únicas de idempotência, tentativas, disponibilidade e trava de tarefas; registro sanitizado de ações críticas. Worker e retries efetivos entram na F6/F7.                                                                                                         |

O banco reforça normalização de e-mail, datas obrigatórias para publicação/agendamento, versões positivas, formatos básicos de JSON, evidência de estado da newsletter, privacidade de mídia e limites de tentativas. A API complementa esses checks com validação do conteúdo TipTap, URLs, propriedade, permissões e campos públicos. A tabela não substitui autorização no backend.

Exclusões são explícitas: usuário criador, profissional autor, mídia, categoria/tag/área em uso recebem `RESTRICT`. Exclusão de artigo remove somente seus joins/previews; exclusão de sessão remove seus refresh tokens; exclusão de usuário pode remover sessões/reset tokens, mas continua impedida se houver autoria ou mídia em uso. O ator do evento de auditoria fica nulo se a conta puder ser excluída, preservando o evento.

## Migrations e busca

`202610020001_f2_domain` cria enums, tabelas, índices de listagem, unicidade e relações. `202610020002_search_integrity` adiciona checks/triggers e Full Text Search PostgreSQL em português.

Artigos têm vetor com pesos A para título, B para resumo e C para conteúdo. Profissionais usam nome/cargo e bio; áreas usam nome/resumo/descrição. Triggers atualizam os vetores após edição, publicação ou mudança de atividade; rascunhos/agendados/arquivados e registros inativos ficam sem vetor. Índices GIN parciais abrangem somente conteúdo publicado/ativo.

Consultas públicas devem combinar `status = 'PUBLISHED'`, `published_at <= now()` e, nas demais entidades, `is_active = true`, usando parâmetros em `plainto_tsquery('portuguese', ...)`. Vetor/índice preparado nesta fase não representa a busca global/interface da F7. Conteúdo privado, contatos, assinantes e tokens não são indexados.

Depois de configurar o ambiente privado local, os comandos previstos são:

```powershell
rtk proxy pnpm --filter @filaretti/api db:validate
rtk proxy pnpm --filter @filaretti/api db:generate
rtk proxy pnpm --filter @filaretti/api db:migrate
rtk proxy pnpm --filter @filaretti/api db:seed:development
```

`db:migrate` aplica exclusivamente migrations pendentes via `migrate deploy`; não faz reset. No ambiente real, aplicação requer autorização para o destino, backup e planejamento operacional da fase correspondente.

## Seed de desenvolvimento

`seed-development.ts` é transacional, idempotente e recusa execução sem **APP_ENV=development, NODE_ENV=development e MOCK_CONTENT=true**. Seeds repetidos não recriam registros, redefinem senha ou sobrescrevem edições existentes. A execução não envia e-mails nem cria arquivos/contas externas.

| Fixture                         | Quantidade                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| Usuários ADMIN, EDITOR, AUTHOR  | 3                                                          |
| Profissionais e áreas           | 4 e 5                                                      |
| Artigos, atualizações e guias   | 20: 12 publicados, 4 rascunhos, 2 agendados e 2 arquivados |
| Categorias e tags               | 6 e 20                                                     |
| FAQ e páginas                   | 6 e 4                                                      |
| Contatos e assinantes fictícios | 3 e 3                                                      |
| Configuração do site            | 1                                                          |

Todas as identidades e conteúdos aplicáveis carregam `isMock=true`; nomes e textos dizem explicitamente que são fictícios. E-mails usam `.test`. Não há biografias, credenciais profissionais, números de telefone, destinatários ou anexos reais. Os 20 artigos têm slugs `conteudo-ficticio-01` a `conteudo-ficticio-20` e relações com autor, usuário criador, categoria, tag e área.

**Credenciais públicas exclusivamente locais:** `admin@filaretti.test`, `editor@filaretti.test` e `author@filaretti.test`; senha de teste `Local-F2-Ficticio!2026`. A senha é armazenada como Argon2id (64 MiB, 3 iterações, paralelismo 1), com o mesmo helper de autenticação. Não reutilizar essas identidades/senha em homologação pública ou produção. Se o seed encontrar uma identidade correspondente sem `isMock`, falha em vez de sobrescrevê-la.

## Seed estrutural e primeiro ADMIN

`seed-production.ts` exige APP_ENV/NODE_ENV de produção e MOCK_CONTENT=false. Cria apenas a estrutura vazia de `site_settings`, se ausente: sem usuários, senhas padrão, profissionais, conteúdo, contatos, assinantes ou destinos de comunicação. Repetição preserva dados existentes. Não limpa mocks: a inspeção e carga de material aprovado continuam gates da F9/F10.

`db:provision-admin` executa `prisma/provision-admin.ts`. Só funciona no ambiente de produção configurado, recebe `PROVISION_ADMIN_EMAIL` e `PROVISION_ADMIN_NAME` no ambiente seguro do processo e recebe a senha **exclusivamente por stdin**, fornecida pelo canal protegido de operação/gerenciador de senhas. Não passar senha como argumento de CLI, gravar em script versionado ou escrever um comando que a exponha no histórico.

A senha deve ter 16–128 caracteres e não pode ser a fixture local; não há valor padrão ou exibição da senha. O script normaliza o e-mail, recusa domínios `.test`, usa Argon2id, bloqueia provisionamentos simultâneos com advisory lock transacional e recusa execução se já houver ADMIN ativo. Criação e evento de auditoria são atômicos; não altera senha/conta existentes. Mensagens de falha são sanitizadas. Usuários posteriores são geridos pela API autenticada de ADMIN.

Nenhum provisionamento de produção é autorizado pela simples criação do script. O operador deve escolher o banco isolado correto e fornecer o segredo pelo canal seguro na etapa de produção autorizada.

## Evidências e fases futuras

`database.integration.test.ts` verifica no PostgreSQL real contagens/grafo das fixtures, unicidade/FKs, exclusões em uso, stemming em português, atualização/retirada de vetores, presença dos três índices GIN e privacidade das referências de mídia. O runner também verifica migrations em bancos novos e seeds repetidos/guards, preservando o banco de desenvolvimento. Resultados efetivamente executados constam em `../relate.md`.

F6/F7 ainda devem comprovar uploads privados, confirmação/descadastro e concorrência/idempotência do worker. F8 trata backup/restauração e privilégios do usuário de produção; F10 aplica migrations compatíveis antes da API e carrega apenas o lote aprovado.
