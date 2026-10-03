# SEO, cache e indexação

Atualizado na F5, versão `0.5.0`, 03/10/2026. Rotas institucionais/editoriais possuem metadata básica e canonical configurado; sitemap, analytics e Search Console continuam nas fases seguintes. Domínio final e dados oficiais permanecem dependentes de aprovação.

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
