# Banco de dados

Referência inicial: F1, 02/10/2026. As entidades abaixo são decisões para a F2; não representam tabelas já criadas.

## Banco local na F1

O Compose está configurado para PostgreSQL `17.11-alpine` em projeto isolado `filaretti-local`, com healthcheck e volume nomeado persistente. A imagem oficial e seu digest estão fixados no Compose e no CI. Somente `127.0.0.1:5434` publica a porta do banco no host; clientes em contêineres do mesmo projeto usariam o nome do serviço e a porta `5432`. São endereços distintos, conforme o [modelo de rede do Compose](https://docs.docker.com/compose/how-tos/networking/). A configuração não comprova que o serviço iniciou nesta máquina; consultar as evidências em `../relate.md`.

`DATABASE_URL` é configuração privada da API. O setup local gera credenciais aleatórias e não as imprime. O health executa `SELECT 1` com conexão e timeout limitados; isso verifica conectividade ao PostgreSQL real, sem criar dados de domínio. A validação de disponibilidade/indisponibilidade deve ser registrada em `../relate.md`.

Não existem migrations, seed, usuários administrativos ou conteúdo institucional na F1. Prisma foi selecionado para a F2; instalar ou fixar sua versão não comprova modelagem nem integração de domínio.

O volume persiste ao parar/recriar o serviço. Não executar reset de banco, `docker compose down --volumes`, exclusão de volumes ou substituição de dados para resolver falhas de setup. Primeiro diagnosticar serviço, porta e configuração local, preservando os dados.

## Modelo mínimo previsto para F2

| Grupo         | Entidades previstas                                                                                | Regras principais                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Identidade    | `users`, `refresh_tokens`, `password_reset_tokens`                                                 | E-mail normalizado único, usuário ativo, roles e tokens com hash/revogação                      |
| Institucional | `professionals`, `practice_areas`, `professional_practice_areas`, `pages`, `faqs`, `site_settings` | Usuário administrativo e profissional público são identidades distintas; FAQ global ou por área |
| Editorial     | `articles`, `categories`, `tags` e tabelas de relações                                             | Slug único, tipo ARTICLE/UPDATE/GUIDE, profissional autor e usuário criador explícitos          |
| Publicação    | Estado, datas, preview e controle de versão                                                        | DRAFT/SCHEDULED/PUBLISHED/ARCHIVED; datas UTC; preview expirante; edição concorrente detectável |
| Arquivos      | `media`, `contacts`, `contact_attachments`                                                         | Visibilidade, proprietário, MIME, tamanho, chave, alt, origem/licença e vínculos de uso         |
| Newsletter    | `newsletter_subscribers`, tokens de confirmação/descadastro                                        | E-mail único; PENDING/ACTIVE/UNSUBSCRIBED; consentimento e texto aceito registrados             |
| Operação      | `redirects`, tarefas/outbox e eventos básicos                                                      | Idempotência, retries, datas, falhas sanitizadas e integridade referencial                      |

IDs, nomes finais de colunas, ações de exclusão, limites e índices serão fixados junto com o schema e os contratos na F2. Relações muitos-para-muitos terão integridade no banco. Remoção de autor/mídia em uso não poderá apagar relações silenciosamente. Listagens públicas consultarão apenas registros publicados e campos permitidos.

Tokens de refresh, recuperação, confirmação, descadastro e preview não serão persistidos em texto claro. Suas finalidades, expiração, uso único quando aplicável e revogação serão verificadas na fase responsável. Horários ficam em UTC; a interface exibe America/Sao_Paulo.

## Migrations e seeds futuros

Migrations serão versionadas, revisadas e executadas primeiro em banco local novo. Alterações SQL necessárias para Full Text Search em português e índices serão incorporadas em migrations revisáveis. Migrations já aplicadas em ambiente compartilhado não serão reescritas. A documentação oficial explica o [histórico e a ordem das migrations Prisma](https://www.prisma.io/docs/orm/migrations/the-migration-graph).

Na F2, seed de desenvolvimento será idempotente, bloqueado fora de desenvolvimento e conterá apenas identidades e conteúdo fictícios marcados como mocks quando aplicável. Seed de produção será estrutural, sem contas/senhas padrão, contatos ou assinantes falsos. A limpeza para produção exigirá inspeção de registros e ativos na F9, além da flag de ambiente.

## Verificação por fase

| Fase  | Evidência necessária                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------- |
| F1    | Health com PostgreSQL real disponível e indisponível; persistência e isolamento local                 |
| F2    | Migrations em banco novo, seeds repetidos sem duplicação, relações/consultas/permissões em banco real |
| F6–F7 | Concorrência/idempotência de tarefas, privacidade de anexos, confirmação e descadastro                |
| F8    | Backup e restauração comprovados; política de recuperação de banco e arquivos                         |
| F10   | Migrations compatíveis antes da API e carga somente do lote aprovado                                  |

Mocks de consulta não substituem essas evidências. Backup/restauração, retenção, usuário de produção com privilégio mínimo e capacidade operacional permanecem decisões das fases futuras.
