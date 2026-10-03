# SEO, cache e indexação

Decisões iniciais da F1, 02/10/2026. A fundação não entrega páginas institucionais/editoriais, sitemap, analytics ou integração com Search Console. Domínio final e dados oficiais permanecem dependentes de aprovação.

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

Sitemap conterá somente URLs públicas publicadas. Admin, preview e staging não serão indexáveis; staging também exigirá controle de acesso. `robots.txt` não protege conteúdo privado e não substitui autenticação. A política de busca interna e combinações de filtros será explicitada na F7 para evitar indexação indiscriminada.

Schema.org poderá incluir LegalService, Article, Person, BreadcrumbList e FAQPage quando aplicável ao conteúdo realmente exibido. Não preencher dados profissionais, avaliações, contatos ou promessas de resultado com informação inventada. Dados estruturados não garantem recursos especiais em buscadores.

## Cache e publicação

Não presumir cache automático do Next.js. A F5 deverá definir o modelo efetivamente usado, tempos/tags e invalidação conforme a versão fixada. A [documentação de cache do Next.js](https://nextjs.org/docs/app/getting-started/caching) distingue configurações e modelos; essa escolha será documentada junto com a implementação.

Admin, dados pessoais e preview ficarão fora do cache público. Publicar, alterar slug ou retirar conteúdo deverá atualizar listas, detalhes, relacionados, busca e sitemap dentro de um prazo definido/testado na F6/F7. Preview exigirá token válido, noindex e no-store; o token não poderá ir a logs ou analytics.

## Analytics e privacidade

GA4 será ativado somente após consentimento e deverá parar após revogação. Os eventos previstos são `click_whatsapp`, `submit_contact`, `newsletter_signup`, `article_share`, `download_guide` e `search`. Payloads não poderão conter mensagens, anexos, e-mails, tokens ou consultas potencialmente sensíveis. Implementação e testes pertencem à F7.

Search Console exigirá conta/verificação do domínio no ambiente autorizado. A F1 não faz cadastro, envio de sitemap, alteração de DNS ou carregamento de analytics.

## Metas e evidências

Na F8, medir templates públicos em build de produção e condições reproduzíveis: Lighthouse Performance ≥ 90, Accessibility ≥ 90, Best Practices ≥ 90 e SEO ≥ 95. Valores são metas, não resultados desta fase. Lighthouse não certifica sozinho acessibilidade nem experiência real de usuários; as evidências devem registrar URL, ambiente e condições de medição.
