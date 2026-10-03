# Site institucional

Site institucional entregue na F4 e integrado ao portal editorial na F5, versão `0.5.0`, 03/10/2026. O usuário aprovou a estilização da F3. As evidências e o checkpoint ficam em `../relate.md`. Dados e identidades continuam explicitamente fictícios; aprovação do design não substitui aprovação de materiais oficiais. Leitura, filtros, arquivos e cache editorial: [editorial.md](editorial.md).

## Rotas e dados

| Rota                       | Consultas públicas da API                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/`                        | Página `home`, página `o-escritorio`, settings, áreas, profissionais, artigos recentes, destacados e guias |
| `/o-escritorio`            | Página publicada `o-escritorio`, settings e profissionais ativos                                           |
| `/areas-de-atuacao`        | Áreas ativas, paginação real com 12 registros                                                              |
| `/areas-de-atuacao/[slug]` | Área ativa, serviços, profissionais vinculados e artigos publicados filtrados por área                     |
| `/profissionais`           | Profissionais ativos, paginação real com 12 registros                                                      |
| `/profissionais/[slug]`    | Perfil ativo, bio, formação, experiência, áreas e artigos publicados filtrados pelo profissional           |

Os Server Components consomem exclusivamente DTOs de `@filaretti/types` por `src/lib/public-api.ts`. Prisma, cookies de sessão e segredos não integram essa camada. O cliente servidor usa `API_INTERNAL_URL`, timeout de cinco segundos, `credentials: omit`, redirecionamentos recusados e `cache: no-store`; projeta somente campos públicos e diferencia 404, indisponibilidade e resposta inválida. Erros de transporte/corpos de erro não são apresentados ao visitante. O Nest continua responsável pela publicação, visibilidade e relações.

`?pagina=N` nas listagens traduz-se em `page=N` na API. Valores inválidos retornam à primeira página; o limite máximo aceito é 100000. Página distante preserva o estado vazio e navegação. Menu e Home apresentam seleções limitadas; as listagens paginadas permitem percorrer todo o catálogo. A Home consulta recentes, destaques e guias separadamente, com três itens em cada seleção: `featured=true` e `type=GUIDE` são filtrados no PostgreSQL, sem depender de uma janela dos artigos recentes.

Título/seções de Home e escritório, descrições/bios, serviços, contatos, marca textual, relações e mídias vêm da API. Rótulos de navegação e das seções são interface. Fotos ausentes usam iniciais; o Hero institucional mantém a ilustração CSS substituível aprovada na F3. `Page.sections` não possui campo de mídia; sua extensão e gestão de uploads pertencem ao CMS da F6.

## Renderização, metadata e estados

O grupo `(institutional)` é dinâmico e renderiza no servidor. `React.cache` deduplica somente consultas iguais dentro de uma renderização; não existe cache persistente de dados ou páginas nesta fase. A alteração de um registro publicado aparece em uma nova requisição sem rebuild. Títulos/descrições básicos usam os DTOs; canonical usa `NEXT_PUBLIC_SITE_URL`, com caminho limpo, sem copiar Host da requisição. Desenvolvimento continua `noindex, nofollow` no HTML e no header. SEO completo e indexação de produção seguem F7–F10.

Antes do streaming, o Proxy consulta somente o recurso público correspondente à rota, com timeout e sem encaminhar cookies. A API decide se existe e está publicado/ativo. HTTP 404 produz uma página navegável com status **404**; falha de conexão/erro da API produz status **503**, `Retry-After: 30` e `no-store`. A consulta adicional evita a limitação de [status após streaming no Next.js](https://nextjs.org/docs/app/api-reference/functions/not-found). Não há cópia de regras de publicação no Proxy. Guardas `notFound`, loading, estados vazios e error boundaries também protegem a renderização e navegação interna. Uma mudança concorrente entre a verificação e a leitura continua sujeita ao comportamento de streaming; não é um snapshot transacional entre serviços.

`PublicContent` renderiza o schema institucional TipTap permitido pela API, como JSX escapado: parágrafos, headings 2–4, listas, marcas, links, citações e código. URLs executáveis, credenciais e protocolos não permitidos são retirados; o texto do link é preservado. Não utiliza HTML bruto. Esse componente é uma dependência dos textos institucionais; páginas de leitura, sumário, compartilhamento e PDF continuam na F5.

Imagens usam `next/image` e `sizes`. A allowlist inicial admite somente raster JPEG/PNG/WebP/AVIF em `/media/public/**`, sem query, traversal, SVG, caminhos privados ou origens remotas. DTOs incompatíveis usam placeholder. Adicionar hosts e paths de storage exige a integração/revisão da F6; não foi criada uma allowlist genérica de URLs. O smoke usa somente uma ilustração raster fictícia temporária e confirma redimensionamento pelo otimizador.

Os resumos editoriais publicados e relacionados agora levam à leitura integral em `/conteudos/[slug]`; menu/footer e Home levam a `/conteudos`. Newsletter mostra disponibilidade futura, sem formulário que simule inscrição. Contato apresenta apenas canais públicos configurados; envio de formulário, anexos, newsletter e busca global operacional pertencem à F7.

## Contrato para cache e invalidação

A política vigente é **nova leitura por requisição**, mantida explicitamente na F5 para que a retirada de publicação apareça na primeira consulta posterior à transação, sem cache persistente. A F6 persistirá as tarefas de invalidação após mutações. As dependências abaixo devem ser preservadas se um cache persistente for introduzido:

| Recurso alterado                               | Superfícies dependentes                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Settings                                       | Marca/menu/footer, Home e escritório, contatos e metadata institucional aplicável                                        |
| Página `home` ou `o-escritorio`                | Respectiva rota, metadata e resumo do escritório na Home                                                                 |
| Área, atividade, slug ou relações              | Menu, Home, índice/detalhe da área e perfis vinculados                                                                   |
| Profissional, atividade, slug ou relações      | Home, escritório, índice/perfil e detalhes das áreas vinculadas                                                          |
| Artigo, destaque, tipo, publicação ou relações | Recentes/destaques/guias da Home, relacionados por área e publicações por profissional; leitura/listagem editorial na F5 |

Retirada, troca de slug e alteração de relações devem invalidar tanto os caminhos antigos quanto os novos e as listagens dependentes. Preview/admin permanecem fora do cache público. Nenhum endpoint de revalidação, worker ou tag com cache ativo é apresentado como entregue na F4/F5; política e comprovação de retirada na F5 estão em [editorial.md](editorial.md).

## Verificação reproduzível

Depois de `rtk proxy pnpm build`, executar `rtk proxy pnpm test:institutional`. O runner carrega configuração local sem imprimi-la, exige desenvolvimento e PostgreSQL em loopback, cria um banco com nome próprio e aplica migrations/seed somente nele. Inicia API e Next otimizado em portas de teste livres; não modifica o banco de desenvolvimento. Remove apenas banco, processos e arquivo raster que criou.

O navegador exige Playwright já disponível (`PLAYWRIGHT_MODULE_PATH`, se necessário) e Edge instalado por padrão; o runner não instala dependências/navegadores. `--http-only` é uma opção explícita com alcance menor, não substitui o aceite visual. JSON e PNGs ficam ignorados em `.local/f4-smoke.json` e `.local/f4-evidence/`. Registrar no relatório os checks efetivamente executados, navegador, larguras, limitações e resultado da limpeza.
