# Migração e preparação da release — F9

A F9 prepara um lote revisável, importação controlada e verificação de prontidão. A implementação local não autoriza carga de dados reais, envio de mensagens, contratação, publicação, DNS ou corte de tráfego. A F8 continua com homologação parcial até suas evidências externas; materiais e aprovações do escritório também permanecem pendentes.

[release-checklist.json](release-checklist.json) começa com todos os gates pendentes. Nenhuma identidade, aprovação, origem de produção, responsável ou janela de corte foi preenchida com uma suposição. Os checks efetivamente executados e o estado da entrega ficam em [plan.md](../plan.md) e [relate.md](../relate.md).

## Inventário e decisões sobre URLs

O responsável pela migração deve fornecer o inventário do site antigo: URLs, títulos, descrições, conteúdos, arquivos, direitos de uso e vínculos. A origem antiga fica em `legacyOrigin`; deve ser uma origem HTTPS completa, sem credenciais, caminho, query, fragmento ou barra final. O importador não rastreia nem altera o site antigo.

Cada URL incluída no lote recebe uma decisão:

| Decisão    | Destino e efeito                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `keep`     | `targetPath` igual a `sourcePath`; a rota precisa existir no conjunto público validado.                                                                                        |
| `redirect` | `targetPath` interno diferente da origem; preparar redirecionamento permanente 301 e validar o grafo completo.                                                                 |
| `remove`   | `targetPath: null` e referência obrigatória em `removalApproval`; registrar a retirada aprovada no inventário. Não excluir conteúdo ou arquivos do site antigo nem do destino. |

Os caminhos seguem a política de [redirects.ts](../apps/api/src/cms/redirects.ts): ASCII, até 500 caracteres, sem query, fragmento, percent encoding, barras duplicadas, barra final fora de `/`, segmentos `.`/`..` ou prefixes privados (`api`, `admin`, `preview`, `_next`, `media`). O lote deve registrar incompatibilidades antes da importação; não transformar URLs diferentes no mesmo caminho silenciosamente. `assetPaths` registra caminhos de arquivos do inventário, sem transferir seus bytes.

Verificar ciclos, fontes duplicadas, colisões com URLs atuais e existência do destino público final. Um slug no banco não cria automaticamente um template Next. As páginas institucionais aceitas neste lote são `home`, `o-escritorio`, `privacidade` e `cookies`; contato é um fluxo próprio. Demais destinos precisam corresponder às rotas públicas existentes de listagem ou detalhe.

## Contrato do lote

O contrato validado está em [migration-contract.ts](../apps/api/src/release/migration-contract.ts). O arquivo de entrada é JSON, com campos desconhecidos rejeitados.

| Campo           | Regra                                                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | `1`.                                                                                                                              |
| `batchId`       | UUID estável do lote; conservar a identidade ao reexecutar o mesmo lote.                                                          |
| `fixture`       | `true` somente para conteúdo explicitamente fictício em desenvolvimento isolado. Um lote fixture nunca fica pronto para produção. |
| `legacyOrigin`  | Origem HTTPS do inventário. Em fixtures, usar uma origem fictícia explicitamente identificada.                                    |
| `approval`      | `null` para fixture; lote real exige `{ reference, reviewer, approvedAt }`.                                                       |
| `records`       | De 1 a 1.000 registros tipados; IDs estáveis e únicos.                                                                            |
| `urls`          | Até 2.000 decisões do inventário; não representam prova de que o inventário está completo.                                        |

`approvedAt` é um instante UTC ISO 8601 terminado em `Z`, sem data futura. `reference` aponta para a aprovação documental rastreável; `reviewer` identifica o responsável pela revisão. Um objeto preenchido registra uma declaração e precisa corresponder à aprovação efetivamente obtida. Não inserir segredos ou dados de clientes nesses campos. A aprovação jurídica e profissional pertence ao responsável do escritório.

Cada registro contém `kind`, `id` e `data`. O ID é UUID, exceto settings, que usa `site`. `data` segue os DTOs atuais de [dto.ts](../apps/api/src/domain/dto.ts), sem campos internos como `isMock`, `version`, credenciais ou timestamps administrativos.

| `kind`            | Conteúdo e vínculos                                                                    |
| ----------------- | -------------------------------------------------------------------------------------- |
| `category`, `tag` | Nome, slug e ativação de taxonomia.                                                    |
| `practiceArea`    | Dados de área, descrição TipTap e serviços.                                            |
| `professional`    | Biografia TipTap, formação, experiência, foto preexistente e IDs das áreas.            |
| `article`         | Conteúdo TipTap, tipo, autor profissional, taxonomias/áreas, mídia preexistente e SEO. |
| `page`            | Template institucional permitido, seções estruturadas e SEO.                           |
| `faq`             | Pergunta, resposta TipTap e área opcional.                                             |
| `settings`        | Configuração pública administrável; singleton `id: "site"`.                            |

Somente `article` e `page` recebem também `status` (`DRAFT`, `PUBLISHED` ou `ARCHIVED`) e `publishedAt`. Publicado exige instante UTC válido e não futuro; draft/archived exige `publishedAt: null`. O lote não aceita agendamento. Os demais tipos não recebem esses campos. O autor profissional público e o usuário administrativo operador são identidades distintas.

Slugs usam minúsculas ASCII e hífens, até 120 caracteres. O lote conserva UUIDs dos relacionamentos; resolver cada vínculo contra registros aceitos do próprio lote ou do destino, sem importar identidades administrativas. Conteúdo e seções seguem o schema seguro atual de TipTap, inclusive limites e bloqueio de protocolos/tipos perigosos. Não converter HTML legado sem revisar o documento resultante.

## Dry-run e aplicação

Os comandos abaixo devem ser executados no checkout real. Substituir os parâmetros indicados por caminho, operador, hash e nome do banco efetivamente revisados; eles não são exemplos de aprovação. A conexão permanece no ambiente seguro do processo e nunca aparece no lote ou no relatório.

```powershell
rtk proxy pnpm migration:plan --batch 'CAMINHO_DO_LOTE_JSON' --actor 'UUID_DO_OPERADOR'
```

O planejamento é o padrão e não escreve no banco. Validar contrato, operador, relações, mídia preexistente, colisões e redirects contra o destino. Revisar o relatório sanitizado e seu digest SHA-256 antes de aplicar. O digest identifica o conteúdo JSON canônico; `batchSha256` do checklist deve conservar esse mesmo valor, e não o hash dos bytes do arquivo formatado.

Caminhos de arquivos são relativos à raiz do checkout ou absolutos. Os scripts não carregam `.env` automaticamente: a conexão e as flags devem estar no ambiente seguro do processo. `--offline` valida somente contrato/digest, com `databaseChecked=false`; não equivale ao dry-run PostgreSQL.

```powershell
rtk proxy pnpm migration:apply --batch 'CAMINHO_DO_LOTE_JSON' --actor 'UUID_DO_OPERADOR' --confirm-sha256 'SHA256_DO_LOTE_REVISADO' --confirm-database 'NOME_DO_BANCO_ISOLADO_REVISADO'
```

A aplicação requer confirmação explícita do digest e do nome do banco. Em produção, exige também `F9_IMPORT_APPROVED=true` configurado no processo autorizado; essa flag não concede autorização humana nem substitui a revisão. Fixtures ficam limitadas a desenvolvimento isolado. Não apontar o ensaio ao banco persistente de desenvolvimento nem ao banco do site antigo.

A carga é transacional e cria o conjunto revisado, sem sobrescrever conteúdo existente do CMS. IDs/slugs conflitantes são falhas revisáveis. Settings é singleton: conferir previamente seu estado estrutural e o procedimento aceito, sem usar a importação para substituir configuração administrada. Uma falha invalida a transação; não aceitar uma lista parcial como migração concluída.

Settings pode ser criado ou receber sua primeira configuração somente sobre a estrutura vazia da seed de produção: `siteName` vazio, `isMock=false`, contatos nulos, `address={}` e `socialLinks=[]`. Configuração populada gera conflito. Nenhuma outra entidade existente é atualizada pelo importador.

O recibo persistido registra identidade/digest do lote e auditoria. A reexecução deve reconhecer o lote já aplicado sem duplicar registros; mudar o conteúdo mantendo o mesmo `batchId` exige revisão de conflito. O relatório retorna contagens, índices e códigos estáveis de falha; não imprimir conteúdo, contatos pessoais, conexão, segredos ou bytes.

O recibo também conserva hash do snapshot persistido, incluindo versões/vínculos e redirects. Alteração posterior pelo CMS é preservada pela reexecução e bloqueia a release com `IMPORTED_BATCH_DRIFT`; recibo ausente ou incompatível gera `IMPORT_RECEIPT_UNVERIFIED`. Revisar o material alterado e preparar novamente uma candidata isolada com lote atualizado, sem usar replay para desfazer uma edição administrada.

Não transportar usuários, senhas, sessões, tokens de preview, contatos, assinantes, anexos privados, tarefas pendentes ou credenciais. O operador deve existir no destino com permissões verificadas. O provisionamento do primeiro ADMIN continua no procedimento de [database.md](database.md).

## Preparação da mídia

O lote referencia mídia previamente carregada e validada no destino. Não copia arquivos nem acessa URLs arbitrárias. Fotos, logo, imagens e PDFs precisam de material aprovado, origem/licença, alt pertinente e conferência de referência pública. Anexos de contato permanecem privados e fora da migração editorial.

A validação de relacionamento no banco não comprova objeto presente no bucket, igualdade de bytes, direitos de uso ou recuperação. A evidência `mediaIntegrity` deve registrar a inspeção dos objetos e hashes do conjunto aprovado, no ambiente final isolado. Completar a verificação real de storage e recuperação em conjunto com os gates de fornecedores/backup da F8.

## Gate verificável contra mocks e preparação da candidata

```powershell
rtk proxy pnpm release:check --checklist 'docs/release-checklist.json' --batch 'CAMINHO_DO_LOTE_JSON'
```

O gate é somente leitura: verifica contrato do checklist/lote, evidências declaradas, registros do banco e placeholders em código. `MOCK_CONTENT=false` sozinho não certifica limpeza. Conferir `isMock` de conteúdos, configurações, usuários, mídia e dados de relacionamento, inclusive registros inativos/rascunhos. Procurar marcadores de ficção, contas de teste e ativos de demonstração também em registros desmarcados.

Sem `--http`, o comando registra `CANDIDATE_HTTP_UNVERIFIED` e mantém `ready=false`. Com `--http`, exige configuração de produção consistente com o domínio final e acessa somente essa origem, sem seguir redirects nem enviar credenciais. Verifica todos os caminhos públicos projetados, canonical, robots, status200, títulos, h1 e material fictício, além de comparar sitemap ao catálogo indexável de produção. Os mapeamentos do lote exigem 301 com Location aprovado ou 404/410 na retirada. Limites: 2MB por resposta, timeout10s por requisição e até10000 caminhos públicos. As verificações de formulário, mídia real, acessibilidade e fornecedor dependem de evidências próprias. Uma árvore Git alterada bloqueia o gate com `WORKTREE_DIRTY`. O gate não ativa indexação nem simula flags para obter sucesso.

Fixtures nunca são candidatas prontas. Um teste local pode comprovar que o mecanismo reconhece/rejeita mocks; não comprova limpeza de produção. Busca e sitemap da API excluem mocks em produção, mas a ausência nesses resultados não prova que o banco e a leitura pública direta estejam limpos.

O checklist usa `schemaVersion: 1`, versão da candidata, `commit` identificado, `batchSha256` e `finalOrigin` HTTPS do domínio final. Aprovações e evidências pendentes ficam `null`; quando obtidas, recebem `{ reference, reviewer, approvedAt }`. Preencher somente com documentos e verificações realmente existentes.

| Grupo                                | Revisão exigida                                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `approvals.content`                  | Textos, fotos, logo, publicações e apresentação visual aprovados.                                                        |
| `approvals.migration`                | Lote, inventário, destinos/301 e retiradas aprovados.                                                                    |
| `approvals.privacyRetention`         | Políticas, consentimento, CTAs e retenção aprovados.                                                                     |
| `approvals.professionalPresentation` | Biografias, formação, experiência e apresentação profissional aprovadas pelo responsável.                                |
| `evidence.f8`, `ci`, `providers`     | Aceite F8, CI do commit e integrações reais no ambiente autorizado.                                                      |
| `evidence.backupRestore`             | Backup/recuperação efetivamente testados e política operacional aprovada.                                                |
| `evidence.accessibility`, `seo`      | Revisão dos fluxos/templates, browsers e lacunas; canonical/robots/sitemap do domínio final.                             |
| `evidence.mediaIntegrity`, `forms`   | Objetos/bytes/hashes/aprovação da mídia e fluxos completos de contato/newsletter/recuperação.                            |
| `operations`                         | Responsável, janela de corte, responsável pelo rollback, hosting e orçamento; aprovação explícita de DNS antes do corte. |

`candidatePaths` começa vazio. As URLs futuras representam a superfície HTTP candidata a verificar; não autorizam acesso, publicação ou ativação automática nesta entrega. Comparar páginas e metadata reais da candidata com o lote aprovado, testar redirects e ausência de conteúdo/ativos fictícios. Separar resultados de uma projeção local dos checks HTTP executados no ambiente de produção autorizado.

O `sitemap.xml` da web fica vazio quando a indexação está desabilitada e fora de produção. Esse resultado local é esperado, mas não serve como prova de sitemap final limpo. Não habilitar indexação/analytics nem trocar configuração para produção apenas para obter sucesso no gate.

### Bloqueadores de apresentação presentes na base

Home e escritório usam `PlaceholderArtwork` diretamente em [home-view.tsx](../apps/web/src/components/institutional/home-view.tsx) e [office-view.tsx](../apps/web/src/components/institutional/office-view.tsx). A legenda padrão em [hero.tsx](../apps/web/src/components/site/hero.tsx) informa “Ilustração de demonstração · imagem substituível”. Perfis sem foto exibem “Retrato em preparação”; cards sem foto exibem “Retrato de demonstração”. Esses ativos precisam de substituição/revisão aprovada antes da release, mesmo com banco sem registros `isMock`.

Placeholders legítimos de campos de formulário não são material fictício. O gate deve identificar os ativos/legendas de demonstração pertinentes sem tratar todo atributo HTML `placeholder` como bloqueador. Não ocultar marcadores para produzir uma aprovação técnica nem preencher mídia/biografia com conteúdo inventado.

## Corte e rollback revisáveis

Antes da F10, fechar escopo da candidata e registrar materiais, inventário, commit/digest, domínio, hosting, orçamento e responsáveis. Definir janela de congelamento do site antigo, backup verificável, sequência de implantação, smokes, critério de aborto, responsável pelo rollback e comunicação do resultado.

A sequência prevista é migrations compatíveis → carga estrutural e lote aprovado → API/worker/readiness → web → smoke controlado → corte de DNS/tráfego explicitamente autorizado. Reverter código não desfaz migration; documentar compatibilidade de schema e recuperação de banco/objetos. A decisão `remove` do inventário não substitui esse plano operacional.

Nenhum script da F9 publica a web/API, cria contas externas, envia sitemap, habilita indexação, altera DNS ou executa rollback de produção. Os procedimentos e gates operacionais restantes estão em [deployment.md](deployment.md) e [operations.md](operations.md).
