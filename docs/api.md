# API e contratos

Referência: F2, 03/10/2026. As rotas abaixo existem na API NestJS; interface administrativa e páginas conectadas entram nas fases seguintes. A validação integrada usa HTTP e PostgreSQL reais em banco de teste isolado.

## Saúde do serviço

`GET /health` fica fora do prefixo de domínio. Consulta o PostgreSQL com `SELECT 1` e responde sem cache (`Cache-Control: no-store`). Não depende de schema ou migration.

| Condição                           | HTTP  | Corpo                                  |
| ---------------------------------- | ----- | -------------------------------------- |
| Banco responde                     | `200` | `{"status":"ok","database":"up"}`      |
| Banco indisponível ou probe expira | `503` | `{"status":"error","database":"down"}` |

O retorno de indisponibilidade contém somente estado; não expõe host, credenciais, driver, SQL ou stack. Uma resposta `200` comprova a consulta no instante do probe, sem certificar os fluxos futuros, os fornecedores ou a operação de produção. Liveness/readiness separados serão avaliados na F8.

## Erros e correlação

Falhas da API usam um contrato público estável:

```json
{
  "error": {
    "code": "CODIGO_ESTAVEL",
    "message": "Mensagem pública sem detalhes internos",
    "requestId": "UUID-gerado-pela-API"
  }
}
```

A API sempre gera um UUID próprio, sem confiar no identificador enviado pelo cliente, e o retorna também em `X-Request-Id`. O identificador permite correlacionar a resposta com logs sanitizados. Exceções inesperadas não devolvem stack ou mensagem do driver. Códigos aceitos pelo filtro têm mensagens públicas fixas; texto arbitrário de exceções não chega ao cliente.

| HTTP | Código                                                                                        | Situação                                                                |
| ---- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`                                                                             | DTO, propriedade desconhecida, URL ou formato inválido                  |
| 400  | `INVALID_CONTENT`, `INVALID_RELATION`, `INVALID_PUBLICATION`, `INVALID_SORT`, `REDIRECT_LOOP` | Regras de conteúdo, relacionamentos, publicação, ordenação ou redirects |
| 401  | `UNAUTHORIZED`                                                                                | Sessão ausente/inválida/expirada/revogada                               |
| 403  | `FORBIDDEN`, `CONTENT_FORBIDDEN`                                                              | Role/propriedade, CSRF ou origem rejeitada                              |
| 404  | `NOT_FOUND`                                                                                   | Recurso inexistente ou conteúdo não disponível publicamente             |
| 409  | `CONFLICT`, `VERSION_CONFLICT`, `RESOURCE_IN_USE`                                             | Unicidade, edição concorrente ou FK em uso                              |
| 429  | `RATE_LIMITED`                                                                                | Limite persistido de tentativas                                         |
| 500  | `INTERNAL_ERROR`                                                                              | Falha inesperada com mensagem genérica                                  |

## Documentação e validação

Swagger fica em `/api/docs` somente quando `APP_ENV` e `NODE_ENV` são `development`; é desativado nos demais casos. Ele descreve os endpoints existentes; o planejamento abaixo não deve gerar rotas fictícias na documentação executável. A configuração segue a [integração OpenAPI do NestJS](https://docs.nestjs.com/openapi/introduction).

A API aplica DTOs com transformação explícita, whitelist e rejeição de propriedades desconhecidas. O corpo JSON tem teto de 64 KiB; IDs administrativos/relacionais usam UUID e slugs usam letras minúsculas, números e hífens. `packages/types` publica contratos permitidos sem modelos Prisma. As respostas de domínio passam por serializers explícitos; hash de senha, chave de storage, token, contato e assinante não integram respostas públicas. Swagger inclui DTOs de entrada, rotas reais e schemas dos campos de saída públicos/administrativos.

Todas as respostas ficam `Cache-Control: no-store`, política mantida na F5. A web revalida por nova requisição e renderiza sem cache persistente; retirada de publicação impede imediatamente nova leitura pública pela API/site. Tarefas persistidas após mutações pertencem à F6; detalhes em [editorial.md](editorial.md).

## Sessão e usuários

Todos os caminhos desta seção e das próximas usam o prefixo `/api/v1`. Antes do login, obter `GET /auth/csrf` e enviar o cookie recebido com `X-CSRF-Token`. O cookie CSRF é assinado e HttpOnly; a resposta entrega o valor necessário ao cliente. Mutações exigem `Origin` igual à origem de `WEB_PUBLIC_URL`; o backend valida novamente CSRF e sessão. Cookies `filaretti_access`, `filaretti_refresh` e `filaretti_csrf` são HttpOnly, SameSite=Lax e Secure em produção, com Path `/api/v1`. Tokens de acesso/refresh não aparecem no corpo nem devem ir a localStorage.

| Método/caminho                     | Entrada                                    | Retorno/efeito                                                                         |
| ---------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET `/auth/csrf`                   | Sem corpo                                  | 200 `{ csrfToken }`; restaura o valor de uma sessão válida ou emite proteção pré-login |
| POST `/auth/login`                 | `email`, `password`                        | 200 `{ user, csrfToken }`; cookies de sessão                                           |
| POST `/auth/refresh`               | Cookies + CSRF/origem                      | 200 `{ user, csrfToken }`; refresh rotativo                                            |
| POST `/auth/logout`                | Sessão + CSRF/origem                       | 204; revoga a família e limpa cookies                                                  |
| GET `/auth/me`                     | Sessão                                     | 200 usuário permitido                                                                  |
| POST `/auth/password`              | `currentPassword`, `newPassword`           | 204; Argon2id, revoga todas as sessões                                                 |
| POST `/auth/password/recovery`     | `email` + CSRF/origem                      | 202 com mensagem igual para e-mail conhecido/desconhecido                              |
| POST `/auth/password/reset`        | `token`, `newPassword` + CSRF/origem       | 204; token de uso único, revoga sessões                                                |
| GET `/admin/users`                 | ADMIN; paginação                           | 200 `{ data, meta }`                                                                   |
| POST `/admin/users`                | ADMIN; `name`, `email`, `password`, `role` | 201 usuário permitido                                                                  |
| POST `/admin/users/:id/deactivate` | ADMIN                                      | 201 usuário inativo; sessões revogadas                                                 |

Usuário permitido contém exclusivamente `id`, `name`, `email`, `role`, `isActive`. E-mail é normalizado e único. Senha nova tem 12–128 caracteres. Desativação própria e remoção do último ADMIN são impedidas. Não existe cadastro administrativo público.

Access JWT HS256 dura até 900 segundos, configurável entre 60–900. A família de refresh tem expiração absoluta, padrão 7 dias, configurável entre 1 hora–30 dias; o refresh anterior consumido revoga a família em caso de reutilização. Hashes HMAC dos tokens e CSRF ficam persistidos, nunca o token bruto. Recuperação expira em 30 minutos e consome o token atomicamente. O adaptador de entrega fica inativo na F2: nenhum e-mail é enviado e o token não é retornado ou logado; envio transacional entra na F7.

Login contabiliza tentativas inclusive bem-sucedidas: 5 por e-mail e 20 por IP a cada 15 minutos, com bloqueio de 15 minutos ao exceder; PostgreSQL compartilha os contadores entre instâncias. Recuperação e reset usam buckets separados. O primeiro ADMIN de produção exige o provisionamento seguro descrito em `security.md`, sem senha padrão.

## Paginação e filtros

Listagens retornam `{ data, meta: { page, limit, total, pages } }`, com padrão `page=1&limit=12`, `limit` entre 1–50 e `page` entre 1–100000. `pages = ceil(total / limit)`; ausência de resultados produz `data: []`, `total: 0`, `pages: 0`. Não há coerção de booleanos enviados como strings no corpo. Ordenação recebe somente nomes permitidos e usa ID como desempate.

| Listagem            | `sort` permitido            | Padrão                                                   |
| ------------------- | --------------------------- | -------------------------------------------------------- |
| Artigos             | `newest`, `oldest`, `title` | `newest`, pela data de publicação; sem data ficam no fim |
| Categorias/tags     | `name`                      | `name`                                                   |
| Profissionais/áreas | `order`, `name`             | `order`                                                  |
| Páginas             | `title`, `newest`, `oldest` | `title`; newest/oldest usam data de criação              |
| FAQ                 | `order`                     | `order`                                                  |
| Redirects           | `newest`, `oldest`          | `newest`, pela data de criação                           |

Artigos aceitam filtros combinados `area`, `category`, `professional`, `tag` por slug, `type=ARTICLE|UPDATE|GUIDE` e `year=1900..2100` pela data de publicação UTC. Na F4, `featured=true|false` seleciona destaques diretamente no PostgreSQL; somente essas strings booleanas são convertidas no query, sem relaxar os booleanos do corpo. A seleção mantém os filtros de publicação/data/autor ativo. `author` é alias de `professional`, referente ao profissional público, nunca ao usuário administrativo; se ambos forem enviados devem concordar. FAQ aceita `area` por slug. Artigos administrativos também aceitam `status=DRAFT|SCHEDULED|PUBLISHED|ARCHIVED`. AUTHOR continua restrito aos próprios rascunhos mesmo ao fornecer outro status.

## Domínio público

| Caminho GET                                              | Regra de leitura                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `/articles`, `/articles/:slug`                           | Somente PUBLISHED com data não futura e profissional autor ativo              |
| `/editorial/filters`                                     | Opções de filtros derivadas exclusivamente do catálogo público, sem paginação |
| `/taxonomies/categories`, `/taxonomies/categories/:slug` | Categorias ativas                                                             |
| `/taxonomies/tags`, `/taxonomies/tags/:slug`             | Tags ativas                                                                   |
| `/professionals`, `/professionals/:slug`                 | Profissionais ativos; áreas vinculadas também ativas                          |
| `/practice-areas`, `/practice-areas/:slug`               | Áreas ativas; profissionais vinculados também ativos                          |
| `/pages`, `/pages/:slug`                                 | Somente PUBLISHED com data não futura                                         |
| `/faqs`, `/faqs/:id`                                     | FAQ ativo; FAQ de área inativa fica oculto                                    |
| `/settings`                                              | Nome e campos de contato explicitamente públicos, endereço e links permitidos |
| `/redirects`                                             | Mapeamentos ativos: `sourcePath`, `targetPath`, `statusCode`                  |

Rascunhos, agendamentos, arquivados, conteúdo futuro e registros inativos retornam 404 no detalhe público. Categorias/tags/áreas inativas são removidas dos relacionamentos públicos. Listagem de artigos entrega resumos; conteúdo TipTap, PDF e SEO entram somente no detalhe. IDs de usuário criador/editor, status interno, versão e `isMock` não aparecem no contrato público.

Mídia pública é serializada somente com visibilidade PUBLIC, URL HTTPS segura ou caminho local `/media/public/**` correspondente ao MIME, e sem vínculo com contato. O contrato expõe `id`, `alt`, `mimeType`, `size`, `url`; `storageKey`, proprietário e anexos privados ficam fora. Referência privada/inválida existente no banco devolve `null` publicamente; novos vínculos editoriais privados são rejeitados. Upload e download privado seguem F6/F7; a UI F5 permite apenas raster/PDF local da allowlist.

`GET /editorial/filters` retorna `{ areas, categories, authors, tags, years }`, com quatro arrays de `{ id, slug, name }` e anos inteiros descendentes. Opções derivam de PUBLISHED com data não futura e autor ativo; relações inativas são excluídas. As consultas usam uma transação de leitura consistente e não truncam opções com a paginação dos artigos. Anos seguem UTC, como o filtro `year`. O cliente público projeta esses campos e o detalhe `PublicArticle` sem status, propriedade administrativa, flags internas ou chaves de storage.

## Domínio administrativo

| Recurso sob `/admin`                         | Métodos                                                             | Permissão                                   |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `/articles`, `/articles/:id`                 | GET lista/detalhe, POST criar, PATCH editar, DELETE remover         | ADMIN/EDITOR; AUTHOR somente próprios DRAFT |
| `/articles/:id/publication`                  | POST `{ version, status }`                                          | ADMIN/EDITOR                                |
| `/taxonomies/:kind`, `/taxonomies/:kind/:id` | GET lista/detalhe, POST, PATCH, DELETE; kind=`categories` ou `tags` | ADMIN/EDITOR                                |
| `/professionals`, `/professionals/:id`       | GET lista/detalhe, POST, PATCH, DELETE                              | ADMIN/EDITOR                                |
| `/practice-areas`, `/practice-areas/:id`     | GET lista/detalhe, POST, PATCH, DELETE                              | ADMIN/EDITOR                                |
| `/pages`, `/pages/:id`                       | GET lista/detalhe, POST, PATCH, DELETE                              | ADMIN/EDITOR                                |
| `/pages/:id/publication`                     | POST `{ version, status }`                                          | ADMIN/EDITOR                                |
| `/faqs`, `/faqs/:id`                         | GET lista/detalhe, POST, PATCH, DELETE                              | ADMIN/EDITOR                                |
| `/settings`                                  | GET, PATCH                                                          | ADMIN                                       |
| `/redirects`, `/redirects/:id`               | GET lista/detalhe, POST, PATCH, DELETE                              | ADMIN                                       |

POST de criação/publicação retorna 201, GET/PATCH/DELETE retorna 200. DELETE recebe `{ version }` no corpo e retorna `{ deleted: true }`. PATCH e mudança de publicação exigem a versão inteira da leitura anterior. `updateMany`/`deleteMany` com ID+versão e incremento atômico, no mesmo transaction dos relacionamentos e auditoria, impedem sobrescrita silenciosa; conflito devolve 409 `VERSION_CONFLICT`. O cliente deve recarregar o registro antes de reaplicar sua alteração.

Artigos e páginas nascem DRAFT. O payload de criação/edição não aceita `status`, `createdById`, `updatedById`, `isMock`, datas de publicação/agendamento ou versão inicial. O servidor associa proprietário/editor à sessão e marca criação com `MOCK_CONTENT`. O vínculo do profissional autor usa `authorId` separado do usuário criador. Publicação aceita DRAFT/PUBLISHED/ARCHIVED; não há agendamento operacional na F2. Artigo vazio ou com relações inativas/privadas não publica. Artigo PUBLISHED/SCHEDULED e página PUBLISHED precisam sair desses estados antes da exclusão. Exclusão de profissional, taxonomia, área ou mídia em uso é impedida por FK, sem remoção silenciosa.

Campos editáveis principais:

- Artigo: `title` (200), `slug` (120), `excerpt` (500), `content`, `type`, `authorId`, `coverMediaId?`, `pdfMediaId?`, `featured?`, `categoryIds?` (20), `tagIds?` (50), `practiceAreaIds?` (20), `seoTitle?` (70), `seoDescription?` (170). Tempo de leitura é calculado pelo servidor, estimativa de 200 palavras/minuto.
- Profissional: `name`, `slug`, `title`, `bio`, arrays de strings `education`/`experience`, `photoMediaId?`, `practiceAreaIds?`, `isActive?`, `sortOrder?`.
- Área: `name`, `slug`, `summary`, `description`, array de strings `services`, `isActive?`, `sortOrder?`.
- Página: `title`, `slug`, `sections`, campos SEO; seção tem `{ key, heading?, body }`, chave única e body TipTap, máximo 30 seções.
- FAQ: `question` (300), `answer`, `practiceAreaId?`, `isActive?`, `sortOrder?`.
- Configurações: `siteName?`, `publicEmail?`, `publicPhone?`, `whatsappUrl?`, `address?` com `street/city/state/postalCode/country`, `socialLinks?` com `{ label, url }`. Campos desconhecidos inclusive dentro de endereço/links são rejeitados.
- Redirect: `sourcePath`, `targetPath`, `statusCode?` (301/302/307/308), `isActive?`. Apenas caminhos internos canônicos, sem query/hash, percent-encoding, barras duplicadas, segmentos `.`/`..`, barra final ou rotas reservadas `/admin`, `/api`, `/preview`, `/_next`. Sem destinos externos, autorreferência ou ciclos; validação do grafo e gravação usam transação SERIALIZABLE para proteger concorrência.

## Schema editorial TipTap

O backend aceita JSON estruturado, sem HTML bruto, embeds, imagem inline, scripts, estilos ou atributos arbitrários. Fotos/PDFs são campos de mídia separados. O documento raiz é `{ type: "doc", content: [...] }` e aceita somente:

- Blocos `paragraph`, `heading`, `bulletList`, `orderedList`, `blockquote`, `horizontalRule`, `codeBlock`; listas contêm `listItem`, que contém blocos.
- `paragraph`/`heading` contêm `text` e `hardBreak`; `codeBlock` contém apenas `text`. Textos usam `text` como string, renderizada como texto pelo renderer JSX, nunca inserida como HTML.
- Marks em texto: `bold`, `italic`, `underline`, `strike`, `code`, `link`. Link aceita somente `attrs: { href }`; protocolos permitidos são HTTPs, mailto, tel e caminho interno relativo seguro. `javascript:`, `data:`, URLs com credenciais, caracteres de controle, backslash e `//host` são rejeitados.
- Atributos: heading `level=2|3|4` obrigatório; orderedList `start` inteiro 1–10000 opcional; codeBlock `language` opcional com letras minúsculas, números e hífen (até 30). Os demais nós não aceitam attrs.

Limites por documento: profundidade 24, 2000 nós, 50000 caracteres de texto e até 6 marks distintos por trecho. Propriedades desconhecidas e relações inválidas entre nós são rejeitadas. Esse contrato é compartilhado por artigo, bio, descrição de área, resposta FAQ e corpo de seção. O renderer da F5 projeta nós permitidos e gera JSX escapado no servidor, sem inserir HTML bruto; URLs são verificadas novamente. A API rejeita payloads executáveis na entrada. Sumário e controles de arquivo em [editorial.md](editorial.md).

## Interfaces preparadas e limites da fase

`packages/types` contém portas tipadas de storage (public/private), submissão de contato, newsletter (confirmação/descadastro) e tarefas idempotentes. Schema/migrations persistem as entidades necessárias. Essas interfaces não registram rotas fictícias nem executam fornecedores: upload/preview/worker/revalidação pertencem à F6; contato/newsletter/busca/envio/antispam/retenção pertencem à F7. O índice de busca PostgreSQL é preparado na F2, sem endpoint de busca pública ainda.

## Validação exigida

Os testes de integração da F2 usam banco PostgreSQL novo e isolado: migrations, seed duas vezes, autenticação/revogação/CSRF, roles/propriedade, consultas/relacionamentos, publicação/retirada, conflitos concorrentes, conteúdo malicioso, mídias privadas, DTOs e Swagger. O runner também verifica bloqueio do seed fictício fora de desenvolvimento e seed estrutural separado. Evidências finais de comandos, resultados e limitações ficam em `relate.md`; fornecedores/fluxos das F6/F7 não são certificados por esses testes locais.
