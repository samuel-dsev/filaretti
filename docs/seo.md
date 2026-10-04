# SEO, cache e indexação

Atualizado na F7, versão `0.7.0`, 04/10/2026. Busca PostgreSQL em português, FAQ, metadata social, dados estruturados, sitemap e robots implementados. Indexação permanece desligada no desenvolvimento/homologação e depende de habilitação explícita em produção. Domínio final e dados oficiais permanecem dependentes de aprovação.

## Entregas por fase

| Fase | Escopo previsto                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------- |
| F4   | Metadata básica e canonical previsto nas páginas institucionais                                   |
| F5   | Metadata editorial, renderização segura, URLs de filtros e política de cache explícita            |
| F6   | Invalidação persistida após publicação/retirada e preview privado sem cache                       |
| F7   | Sitemap, robots, breadcrumbs, Open Graph, Twitter/X Cards, Schema.org e política de busca/filtros |
| F8   | Medição de build de produção, revisão de indexação e desempenho                                   |
| F9   | Mapeamento de URLs antigas, redirects e revisão de conteúdo aprovado                              |
| F10  | Domínio autorizado, sitemap no Search Console e monitoramento operacional                         |

## Metadata e rotas

Títulos, descrições e dados estruturados deverão refletir conteúdo aprovado da API. Cada recurso público terá URL consistente; slug inexistente deverá devolver 404 real. Canonical usará a URL pública configurada, sem copiar origem local ou staging. A implementação seguirá a [API de metadata do Next.js](https://nextjs.org/docs/app/api-reference/functions/generate-metadata).

Na F4, títulos/descrições institucionais usam os dados publicados, ainda fictícios; listas usam rótulos de interface. Canonical usa `NEXT_PUBLIC_SITE_URL`, sem query/fragmento. Todas as rotas seguem `noindex, nofollow`, inclusive no header. O Proxy verifica HTTP público antes do streaming para emitir 404 real ou 503 em falha da API. O grupo é dinâmico, com fetch `no-store` e deduplicação restrita à renderização; mutações aparecem na próxima requisição. O contrato de dependências para cache/invalidação futuro está em [public-site.md](public-site.md).

Sitemap conterá somente URLs públicas publicadas. Admin, preview e staging não serão indexáveis; staging também exigirá controle de acesso. `robots.txt` não protege conteúdo privado e não substitui autenticação. A política de busca interna e combinações de filtros será explicitada na F7 para evitar indexação indiscriminada.

Schema.org poderá incluir LegalService, Article, Person, BreadcrumbList e FAQPage quando aplicável ao conteúdo realmente exibido. Não preencher dados profissionais, avaliações, contatos ou promessas de resultado com informação inventada. Dados estruturados não garantem recursos especiais em buscadores.

## Cache e publicação

Na F5, a política é revalidação por requisição: `no-store`, grupo `force-dynamic` e ausência de cache persistente. A primeira consulta posterior à retirada de publicação deve mostrar 404 no detalhe e remover o resultado das listas/opções/relações, sem rebuild. Links editoriais evitam prefetch e iniciam leitura nova. A [documentação de cache do Next.js](https://nextjs.org/docs/app/guides/caching-without-cache-components) sustenta a configuração para a versão fixada; decisão, testes e limites em [editorial.md](editorial.md).

Admin, dados pessoais e preview ficarão fora do cache público. Publicar, alterar slug ou retirar conteúdo deverá atualizar listas, detalhes, relacionados, busca e sitemap dentro de um prazo definido/testado na F6/F7. Preview exigirá token válido, noindex e no-store; o token não poderá ir a logs ou analytics.

## Analytics e privacidade

GA4 será ativado somente após consentimento e deverá parar após revogação. Os eventos previstos são `click_whatsapp`, `submit_contact`, `newsletter_signup`, `article_share`, `download_guide` e `search`. Payloads não poderão conter mensagens, anexos, e-mails, tokens ou consultas potencialmente sensíveis. Implementação e testes pertencem à F7.

Search Console exigirá conta/verificação do domínio no ambiente autorizado. A F1 não faz cadastro, envio de sitemap, alteração de DNS ou carregamento de analytics.

## Metas e evidências

Na F8, medir templates públicos em build de produção e condições reproduzíveis: Lighthouse Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90 e SEO ≥ 95. Valores são metas, não resultados desta fase. Lighthouse não certifica sozinho acessibilidade nem experiência real de usuários; as evidências devem registrar URL, ambiente e condições de medição.

## Implementação F7

### Busca e FAQ

`GET /api/v1/public/search?q=...&kind=all|article|area|professional&page=1&limit=12` consulta os vetores/GIN da F2 com `websearch_to_tsquery('portuguese', ...)` e `ts_rank_cd(..., 32)`. Título/nome, resumo e corpo recebem os pesos A/B/C já mantidos pelos triggers. Termo entre 2 e 120 caracteres, páginas até 100000 e limite máximo 50; entrada é validada e parâmetros SQL são vinculados pelo Prisma. Stopwords sem lexemas devolvem zero resultados. Ranking decrescente seguido por título/tipo/slug estabiliza a paginação. Dados e contagem compartilham uma transação Repeatable Read.

Somente PUBLISHED com data já atingida e autor ativo, áreas ativas e profissionais ativos participam. Produção exclui mocks, incluindo o autor do artigo, independentemente da flag de conteúdo. Resultado projeta apenas `kind`, `slug`, `title`, `excerpt` e `href`; nenhum contato, assinante, mídia privada, rascunho ou preview é consultado. A página `/busca` preserva termo/tipo/página na URL, tem estados inicial/vazio/erro e o overlay submete a busca por GET. Consultas não são enviadas em eventos de analytics. [Funções de busca do PostgreSQL 17](https://www.postgresql.org/docs/17/textsearch-controls.html).

`/perguntas-frequentes` usa o catálogo paginado da API; `?area=<slug>` filtra por área. Detalhes de áreas mostram até 12 perguntas relacionadas e link para a listagem completa quando necessário. FAQ inativo e FAQ de área inativa são excluídos pelo backend. Os documentos TipTap usam o renderizador público seguro. FAQPage corresponde exclusivamente às perguntas/respostas visíveis na página atual.

### Indexação, sitemap e metadata

`SEO_INDEXING_ENABLED=false` é o padrão. A configuração só aceita ativar a flag em `APP_ENV=production`; mesmo nessa condição é necessário `MOCK_CONTENT=false` e URL HTTPS. Desenvolvimento e staging seguem noindex/nofollow, robots com `Disallow: /` e sitemap vazio. Ativar a flag pertence ao corte de produção autorizado na F10; não foi ativada na F7.

Busca, admin, preview, rotas de token e URLs públicas com filtros/paginação permanecem noindex. Listagens com parâmetros fazem canonical para a listagem base; buscas fazem canonical para `/busca`. Robots bloqueia caminhos internos mas nunca substitui autenticação. Open Graph e Twitter/X Cards usam título/descrição sanitizados, URL canônica configurada e imagem pública quando existente; publicações incluem datas reais da API.

`GET /api/v1/public/sitemap?page=1&limit=50` oferece URLs públicas projetadas/paginadas. Inclui somente templates institucionais conhecidos com página publicada e data atingida, artigos publicados com autor ativo, áreas/profissionais ativos, listagens com catálogo e FAQ ativo. Exclui mocks e autores mock em produção, caminhos arbitrários do CMS, dados pessoais, filtros, busca, admin e preview. O sitemap Next é `force-dynamic`, lê todas as páginas via `no-store` e não devolve uma lista parcial quando a API falha. Teto de 50000 URLs por sitemap; catálogo maior exige particionamento antes da publicação, sem truncamento silencioso. [Sitemap do Next.js](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap).

JSON-LD: LegalService na Home usa somente nome/contato/endereço/redes configurados; Article na leitura; Person no perfil; BreadcrumbList nas páginas institucionais/editoriais; FAQPage quando perguntas estão presentes. Não acrescenta avaliações, registro profissional, preços, promessa de resultado nem identidade inventada fora dos dados explícitos da API. Dados locais continuam fictícios e não indexáveis. JSON serializado escapa delimitadores HTML e separadores Unicode para impedir que texto publicado feche o elemento script. [Schema.org](https://schema.org/docs/full.html).

Retirada de publicação/inativação afeta busca e catálogo sitemap na consulta seguinte, sem rebuild; não há cache público persistente. Testes PostgreSQL/HTTP verificam ranking/stemming, filtros/paginação, projeção, negativos de entrada, exclusão de drafts/agendados/futuros, autor inativo, retirada e sitemap público. Checks de metadata verificam gate explícito, noindex de filtros e campos sociais. Essas validações locais não comprovam indexação, Search Console ou recursos especiais de buscadores.
