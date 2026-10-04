# Segurança e tratamento de dados

Atualização F6: o [CMS](cms.md) integra a sessão, roles/propriedade, preview expirante/revogável, validação real de upload, storage local/R2 e agendamento/outbox. O adapter R2 existe, com validação externa pendente na F8. Admin/preview usam no-store/noindex/no-referrer; o encaminhamento aceita apenas auth/admin, preserva Origin/CSRF e mantém cookies HttpOnly. As menções a fluxos futuros nas seções históricas F2–F5 referem-se à entrega daquela fase.

Referência: F2, 03/10/2026. Os controles descritos são implementados na API local; evidências e limitações do aceite ficam em `relate.md`. Fornecedores, homologação e produção permanecem nas fases próprias.

## Fundação e segredos

- Configuração validada antes do bootstrap; diagnósticos mostram somente nomes de campos, sem seus valores. Exemplos usam placeholders, ambientes reais são ignorados pelo Git e o setup local não sobrescreve ambientes existentes.
- Compose mantém banco/volume isolados; portas locais em loopback. API e health não devolvem credenciais, strings de conexão, SQL ou stack.
- API gera seu próprio UUID de correlação. Logging registra evento, status e correlação; não registra corpos, cookies, Authorization, query strings sensíveis ou tokens. Eventos básicos persistidos contêm ação, IDs internos e metadados sanitizados.
- Swagger existe somente quando `APP_ENV` e `NODE_ENV` são `development`. Todas as respostas locais usam `Cache-Control: no-store`; drafts e dados pessoais não podem chegar à leitura pública.
- Produção rejeita mocks, exige HTTPS e `COOKIE_SECURE=true`. Seeds fictícios são bloqueados fora de desenvolvimento. `MOCK_CONTENT=false` não substitui inspeção dos registros/ativos antes da publicação.
- R2, Resend e Turnstile permanecem desabilitados; storage local completo e fornecedores reais pertencem às F6–F8. Nenhum envio externo é iniciado na F2.

`DATABASE_URL`, JWT/refresh, preview/revalidação e chaves de fornecedores permanecem privados. Somente contratos explicitamente permitidos entram em `packages/types`; modelos Prisma, hashes, IPs e flags internas não são exportados ao navegador.

## Autenticação e sessões implementadas na F2

Senhas têm 12–128 caracteres na criação/troca/recuperação, com Argon2id (64 MiB, três iterações, paralelismo 1). Login aceita senha existente com limite de 128 caracteres e normaliza e-mail. Conta inexistente ou inativa recebe a mesma resposta de credenciais inválidas; verificação de hash fictício evita pular o custo de senha para e-mail inexistente.

Access JWT usa HS256, issuer `filaretti-api`, audience `filaretti-admin` e duração configurada de 60–900 segundos. Contém somente IDs de usuário/sessão e tipo do token. Cada requisição autenticada consulta sessão/usuário no PostgreSQL, valida expiração/revogação e usa a role atual do usuário. Assim, desativação, logout, troca/recuperação de senha e reuse invalidam acesso mesmo antes de o JWT expirar.

Refresh tokens têm 256 bits aleatórios e somente HMAC-SHA256 é persistido, com segredo separado do JWT. `Session.id` identifica a família: refresh bloqueia a linha da sessão na transação, marca token consumido e cria sucessor. Reutilizar um token consumido revoga a sessão e toda a família; pedidos simultâneos com o mesmo token produzem uma rotação e detecção de reuse. O vencimento da família é absoluto, conforme `REFRESH_TOKEN_TTL_SECONDS` (padrão sete dias), sem extensão ilimitada a cada rotação.

Credenciais de sessão chegam exclusivamente nos cookies `filaretti_access` e `filaretti_refresh`, HttpOnly, `Path=/api/v1`, SameSite configurado (`lax` ou `strict`) e Secure em produção. Não há tokens de acesso/refresh em JSON ou localStorage. Logout limpa os três cookies e revoga a família. Uma sessão sem access válido pode executar refresh antes do logout; o endpoint de logout exige sessão válida.

## CSRF e origem

O navegador obtém `GET /api/v1/auth/csrf` antes do login. A resposta contém `csrfToken` e um cookie HttpOnly `filaretti_csrf`; o cliente guarda esse valor em memória para enviar `X-CSRF-Token`. O token pré-login é aleatório, tem assinatura HMAC e vence em uma hora; a assinatura impede criar um par arbitrário de cookie/header.

Login, pedido de recuperação e consumo de recuperação exigem token pré-login assinado, cookie/header iguais e `Origin` exatamente igual à origem de `WEB_PUBLIC_URL`. Login retorna um novo `csrfToken` ligado pelo hash à sessão. Refresh e todas as mutações autenticadas exigem esse token de sessão, cookie correspondente e origem permitida. A guarda compartilhada aplica isso às rotas administrativas do domínio. `Sec-Fetch-Site: cross-site` também é rejeitado. Ausência de Origin nas mutações é rejeitada.

`GET /auth/csrf` restaura o token existente de uma família válida a partir do cookie HttpOnly, inclusive após o access expirar. A chamada não cria sessão nem entrega credenciais de autenticação. Após login, usar o novo token retornado; após logout/troca/reset, iniciar novamente o fluxo pré-login. Na F3/F6 a interface integrará esse contrato; ainda não há tela administrativa na F2. A camada de mesma origem prevista para Next precisa preservar cookies, Origin e header CSRF até a API, sem aceitar headers de origem forjados por clientes externos.

## Limites, usuários e recuperação

Tentativas de login são contadas em PostgreSQL, com bloqueio de linha compartilhado entre processos: cinco por e-mail e vinte por IP em quinze minutos. A próxima tentativa bloqueia a chave por quinze minutos e responde 429. Todas as tentativas, inclusive as bem-sucedidas, contam na janela. E-mail/IP ficam como HMAC no identificador da chave; não são copiados em logs. Recuperação usa buckets separados com os mesmos limites; consumo de reset limita vinte por IP. Proxy confiável será configurado na F8; a F2 usa endereço de conexão e ignora `X-Forwarded-For` para decisão de limite.

Somente ADMIN lista/cria/desativa usuários; não há cadastro público. Criação não aceita flags internas nem hash fornecido pelo cliente. Listagem usa a allowlist de usuário e paginação 1/12, máximo 50. Desativação revoga sessões, refresh e recuperação. O administrador não pode desativar a própria conta; transações de desativação usam trava compartilhada, revalidam o ator ativo e protegem o último ADMIN. Troca de senha verifica senha atual, impede sobrescrita concorrente pela comparação do hash anterior e revoga todas as sessões/tokens de recuperação.

Recuperação gera token aleatório de 256 bits, persiste apenas HMAC, vence em trinta minutos e invalida tokens anteriores. Reset bloqueia o usuário na transação, permite consumo único, altera senha e revoga todas as sessões/tokens. Requisição HTTP responde 202 com o mesmo corpo para e-mail existente/inexistente, sem retornar token. O adaptador `DeferredRecoveryDelivery` não envia mensagens nem imprime tokens; F7 implementará a entrega segura com Resend/outbox. O serviço aceita adaptador de entrega injetado, usado somente com captura em memória nos testes locais. A F2 não permite concluir recuperação pela interface sem integrar a entrega da F7.

Seed de produção contém somente configuração estrutural. Provisionamento do primeiro ADMIN é ferramenta local separada, sem senha padrão, com segredo lido de entrada segura e hash Argon2id; procedimento/gates em `docs/database.md`. A implementação da ferramenta não autoriza executá-la em produção.

## Autorização e dados públicos

ADMIN controla usuários/configurações; EDITOR mantém e publica conteúdo; AUTHOR cria/edita somente seus rascunhos. A API decide roles/propriedade usando usuário da sessão, e o profissional público é separado da identidade administrativa. Visitantes acessam somente registros publicados/ativos e campos explicitamente permitidos. Contatos, assinantes, drafts, tokens, anexos privados e IDs internos desnecessários não pertencem às respostas públicas.

DTOs recusam campos não previstos. Conteúdo TipTap e seções de página têm schema permitido e limites; os detalhes ficam em `docs/api.md`. Sanitização/renderização completa, upload e preview pertencem às F5/F6. Preparar entidades/interfaces não representa fluxos completos de mídia, contato, newsletter ou worker.

## Demonstração visual local da F3

`/dev/design-system` e seu layout administrativo são exemplos fictícios, sem sessão, dados reais ou chamadas administrativas. Exigem APP_ENV=development, Host loopback e bind local; Proxy Next rejeita fora dessas condições com HTTP 404/no-store/noindex antes da renderização. O layout servidor repete a guarda e não produz cache estático. A checagem de Host complementa o isolamento local, sem substituir autenticação ou autorização da API.

Nenhum campo de exemplo é enviado ou persistido. Cookies/tokens continuam exclusivos dos contratos da F2; o layout administrativo não declara login concluído. Testes da allowlist e smokes do bundle otimizado validam ambientes e hosts negativos; detalhes em docs/design-system.md e RP-004.

## Leituras institucionais da F4

O cliente público Next é `server-only`, usa exclusivamente DTOs projetados, omite credenciais e mantém `API_INTERNAL_URL` no servidor. Timeout, resposta inválida e erro de transporte produzem mensagens fixas, sem corpo/causa do backend. O Proxy consulta apenas recursos públicos mapeados e não encaminha cookies, headers de autenticação ou regras administrativas. Retirada/inatividade continua decidida pelo Nest e produz 404 no site; falha da API produz 503.

Textos institucionais TipTap recebem renderer JSX escapado e política de URLs permitidas, sem HTML bruto. Imagens ficam restritas a raster público local `/media/public/**`; fontes remotas, SVG, query e paths privados são excluídos. Upload/storage e renderização dos fluxos editoriais completos continuam F5/F6. As páginas não criam sessão nem executam inscrição, envio de contato ou busca. Detalhes, reprodução e limites: [public-site.md](public-site.md).

## Controles futuros e gates

| Fase   | Controles pendentes                                                                                               |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| F6     | Preview expirante privado, uploads validados e visibilidade explícita                                             |
| F6–F7  | Outbox/retries/idempotência completos, assinatura/deduplicação de webhooks e revalidação                          |
| F7     | Entrega de recuperação, Turnstile server-side, anexos privados, confirmação/descadastro, retenção e consentimento |
| F8     | CSP, HSTS, Permissions Policy, CORS/proxy confiável, fornecedores reais, quarentena e backup/restauração          |
| F9–F10 | Materiais e retenção aprovados, inspeção de mocks, segredos e ADMIN de produção, corte/deploy autorizado          |

Ativos editoriais públicos e anexos de contato privados terão storage separado. Upload validará conteúdo/MIME/tamanho/extensão; SVG/HTML executável não será aceito. Download privado exigirá autorização e URL curta. Turnstile será verificado conforme [documentação oficial](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/); webhooks conforme [orientação do Resend](https://resend.com/docs/webhooks/verify-webhooks-requests).

## Leituras editoriais da F5

O detalhe editorial recebe renderer JSX escapado, árvore limitada/permitida e nova checagem de URLs. Scripts/embeds/HTML bruto não são inseridos; marcas inseguras perdem o link e conservam o texto. Mídia vinculada a contato é excluída da projeção pública mesmo se a visibilidade armazenada estiver inconsistente. Download de guia exige PDF público local de até 10 MiB; validação de bytes/upload/storage segue F6. Sem cache persistente, retirada de publicação vale na primeira nova consulta após a transação. Facets não enumeram rascunhos nem relações inativas. Reprodução e limites: [editorial.md](editorial.md).

Homologação, contratação, dados reais, deploy, DNS e produção exigem autorização aplicável. Antes da publicação: integrações reais, ausência de mocks, aprovação de materiais, backup/restauração e rollback comprovados. O aceite da F2 é local, com PostgreSQL real e sem certificar operação de produção.
