# Portal editorial

Complemento F6: editor TipTap, mídia validada, preview e publicação agendada estão documentados em [cms.md](cms.md). A política no-store e o renderer seguro desta fase permanecem; alterações de slug editorial preservam a URL antiga, e a outbox entrega a revalidação com retries. Resultados da F6 no RP-007.

F5, versão `0.5.0`, 03/10/2026. As rotas editoriais usam PostgreSQL/API reais e preservam o visual aprovado. Conteúdos, identidades e arquivos de desenvolvimento continuam fictícios; materiais oficiais dependem da aprovação prevista na F9. Evidências e resultado do aceite ficam no RP-006 de `../relate.md`.

## URLs e leitura

`/conteudos` lista artigos, atualizações e guias em páginas de 12 registros. Filtros GET refletem a URL: `area`, `categoria`, `autor`, `tag`, `tipo` (`ARTICLE`, `UPDATE`, `GUIDE`), `ano` e `ordem` (`newest`, `oldest`, `title`); `pagina` percorre o mesmo resultado. Alterar os filtros inicia na primeira página. `editorialHref` preserva os critérios na paginação; copiar/reabrir a URL repete a consulta. Valores inválidos ou repetidos são ignorados, página fica entre 1–100000, ano entre 1900–2100 e slugs têm no máximo 120 caracteres. A API valida novamente todos os critérios e combina-os com AND.

`GET /api/v1/editorial/filters` entrega opções `areas`, `categories`, `authors`, `tags` e `years` derivadas somente do catálogo público e de vínculos ativos. Não deriva opções da primeira página nem inclui taxonomias usadas exclusivamente em rascunhos. `year` usa limites UTC da publicação, como na API existente; datas de leitura são exibidas em `America/Sao_Paulo`.

`/conteudos/[slug]` apresenta categoria, título, resumo, autor, publicação/atualização, tempo de leitura, capa otimizada, conteúdo, sumário H2, compartilhamento, perfil do autor, áreas e relacionados. O backend decide disponibilidade: DRAFT/SCHEDULED/ARCHIVED, data de publicação futura e autor inativo ficam fora da leitura pública. Relacionados usam a primeira área vinculada, ou recentes na ausência de área, excluindo o próprio artigo. Header/footer, Home, áreas e profissionais levam às páginas de leitura existentes.

## Conteúdo e arquivos

O renderizador `PublicContent` reutiliza o schema TipTap da F2. Ele projeta uma árvore limitada de nós e marcas conhecidos e produz JSX escapado no servidor. Não insere HTML bruto, scripts, iframes, imagens embutidas nem embeds. Texto semelhante a HTML permanece texto; marcas de link com protocolo inseguro são removidas preservando o texto. URLs recusam JavaScript/data/vbscript, controles, credenciais, barras invertidas e origem relativa a protocolo. Nenhuma biblioteca de sanitização de HTML é necessária porque não existe inserção de HTML fornecido pelo editor.

`getContentOutline` e `headingPrefix` usam a mesma ordem H2 para IDs estáveis e únicos, inclusive títulos repetidos, vazios ou em outras escritas. H2 recebe `tabIndex=-1` para foco a partir do sumário. O renderizador permanece reutilizável pelo preview da F6; esta fase não cria preview nem aceita tokens públicos.

Capas/fotos continuam restritas a raster local `/media/public/**`, conforme a allowlist de Next Image. Guias mostram download somente quando possuem referência pública de MIME `application/pdf`, extensão `.pdf`, caminho local público e tamanho positivo de até 10 MiB. Não há link de download indisponível que simule sucesso. Mídia privada ou ligada a contato não pode ser emitida pelo serializer público, mesmo se tiver visibilidade inconsistente. Upload, validação dos bytes, storage local completo/R2 e retirada física de arquivos pertencem à F6. Remover a publicação retira a referência do site; um PDF já público ou baixado exige a política própria de storage e não se torna privado automaticamente.

Compartilhamento usa canonical construído da configuração pública, sem copiar Host do visitante. Links de WhatsApp/LinkedIn/e-mail não enviam mensagens por iniciativa da aplicação; o usuário escolhe continuar no serviço. Copiar URL tem feedback acessível e fallback quando Clipboard API estiver indisponível. Analytics não é carregado nesta fase.

## Cache e revalidação

A política escolhida é **revalidar a cada requisição pública**, com `fetch: no-store`, grupo `force-dynamic` e `Cache-Control` que proíbe armazenamento. Não há Data Cache, Full Route Cache nem TTL persistente para o conteúdo editorial. `React.cache` apenas deduplica argumentos iguais na mesma renderização, sem guardar uma publicação entre requisições. A escolha evita uma janela de exposição de material retirado e mantém a API como autoridade de publicação.

Links de cards/leitura e filtros GET iniciam uma nova requisição, sem prefetch de payload editorial. O Proxy consulta o recurso público antes do streaming para retornar 404 real após retirada ou 503 com `Retry-After: 30` quando a API está indisponível. O prazo de retirada é **a primeira nova consulta após a transação de retirada**, sem rebuild/restart/espera de TTL; o runner comprova detalhe, listagem, relações e opções. Um documento já aberto/baixado e o histórico do navegador não podem ser apagados retroativamente. Proxy e renderização são duas consultas, sem snapshot transacional entre serviços.

Esta política é compatível com o Next.js fixado `16.3.8`, sem Cache Components. Referência consultada em 03/10/2026: [cache sem Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components). A persistência de tarefas de invalidação após mutações pertence à F6; se um cache persistente for adotado, deverá respeitar o contrato de dependências de [public-site.md](public-site.md) e testar retirada novamente. Admin, preview e dados pessoais continuarão fora do cache público.

## Verificação reproduzível e limites

Após `rtk proxy pnpm build`, executar `rtk proxy pnpm test:editorial`. O runner exige ambiente local de desenvolvimento, PostgreSQL em loopback e portas próprias livres. Cria um banco de teste, aplica migrations/seed somente nele e usa arquivos fictícios temporários. Remove apenas recursos que criou. JSON/PNG ficam ignorados em `.local/f5-*`; navegador/runtime Playwright existente é pré-requisito, sem instalação automática. `--http-only` reduz a cobertura e não substitui o aceite visual.

O relatório identifica verificações realmente executadas, navegador, larguras e limpeza. Busca global/overlay funcional, sitemap, Schema.org e analytics seguem F7; CMS, preview, uploads e publicação agendada seguem F6. Integrações externas, produção, conteúdo oficial e revisão abrangente de acessibilidade/navegadores têm gates próprios.
