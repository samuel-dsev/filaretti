# Banco de dados

F9 (`0.9.0`) acrescenta ferramentas de [migração](migration.md), preservando schema e as quatro migrations existentes. O lote cria somente conteúdo institucional/editorial e redirects; usa ADMIN preexistente, não transporta usuários/contatos/assinantes, e grava `audit_events` com action `migration.imported`, resource `migration-batch`, UUID e digests SHA-256 do lote/snapshot. Trava `6006001` compartilhada com o CMS, transação Serializable e IDs/slugs estáveis impedem sobrescrita/duplicação. Reexecução conserva edições posteriores; o gate da release detecta alteração no snapshot e exige nova revisão da candidata. Somente settings estrutural integralmente vazio pode receber a carga inicial; configuração existente gera conflito. Dry-run e gate abrem transações PostgreSQL READ ONLY. Fixtures aplicam exclusivamente em banco descartável `filaretti_test_<uuid>` criado pelo runner; banco/volume persistente de desenvolvimento são preservados.

Referência atual F7 (`0.7.0`): mídia, preview e outbox da F6 continuam em [cms.md](cms.md); a migration aditiva da F7 implementa arquivos privados de contato, tickets de download, deduplicação de webhook, idempotência e versões de relacionamento. Migrations anteriores foram preservadas. Evidências de aplicação e checks efetivamente executados: `../relate.md`.

F2, 03/10/2026. Schema, duas migrations, seeds e serviço Prisma implementados. As evidências de execução com PostgreSQL real e o aceite integrado ficam em `../relate.md`; validação estática do schema não comprova aplicação de migrations.

## Ambiente e acesso

PostgreSQL `17.11-alpine`, em Compose isolado `filaretti-local`, com imagem/digest fixados, healthcheck e volume persistente. A porta do host é `127.0.0.1:5434`; no Compose, o serviço usa `postgres:5432`. `DATABASE_URL` pertence à API, nunca aos contratos do navegador.

Prisma `7.10.0` gera `@prisma/client` em `node_modules`, a partir de `apps/api/prisma/schema.prisma`. `DatabaseModule.register(environment)` exporta globalmente `PrismaService`, com adapter PostgreSQL, pool limitado e encerramento por `$disconnect`. A conexão é aberta sob demanda; `/health` mantém sua sondagem PostgreSQL independente e limitada.

Não executar `prisma migrate reset`, `db push` para substituir o histórico, `docker compose down --volumes`, exclusão de volume ou carga sobre dados compartilhados para resolver erros. Migrations aplicadas não devem ser reescritas. O runner de integração cria bancos temporários novos no PostgreSQL local e não migra o banco de desenvolvimento existente.

## Modelo implementado

As 29 tabelas usam nomes `snake_case`. Identificadores de entidades são UUID; as exceções são a chave opaca do rate limit, a configuração singleton `site` e o ID de evento do fornecedor. Datas são `timestamptz(3)`, em UTC; a interface usa America/Sao_Paulo. Campos editoriais, contatos e assinantes mutáveis possuem `version`, usado pelo backend para detectar edição concorrente.

| Grupo              | Tabelas                                                                                                            | Regras                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade         | `users`, `sessions`, `refresh_tokens`, `password_reset_tokens`, `login_rate_limits`                                | E-mail normalizado único, roles ADMIN/EDITOR/AUTHOR, ativação e hashes Argon2id. `session.id` identifica a família de refresh; CSRF, tokens, expiração, consumo e revogação são persistidos. Rate limit permanece compartilhado entre processos.                                                                                                                                                        |
| Institucional      | `professionals`, `practice_areas`, `professional_practice_areas`, `pages`, `faqs`, `site_settings`                 | Profissional público é distinto de usuário administrativo. Bio/descrição/resposta usam JSON TipTap; formação, experiência e serviços são arrays. Página contém seções `{key, heading, body}`. FAQ pode ser global ou por área. Configuração singleton contém somente campos públicos permitidos.                                                                                                        |
| Editorial          | `articles`, `categories`, `tags`, `article_categories`, `article_tags`, `article_practice_areas`, `preview_tokens` | Tipo ARTICLE/UPDATE/GUIDE; slug único; autor profissional e usuário criador explícitos; estado DRAFT/SCHEDULED/PUBLISHED/ARCHIVED; datas, SEO, destaque, leitura, imagens/PDF e relações com integridade. Preview mantém somente hash, validade e revogação; seu fluxo pertence à F6.                                                                                                                   |
| Arquivos e contato | `media`, `contacts`, `contact_attachments`, `contact_files`, `contact_download_tickets`                            | Mídia editorial e arquivos públicos de contato usam modelos separados. Contato mantém ciência/versionamento, HMAC de IP, UUID único de idempotência e hash do payload. Arquivos de contato têm chave aleatória, driver, limite, estado de quarentena/verificação e expiração temporária; tickets persistem HMAC, ADMIN/sessão, validade e consumo. `contact_attachments` permanece por compatibilidade. |
| Newsletter         | `newsletter_subscribers`, `newsletter_tokens`                                                                      | E-mail normalizado único; PENDING/ACTIVE/UNSUBSCRIBED; prova de consentimento, instante de reenvio e versão. Tokens CONFIRM/UNSUBSCRIBE persistem somente HMAC, finalidade, expiração e uso; transações serializam por e-mail.                                                                                                                                                                          |
| Operação           | `redirects`, `outbox_tasks`, `audit_events`, `mail_webhook_events`                                                 | Caminhos internos; chaves únicas de idempotência, tentativas/lease/fencing e auditoria sanitizada. Payload de `mail.send` é criptografado; evento de webhook guarda somente ID/tipo/ID do e-mail/instante e deduplica pela chave primária.                                                                                                                                                              |

O banco reforça normalização de e-mail, datas obrigatórias para publicação/agendamento, versões positivas, formatos básicos de JSON, evidência de estado da newsletter, privacidade de mídia e limites de tentativas. A API complementa esses checks com validação do conteúdo TipTap, URLs, propriedade, permissões e campos públicos. A tabela não substitui autorização no backend.

Exclusões são explícitas: usuário criador, profissional autor, mídia, categoria/tag/área em uso recebem `RESTRICT`. Exclusão de artigo remove somente seus joins/previews; exclusão de sessão remove seus refresh tokens; exclusão de usuário pode remover sessões/reset tokens, mas continua impedida se houver autoria ou mídia em uso. O ator do evento de auditoria fica nulo se a conta puder ser excluída, preservando o evento.

## Migrations e busca

`202610020001_f2_domain` cria enums, tabelas, índices de listagem, unicidade e relações. `202610020002_search_integrity` adiciona checks/triggers e Full Text Search PostgreSQL em português.

Artigos têm vetor com pesos A para título, B para resumo e C para conteúdo. Profissionais usam nome/cargo e bio; áreas usam nome/resumo/descrição. Triggers atualizam os vetores após edição, publicação ou mudança de atividade; rascunhos/agendados/arquivados e registros inativos ficam sem vetor. Índices GIN parciais abrangem somente conteúdo publicado/ativo.

Na F7, a busca global combina `status = 'PUBLISHED'`, `published_at <= now()` e autor ativo; áreas/profissionais exigem `is_active = true`. Usa parâmetros em `websearch_to_tsquery('portuguese', ...)`, ranking `ts_rank_cd` e desempate estável, aproveitando os vetores/GIN da F2. Lista e contagem usam leitura REPEATABLE READ. Contatos, assinantes, anexos privados e tokens não são indexados. O catálogo de sitemap público é paginado e exclui `isMock` em produção.

`202610030001_f6_media` acrescenta versão/driver à mídia. `202610040002_f7_relationship` adiciona `ContactScanStatus`, as três tabelas F7 e colunas/índices de idempotência e controle de versão. O upload persiste um arquivo temporário antes de gravar bytes; a transação de contato associa os arquivos e cria a notificação. Novo arquivo fica QUARANTINED no ambiente real e LOCAL_VERIFIED somente no mock local. VERIFIED depende do scanner autorizado; REJECTED bloqueia acesso.

Tickets expiram em 60 segundos e são consumidos sob bloqueio de linha, vinculados ao ADMIN e à mesma sessão. Excluir arquivo elimina seus tickets por cascade. O contato usa RESTRICT: a aplicação agenda a exclusão privada durável e remove seus vínculos explicitamente antes do contato. A compatibilidade dos anexos antigos continua protegida pelos triggers F2.

## Outbox e retenção de relacionamento

Contato, confirmação/descadastro e recuperação criam `mail.send` junto da alteração de domínio. AES-256-GCM com IV aleatório cifra destinatário/token/payload; a chave idempotente participa como dado autenticado. `MAIL_ENCRYPTION_KEY` privada de 32 bytes hex é obrigatória no adaptador real. Somente mock de desenvolvimento pode derivar uma chave de `PREVIEW_SECRET`; esse fallback não é configuração de produção. Trocar a chave sem migrar tarefas pendentes impede decriptá-las e exige planejamento operacional.

O worker reclama tarefas com `FOR UPDATE SKIP LOCKED`, lease de cinco minutos e fencing por instância/instante; conserva chave idempotente nas tentativas. Processa até 50 tarefas por ciclo, executado ao iniciar e a cada minuto. Entrega concluída substitui o payload por `{ redacted: true }`; tarefas `mail.send` concluídas/falhas saem após sete dias e eventos de webhook após 30 dias. Falhas usam código fixo sem destinatário/token. Em ambiente local, a captura em `MAIL_LOCAL_PATH` conserva o envelope criptografado, separado do banco e ignorado pelo Git. Capturas JSON/HTML próprias são limpas após sete dias, sem recursão; `pnpm mail:local` permite revisão explícita conforme [relationship.md](relationship.md).

Retenção executa lotes de até 100 com advisory lock compartilhado. `CONTACT_RETENTION_DAYS` (padrão 180) conta desde a criação do contato; `SUBSCRIBER_RETENTION_DAYS` (365) conta desde a última alteração de PENDING/UNSUBSCRIBED. ACTIVE é preservado enquanto inscrito. Temporários não vinculados vencem em uma hora. Exclusão registra `storage.delete-private` antes de remover metadados; bytes são apagados com retries. Tokens/tickets expirados e contadores de relacionamento antigos também são limpos. Aprovar prazos/textos e comprovar scanner, exclusão no storage real e backups na homologação antes de dados reais.

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

Todas as identidades e conteúdos aplicáveis carregam `isMock=true`. Desde a revisão local `0.10.1`, os textos de apresentação são originais, com profissionais e informações inventados por pedido do usuário, sem o rótulo “Fictícia” na interface. O catálogo está em `apps/api/prisma/development-content.ts`; isso não constitui aprovação de materiais reais para produção. E-mails usam `.test`, e nenhuma credencial profissional, número de telefone, destinatário ou anexo real foi acrescentado. IDs, slugs técnicos e relações foram preservados; os 20 artigos continuam com slugs `conteudo-ficticio-01` a `conteudo-ficticio-20`.

O seed normal continua idempotente e não sobrescreve edições. Para a revisão textual já existente no banco local, o comando abaixo atualiza exclusivamente os 75 registros mock conhecidos, em transação Serializable com a trava do CMS. Exige o mesmo ambiente de desenvolvimento do seed e banco em loopback; recusa conjunto incompleto ou registros sem `isMock`. Salva um snapshot ignorado em `.local/content-before-<timestamp>.json`, sem senhas/tokens, e verifica que mídias e campos não textuais permanecem iguais, exceto `version`/`updatedAt` usados no controle de edição. Este comando substitui deliberadamente os textos desses fixtures; não o executar sobre edições locais que devam ser preservadas.

```powershell
rtk proxy pnpm --filter @filaretti/api exec tsx prisma/refresh-development-content.ts
```

**Credenciais públicas exclusivamente locais:** `admin@filaretti.test`, `editor@filaretti.test` e `author@filaretti.test`; senha de teste `Local-F2-Ficticio!2026`. A senha é armazenada como Argon2id (64 MiB, 3 iterações, paralelismo 1), com o mesmo helper de autenticação. Não reutilizar essas identidades/senha em homologação pública ou produção. Se o seed encontrar uma identidade correspondente sem `isMock`, falha em vez de sobrescrevê-la.

## Seed estrutural e primeiro ADMIN

`seed-production.ts` exige APP_ENV/NODE_ENV de produção e MOCK_CONTENT=false. Cria apenas a estrutura vazia de `site_settings`, se ausente: sem usuários, senhas padrão, profissionais, conteúdo, contatos, assinantes ou destinos de comunicação. Repetição preserva dados existentes. Não limpa mocks: a inspeção e carga de material aprovado continuam gates da F9/F10.

`db:provision-admin` executa `prisma/provision-admin.ts`. Só funciona no ambiente de produção configurado, recebe `PROVISION_ADMIN_EMAIL` e `PROVISION_ADMIN_NAME` no ambiente seguro do processo e recebe a senha **exclusivamente por stdin**, fornecida pelo canal protegido de operação/gerenciador de senhas. Não passar senha como argumento de CLI, gravar em script versionado ou escrever um comando que a exponha no histórico.

A senha deve ter 16–128 caracteres e não pode ser a fixture local; não há valor padrão ou exibição da senha. O script normaliza o e-mail, recusa domínios `.test`, usa Argon2id, bloqueia provisionamentos simultâneos com advisory lock transacional e recusa execução se já houver ADMIN ativo. Criação e evento de auditoria são atômicos; não altera senha/conta existentes. Mensagens de falha são sanitizadas. Usuários posteriores são geridos pela API autenticada de ADMIN.

Nenhum provisionamento de produção é autorizado pela simples criação do script. O operador deve escolher o banco isolado correto e fornecer o segredo pelo canal seguro na etapa de produção autorizada.

## Evidências e fases futuras

`database.integration.test.ts` verifica no PostgreSQL real contagens/grafo das fixtures, unicidade/FKs, exclusões em uso, stemming em português, atualização/retirada de vetores, presença dos três índices GIN e privacidade das referências de mídia. O runner também verifica migrations em bancos novos e seeds repetidos/guards, preservando o banco de desenvolvimento. Resultados efetivamente executados constam em `../relate.md`.

Testes F7 adicionais exercitam persistência/idempotência do contato, anexos/quarentena/tickets, confirmação/descadastro, retenção, CSV, busca/sitemap, envelopes criptografados e concorrência/retry do worker em PostgreSQL isolado. O registro do run integrado decide o aceite; código de teste existente não substitui sua execução. F8 trata fornecedores/scanner reais, backup/restauração e privilégios de produção; F10 aplica migrations compatíveis antes da API e carrega apenas o lote aprovado.
