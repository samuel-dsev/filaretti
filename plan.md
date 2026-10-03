# Filaretti Advocacia — planejamento técnico da V1

## 1. Situação atual e ponto de retomada

| Campo                            | Situação                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Última atualização               | 03/10/2026 — F5 concluída com PostgreSQL/API reais e revisão no Edge                                    |
| Último relatório                 | `RP-006`, em `relate.md`                                                                                |
| Última entrega técnica concluída | **F5 — Portal editorial e leitura de conteúdos; aceite local aprovado**                                 |
| Versão de referência             | `0.5.0`, registrada na raiz e nos sete workspaces privados                                              |
| Etapa em execução                | Nenhuma; F5 concluída                                                                                   |
| Próxima etapa                    | **F6 — CMS, mídia e publicação ponta a ponta**                                                          |
| Autorização da próxima etapa     | **Aguardando confirmação do usuário para F6**                                                           |
| Git                              | `dev`, remoto `origin`; base F4 real `e96b124`; commit local F5 previsto em RP-006; push não autorizado |
| Cwd verificado                   | `C:\Users\Samuel\Documents\Projetos\Filaretti`                                                          |

**Antes de cada implementação:** ler `AGENTS.md`, este arquivo inteiro e a situação atual de `relate.md`; verificar a pasta e o estado real do Git. Executar somente a etapa autorizada. Ao encerrar, atualizar este quadro, a tabela de etapas e o relatório, entregar os resultados e aguardar confirmação para avançar.

Os números de versão abaixo são marcos previstos. Correções intermediárias podem alterar a sequência efetiva; sempre registrar a versão real, sem renumerar o histórico. A conclusão técnica de uma etapa não autoriza automaticamente a seguinte.

## 2. Objetivo e limites

Construir, nesta pasta, um portal institucional e editorial para a Filaretti Advocacia, com CMS próprio. O fluxo principal será **conteúdo → área de atuação → profissional → contato**. A V1 deve permitir que a equipe mantenha o conteúdo sem editar código.

| Superfície     | Escopo da V1                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Institucional  | Home, escritório, áreas e detalhes, profissionais e perfis, FAQ, contato, privacidade e cookies                                                                          |
| Editorial      | Artigos, atualizações e guias; detalhes, filtros, busca global, relacionados, sumário, compartilhamento e downloads públicos aprovados                                   |
| Relacionamento | Link de WhatsApp, contato com anexos privados, newsletter com confirmação e descadastro                                                                                  |
| Administração  | Login, dashboard, artigos, categorias, tags, áreas, profissionais, FAQ, páginas institucionais, mídia, contatos, assinantes, usuários, redirecionamentos e configurações |
| Operação       | SEO, analytics por consentimento, segurança, acessibilidade, testes, CI, homologação, migração, backup e publicação controlada                                           |

Ficam fora da V1: área do cliente, chat, CRM, campanhas e automação de marketing, multilíngue, assinatura eletrônica, integração processual, IA de pesquisa, recomendações automáticas, histórico completo de revisões de artigos e auditoria avançada. Registro básico de ações críticas e eventos de segurança permanece na V1.

Desenvolvimento e homologação usam conteúdo explicitamente fictício e imagens substituíveis. Mesmo nomes citados no plano mestre não representam autorização para publicar biografias, contatos ou credenciais profissionais. Produção exige conteúdo real aprovado e verificação de ausência de mocks.

## 3. Arquitetura e decisões de implementação

- **Monorepo:** pnpm workspaces + Turborepo; `apps/web` com Next.js App Router, React, TypeScript e Tailwind; `apps/api` com NestJS, TypeScript, PostgreSQL e Prisma. A própria raiz atual será o monorepo, sem outra pasta de projeto dentro dela.
- **Pacotes compartilhados:** `packages/ui`, `packages/types`, `packages/config`, `packages/eslint-config` e `packages/tsconfig`. Contratos públicos não exportam modelos Prisma, segredos ou campos internos para o navegador.
- **Responsabilidade:** NestJS concentra persistência, validação, autorização e regras de negócio. Next.js renderiza o site e o admin; uma camada de encaminhamento na mesma origem atende o navegador e evita duplicar regras. Leituras públicas no servidor podem acessar a API diretamente.
- **API:** contratos REST sob `/api/v1`; Swagger em `/api/docs`, disponível no desenvolvimento e protegido/desativado em produção. Endpoints administrativos separados dos públicos; respostas públicas incluem somente registros publicados e campos permitidos.
- **Sessão administrativa:** Argon2id; access JWT de curta duração e refresh token rotativo, com hash persistido, expiração, revogação e detecção de reutilização. Cookies HttpOnly e Secure em produção, SameSite apropriado, proteção CSRF e validação de origem. Sem tokens em localStorage. Não haverá cadastro público de administradores.
- **Permissões:** ADMIN controla usuários, configurações e operações administrativas; EDITOR mantém conteúdo e aprova/publica; AUTHOR cria e edita seus próprios rascunhos. Autoria e propriedade são verificadas no backend; vínculo com o profissional exibido no site é explícito. Contatos e assinantes ficam restritos a ADMIN na V1.
- **Mídia:** interface de storage com adaptador local para desenvolvimento e Cloudflare R2 para ambiente real. Ativos editoriais públicos e documentos de contato privados ficam em buckets separados; anexos nunca recebem URL pública permanente.
- **Integrações:** Resend para mensagens transacionais; TipTap para conteúdo; Turnstile validado no backend; GA4 e Search Console; observabilidade com Sentry condicionada à configuração e ao tratamento de dados. Adaptadores simulados permitem desenvolvimento local sem contas externas.
- **Processamento:** cron/worker NestJS para publicações, envio de e-mails e tarefas de retenção, com trabalho persistido em PostgreSQL, retries limitados e idempotência. Redis não é dependência inicial; só entra se uma necessidade técnica demonstrada justificar.
- **Ambientes:** desenvolvimento, homologação e produção com dados, segredos e storage isolados. Homologação é protegida, não indexável e envia mensagens apenas a destinatários de teste. Hosting proposto: Vercel para web e Railway para API/worker/PostgreSQL, com Cloudflare; custos e compatibilidade serão confirmados antes da contratação.

Versões verificadas e fixadas na F1, com lockfile: Node 24.18.0 LTS, pnpm 11.25.0, Next.js 16.3.8, NestJS 12.1.2, Prisma 7.10.0 e PostgreSQL 17.11. A matriz e as decisões de compatibilidade ficam em `docs/architecture.md`; o relatório distingue instalação/configuração de validação real do banco.

### Modelo de dados mínimo, a detalhar na F2

| Grupo         | Entidades e regras                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade    | `users`, `refresh_tokens`, `password_reset_tokens`; e-mail único, roles, usuário ativo, revogação de sessões; separar usuário administrativo de profissional público                                          |
| Institucional | `professionals`, `practice_areas`, `professional_practice_areas`, `pages`, `faqs`, `site_settings`; páginas com seções estruturadas e validadas; FAQ global ou vinculada a uma área                           |
| Editorial     | `articles`, `categories`, `tags`, `article_categories`, `article_tags`, `article_practice_areas`; autor profissional, usuário criador, tipo ARTICLE/UPDATE/GUIDE, slug único, destaque, imagem e PDF opcional |
| Publicação    | Estados DRAFT/SCHEDULED/PUBLISHED/ARCHIVED; datas em UTC, edição exibida em America/Sao_Paulo; tokens de preview com hash e expiração; controle de edição concorrente por versão ou `updated_at`              |
| Arquivos      | `media`, `contacts`, `contact_attachments`; proprietário, visibilidade, MIME, tamanho, chave de storage, alt, licença/origem quando aplicável e vínculo de uso                                                |
| Newsletter    | `newsletter_subscribers` e tokens de confirmação/descadastro; e-mail normalizado único, estados PENDING/ACTIVE/UNSUBSCRIBED, prova de consentimento e versão do texto aceito                                  |
| Operação      | `redirects`, outbox de tarefas/notificações e eventos básicos de ações críticas; índice de busca textual, índices de listagem e restrições de integridade                                                     |

Usar migrations versionadas, relações e políticas de exclusão explícitas. Autor ou mídia em uso não pode ser removido silenciosamente. A modelagem de tokens/outbox pode usar tabelas dedicadas, documentadas em `docs/database.md`; isso não introduz um sistema genérico de workflows.

## 4. Grandes atualizações e ordem cronológica

| Etapa | Versão prevista | Entrega principal                             | Dependência                  | Estado                 |
| ----- | --------------- | --------------------------------------------- | ---------------------------- | ---------------------- |
| F0    | 0.0.0           | Planejamento e regras de continuidade         | Plano mestre                 | **Concluída — RP-000** |
| F1    | 0.1.0           | Fundação, arquitetura e ambiente reproduzível | Autorizada em 02/10/2026     | **Concluída — RP-002** |
| F2    | 0.2.0           | Banco, autenticação e API de domínio          | F1; autorizada pelo usuário  | **Concluída — RP-003** |
| F3    | 0.3.0           | Design System e estrutura de interfaces       | F2; autorizada em 03/10/2026 | **Concluída — RP-004** |
| F4    | 0.4.0           | Site institucional conectado à API            | F3; autorizada em 03/10/2026 | **Concluída — RP-005** |
| F5    | 0.5.0           | Portal editorial e leitura de conteúdos       | F4; autorizada em 03/10/2026 | **Concluída — RP-006** |
| F6    | 0.6.0           | CMS, mídia e publicação ponta a ponta         | F5                           | Pendente               |
| F7    | 0.7.0           | Contato, newsletter, busca, SEO e privacidade | F6                           | Pendente               |
| F8    | 0.8.0           | Validação integrada e homologação             | F7                           | Pendente               |
| F9    | 0.9.0           | Migração e preparação da release              | F8 + materiais aprovados     | Pendente               |
| F10   | 1.0.0           | Publicação e validação operacional da V1      | F9 + autorização de produção | Pendente               |

Cada etapa termina com validação, documentação, commit local quando o Git estiver preparado, relatório e pausa. Os subpassos pertencem à mesma atualização; não autorizam executar a etapa seguinte. Segurança, testes e acessibilidade começam na fundação e acompanham todas as entregas.

### F1 — Fundação técnica e ambiente local

1. Confirmar o baseline Git preparado pelo usuário e a branch de desenvolvimento efetiva; preservar arquivos e alterações existentes. Não inicializar Git nem criar remoto/branch em seu lugar.
2. Escrever `README.md` e `docs/architecture.md`, `database.md`, `api.md`, `design-system.md`, `seo.md`, `security.md` e `deployment.md` com decisões iniciais, contratos previstos e pendências explícitas. Refinar esses documentos na etapa responsável, sem inventar implementação existente.
3. Criar os apps e pacotes, TypeScript estrito, ESLint, Prettier, Husky/lint-staged quando houver Git, lockfile e scripts de dev, lint, typecheck, teste e build. Registrar a estratégia de versão única do projeto.
4. Configurar Docker Compose para PostgreSQL com healthcheck e volume persistente, exemplos de ambiente por app, validação de configuração e `.gitignore`. Incluir URLs interna/pública, cookies, JWT/refresh, storage, R2/buckets, Resend/webhook, Turnstile/site key, preview/revalidação, flags de mock e integrações; valores reais ficam fora do Git.
5. Criar `/health` básico com verificação de conectividade ao banco, tratamento global de erros, logging sanitizado e pipeline CI de lint → typecheck → testes → build. As migrations de domínio entram na F2. CI não publica automaticamente.

**Aceite:** após configurar o ambiente local conforme o README, `pnpm install --frozen-lockfile`, `docker compose up -d` e `pnpm dev` iniciam web, API e banco; build/lint/typecheck passam; health indica corretamente conexão disponível/indisponível. Registrar pré-requisitos e versões verificadas. Nenhuma conta externa é obrigatória para iniciar.

### F2 — Banco, autenticação e API de domínio

1. Implementar schema Prisma, migrations e os contratos da seção 3; índices, slugs e relacionamentos; preparar busca PostgreSQL em português e alterações via SQL de migration quando necessário.
2. Criar `seed-development.ts`, idempotente e bloqueado fora de desenvolvimento: 3 usuários de roles diferentes, 4 profissionais, 5 áreas, 20 conteúdos distribuídos entre os tipos, 6 categorias, 20 tags, FAQ, páginas, contatos e assinantes falsos. Registrar `isMock` nos conteúdos/ativos aplicáveis e usar credenciais locais explicitamente de teste. `seed-production.ts` conterá somente configuração estrutural, sem conteúdo fictício nem senhas padrão.
3. Implementar login, refresh, logout e me, autorização por role/propriedade, proteção CSRF/origem, limite de tentativas, criação/desativação de usuário por ADMIN, troca de senha e serviço de recuperação com tokens expirantes de uso único. O envio real de recuperação será integrado na F7. Primeiro ADMIN de produção terá provisionamento seguro e documentado.
4. Criar módulos/endpoints de artigos, taxonomias, profissionais, áreas, páginas, FAQ, configurações e redirects. Preparar interfaces de mídia, contatos, newsletter e tarefas; seus fluxos completos serão concluídos nas F6/F7.
5. Padronizar DTOs, validação de entrada e saída, erro com código estável, paginação `{ data, meta: { page, limit, total, pages } }`, ordenação e limites. Padrão `page=1&limit=12`, máximo documentado. Filtros editoriais por área, categoria, autor, tag, tipo e ano. Definir o schema permitido de conteúdo TipTap antes de aceitar conteúdo editorial pela API.

**Aceite:** migrations executam em banco novo; seeds não duplicam registros; testes com PostgreSQL real comprovam relações e consultas. Login/refresh/revogação funcionam; AUTHOR não altera conteúdo alheio; visitante não acessa dados pessoais, rascunhos ou rotas administrativas. Swagger e contratos refletem o comportamento real.

### F3 — Design System e estrutura de interfaces

1. Definir tokens de cor, tipografia, espaçamento, breakpoints e containers. Partir da paleta azul `#102A43`, `#1D4E89`, `#2563A6`, `#DCEAF7`, off-white `#F7F8FA`, branco, cinza `#404852` e preto `#161A1D`; validar contraste. Cormorant Garamond + Inter são o ponto de partida, carregadas por `next/font`.
2. Criar componentes reutilizáveis de formulários, botões/links, cards, badges, avatar, modal/drawer, accordion, paginação, skeleton e toast. Sem duplicar componentes equivalentes.
3. Criar layout público e administrativo, header, mega menu, menu mobile, footer, hero, breadcrumb, cards editoriais/áreas/profissionais e estrutura do overlay de busca. Implementar teclado, foco, semântica, reduced motion e estados de erro/vazio/carregamento desde aqui.
4. Aplicar linguagem institucional/editorial, títulos grandes, espaços amplos e imagens substituíveis. Usar a referência Silveiro como princípio visual, com identidade própria. Microinterações discretas; Framer Motion somente quando necessário.

**Aceite:** componentes apresentados numa rota de demonstração apenas local; navegação e formulários utilizáveis por teclado; contraste validado; layouts revisados em 375, 768, 1024, 1440 e 1920 px; web sem dependências de módulos exclusivos do backend.

### F4 — Site institucional conectado à API

1. Implementar `/`, `/o-escritorio`, `/areas-de-atuacao`, `/areas-de-atuacao/[slug]`, `/profissionais` e `/profissionais/[slug]` sobre contratos reais e dados fictícios do banco.
2. Home reúne apresentação, destaques, áreas, escritório, conteúdos recentes, profissionais, guias e chamadas de contato/newsletter. Inicialmente, formulário de newsletter aponta para a funcionalidade pendente da F7, sem simular inscrição concluída.
3. Área detalhada reúne descrição, serviços, profissionais e conteúdos relacionados. Perfil reúne foto, bio, formação, experiência, áreas e publicações. Textos institucionais, contatos e referências de imagens vêm de páginas/configurações/API.
4. Aplicar renderização no servidor, títulos/metadata básicos, canonical previsto e imagens otimizadas. Criar 404, erro de API, estados vazios e loading coerentes; preparar o contrato de invalidação de cache.

**Aceite:** rotas e relacionamentos funcionam com a API; slug inexistente devolve 404; dados podem ser alterados no banco/API e refletidos sem mudar componentes; revisão responsiva concluída. Botões e ações ainda pendentes são identificados, sem resultados falsos.

### F5 — Portal editorial e leitura de conteúdos

1. Implementar `/conteudos` e `/conteudos/[slug]` para artigos, atualizações e guias, com paginação e filtros refletidos na URL. Usar links públicos para PDFs de guias aprovados; não confundir esses arquivos com anexos privados de contato.
2. Criar página de leitura com categoria, título, resumo, autor, datas, tempo de leitura, imagem, conteúdo, sumário por H2, compartilhamento, perfil do autor, área e conteúdos relacionados.
3. Consumir o schema TipTap definido na F2 e criar renderizador seguro e sanitização no servidor de HTML/URLs derivados; bloquear scripts, embeds e protocolos perigosos. O renderizador será reutilizado pelo preview na F6.
4. Aplicar política explícita de cache público e revalidação compatível com o Next.js fixado na F1. Admin e preview ficam fora do cache público; retirada de publicação deve remover o conteúdo da leitura e dos resultados públicos dentro de prazo documentado/testado.

**Aceite:** filtros combinados e paginação são corretos; links compartilhados reabrem o mesmo resultado; rascunhos/agendados não aparecem; imagens e sumário funcionam; payloads XSS são rejeitados/sanitizados; páginas tratam API indisponível sem expor dados internos.

### F6 — CMS, mídia e publicação ponta a ponta

1. Construir `/admin/login`, dashboard e telas de usuários, artigos, categorias, tags, áreas, profissionais, páginas institucionais, FAQ, mídia, configurações e redirects. Listagens de contatos/assinantes entram completas na F7. Interface respeita roles, com autorização novamente no backend.
2. Integrar TipTap e campos editoriais/SEO, slug, autor, tipo, relacionamentos, destaque, imagem e PDF; ações de salvar, publicar, agendar, retirar de publicação e arquivar. Detectar conflito de edição para evitar sobrescrita silenciosa.
3. Implementar `/preview/[token]` com token expirante e revogável, noindex, no-store e conteúdo acessível somente após validação. Não incluir token em logs ou analytics. Restringir emissor às permissões do artigo.
4. Concluir storage local/R2 e biblioteca: validação real de extensão/MIME/tamanho, nomes e chaves aleatórios, alt, busca, URL pública somente de ativo editorial e exclusão com análise de referências. Limites iniciais: imagem 5 MB, PDF 10 MB; aceitar JPG/JPEG, PNG, WebP, AVIF e PDF, sem SVG/HTML executável.
5. Implementar publicação agendada a cada minuto, datas UTC, transação e trava no PostgreSQL para impedir duplicação entre instâncias. Recuperar tarefas vencidas após reinício e persistir invalidação de cache com retry. Validar destinos de redirects para evitar loops e redirecionamento externo arbitrário; alterações de slug preservam URL anterior.

**Aceite:** login → criar artigo → upload → preview → publicar → visualizar no site funciona ponta a ponta; AUTHOR não publica; publicação/retirada atualiza páginas relacionadas; agendamento funciona após reinício e execução concorrente; exclusão de mídia em uso é impedida. R2 real será validado na homologação se credenciais ainda não estiverem disponíveis.

### F7 — Relacionamento, busca, SEO e privacidade

1. Criar `/contato`: nome, e-mail, telefone/estado/área opcionais conforme decisão do escritório, assunto, mensagem, anexos e ciência do aviso de privacidade. Consentimento de newsletter é separado. Persistir o contato antes da notificação; falha de e-mail não pode apagar a solicitação nem gerar duplicações.
2. Implementar fluxo público de anexos com Turnstile, quotas, limite total/quantidade documentado e vínculo à solicitação; validar arquivos como na F6, mantendo-os privados. Downloads somente por ADMIN autenticado via URLs de curta duração; limpar temporários órfãos. Definir scanner/quarentena para documentos de contato na homologação; não liberar arquivos não verificados.
3. Implementar Resend para contato, confirmação, recuperação de senha e descadastro. Outbox persistente e retries; webhooks com assinatura verificada sobre corpo bruto e deduplicação de eventos. Newsletter: inscrição PENDING → confirmação com token de uso único → ACTIVE; descadastro funcional, reenvio limitado e respostas que não enumeram e-mails. Lista no admin e exportação CSV por ADMIN com proteção contra fórmulas.
4. Validar Turnstile no backend, incluindo hostname/action esperados; falhar de forma controlada se indisponível. Rate limits em login, contato, newsletter e uploads, com proteção compartilhada entre instâncias. Modo simulado é explícito, permitido só localmente e bloqueado em produção.
5. Concluir `/busca?q=...`, overlay, Full Text Search PostgreSQL em português, ranking, paginação e filtros; pesquisar conteúdo publicado, áreas e profissionais ativos. Criar `/perguntas-frequentes` e FAQ por área.
6. Concluir metadata, canonical, Open Graph, Twitter/X Cards, sitemap, robots, breadcrumbs e Schema.org aplicável (LegalService, Article, Person, BreadcrumbList e FAQPage quando adequado), sem dados inventados nem promessa de resultado em buscadores. Busca interna/filtros e preview têm política de indexação explícita; staging/admin/preview não são indexáveis. robots não substitui autenticação.
7. Criar páginas de privacidade/cookies e preferências necessárias/analytics; GA4 inicia apenas após aceite e para após revogação. Eventos: `click_whatsapp`, `submit_contact`, `newsletter_signup`, `article_share`, `download_guide` e `search`, sem conteúdo de mensagens, documentos, e-mails ou consultas potencialmente sensíveis. Search Console exige verificação do domínio no ambiente autorizado.
8. Implementar política configurável de retenção/exclusão de contatos, anexos e dados de inscrição; validar com o escritório antes de dados reais. Admin gerencia status de contatos, assinantes e dados oficiais sem código. Newsletter V1 coleta assinantes e envia mensagens transacionais; campanhas ficam fora do escopo.

**Aceite:** fluxos completos passam localmente com adaptadores explicitamente simulados; envio real, antispam e webhooks são comprovados em homologação na F8. Anexos não podem ser acessados publicamente; inscrição sem confirmação não ativa; descadastro e recuperação funcionam; busca exclui drafts; sitemap contém apenas URLs públicas publicadas; negar analytics impede carregamento e eventos.

**Marco funcional:** ao concluir F7, site, CMS, publicação, busca e relacionamento funcionam de ponta a ponta no ambiente de desenvolvimento. Isso ainda não representa aceite de produção.

### F8 — Validação integrada e homologação

1. Consolidar testes Jest no backend, Vitest/React Testing Library em comportamentos de interface relevantes e Playwright nos fluxos críticos; integração com PostgreSQL real, storage e worker. Validar falhas de fornecedores, expiração de sessão, permissões, XSS, CSRF, upload privado, rate limit, confirmação/descadastro e concorrência de agendamento.
2. Revisar CSP, HSTS no HTTPS, nosniff, Referrer-Policy, Permissions-Policy, CORS restrito, proxies confiáveis, secrets, permissões de storage e logs/Sentry sem dados sensíveis. Corrigir vulnerabilidades relevantes antes do avanço.
3. Inspecionar visualmente cada template nos cinco tamanhos da F3; teclado, leitor de tela nos fluxos principais, foco, labels, alt e hierarquia. Meta WCAG 2.2 AA nos fluxos principais; relatório identifica o que foi efetivamente verificado. Verificar Chrome, Edge, Firefox, Safari, Android Chrome e iOS Safari, registrando dispositivos disponíveis e lacunas.
4. Medir build de produção com condições reproduzíveis: metas Lighthouse Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90 e SEO ≥ 95 nos templates públicos. Otimizar imagens, fontes, cache e carregamento sem esconder falhas; Lighthouse não certifica sozinho acessibilidade ou métricas reais de usuários.
5. Preparar e, com autorização para o ambiente externo, publicar homologação protegida proposta em `staging.filarettiadvocacia.com.br`; isolar banco/buckets, validar Resend/Turnstile/R2 reais e worker contínuo. Pipeline gera artefato identificável e deploy depende de gate manual.
6. Configurar health/liveness/readiness, métricas/erros sanitizados, alerta de falha de tarefas e backup diário com retenção aprovada; testar restauração de banco e recuperação de arquivos. Não presumir versionamento nativo do R2: definir política de recuperação comprovada. Documentar rollback de web/API e estratégia compatível de migrations.

**Aceite:** CI passa, relatório de QA contém evidências e limitações; integrações reais e restauração são comprovadas; não há defeito impeditivo nos fluxos principais. Se contas/ambiente externo faltarem, concluir os trabalhos locais e registrar **homologação parcial**, sem declarar a F8 inteiramente concluída.

### F9 — Migração e preparação da release

1. Inventariar o site antigo: URLs, conteúdos, arquivos e metadata; mapear cada URL relevante para destino/301 ou retirada aprovada. Importador terá dry-run, idempotência, validação de slugs/relacionamentos e relatório de falhas; não sobrescrever o site antigo.
2. Receber textos, fotos, logo, equipe, áreas, FAQ, contatos e políticas aprovados. Preparar importação para o ambiente de produção isolado, sem transportar usuários, contatos ou assinantes falsos. Enquanto não houver autorização para carga real, validar o mecanismo com fixtures e preparar o lote revisável.
3. Registrar aprovação do escritório para conteúdo institucional, publicações, biografias, CTAs, privacidade/retenção e apresentação profissional. Essa revisão é do responsável do escritório; conclusão técnica não equivale a aprovação jurídica.
4. Implementar gate verificável contra mocks: flag de ambiente, busca de registros `isMock`, ativos/placeholders, contas de teste e conteúdo fictício em sitemap/páginas. `MOCK_CONTENT=false` sozinho não comprova limpeza. Preservar mocks apenas no desenvolvimento e homologação isolados.
5. Congelar o escopo da release; validar redirects sem loops, conteúdo/mídia aprovados, robots/canonical do domínio final, formulários e configurações. Preparar checklist de go-live, responsáveis, backup, janela de corte e rollback, com domínio/hosting/orçamento definidos.

**Aceite:** lote e mapeamento de migração revisados; nenhum mock no conjunto destinado à produção; aprovação dos materiais registrada; release candidata testada e plano de corte revisável. Materiais/aprovações ausentes são pendências externas explícitas; não preencher com dados inventados.

### F10 — Publicação e validação operacional da V1

**Gate:** autorização explícita para o ambiente de produção, carga de dados reais, contratação quando necessária e alterações de DNS. Preparar o resultado para revisão antes de solicitar a ação externa. Não publicar por consequência automática da aprovação de uma etapa anterior.

1. Confirmar aprovação e responsáveis; congelar alterações do site antigo e fazer backups verificados. Preparar e validar artefatos da versão `1.0.0` a partir de commit identificado antes do deploy. Provisionar/confirmar banco, storage, domínio de e-mail e segredos de produção isolados.
2. Aplicar migrations compatíveis **antes** da API que delas depende; executar carga estrutural e lote aprovado; provisionar o ADMIN sem senha padrão. Implantar API/worker, validar readiness e depois implantar web. Não executar seed de desenvolvimento.
3. Validar sob acesso controlado conteúdo, autenticação, R2 privado/público, e-mails, antispam, agendamento, redirects e rollback; somente então realizar o corte de DNS/tráfego autorizado, habilitar indexação pública e aplicar redirecionamentos do domínio final.
4. Enviar sitemap ao Search Console no ambiente autorizado; habilitar analytics condicionado ao consentimento e monitoramento. Executar smoke público: navegação, busca, artigo, contato, confirmação/descadastro, admin, uploads e publicação controlada de conteúdo aprovado.
5. Registrar versão `1.0.0`, commit/release e resultado dos smokes; entregar instruções de uso do CMS, manutenção, recuperação e pendências. Verificações posteriores de 404/500, entrega de e-mails, indexação e métricas reais terão responsável e janela definidos; qualquer automação recorrente depende de pedido específico.

**Aceite:** V1 pública no domínio aprovado, sem mocks, com fluxos e integrações reais comprovados, backup/recuperação/rollback documentados e responsável operacional definido. Se o smoke encontrar falha impeditiva, executar o rollback autorizado e não declarar a publicação concluída.

## 5. Qualidade, versionamento e encerramento de etapas

- Pronto significa comportamento correto, tipagem, erro/loading/vazio, responsividade e acessibilidade pertinentes, contratos documentados, lint/typecheck/build e testes relevantes aprovados. Testes simulados não comprovam integração real.
- Alterações de conteúdo/segurança/contratos precisam de validação no backend; migrations são adicionadas, não reescritas após aplicadas em ambiente compartilhado. Não executar reset ou exclusão de volumes/dados sem autorização específica.
- Versão no formato **MAJOR.MINOR.PATCH**: correção compatível incrementa PATCH; grande atualização funcional incrementa MINOR; quebra de compatibilidade após 1.0 incrementa MAJOR. Durante 0.x, quebras incrementam MINOR e são destacadas no relatório. `1.0.0` identifica a V1 aprovada para operação.
- Na F1, a versão passa a ser registrada no `package.json` raiz; apps/pacotes publicáveis, se existirem, seguem uma política documentada. Documentos e lockfile permanecem coerentes. Atualizar relatório/plan do mesmo marco não gera um bump separado.
- Após o primeiro commit feito pelo usuário, cada etapa autorizada inclui seu commit local explicativo, somente com arquivos da etapa e checks pertinentes aprovados. Usar Conventional Commits, por exemplo `feat(cms): implementa publicação editorial (v0.6.0)`, com corpo contendo motivo, mudança, validação e limitações. Sem `git add .` indiscriminado. Push, merge e deploy dependem de autorização própria.
- `relate.md` mantém a situação atual no topo e histórico por `RP-NNN`: escopo, versão, arquivos criados/alterados, decisões, validações executadas e resultado, limitações, Git/commit e próximo passo. Não apagar relatórios anteriores.
- Antes do commit, atualizar o checkpoint e o relatório com a versão e o assunto esperado. Depois, conferir o commit real e informar o SHA ao usuário; registrar esse SHA na próxima retomada, evitando um commit circular só para gravar o próprio hash.

## 6. Pendências externas e decisões a confirmar no momento adequado

| Pendência                                                                | Necessária até                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Primeiro commit, remoto e branch de desenvolvimento pelo usuário         | Resolvida: baseline `6c84b6a`, `origin` e `dev` confirmados na F1            |
| Refinamento visual e identidade definitiva                               | Validação da F3 / materiais finais na F9                                     |
| Limites do contato, destinatários, retenção e textos de privacidade      | Definição na F7 e aprovação até F8, antes de receber dados reais em produção |
| Contas e acessos R2, Resend, Turnstile, domínio/e-mail, Sentry e hosting | Integrações reais e homologação na F8                                        |
| Política de backup, recuperação de mídia e orçamento operacional         | F8, antes do corte de produção                                               |
| Inventário do site atual e materiais/aprovação do escritório             | F9                                                                           |
| GA4, Search Console e aprovação do corte/DNS                             | F10                                                                          |

Essas pendências não impedem o trabalho local independente; impedem declarar concluído o aceite que depende delas. Credenciais são configuradas por canal seguro/ambiente, nunca coladas nos relatórios.

## 7. Referências técnicas verificadas

Documentação consultada em 02/10/2026 para sustentar decisões do planejamento; rever a compatibilidade na F1 e antes de integrar fornecedores.

- [Next.js — cache](https://nextjs.org/docs/app/getting-started/caching): o modelo depende da versão e da configuração; definir cache e invalidação explicitamente, sem pressupor comportamento automático.
- [NestJS — task scheduling](https://docs.nestjs.com/techniques/task-scheduling): cron local deve ser complementado por persistência/idempotência e trava entre instâncias.
- [Cloudflare Turnstile — validação no servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): o widget sozinho não protege o envio; tokens expiram e são de uso único.
- [Cloudflare R2 — buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/): exposição pública é uma configuração de acesso; manter documentos de contato em bucket privado separado.
- [Resend — verificação de webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests): verificar assinatura com o corpo original e tratar eventos duplicados.
- [Versionamento Semântico](https://semver.org/lang/pt-BR/): referência do formato de versão; a convenção de marcos 0.x acima é a política de trabalho deste projeto.

## 8. Registro da última atualização

**03/10/2026 — RP-006 — F5 concluída:** autorização “Inicie a F5”; versão `0.5.0`. Listagem/leitura SSR editorial com filtros combinados e URLs paginadas, opções completas do catálogo público, renderer TipTap seguro reutilizável, sumário H2, compartilhamento/cópia acessível, autor/áreas/relacionados e PDF GUIDE público local. Links institucionais levam à leitura; endpoint de opções separado preserva slugs existentes. Política no-store/force-dynamic revalida por nova requisição, com 404/503 reais e retirada comprovada em cinco superfícies sem rebuild. Instalação frozen, lint, typecheck,37 testes básicos,30 integrações PostgreSQL, build e 44 contrastes passaram. Smoke Edge 154:38 checks,20 layouts em 375/768/1024/1440/1920,1932 amostras sólidas com contraste ≥ 4,5:1/zero ignoradas e zero falhas/console/overflow. Inventário 50 arquivos, banco/PNG/PDF/processos temporários removidos, preview local atualizado. Nenhuma biblioteca/schema/migration/seed alterado; sem ação externa. Commit local previsto em RP-006. **Ponto de parada: F5 entregue; aguardar autorização para F6.**
