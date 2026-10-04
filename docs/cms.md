# CMS, mídia e publicação

F6, versão `0.6.0`. O painel usa as APIs NestJS e o PostgreSQL existentes. Desenvolvimento usa somente identidades e conteúdos fictícios. Resultados do aceite, evidências e limitações ficam no RP-007 de `../relate.md`.

## Operação local

Em um checkout novo, `pnpm setup:local` gera os ambientes ignorados com o mesmo segredo de revalidação no servidor web e na API. Em um checkout das fases anteriores, `pnpm setup:cms-local` acrescenta somente o segredo já existente da API ao ambiente web local, sem imprimir seu valor, sobrescrever configuração existente ou aceitar outro ambiente. Reiniciar os apps depois da configuração.

Aplicar as migrations com `pnpm db:migrate` e iniciar `pnpm dev`. `/admin/login` autentica uma das contas fictícias documentadas em [database.md](database.md). Não há cadastro público nem senha padrão de produção. A origem usada no navegador deve ser exatamente a configurada em `WEB_PUBLIC_URL`; misturar `localhost` e `127.0.0.1` nas mutações resulta em rejeição de origem.

O dashboard e as telas de artigos, categorias, tags, áreas, profissionais, páginas, FAQ e mídia usam contratos reais. Usuários, configurações e redirects são restritos a ADMIN. EDITOR mantém/publica conteúdo. AUTHOR cria e edita seus próprios rascunhos e gerencia sua mídia; a API verifica novamente essas permissões. Contatos e assinantes completos permanecem na F7.

O editor TipTap oferece formatação compatível com o schema permitido da API, campos SEO, relacionamentos, capa e PDF. A versão enviada em cada alteração impede sobrescrita concorrente. Um conflito mantém os campos atuais e exige recarregar a versão antes de reaplicar alterações. Salvar e publicar são operações separadas. A data de agendamento é exibida em `America/Sao_Paulo` e persistida em UTC.

## Sessão e encaminhamento

`/api/cms/*` encaminha somente os namespaces `auth` e `admin` à API interna. Preserva Origin e CSRF, sem aceitar um destino fornecido pelo navegador. Os cookies HttpOnly emitidos pela API recebem `Path=/api/cms` na resposta do encaminhamento; access/refresh não são devolvidos em JSON nem gravados em localStorage. O token CSRF fica apenas em memória e pode ser restaurado pelo endpoint autenticado/pré-login apropriado. Refresh concorrente é deduplicado no navegador; a rotação e detecção de reutilização continuam no PostgreSQL.

Admin e preview são dinâmicos, no-store, noindex e no-referrer. SSR do admin entrega a estrutura; os dados administrativos são obtidos após validação da sessão pela API. Autorização não depende de esconder links da navegação. Não há analytics no preview.

## Preview

`POST /api/v1/admin/articles/:id/preview` emite um token opaco; a API guarda somente seu hash e expiração. `/preview/[token]` consulta `GET /api/v1/preview/:token` e reutiliza o renderer seguro da leitura editorial. O link permite leitura a quem o receber até expirar ou ser revogado; deve ser compartilhado somente com revisores autorizados.

O Proxy verifica o token antes do streaming para retornar HTTP 404 em tokens inválidos, expirados ou revogados e 503 na indisponibilidade da API. O servidor repete a validação antes de renderizar. URLs/tokens, cookies e corpos não entram nos logs sanitizados da API. O preview não entra em catálogos públicos, busca, sitemap ou cache público. A expiração configurável `PREVIEW_TTL_SECONDS` varia de 60 a 3600 segundos, padrão 900.

## Arquivos e storage

Uploads administrativos são multipart com campo `file`, metadados `alt`, `source`, `license` e visibilidade explícita. Imagens JPG/JPEG, PNG, WebP e AVIF têm limite de 5 MiB; PDF, 10 MiB. Extensão, MIME declarado, tamanho e bytes devem concordar. SVG, HTML, arquivos vazios/truncados, imagens excessivas ou animadas e PDF ativo são recusados. O decoder raster executa decodificação completa/reencode, limita pixels e remove metadados; não se limita à leitura de cabeçalho. PDFs são analisados estruturalmente; isso não substitui a política de scanner/quarentena dos anexos de contato da F7/F8.

Chaves aleatórias impedem usar o nome original como caminho. Storage local mantém diretórios separados `public`/`private`; R2 usa buckets distintos configurados no servidor. A biblioteca permite busca e edição dos metadados. O controle de versão protege edição/exclusão. Referências em artigos, profissionais, páginas, áreas e FAQ impedem excluir mídia em uso.

Ativos editoriais públicos são acessados pela fachada `/media/public/<chave>`, encaminhada a `/api/v1/media/public/:key`. A API verifica a visibilidade e ausência de vínculo com contatos antes de servir os bytes. A fachada conserva a allowlist local do otimizador Next Image e não expõe URL permanente do bucket privado. Remoção tira o registro público na transação; uma tarefa persistida remove os bytes com retry. Conteúdo já baixado não pode ser apagado do dispositivo de quem o recebeu.

Imagens geridas pelo CMS usam `Image unoptimized` e a fachada `no-store`. O Proxy também recusa chamadas manuais ao otimizador para essas chaves, inclusive caminhos codificados; assim derivados antigos não continuam acessíveis depois da exclusão. Fixtures estáticos de desenvolvimento continuam otimizáveis. A geração de derivados no storage, com revogação equivalente, poderá ser avaliada na homologação.

`STORAGE_DRIVER=r2` requer `R2_ENABLED=true`, credenciais server-only e buckets público/privado distintos. Nenhuma conta externa é necessária no desenvolvimento. O adaptador R2 é implementado, mas sua validação real exige as credenciais e a autorização do ambiente de homologação previstas na F8. Não ativar fornecedores apenas para validar configuração.

## Agendamento, revalidação e URLs

O worker verifica publicações a cada minuto e também recupera trabalhos vencidos na inicialização. Datas ficam em UTC. A transação e a trava PostgreSQL impedem que instâncias concorrentes publiquem o mesmo registro duas vezes. A decisão de publicar revalida autor e vínculos ativos. Revalidação e remoção física de mídia usam outbox persistida, tentativas limitadas e registro sanitizado de falhas.

`CMS_WORKER_ENABLED=false` permite desligar a execução automática em ensaios controlados; `NODE_ENV=test` não inicia o timer. Em operação, pelo menos uma instância API/worker deve permanecer ativa. Cron do processo não garante execução enquanto todas as instâncias estiverem desligadas; a recuperação processa os trabalhos vencidos quando o serviço volta.

`POST /api/revalidate` exige `X-Revalidation-Secret` server-only e um corpo com `idempotencyKey` e `paths` públicos permitidos. O worker entrega o callback e persiste sucesso/retry. A operação é idempotente. A política pública da F5 continua sem cache persistente: a primeira nova consulta após publicação/retirada já usa o estado atual do banco, mesmo se o callback estiver temporariamente indisponível. O callback mantém o contrato para invalidação de dependências; não cria um cache novo.

Mudanças de slug de artigos publicados, páginas publicadas e perfis/áreas ativos preservam a URL anterior com redirecionamento interno. Edições de rascunhos ou registros inativos respeitam URLs reservadas, mas não criam aliases públicos. A preservação automática ocorre enquanto o conteúdo está visível; retirar, renomear e republicar é uma nova URL e exige redirect ADMIN explícito se for necessário preservar a antiga. O backend valida o grafo de redirects e recusa ciclos, destinos externos, caminhos ambíguos e superfícies privadas. `GET /api/v1/redirects/resolve?path=...` resolve um caminho sem paginação. O Proxy aplica somente respostas com destino interno validado; não encaminha visitantes para origens fornecidas pelo cliente.

## Verificação

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build` e `pnpm test:cms` verificam os contratos e fluxos. O smoke CMS exige Edge/Playwright já disponíveis e API compilada; cria seu próprio build web otimizado, banco PostgreSQL, arquivos, storage e processos em portas 3024/3025. Rewrites são fixados pelo Next durante o build, por isso o artefato do teste é compilado com sua origem isolada. O identificador interno `FILARETTI_QA_BUILD_ID` só seleciona diretório/tsconfig de teste quando é UUID válido em desenvolvimento. O ensaio não substitui o artefato normal, não instala navegador, não altera o banco de desenvolvimento e remove somente os recursos que criou. Evidências JSON/PNG ficam ignoradas em `.local/f6-*`.

Referências usadas na implementação: [TipTap com Next.js](https://tiptap.dev/docs/editor/getting-started/install/nextjs), [Sharp: metadados são leitura do cabeçalho](https://sharp.pixelplumbing.com/api-input/) e [R2 com AWS SDK v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/). Integrações reais, múltiplos navegadores, leitor de tela, Lighthouse e operação de produção seguem os gates das fases posteriores.
