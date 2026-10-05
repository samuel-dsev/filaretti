# Filaretti Advocacia — situação atual e relatórios

## Situação atual

| Campo              | Estado                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Última atualização | 05/10/2026 — RP-012                                                                                        |
| Etapa              | **Testes manuais locais iniciados; F8/F9/F10 parciais nos aceites externos**                               |
| Versão             | `0.10.0`, oito manifests privados alinhados; V1 `1.0.0` não publicada                                      |
| Git                | `dev`; F10 confirmada em `e03f71f3259081259aed4d7d974cbd4ff64373b3`; commit documental previsto no RP-012  |
| Autorização        | Localhost, testes manuais, revisão visual e conteúdo real local; ações externas permanecem pendentes       |
| Checkpoint         | Receber relatos de bugs, referências visuais e materiais reais aprovados; corrigir a base incrementalmente |

Este documento distingue implementação, validação e pendências externas. Atualizar em cada entrega; preservar o histórico. Datas informadas ao usuário seguem America/Sao_Paulo; este fechamento usa a data 05/10/2026 do cliente, com timestamps UTC originais nas evidências.

## Histórico

### RP-012 — 05/10/2026 — Ambiente para testes manuais locais

**Escopo autorizado:** iniciar o sistema em localhost e informar a porta antes dos testes do usuário, com continuidade para correções, revisão de estilização e inserção de materiais reais fornecidos/aprovados. Esta entrega inicia o ambiente; nenhum material real foi recebido/inserido e nenhum ajuste visual foi solicitado em detalhe.

**Estado/versão/Git:** ambiente local disponível, versão `0.10.0` preservada. Checkout `C:\Users\Samuel\Documents\Projetos\Filaretti`, branch `dev` inicialmente limpa, F10 confirmada em `e03f71f3259081259aed4d7d974cbd4ff64373b3`. Commit documental previsto: `docs: registra inicio dos testes manuais locais`. F8/F9/F10 permanecem parciais nos aceites externos.

**Execução:** processos API/Next antigos nas portas 3001/3000 foram identificados pelo caminho deste checkout e data de início anterior aos builds atuais; somente esses dois processos foram encerrados. `rtk proxy pnpm dev` iniciou Next/Turbopack e API/tsc-watch, permitindo atualização automática nas próximas edições. Serviços permanecem ativos ao entregar os links. Nenhum serviço de outro projeto, banco ou volume foi encerrado/removido. PostgreSQL existente `filaretti-local-postgres-1` permanece saudável em `127.0.0.1:5434`.

**Endereços:** site `http://localhost:3000`; CMS `http://localhost:3000/admin/login`; API `http://127.0.0.1:3001`. A origem configurada de web/API é `http://localhost:3000`; usar essa origem no navegador para as mutações do CMS. Configuração local validada sem imprimir segredos: development, bind loopback, integrações simuladas e R2/Resend/Turnstile externos desabilitados. Conta ADMIN fictícia e senha pública de teste continuam documentadas em `docs/database.md`.

**Validação atual:** Compose confirmou PostgreSQL saudável; compilação API em watch e Next dev iniciaram; HTTP 200 em readiness (`database=up`), Home, login e contato. Edge headless real validou preenchimento/login pelo BFF e chegada ao Dashboard, com zero erros JavaScript capturados nesse fluxo. Esta verificação de disponibilidade não repete a suíte de QA nem substitui os testes manuais que o usuário vai realizar.

**Arquivos:** alterados somente `plan.md` e `relate.md` para checkpoint/histórico. Nenhum arquivo versionável criado/removido, código ou configuração da aplicação alterados; nenhum seed/migration/carga de conteúdo executado. Prettier e diff-check executados no fechamento documental. Subagentes não foram necessários para esta inicialização operacional simples.

**Retomada:** receber os bugs e escolhas visuais do usuário e corrigir incrementalmente nesta base. Inserir conteúdo real local conforme materiais fornecidos/aprovados, sem inventar biografias/contatos/políticas. E-mails e antispam permanecem simulados neste ambiente. Publicação, fornecedores reais, produção, carga externa, DNS e push/PR continuam pendentes de alvo/autorização aplicáveis.

### RP-011 — 05/10/2026 — F10 local e revisão completa F0–F10

**Escopo autorizado:** “continue a implementação f10 do projeto, apos, faça uma revisão completa se todas as fases foram implementadas corretamente”. A F9 local já estava commitada; nenhum trabalho F10 existia. O pedido autoriza a preparação F10 independente e a revisão/correção das fases anteriores. Ambiente de produção, materiais/lote aprovados e evidências F8/F9 ainda não foram fornecidos; a pergunta de referências desta retomada permanece sem resposta. Nenhuma aprovação externa foi inferida. **Estado: implementação/revisão local verificadas; F8–F10 parciais nos aceites externos.**

**Versão:** `0.9.0` → `0.10.0`, oito manifests privados alinhados; `docs/release-checklist.json` acompanha a versão local. `1.0.0` permanece o alvo operacional, sem publicar/registrar falsa conclusão de produção. Nenhuma dependência, schema ou migration aplicada alterada; lockfile preservado.

**Git/cwd:** `C:\Users\Samuel\Documents\Projetos\Filaretti`; pasta inicial `Projeto` ausente. `dev` inicialmente limpa; commit F9 real `fff682d0a60f7c95fb7f927d1d3e6812f91695fd`, confirmado no Git. Commit previsto: `feat(operations): prepara F10 e corrige revisao das fases (v0.10.0)`. SHA informado após commit e registrado na próxima retomada, conforme AGENTS. Nenhum push/PR/deploy/DNS/carga real/envio externo.

#### Implementação e revisão

- Gate operacional **offline/somente leitura**, treze etapas sequenciais e schema estrito. Verifica commit/versão, bytes do arquivo de artefato por SHA-256, manifesto de produção, origem HTTPS, lote, timestamps, janela de corte, responsáveis, escopos documentais e reports F9 controlados/públicos por digest. Recusa build QA development/mocks e checkout `0.10.0` como V1 `1.0.0`. `actionAuthorized=false` sempre; referências identificam registros do operador, sem autenticar documentos ou conceder permissão.
- Histórico incompleto/falho bloqueia conclusão; falha com mutações registradas exige rollback. Recibo de recuperação válido termina `rolled-back` e `ready=false`; identidade/pré-requisitos inválidos não viram prova de recuperação. Não executa deploy, DNS, banco, restore, rede, scheduler ou e-mail. CLI não lê `.env` automaticamente; entrada JSON limitada a 1 MB e artefato regular a 5 GB.
- Gate F9 diferencia `--phase controlled` e `--phase public` (padrão compatível). Controlado exige `SEO_INDEXING_ENABLED=false`, sitemap vazio, robots bloqueado sem Allow/agent que o contorne e noindex; público exige `SEO_INDEXING_ENABLED=true` e catálogo indexável exato depois do corte. Reports conservam fase, timestamp, origem, versão, commit e lote. Proteção de acesso e fluxos reais mantêm evidências próprias.
- Revisão completa por subagentes backend/frontend/operação e integração principal. **Seis defeitos confirmados/corrigidos:** mocks residuais em leituras/relações/mídia públicas de produção; gate exigindo indexação antes do corte; CTA newsletter obsoleto; políticas retiradas com status incorreto após streaming; indisponibilidade seguida de 401 preservando erro de sessão; cópia de link sem evento de compartilhamento consentido. Testes de regressão confirmam comportamento e preservam fixtures administrativos/locais.
- Manual CMS, procedimentos de manutenção/publicação/rollback, templates sem aprovação inventada e matriz por fase entregues. F0–F7 têm implementação local prevista; F8–F10 continuam parciais. Placeholders visuais ficam preservados até material oficial, identificados pelo gate; nenhum conteúdo/biografia/política/direito de mídia real foi inventado.

#### Arquivos criados, alterados e removidos

Criados (12):

- `apps/api/scripts/operations-check.ts`
- `apps/api/src/release/operations-gate.ts`
- `apps/api/test/operations-gate.test.ts`
- `apps/api/test/production-public.integration.test.ts`
- `apps/web/test/f8-policy-routing.test.mjs`
- `apps/web/test/f8-session.test.tsx`
- `apps/web/test/f8-share-links.test.tsx`
- `docs/cms-handbook.md`
- `docs/go-live-plan.template.json`
- `docs/go-live.md`
- `docs/phase-review.md`
- `docs/release-artifact.template.json`

Alterados (29): `README.md`; `package.json`; `plan.md`; `relate.md`; `apps/api/package.json`; `apps/api/scripts/release-check.ts`; `apps/api/src/cms/media.service.ts`; `apps/api/src/domain/articles.service.ts`; `apps/api/src/domain/institution.service.ts`; `apps/api/src/domain/shared.ts`; `apps/api/src/release/candidate-http.ts`; `apps/api/test/release-evidence.integration.test.ts`; `apps/web/package.json`; `apps/web/src/components/admin/session.tsx`; `apps/web/src/components/editorial/share-links.tsx`; `apps/web/src/components/institutional/shared.tsx`; `apps/web/src/lib/public-routing.ts`; `apps/web/test/public-routing.test.mjs`; `docs/api.md`; `docs/deployment.md`; `docs/migration.md`; `docs/release-checklist.json`; `docs/security.md`; os cinco `packages/{config,eslint-config,tsconfig,types,ui}/package.json`; `scripts/test-f8.mjs`.

Removidos: nenhum. Nenhuma alteração em AGENTS, migrations/schema, lockfile, env real ou workflows. Evidências/builds e tipos Next são ignorados; o typecheck web direto após o QA regenera os imports de tipos do build normal. Bancos/volumes de desenvolvimento e serviços de outros projetos preservados.

#### Validação

| Check                                          | Resultado                                                                                                                                                                                                |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`               | Aprovado antes/depois do bump; nenhuma dependência/lockfile alterado.                                                                                                                                    |
| `pnpm lint` / `pnpm typecheck`                 | Aprovados; TypeScript estrito inclui tools/tests. Typecheck web direto também aprovado após os runners.                                                                                                  |
| `pnpm build`                                   | API/pacotes e web otimizada aprovados; web com `APP_ENV=development`, artefato local não promovível.                                                                                                     |
| `pnpm test`                                    | 110 aprovados: 12 config, 63 web Node, 9 RTL, 4 fundação HTTP, 15 F10 e 7 Jest; zero falhas/skips.                                                                                                       |
| `pnpm test:integration`                        | 100 aprovados, zero skips, PostgreSQL 17 real; quatro migrations, seeds, auth/roles, workers, importação e mocks de produção. Primeira rodada com 96 testes passou antes da regressão backend adicional. |
| `pnpm test:design-system`                      | 44 combinações de contraste aprovadas.                                                                                                                                                                   |
| `pnpm test:recovery`                           | Seis checks aprovados: snapshot AES-GCM, restore PostgreSQL real em banco novo, arquivos públicos/privados, chave/adulteração/traversal/overwrite.                                                       |
| `pnpm audit --prod --audit-level=high`         | Nenhuma vulnerabilidade conhecida reportada.                                                                                                                                                             |
| `pnpm test:f8 --skip-lighthouse`               | 88 checks, 248 layouts, 115 análises axe, zero falhas/violações automáticas; Edge e Chrome reais locais. Cleanup integral.                                                                               |
| `pnpm test:cms`                                | 25 checks/81 layouts aprovados; login/editor/upload/preview/publicar/retirar/conflito/roles, URLs e reinício reais locais. Cleanup integral.                                                             |
| `pnpm test:relationship`                       | 19 checks/70 layouts aprovados; contato/anexo, confirmação/descadastro/reset, busca/consentimento e ADMIN/CSV reais locais. Integrações simuladas explicitamente. Cleanup integral.                      |
| Gate F9 offline controlled                     | `ready=false`/exit 1 esperado: fixture, materiais/aprovações/evidências, placeholders e HTTP/runtime ausentes.                                                                                           |
| `pnpm go-live:check --offline`                 | `ready=false`, `status=blocked`, `actionAuthorized=false` e `nextStep=candidateApproved`; ausência de artefato/ambiente/evidências bloqueia corretamente.                                                |
| Prettier / `format:check` / `git diff --check` | Aprovados no fechamento; staging explícito dos 41 arquivos revisados.                                                                                                                                    |

**Browser e evidências:** `.local/f8-layout-smoke.json` final, iniciado em `2026-10-05T16:46:52.646Z` e concluído em `2026-10-05T16:51:33.891Z`; 248 layouts, 115 análises axe e 71 grupos incompletos conservados. Edge 154.0.4258.53 cobre 225 layouts nas cinco larguras (375/768/1024/1440/1920); Chrome 154.0.8037.93 cobre 23 a 1440 px. Principal inspecionou 11 capturas atuais de Home/escritório/artigo/políticas/login/dashboard, cobrindo as cinco larguras e viewport real. Não equivale a inspeção humana de todos os 248 layouts nem certificação WCAG. Relatórios CMS/relacionamento/recuperação em `.local/f6-qa-smoke.json`, `.local/f7-qa-smoke.json` e `.local/f8-recovery.json`; screenshots em seus diretórios próprios. Todos os runners encerraram apenas recursos que criaram, com cleanup aprovado.

**Limites:** Lighthouse não foi reexecutado nesta revisão; as 54 medições RP-009 são históricas e não são atribuídas à versão 0.10.0. Firefox/WebKit compatíveis, Safari/macOS, Android/iOS físicos e leitor de tela continuam não executados. Axe incompleto requer revisão humana. ClamAV real RP-009 não foi repetido; protocolo/fail-closed e indisponibilidade passam nos testes atuais, sem comprovar scanner/definições/serviço externos atualizados. Sentry não está implementado; monitor/destino operacional externo não configurado. Warning preexistente de concorrência do driver pg permanece documentado, sem alegar compatibilidade pg 9.

A primeira execução F8 desta revisão registrou 88 checks/248 layouts e uma falha do novo teste: o helper `request` esperava HTTP 200 por padrão e recusou o 404 correto da política retirada antes da asserção. Corrigido para esperar HTTP 404; relatório anterior preservado em `.local/f10-layout-before-fixture-fix.json`, sem alterar o produto para satisfazer o teste. A segunda rodada completa passou integralmente. Os primeiros typecheck/build também encontraram tipagens no gate/teste enquanto os arquivos eram estabilizados; corrigidas e checks repetidos. Não ocultar rodada ou declarar falha como aprovação.

**Retomada:** obter inventário/materiais/aprovações, ambiente/domínio/hosting isolados e evidências F8/F9. Concluir candidata `1.0.0`, backup/rollback e ações externas específicas somente com os gates de `plan.md`. Produção pública, integrações reais, Search Console e observação operacional não comprovadas; última fase com aceite integral permanece F7. F10 local entregue/revisada e commit local previsto acima, sem push/PR/deploy/DNS.

### RP-010 — 05/10/2026 — F9 — Migração e gates da release locais

**Escopo autorizado:** “Continue a implementação da F9 do projeto”. O checkout ainda estava em F8 local, sem implementação anterior da F9. O pedido atual autoriza os mecanismos F9 independentes, preservando as pendências da homologação F8 e os gates de materiais/ambiente/carga real. **Estado: entrega técnica local; F9 permanece parcial até inventário, lote, aprovações e candidata oficiais.**

**Versão:** `0.8.0` → `0.9.0`, oito manifests privados alinhados. Nenhuma dependência adicionada, schema/migration alterada ou interface pública modificada. O build da web reutiliza a base existente. Não iniciar F10 por consequência desta entrega.

**Git/cwd:** `C:\Users\Samuel\Documents\Projetos\Filaretti`, branch `dev`, inicialmente limpa, três commits à frente de `origin/dev`. Commit F8 real confirmado: `222f61ec8e4ec13dcf3a6e8da6d26c8305c9f697`. Nenhuma branch/repositório adicional criado. Commit previsto: `feat(release): prepara migracao e gates locais da F9 (v0.9.0)`; SHA informado após commit e registrado na próxima retomada. Push, PR, carga real, contas externas, deploy e DNS não executados.

#### Arquivos criados, alterados e removidos

Criados (15):

- `apps/api/scripts/migration.ts`
- `apps/api/scripts/release-check.ts`
- `apps/api/src/release/candidate-http.ts`
- `apps/api/src/release/markers.ts`
- `apps/api/src/release/migration-contract.ts`
- `apps/api/src/release/migration-importer.ts`
- `apps/api/src/release/release-evidence.ts`
- `apps/api/src/release/release-gate.ts`
- `apps/api/test/fixtures/migration-batch.json`
- `apps/api/test/migration.integration.test.ts`
- `apps/api/test/release-evidence.integration.test.ts`
- `apps/api/test/release-gate.integration.test.ts`
- `docs/migration.md`
- `docs/migration-batch.template.json`
- `docs/release-checklist.json`

Alterados (14): `README.md`, `docs/database.md`, `docs/deployment.md`, `plan.md`, `relate.md`, `apps/api/prisma/tsconfig.json`, `package.json`, `apps/api/package.json`, `apps/web/package.json`, `packages/config/package.json`, `packages/types/package.json`, `packages/ui/package.json`, `packages/eslint-config/package.json` e `packages/tsconfig/package.json`.

Removidos: nenhum. Schema, migrations aplicadas e lockfile preservados. Builds/dist-test e recursos dos ensaios são locais/ignorados; bancos temporários próprios são removidos pelos runners. Dados/volume de desenvolvimento não são resetados.

#### Implementação, decisões e limites

- **Lote:** schema versionado com limite de tamanho/quantidades, campos desconhecidos rejeitados, IDs/slugs/vínculos validados pelos DTOs e TipTap atuais. Somente conteúdo/taxonomias/FAQ/settings; publicação explícita UTC, sem agendamento. Não importar usuários, senhas, contatos, assinantes, sessões, tokens, outbox ou bytes de mídia. Páginas precisam de template realmente renderizado.
- **Inventário:** origem HTTPS, títulos/descrições e caminhos de ativos; decisões keep, redirect301 ou retirada com referência. Não rastreia/alterar o site antigo. Query, percent encoding, trailing slash e formatos incompatíveis precisam de revisão explícita. O template começa vazio, sem inventar o site antigo ou aprovação.
- **Importação:** dry-run padrão e READ ONLY; apply requer ADMIN ativo, ambiente compatível, confirmação SHA-256/nome do banco e conferência `current_database()`. Fixture só em banco descartável do runner; produção exige flag adicional em processo autorizado. Essa flag não concede autorização humana. Trava6006001 compartilhada com CMS e transação Serializable. IDs/slugs existentes geram conflito; única exceção é singleton settings estrutural integralmente vazio. Falha reverte todo lote. Recibo em audit conserva digests; replay conserva edições do CMS e não duplica registros.
- **Congelamento:** snapshot de registros/vínculos/versões/datas/redirects aprovado pela importação. Gate recusa recibo ausente/digest diferente ou edição posterior, sem desfazer a edição. Material alterado requer nova revisão/candidata isolada. Digests identificam conteúdo JSON canônico e não aprovam material por si mesmos.
- **Mocks:** flags de produção, doze modelos `isMock` paginados por200 e marcadores textuais/links/contas/metadata; JSON profundo/cíclico/grande falha fechado. Validação editorial, quatro páginas obrigatórias, ADMIN, settings, mídia pública/privada/local/alt/origem/licença e redirects sem loops/sombra/destino privado. Relatórios contêm apenas códigos/recursos/contagens/índices, sem segredos ou dados pessoais. Não escolhe quais mocks apagar; desenvolvimento mantém seus fixtures.
- **Release:** checklist de commit/digest/domínio/aprovações/evidências/responsáveis/hosting/orçamento/janela/rollback/DNS começa pendente. Git alterado, configuração incoerente, placeholders estáticos, fixture, falta de evidência, snapshot alterado e HTTP não executado bloqueiam `ready`. Aprovações declaradas no JSON precisam corresponder a documentos reais; não são assinaturas nem validação jurídica automática.
- **HTTP:** mecanismo verifica HTTPS da origem final configurada, sem credenciais/redirect-following, limites/timeout, URLs públicas, canonical, indexação, título/h1, ausência de ficção e sitemap exato comparado ao catálogo API. Mapeamentos exigem 301/Location aprovado ou retirada404/410. Catálogo distingue rotas renderizadas de URLs indexáveis. Fixture de HTTP usa servidor próprio em loopback; nenhum host externo é consultado neste ensaio. Formulários/bytes/buckets/fornecedores têm evidências externas próprias.
- **Apresentação:** Home/escritório ainda usam `PlaceholderArtwork`; perfis/cards têm fallback demonstrativo. Gate os aponta explicitamente, preservando o trabalho visual até receber mídia aprovada. Não confundir atributo HTML de formulário com ativo de demonstração.
- **Equipe:** subagente de revisão/QA documentou contratos e escreveu integração; subagente de gate implementou scanner/ensaios isolados. Principal integrou, corrigiu o código, revisou falhas e executou checks. Arquivos tiveram responsáveis distintos; nenhum agente fez ação externa/commit independente.

#### Validação

| Check                            | Resultado                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout/branch/base             | `dev` limpa sobre `222f61e`; checkout real confirmado                                                                                 |
| `pnpm install --frozen-lockfile` | Passou; lockfile preservado                                                                                                           |
| `pnpm lint`                      | Passou; primeira rodada encontrou variável não usada, corrigida                                                                       |
| `pnpm typecheck`                 | Passou; inclui scripts CLI no tsconfig de ferramentas                                                                                 |
| `pnpm build`                     | Passou; API/pacotes e web otimizada local                                                                                             |
| `pnpm test`                      | 89 aprovados: 12 configuração, 60 web Node, 6 Vitest/RTL, 4 fundação HTTP e 7 Jest                                                    |
| `pnpm test:integration`          | 95 aprovados, zero falhas/skips; PostgreSQL17 real, migrations/seeds, importação/rollback/recibo/drift, mocks e projeção sitemap      |
| HTTP F9 complementar             | 4 casos dirigidos aprovados após incluir 301/Location e retirada404/410; servidor loopback, sem candidata externa                     |
| `migration:plan --offline`       | Passou: fixture6 registros/2 URLs, `databaseChecked=false`; digest `c4203c1b6e3be92c00a15657daf099da8bb810b173570cd2439cbdc9eb2be179` |
| `release:check --offline`        | Bloqueou corretamente com `ready=false`/exit1: fixture, evidências, placeholders e runtime não verificado                             |
| Formatação/diff                  | Prettier nos arquivos da entrega, `format:check` e `git diff --check` aprovados no fechamento                                         |

A primeira integração funcional tinha94 testes,89 aprovados e5 falhas contabilizando testes pais. Corrigido prefixo de `/conteudos/` que impedia detectar redirect encobrindo artigo publicado. Duas fixtures tentavam violar constraints já corretas do banco (URL pública em mídia privada e redirect externo): testes passaram a confirmar a rejeição e a inspecionar estados permitidos, com cleanup em finally. Datas participam do snapshot canônico; teste adicional verifica mudança de publishedAt e restauração somente da fixture própria. A rodada final de95 casos passou integralmente. O warning preexistente do driver pg sobre consultas concorrentes continua documentado; não representa falha nem prova compatibilidade com pg9.

#### Pendências e ponto exato de retomada

1. Obter URL/inventário completo do site antigo e materiais oficiais aprovados; a pergunta desta retomada ainda não teve resposta. Não inventar títulos, biografias, logo, fotos, contatos ou políticas para preencher o lote real.
2. Fechar homologação F8: fornecedores/storage/scanner/ingress/TLS/worker, CI remoto, backups/restauração/alertas, browsers/dispositivos/leitor de tela e SEO. A F8 permanece parcial; os checks F9 locais não substituem esses aceites.
3. Preparar/revisar lote e mapeamentos reais, mídia com bytes/hashes/direitos/alt, substituir apresentação demonstrativa e preencher referências de aprovação/evidência somente após obtidas.
4. No ambiente isolado explicitamente autorizado, provisionar ADMIN/seed estrutural, executar dry-run, revisar digest e executar carga aprovada; verificar snapshots, formulários, HTTP/canonical/robots/sitemap/301/retiradas reais e registrar artefato do commit.
5. Aprovar plano de corte, responsável, hosting/orçamento, janela, backup e rollback. Somente depois solicitar autorização específica F10 para produção/carga/DNS/corte.

**Ponto de parada:** F9 local em`0.9.0`; F8 e F9 permanecem parciais nos aceites externos. Última fase com aceite integral continua F7. Nenhum deploy/push/PR/DNS/carga real/envio externo realizado. Aguardar informações/aprovações para continuar a parte dependente; F10 não iniciada.

### RP-009 — 05/10/2026 — F8 — Entrega local; homologação parcial

**Escopo autorizado:** “Prossiga para a F8”, em 04/10/2026; retomada “continue de onde parou” em 05/10/2026, conforme data do cliente. Evidências conservam seus timestamps UTC originais. **Estado: trabalho técnico local entregue e verificado; F8 permanece parcial até os gates externos e de acessibilidade/compatibilidade.** F9 não iniciada.

**Versão:** `0.7.0` → `0.8.0`, oito manifests privados alinhados. Jest, Vitest/React Testing Library, Playwright, axe e Lighthouse fixados no lockfile. `@parcel/watcher` tem build opcional explicitamente negado; exceções de idade mínima para dependências jsdom fixadas foram registradas no workspace. Install frozen e audit de produção aprovados. A mudança compatível em 0.x exige ingress HMAC, URLs públicas HTTPS e cookies Secure fora de development; validar configuração antes de promover artefatos.

**Git e ordem:** checkout real `C:\Users\Samuel\Documents\Projetos\Filaretti`; `Projeto` é o caminho inicial ausente. Branch `dev`, base F7 real `b52000281dbf34b89212065c8c578a99bf39e056`, inicialmente limpa e duas entregas à frente de origin/dev. Contratos/configuração → API/segurança → componentes → integração/QA → otimização/recuperação. Subagentes backend/frontend/QA entregaram tarefas isoladas; principal integrou, corrigiu, revisou evidências e finalizou checks/documentos. A rodada de layout do QA terminou, embora o agente tenha ficado indisponível; o principal executou o fechamento. Commit local previsto: `feat(quality): fortalece seguranca qa e recuperacao local (v0.8.0)`. SHA real será informado após o commit e registrado na próxima retomada, sem commit circular. Push, PR, deploy, DNS e fornecedores reais não foram executados.

#### Arquivos criados, alterados e removidos

Criados (28):

- `.github/workflows/staging-readiness.yml`
- `apps/api/jest.config.cjs`
- `apps/api/src/common/client-ip.ts`
- `apps/api/src/operations/operations.controller.ts`
- `apps/api/src/operations/operations.service.ts`
- `apps/api/src/relationship/attachment-scanner.ts`
- `apps/api/test/clamav.system.test.ts`
- `apps/api/test/hardening.jest.test.ts`
- `apps/api/test/operations.integration.test.ts`
- `apps/web/src/lib/article-complements.ts`
- `apps/web/src/lib/bff-client-ip.ts`
- `apps/web/src/lib/security-policy.ts`
- `apps/web/test/article-complements.test.mjs`
- `apps/web/test/f8-client-ip.test.mjs`
- `apps/web/test/f8-components.test.tsx`
- `apps/web/test/f8-security-policy.test.mjs`
- `apps/web/test/f8-setup.ts`
- `apps/web/vitest.config.ts`
- `docs/f8-backend.md`
- `docs/f8-frontend.md`
- `docs/f8-qa.md`
- `docs/operations.md`
- `scripts/backup-local.mjs`
- `scripts/ci-artifact.mjs`
- `scripts/f8-backup.mjs`
- `scripts/staging-gate.mjs`
- `scripts/test-f8.mjs`
- `scripts/test-recovery.mjs`

Alterados (75):

- `.husky/pre-commit`
- `.github/workflows/ci.yml`
- `README.md`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/src/app.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/domain/domain.module.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/relationship/public.guard.ts`
- `apps/api/src/relationship/relationship.controllers.ts`
- `apps/api/src/relationship/relationship.service.ts`
- `apps/api/test/foundation.test.ts`
- `apps/api/test/health.integration.test.ts`
- `apps/web/.env.example`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/src/app/(institutional)/conteudos/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/layout.tsx`
- `apps/web/src/app/(institutional)/loading.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/api/cms/[...path]/route.ts`
- `apps/web/src/app/api/relationship/[...path]/route.ts`
- `apps/web/src/app/dev/design-system/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/components/admin/cms-page.tsx`
- `apps/web/src/components/admin/contacts.tsx`
- `apps/web/src/components/admin/dashboard.tsx`
- `apps/web/src/components/admin/resource-editor.tsx`
- `apps/web/src/components/admin/resource-list.tsx`
- `apps/web/src/components/admin/rich-editor.tsx`
- `apps/web/src/components/admin/session.tsx`
- `apps/web/src/components/admin/settings.tsx`
- `apps/web/src/components/editorial/article-card.tsx`
- `apps/web/src/components/editorial/detail-view.tsx`
- `apps/web/src/components/editorial/styles.css`
- `apps/web/src/components/institutional/area-views.tsx`
- `apps/web/src/components/institutional/professional-views.tsx`
- `apps/web/src/components/institutional/styles.css`
- `apps/web/src/components/privacy/consent-provider.tsx`
- `apps/web/src/components/relationship/antispam.tsx`
- `apps/web/src/components/relationship/password-recovery.tsx`
- `apps/web/src/components/seo/structured-data.tsx`
- `apps/web/src/components/site/brand.tsx`
- `apps/web/src/components/site/breadcrumb.tsx`
- `apps/web/src/components/site/content-cards.tsx`
- `apps/web/src/components/site/site-footer.tsx`
- `apps/web/src/components/site/site-header.tsx`
- `apps/web/src/components/site/styles.css`
- `apps/web/src/lib/public-routing.ts`
- `apps/web/src/lib/public-status.ts`
- `apps/web/src/proxy.ts`
- `apps/web/test/consent.test.mjs`
- `apps/web/test/public-metadata.test.mjs`
- `docs/architecture.md`
- `docs/deployment.md`
- `docs/security.md`
- `package.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/test/environment.test.ts`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/ui/package.json`
- `packages/ui/src/button.tsx`
- `packages/ui/src/dialog.tsx`
- `packages/ui/src/surfaces.tsx`
- `plan.md`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `relate.md`

Removidos: nenhum. Evidências e helpers próprios em `.local/` são ignorados, contêm somente fixtures fictícias e não entram no commit. Nenhuma migration foi criada/alterada pela F8.

#### Implementação e decisões

- **Identidade/segurança:** BFF aceita um único IP do ingress configurado/confirmado e assina IP, timestamp de 60 segundos, método e pathname. API ignora forwarding arbitrário, exige assertion válida fora de development e limita auth/relacionamento por essa identidade. Segredo fica nos processos servidores. CORS fechado, Origin/CSRF/HttpOnly preservados; staging/production rejeitam URLs públicas HTTP e cookies não Secure. CSP com nonce aleatório por documento, strict-dynamic, sem unsafe-inline/unsafe-eval em script-src no build otimizado; JSON-LD, Turnstile, GA4 e TipTap usam nonce. Headers de proteção e HSTS condicionado à origem HTTPS. Documentos dinâmicos/no-store preservam retirada imediata de publicação; nenhum controle foi removido para elevar nota.
- **Anexos/saúde/operação:** ClamD privado examina original e bytes normalizados com tamanho/resposta/tempo limitados. Só CLEAN em ambos permite VERIFIED; FOUND rejeita antes da persistência; indisponibilidade conserva QUARANTINED sem ticket/download. Driver disabled só permite LOCAL_VERIFIED nos mocks locais. Liveness distingue processo de readiness PostgreSQL. Operações ADMIN retornam contagens/alertas sanitizados de exaustão, pendência/lease vencidos e quarentena; visitante/EDITOR bloqueados. Nenhum alerta externo/Sentry foi ativado.
- **Recuperação:** backup local cifra dump custom, arquivos públicos/privados e manifesto com AES-256-GCM, IV/AAD e SHA-256. Snapshot só é finalizado quando completo; restore não sobrescreve arquivos existentes. Ensaio usou dois bancos próprios e pg_restore real, comparou todas as tabelas/migrations, metadata/chave de anexo e hashes. Negativos de chave, adulteração, traversal e overwrite aprovados. O backup exige pausa de escritores: banco/storage não compartilham transação. Windows ACL, cópia externa, retenção diária e RPO/RTO ainda precisam de aprovação/prova. Não foi feito backup operacional do banco de desenvolvimento nem ativado scheduler.
- **CI/homologação preparada:** workflow inclui suites, PostgreSQL, recuperação, Chromium/axe/Lighthouse e evidências sanitizadas. Artefato de revisão conserva SHA/versão e `deployable=false`: build development/mocks exige rebuild staging aprovado. Gate manual valida revisão e flags de autorização/ingress/backup, depende de required reviewers e não contém adapter de deploy. Flags não são provas de homologação; CI remoto ainda não executado.
- **Correções de QA:** nomes acessíveis dos cards passaram a conter o texto visível; hierarquia de headings foi corrigida em listas/empty/error; skip links/login/recuperação recebem foco. Contato assíncrono conserva referência ao botão para restaurar foco após pending desabilitá-lo. Loading institucional reserva viewport para impedir deslocamento inicial do rodapé. Banner de consentimento aparece no HTML inicial, sem ativar analytics, e desaparece após ler uma preferência válida salva; retorno pode exibir breve banner. Diálogos/drawers fechados não hidratam conteúdo oculto, preservando hooks/foco/scroll/Escape. Links compartilhados desativam prefetch especulativo; o teste de tráfego confirma leitura somente após interação e navegação Next funcional.

#### Validações efetivamente executadas

| Check                                       | Resultado e limite                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`            | Aprovado; dependências/versões reproduzíveis                                                                                                    |
| `pnpm lint`, `pnpm typecheck`, `pnpm build` | Aprovados em todo o monorepo; build normal e QA otimizado                                                                                       |
| `pnpm test`                                 | 89 aprovados: 4 fundação HTTP, 7 Jest, 12 configuração, 60 Node web, 6 Vitest/RTL                                                               |
| `pnpm test:integration`                     | 72 aprovados, zero skips; PostgreSQL real, quatro migrations/seeds e bancos próprios                                                            |
| ClamAV explícito real                       | 1 teste de sistema aprovado; daemon 1.5.4, definições 28136 de 27/09/2026; EICAR isolado, PNG limpo e marcador fictício com assinatura de teste |
| `pnpm test:recovery`                        | 6 checks aprovados, banco restaurado e arquivos públicos/privados íntegros; recursos próprios removidos                                         |
| `pnpm test:cms`                             | 25 checks / 81 layouts; TipTap com nonce, permissões/conflito, upload/PDF/preview, publicação/retirada sem rebuild e recuperação após reinício  |
| `pnpm test:relationship`                    | 19 checks / 70 layouts; contato/anexo privado, opt-in/descadastro, reset, ADMIN/CSV e tarefas reais locais                                      |
| `pnpm test:f8` final                        | 104 checks, 248 layouts, 115 análises axe, 18 templates Lighthouse × 3; zero falhas funcionais/automáticas e limpeza integral                   |
| `pnpm test:design-system`                   | 44 combinações de contraste aprovadas                                                                                                           |
| `pnpm audit --prod`                         | Zero vulnerabilidades conhecidas na execução                                                                                                    |
| Gate de staging/sintaxe                     | 6 casos fictícios de gate e 5 scripts validados; não é execução de CI/deploy                                                                    |
| Formatação/diff                             | Prettier nos arquivos F8 e `git diff --check` aprovados                                                                                         |
| Preview normal F8                           | 3000/3001 em loopback, versão0.8.0; live/ready, menu móvel/desktop e busca por teclado aprovados                                                |

O teste ClamAV usa imagem oficial fixada e container descartável; FreshClam foi desativado somente na fixture. Atualização online não comprovada. EICAR apenas anexado ao PNG não foi detectado no primeiro experimento; a integração final usa EICAR padrão isolado e marcador fictício reconhecido por assinatura adicional somente de teste. Não alegar cobertura universal de malware. Procedimento/digest em `docs/f8-backend.md`.

**Revisão visual e acessibilidade:** principal abriu capturas dos 45 templates nas cinco larguras (375/768/1024/1440/1920), em 45 pranchas, e estados complementares de token/modal. Matriz Edge 154.0.4258.53: 225 layouts; Chrome 154.0.8037.93: 23 layouts a 1440. Nenhum overflow, erro JS, imagem quebrada, label/controle sem nome ou violação axe detectada. Foram 13291 amostras de texto sólido, 0 ignoradas pelo checker próprio; contraste automatizado não cobre toda composição visual. Axe registrou 71 grupos incompletos que permanecem visíveis no JSON para revisão humana. Teclado verificou skip link, FAQ Enter, foco em diálogos, Escape e restauração ao gatilho; cookies HttpOnly e ausência de tokens em localStorage comprovados. Não certifica WCAG 2.2 AA nem substitui leitor de tela.

**Lighthouse final:** 13.5.0, Chrome desktop com dispositivo móvel emulado, build otimizado `NODE_ENV=production`/`APP_ENV=development`, throttling simulado, reset de storage, noindex legítimo e analytics desligado. Três amostras por template; mediana de Performance escolhe a execução representativa; Accessibility/Best Practices precisam passar nas três. Todas as 54 amostras permanecem em JSON. Metas locais P/A/BP 90 atendidas pelo protocolo; `lighthouseTargetsMet=false`, pois SEO 95 depende da validação adequada de produção/indexação e continua pendente. Após o prefetch, atualização e busca ainda tiveram mediana89; a rodada completa e seus relatórios ficaram em `.local/f8-before-css.json` e `.local/f8-lighthouse-before-css/`. CSS de administração/demonstração foi retirado do global e importado somente nos layouts correspondentes; QA HTTP verifica ausência nas páginas públicas e presença nas rotas privadas/demo, além da matriz visual. Bytes das folhas por rota, antes de gzip: {"public": 50265, "admin": 59242, "demo": 64074}. Essa mudança reduz regras desnecessárias no primeiro carregamento, preservando stylesheets cacheáveis, nonce, conteúdo e funções.

| Template            | Performance mediana | Accessibility nas 3 | Best Practices nas 3 | SEO representativo |
| ------------------- | ------------------- | ------------------- | -------------------- | ------------------ |
| home                | 93                  | 100                 | 100                  | 66                 |
| office              | 93                  | 100                 | 100                  | 66                 |
| areas               | 95                  | 100                 | 100                  | 66                 |
| area-detail         | 93                  | 100                 | 100                  | 66                 |
| professionals       | 93                  | 100                 | 100                  | 66                 |
| professional-detail | 92                  | 100                 | 100                  | 66                 |
| contents            | 90                  | 100                 | 100                  | 66                 |
| article             | 93                  | 100                 | 100                  | 66                 |
| update              | 92                  | 100                 | 100                  | 66                 |
| guide               | 92                  | 100                 | 100                  | 66                 |
| contact             | 92                  | 100                 | 100                  | 66                 |
| newsletter          | 94                  | 100                 | 100                  | 66                 |
| confirm             | 94                  | 100                 | 100                  | 63                 |
| unsubscribe         | 93                  | 100                 | 100                  | 63                 |
| search              | 93                  | 100                 | 100                  | 66                 |
| faq                 | 93                  | 100                 | 100                  | 66                 |
| privacy             | 93                  | 100                 | 100                  | 66                 |
| cookies             | 93                  | 100                 | 100                  | 66                 |

Amostras individuais Performance abaixo de 90, sem remoção: search: 94,88,93. As rodadas exploratórias de uma amostra identificaram CLS 0,734 e notas Home66/artigo62/área68 antes da correção de loading; depois, contato88 por banner tardio e Home88/listagem88/artigo87 após a mudança do banner. Foram preservadas em `.local/f8-lighthouse-baseline/`, `.local/f8-lighthouse-baseline.json`, `.local/f8-lighthouse-after-banner/` e `.local/f8-after-banner.json`. Uma rodada intermediária de três amostras ainda apresentou artigo com mediana89; seus 54 relatórios e resumo foram preservados em .local/f8-lighthouse-before-prefetch/ e .local/f8-before-prefetch.json, motivando a desativação do prefetch especulativo. A mudança para três amostras foi fixada antes da rodada final, conforme variabilidade documentada do Lighthouse; não é repetição até nota favorável. Notas de SEO protegidas não são atribuídas integralmente a noindex: auditorias específicas permanecem nos originais.

**Evidências locais:** `.local/f8-qa-smoke.json` é a execução completa final; `.local/f8-layout-smoke.json`/`f8-lighthouse-smoke.json` guardam rodadas incrementais anteriores, com datas/limites próprios. Capturas e 54 relatórios originais em `.local/f8-qa-evidence/`; `.local/f8-recovery.json`, `.local/f6-qa-smoke.json`, `.local/f7-qa-smoke.json` e documentação F8 conservam reprodução/resultados. O preview normal foi atualizado após confirmar propriedade dos PIDs anteriores, recompilar e reiniciar somente web/API locais: `.local/f8-preview.json` e `.local/f8-preview-checks.json`, quatro checks de saúde/menu/busca. A primeira verificação tinha seletor ambíguo para “Todas as áreas” no menu e na Home; o seletor foi limitado ao menu, sem mudança no produto. Todos os runners removeram apenas bancos, build/config, storage, fixtures, processos e portas que criaram; banco/volume de desenvolvimento preservados.

**Hook de commit no Windows:** a primeira tentativa falhou antes do commit porque a chamada única do Prettier excedeu o limite da linha de comando. O hook agora limita cada lote do lint-staged a4000 caracteres, mantendo stash/restauração e a execução do Prettier em todos os arquivos. Nenhum check foi desativado. A nova tentativa deve passar o hook antes de concluir o commit local.

#### Pendências, riscos e ponto exato de retomada

**Correção da evidência visual:** a captura Chromium beyond-viewport deixou seções adiadas sem paint em PNG, embora foco/Enter funcionassem. O runner passou a guardar o viewport original de1000px e a expandir temporariamente a altura somente durante a captura completa, sem mudar CSS. Geometria/axe/teclado retomam o viewport normal; Lighthouse conserva seu protocolo. A execução completa final usa essa captura corrigida. O SHA-256 do conjunto final de233 arquivos versionáveis da aplicação é `c993b1059170ffd514bb4a8c9d5b7cdea9776e1960cbef444934636ea372b7d3`; seleção em apps/packages e manifests raiz, excluindo env/testes/Markdown. As 54 medições pertencem a uma única execução completa, sem combinar notas de rodadas distintas.

A rodada anterior às correções da leitura principal tinha102 checks/248 layouts/115 análises axe aprovados e somente artigo com mediana89; resumo e54 originais preservados em `.local/f8-before-primary-streaming.json` e `.local/f8-lighthouse-before-primary-streaming/`. A publicação principal passa a ser consultada junto com os dados da navegação, deduplicada por React cache somente nessa renderização, e deixa de esperar biografia/relacionados, que possuem Suspense próprio e falhas independentes. O Proxy sobrescreve o header interno e limita o preload a slug de detalhe público válido; gates de publicação, metadata/JSON-LD e no-store preservados. Testes Node verificam consultas paralelas/independentes e alvos restritos; Edge/Chrome comprovam título/corpo visíveis sem JavaScript. Essa prova se limita à leitura principal, sem alegar widgets ou complementos interativos disponíveis sem JavaScript.

O CSS por rota reduziu o conjunto público para cerca de50KB não comprimidos, mas a rodada seguinte ainda teve Home mediana89/artigo88; os54 originais e resumo ficaram em `.local/f8-lighthouse-before-static-actions/` e `.local/f8-before-static-actions.json`. A implementação final tornou Button/LinkButton universais para evitar hidratação de ações estáticas; callbacks interativos permanecem nos componentes de cliente e ações desabilitadas removem destino/callback/foco. Seções institucionais passam a adiar layout/paint distante do viewport com `content-visibility:auto` e tamanho intrínseco memorizado, preservando DOM/acesso por foco. A estimativa inicial de1000px pode ajustar a extensão da barra de rolagem na primeira exploração. Há fallback por `@supports`. Testes reais de foco/Enter ao final do artigo e revisão visual complementam o QA; leitor de tela continua pendente. As mudanças são aplicadas ao código normal e ao QA, sem flags exclusivas para elevar notas.

Após as correções, foram reabertas capturas da Home e das publicações nas cinco larguras, além de navegação por foco, contato, login/preview e administração, incluindo imagens do viewport original. Os templates preservaram o layout e os controles. Capturas expandidas podem conservar espaço adicional após o rodapé; a imagem de viewport original registra a primeira dobra real. A matriz automatizada completa foi repetida; CMS e relacionamento também foram reexecutados após a antecipação da publicação e passaram, com seus próprios recursos removidos.

1. Obter autorização e ambiente de staging protegido, banco/buckets/secrets isolados e destinatários fictícios em allowlist. Sem resposta confirmando ambiente externo, nenhuma integração real foi ativada.
2. Comprovar R2 público/privado, Resend/domínio/assinatura/replay/entrega, Turnstile hostname/action, worker contínuo, TLS/HSTS/CSP e ingress que sobrescreve IP/bloqueia origin direto. Testar falha/reinício/concorrência e rollback externos.
3. Autorizar push/CI remoto, configurar environment/reviewers e adapter concreto, obter run/artifact reais. Workflow local preparado não comprova CI remoto nem publicação de homologação.
4. Aprovar retenção, backup diário, cópia externa, responsável e orçamento; medir RPO/RTO e comprovar restore de banco/arquivos externos/R2 e recuperação da chave. Configurar scanner privado atualizado e monitor/destino de alertas sanitizados. QUARANTINED não tem liberação posterior implementada; definir procedimento antes de receber dados reais.
5. Executar Firefox, Safari macOS, Android Chrome/iOS Safari físicos e leitor de tela nos fluxos principais. WebKit/Firefox não tinham binários compatíveis; nada instalado ou certificado. Resolver itens axe incompletos com tecnologia assistiva/revisão humana e medir SEO em ambiente/indexação aprovados sem publicar dados fictícios.
6. Só após gates/aceite integral da F8, solicitar autorização própria para **F9 — Conteúdo final e migração**. Materiais, biografias, identidade, destinatários e textos/prazos operacionais seguem sujeitos à aprovação. **Ponto de parada: F8 local entregue em 0.8.0; homologação parcial; F9 aguardando autorização.**

### RP-008 — 04/10/2026 — F7 — Relacionamento, busca, SEO e privacidade

**Escopo autorizado:** “Inicie a F7 seguindo a ordem de desenvolvimento corretamente”, com retomada “continue de onde parou”, em 04/10/2026. Implementar somente F7 e seu commit local conforme AGENTS.md. **Estado: concluída tecnicamente; aceite local aprovado.** F8, push, PR, homologação externa, deploy e produção aguardam autorização própria.

**Versão:** `0.6.0` → `0.7.0`, oito manifests privados alinhados. SDK de verificação Svix `2.6.1` fixado; Resend usa API HTTP no adaptador, Turnstile usa Siteverify. Lockfile/frozen install e audit de produção aprovados; nenhuma conta/integração externa ativada.

**Git e continuidade:** checkout real `C:\Users\Samuel\Documents\Projetos\Filaretti`; caminho inicial `Projeto` ausente. Branch `dev`, base F6 real `51f496c584dee73a57c9830d9229180f71f1fd81`, inicialmente limpa antes da F7. A retomada preservou as alterações da própria fase. Commit previsto: `feat(relationship): implementa contato newsletter busca e privacidade (v0.7.0)`. SHA real será informado depois do commit e registrado na próxima retomada, sem commit circular.

#### Arquivos criados, alterados e removidos

Criados (57):

- `apps/api/prisma/migrations/202610040002_f7_relationship/migration.sql`
- `apps/api/src/relationship/dto.ts`
- `apps/api/src/relationship/email-outbox.ts`
- `apps/api/src/relationship/email-worker.service.ts`
- `apps/api/src/relationship/public.guard.ts`
- `apps/api/src/relationship/rate-limit.service.ts`
- `apps/api/src/relationship/relationship.controllers.ts`
- `apps/api/src/relationship/relationship.service.ts`
- `apps/api/src/relationship/turnstile.service.ts`
- `apps/api/src/relationship/webhook.controller.ts`
- `apps/api/src/search/dto.ts`
- `apps/api/src/search/search.controller.ts`
- `apps/api/src/search/search.module.ts`
- `apps/api/src/search/search.service.ts`
- `apps/api/test/mail.integration.test.ts`
- `apps/api/test/relationship.integration.test.ts`
- `apps/api/test/search.integration.test.ts`
- `apps/web/src/app/(institutional)/busca/page.tsx`
- `apps/web/src/app/(institutional)/contato/page.tsx`
- `apps/web/src/app/(institutional)/cookies/page.tsx`
- `apps/web/src/app/(institutional)/newsletter/confirmar/page.tsx`
- `apps/web/src/app/(institutional)/newsletter/descadastrar/page.tsx`
- `apps/web/src/app/(institutional)/newsletter/page.tsx`
- `apps/web/src/app/(institutional)/perguntas-frequentes/page.tsx`
- `apps/web/src/app/(institutional)/privacidade/page.tsx`
- `apps/web/src/app/admin/recuperar-senha/page.tsx`
- `apps/web/src/app/admin/redefinir-senha/page.tsx`
- `apps/web/src/app/api/relationship/[...path]/route.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/components/admin/contacts.tsx`
- `apps/web/src/components/admin/subscribers.tsx`
- `apps/web/src/components/privacy/consent-provider.tsx`
- `apps/web/src/components/privacy/styles.css`
- `apps/web/src/components/relationship/antispam.tsx`
- `apps/web/src/components/relationship/configuration.ts`
- `apps/web/src/components/relationship/contact-form.tsx`
- `apps/web/src/components/relationship/newsletter-form.tsx`
- `apps/web/src/components/relationship/password-recovery.tsx`
- `apps/web/src/components/relationship/private-download.ts`
- `apps/web/src/components/relationship/styles.css`
- `apps/web/src/components/relationship/token-action.tsx`
- `apps/web/src/components/search/faq-list.tsx`
- `apps/web/src/components/search/search-form.tsx`
- `apps/web/src/components/search/search.module.css`
- `apps/web/src/components/seo/structured-data.tsx`
- `apps/web/src/lib/consent.ts`
- `apps/web/src/lib/relationship-api.ts`
- `apps/web/src/lib/relationship-routing.ts`
- `apps/web/test/consent.test.mjs`
- `apps/web/test/relationship-api.test.mjs`
- `apps/web/test/relationship-routing.test.mjs`
- `docs/relationship.md`
- `packages/types/src/relationship.ts`
- `packages/types/src/search.ts`
- `scripts/local-mail.mjs`
- `scripts/test-relationship.mjs`

Alterados (63):

- `README.md`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/recovery.service.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/domain/domain.module.ts`
- `apps/api/test/auth.integration.test.ts`
- `apps/api/test/domain.integration.test.ts`
- `apps/api/test/helpers.ts`
- `apps/web/.env.example`
- `apps/web/eslint.config.mjs`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/src/app/(institutional)/areas-de-atuacao/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/areas-de-atuacao/page.tsx`
- `apps/web/src/app/(institutional)/conteudos/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/conteudos/page.tsx`
- `apps/web/src/app/(institutional)/layout.tsx`
- `apps/web/src/app/(institutional)/o-escritorio/page.tsx`
- `apps/web/src/app/(institutional)/page.tsx`
- `apps/web/src/app/(institutional)/profissionais/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/profissionais/page.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/components/admin/cms-page.tsx`
- `apps/web/src/components/admin/session.tsx`
- `apps/web/src/components/editorial/detail-view.tsx`
- `apps/web/src/components/editorial/share-links.tsx`
- `apps/web/src/components/institutional/area-views.tsx`
- `apps/web/src/components/institutional/types.ts`
- `apps/web/src/components/site/public-layout.tsx`
- `apps/web/src/components/site/search-overlay.tsx`
- `apps/web/src/components/site/site-footer.tsx`
- `apps/web/src/lib/admin-api.ts`
- `apps/web/src/lib/public-api-core.ts`
- `apps/web/src/lib/public-api.ts`
- `apps/web/src/lib/public-metadata.ts`
- `apps/web/src/lib/public-routing.ts`
- `apps/web/src/proxy.ts`
- `apps/web/test/public-api.test.mjs`
- `apps/web/test/public-metadata.test.mjs`
- `docs/api.md`
- `docs/database.md`
- `docs/deployment.md`
- `docs/security.md`
- `docs/seo.md`
- `package.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/test/environment.test.ts`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/types/src/index.ts`
- `packages/ui/package.json`
- `plan.md`
- `pnpm-lock.yaml`
- `relate.md`
- `turbo.json`

Removidos: nenhum. Total: 120 arquivos versionados da F7. Ambientes reais, mailbox, relatórios JSON/PNG, scripts auxiliares e builds próprios ficam ignorados. Migrations anteriores e seeds foram preservados.

#### Funcionalidades e decisões

- Ordem de desenvolvimento: contratos/configuração e migration estabilizados antes dos consumidores; backend/persistência precederam formulários/admin; integração real local, segurança, revisão visual e otimização encerraram a etapa. Subagentes atuaram em backend, frontend, busca/SEO e revisões isoladas de e-mail, analytics e documentação; principal integrou, validou e registrou a entrega.
- Contato: `/contato` sobre BFF público sem sessão e API Nest. Nome, e-mail, assunto, mensagem e ciência de privacidade obrigatórios; telefone/UF/área opcionais como decisão local sujeita ao escritório. UUID idempotente e hash de campos/arquivos conservam a solicitação em retries e recusam chave reutilizada com outros dados. Contato e notificação cifrada entram na mesma transação antes do ACK; falha de entrega não apaga contato. Newsletter tem consentimento/fluxo próprios; API aceita opção separada, interface direciona para inscrição dedicada.
- Anexos: até três/15 MiB total, imagem até5/PDF até10 MiB, validação F6 de bytes/MIME/extensão e decode/reencode. `ContactFile` fica separado da biblioteca editorial; metadados temporários persistem antes dos bytes, com expiração1h/limpeza durável. Documentos reais entram QUARANTINED. ADMIN precisa de ticket opaco60s, mesmo usuário/sessão, uso único e arquivo VERIFIED; LOCAL_VERIFIED é aceito apenas no adaptador de desenvolvimento. Não há URL pública permanente. Scanner real é gateF8; arquivos não verificados permanecem bloqueados.
- Antispam/limites: backend verifica sucesso, hostname/action de Turnstile e indisponibilidade controlada. Widget trata ausência/erro/timeout e retry. Mock explícito usa loopback+development; configuração rejeita mocks fora desse ambiente ou misturados a fornecedores reais. Limites PostgreSQL por IP/e-mail são compartilhados entre instâncias e precedem intake de anexos; login também usa INSERT ON CONFLICT e lock para primeira tentativa concorrente. BFF/API reafirmam origem configurada. Antes de hosting real, configurar/comprovar proxy confiável e endereço de cliente; o BFF local é visto como IP de origem pela API.
- Newsletter: consentimento versionado, PENDING até token de confirmação24h/uso único, depois ACTIVE. Reenvio10min, quotas e resposta uniforme. Descadastro com token próprio funcional e confirmação transacional; nova inscrição exige confirmação novamente. ACTIVE pode renovar link de preferências vencido sem mudar prova/status. ADMIN gerencia contatos/status e assinantes/exclusão; controle de versão impede sobrescrita. CSV autenticado com filtros, limite10000 e neutralização de fórmulas/caracteres de controle.
- E-mail/recuperação: AES-256-GCM com IV aleatório e chave idempotente como AAD protege destinatários/tokens da outbox. Worker a cada minuto/início, SKIP LOCKED, lease5min/fencing, backoff e tentativas limitadas; entrega real usa a mesma chave e para antes23h para preservar deduplicação do fornecedor. Revalida token/contato/status antes de entregar; payload é redigido ao completar. Contato notifica apenas link do painel, sem solicitação/anexos. Mock grava captura criptografada local. `pnpm mail:local` lista UUID/tipo/data; seleção explícita gera HTML local escapado/no-referrer para abrir a ação, sem token/PII no stdout. Recuperação integra outbox atomicamente e mantém resposta uniforme, inclusive envio desativado; redefinição revoga sessões. Webhook verifica assinatura/timestamp sobre bytes brutos antes do JSON e deduplica somente metadados mínimos. Svix desta versão verifica por exceção e não retorna JSON; parse ocorre depois da verificação.
- Retenção: contatos180dias, PENDING/UNSUBSCRIBED365dias da última alteração, ACTIVE preservado enquanto inscrito; prazos configuráveis e ainda não aprovados para operação. Exclusão de bytes privada usa outbox; lotes100 e lock compartilhado. Tokens/tickets/contadores vencidos limpos; e-mails finalizados/falhos e capturas próprias JSON/HTML7dias, eventos webhook30dias. Capturas locais não são servidas pelo site. Rotação/backup de chave e recuperação de arquivos exigem comprovaçãoF8.
- Busca/FAQ: `/busca` e overlay consultam PostgreSQL Full Text Search português, ranking, filtros/paginação estáveis, somente publicados com data atingida/autor ativo, áreas/profissionais ativos. Produção exclui mocks/autores mock. Resultados projetam campos públicos; nenhum contato/assinante/anexo/draft/preview participa. FAQ global/por área usa API e renderer seguro; detalhes de área incluem perguntas relacionadas.
- SEO: metadata/canonical/social e JSON-LD LegalService/Article/Person/BreadcrumbList/FAQPage usam dados públicos realmente exibidos; serialização segura, sem credenciais/avaliações inventadas. Sitemap paginado só URLs públicas elegíveis e sem mocks em produção. Gate explícito mantém desenvolvimento/staging noindex, robots bloqueado e sitemap vazio. Busca, filtros, admin, preview e token têm política própria. Indexação e Search Console não foram ativados.
- Privacidade: páginas publicadas do CMS, textos fictícios sinalizados, banner/preferences no rodapé. Hidratação inicia negada; GA4 exige produção/flag/ID/consentimento e confirmação externa de medidas automáticas desabilitadas. Somente seis nomes de evento, sem parâmetros livres, conteúdo ou query/token; localização raiz/referrer vazio, ads/signals negados. Revogação síncrona bloqueia envio, remove script/cookies/fila, sincroniza abas; admin/preview/tokens excluídos. Armazenamento indisponível mantém default deny e permite escolha explícita nesta visita.

#### Validações executadas e resultados

- `pnpm install --frozen-lockfile`, `pnpm audit --prod`: passaram; zero vulnerabilidade conhecida de produção no lockfile atual.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check`, `git diff --check`: passaram na base integrada final. Build normal otimizado separado do QA. Lint ignora artefatos `.local`; efeitos de interface/hidratação corrigidos. Typecheck foi repetido depois do build para evitar disputa por tipos `.next` gerados; resultado final verde.
- `pnpm test`: **63 testes aprovados**,50web,10configuração,3fundação, zero falha/skip. Inclui gate SEO/projeção, mutações públicas sem cookies/referrer, downloads/tokens bounded e consentimento. Nove testes de consentimento: três de política e seis executando o componente real transpilado em VM com hooks/DOM simulados, inclusive production+enabled, hidratação, carga após aceite, allowlist sem dados livres, revogação, abas e storage indisponível. Não acessaram Google.
- `pnpm test:integration`: **66 testes aprovados**, PostgreSQL/HTTP reais, zero falha/skip; quatro migrations em databases próprias, seeds repetidos, bloqueio do seed fictício em produção e provisão isolada de ADMIN passaram. Casos novos: intake idempotente/privado, roles/status/conflito, ticket sessão/expiração/uso único/quarentena, inválidos/quota/antispam, double opt-in/reenvio/renovação/descadastro concorrentes, CSV, limites compartilhados/primeira chave login, retenção/orfãos, criptografia/tamper, recuperação uniforme/outbox, spool7d, leases/retries/webhook bruto/deduplicação, busca/ranking/stemming/projeção/retirada/sitemap. Bancos próprios removidos. Aviso de depreciação `pg` em consulta concorrente permanece não impeditivo na versão fixada; nenhuma migração para release candidate.
- `pnpm --filter @filaretti/api db:validate`, `pnpm db:migrate`: passaram. Migration aditiva `202610040002_f7_relationship` aplicada ao `filaretti_dev`, sem reset/reseed/remover volume.
- `pnpm test:design-system`: **44 combinações semânticas de contraste aprovadas**.
- `pnpm test:relationship`, Playwright existente+Edge **154.0.4258.53**: **19 verificações aprovadas**,70layouts:12templates×cinco larguras375/768/1024/1440/1920 + cinco estados×375/1440 (confirmação/descadastro/reset válidos, preferências e detalhe de contato). **2603 amostras sólidas ≥4,5:1, zero ignoradas**, zero overflow global/erros JS, controles com labels/nomes/IDs/imagens válidos. Contato por teclado com arquivo privado/consentimento separado, PENDING/confirmar/descadastrar, remoção de fragmentos, overlay, preferências locais, recuperação/login com senha redefinida, papel AUTHOR, ADMINdownload/status/CSV passaram. GA4 estava desligado nesse navegador; VM prova comportamento habilitado simulado separadamente.
- Revisão visual manual: folhas dos12templates nas cinco larguras, detalhe de contato375/1440 e estados válidos de token/preferences/reset. Evidência estática/navegador local não equivale a WCAG completo, leitor de tela, dispositivo físico ou outros motores.
- QA/cleanup em `.local/f7-qa-smoke.json`: processos, banco, storage, mailbox/fixtures, build e tsconfig próprios removidos; portas3026/3027 liberadas. PNGs/folhas em `.local/f7-qa-evidence`; inventário em `.local/f7-files.json`. Porta3000/3001 e dados de desenvolvimento preservados. Fixture local escolhida de `mail:local` renderizou link fragmento/CSP/no-referrer sem token/recipient em stdout; JSON/HTML próprios removidos.
- Preview **0.7.0** iniciado em loopback após verificar portas livres: API3001/Next3000, health/contato/adminHTTP200. URLs http://localhost:3000/contato e http://localhost:3000/admin/login; dados/storage/fornecedores exclusivamente locais/fictícios. PIDs/checks sanitizados em `.local/f7-preview.json`. Abertura do contato no painel Codex solicitada; ferramenta retornou queued.

Falhas intermediárias de SQL advisory lock/SDK webhook, configuração de origem/seletor/readiness do harness, efeitos lint e disputa de tipos gerados foram corrigidas antes dos resultados finais. Não houve aceite baseado em fornecedor simulado como externo nem em porta fechada.

#### Limitações e próximo passo

R2/Resend/Turnstile/GA4 reais, scanner/quarentena, endereço do cliente/proxy confiável, CI remoto, backup/restauração/rotacão de secrets, Lighthouse, leitores de tela/navegadores adicionais e homologação não foram comprovados. A F7 permite desenvolvimento com adaptadores explicitamente simulados; não representa aceite operacional. Para habilitar relacionamento real, configurar destinatário/segredos e versões aprovadas; liberar anexos reais exige scanner VERIFIED. Defaults são seguros e integrações/indexação permanecem desligadas fora do desenvolvimento até configurar gates.

Conteúdo/identidades, políticas de privacidade, destinatários, campos opcionais e prazos de retenção seguem fictícios/sujeitos à aprovação do escritório. Newsletter V1 não inclui campanhas; worker precisa permanecer ativo. Search Console/indexação dependem do ambiente/domínio/corte autorizado; medidas automáticas da propriedade GA4 precisam ser verificadas remotamente antes da flag. Sitemap acima50000 URLs exige particionamento.

**F7 entregue; aguardar autorização para F8 — Validação integrada e homologação.** Commit local previsto acima; sem push, PR, release, deploy, DNS ou publicação.

### RP-007 — 04/10/2026 — F6 — CMS, mídia e publicação ponta a ponta

**Escopo autorizado:** “Prossiga para a versão F6 do desenvolvimento do projeto” em 03/10/2026, com retomada “continue de onde parou” em 04/10/2026. Implementar somente F6 e seu commit local conforme AGENTS.md. **Estado: concluída tecnicamente; aceite local aprovado.** F7, push, PR, deploy, homologação externa e produção aguardam autorização própria.

**Versão:** `0.5.0` → `0.6.0`, oito manifests privados alinhados. TipTap `3.31.4`, Sharp `0.35.5`, AWS SDK S3 `3.1146.0`, pdf-lib `1.17.1` e tipos Multer `2.3.0` fixados. Overrides limitados a `@prisma/config>deepmerge-ts` `8.0.0` e `prisma>mysql2` `3.23.1` corrigem achados transitivos sem migrar Prisma `7.10.0`. Lockfile e instalação frozen aprovados.

**Git e continuidade:** checkout real `C:\Users\Samuel\Documents\Projetos\Filaretti`; caminho antigo `Projeto` ausente. Branch `dev`, base F5 `a0bf265`, inicialmente limpa. Commit previsto: `feat(cms): implementa gestão de conteúdo e publicação (v0.6.0)`. SHA real informado após commit e registrado na próxima retomada, sem commit circular.

#### Arquivos criados, alterados e removidos

Criados (37):

- `apps/api/prisma/migrations/202610030001_f6_media/migration.sql`
- `apps/api/src/cms/cms.controllers.ts`
- `apps/api/src/cms/dto.ts`
- `apps/api/src/cms/media.service.ts`
- `apps/api/src/cms/outbox.ts`
- `apps/api/src/cms/redirects.ts`
- `apps/api/src/cms/storage.service.ts`
- `apps/api/src/cms/upload.ts`
- `apps/api/src/cms/worker.service.ts`
- `apps/api/test/cms.integration.test.ts`
- `apps/web/src/app/admin/(workspace)/[[...route]]/page.tsx`
- `apps/web/src/app/admin/(workspace)/layout.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/api/cms/[...path]/route.ts`
- `apps/web/src/app/api/revalidate/route.ts`
- `apps/web/src/app/preview/[token]/page.tsx`
- `apps/web/src/components/admin/cms-page.tsx`
- `apps/web/src/components/admin/dashboard.tsx`
- `apps/web/src/components/admin/form-controls.tsx`
- `apps/web/src/components/admin/media-library.tsx`
- `apps/web/src/components/admin/media-picker.tsx`
- `apps/web/src/components/admin/resource-editor.tsx`
- `apps/web/src/components/admin/resource-list.tsx`
- `apps/web/src/components/admin/rich-editor.tsx`
- `apps/web/src/components/admin/session.tsx`
- `apps/web/src/components/admin/settings.tsx`
- `apps/web/src/components/admin/users.tsx`
- `apps/web/src/lib/admin-api.ts`
- `apps/web/src/lib/admin-types.ts`
- `apps/web/src/lib/cms-routing.ts`
- `apps/web/test/admin-api.test.mjs`
- `apps/web/test/cms-routing.test.mjs`
- `docs/cms.md`
- `packages/types/src/cms.ts`
- `scripts/setup-cms-local.mjs`
- `scripts/test-cms.mjs`

Alterados (41):

- `README.md`
- `apps/api/.env.example`
- `apps/api/package.json`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/domain/articles.service.ts`
- `apps/api/src/domain/domain.controllers.ts`
- `apps/api/src/domain/domain.module.ts`
- `apps/api/src/domain/dto.ts`
- `apps/api/src/domain/institution.service.ts`
- `apps/api/test/helpers.ts`
- `apps/web/.env.example`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/src/components/admin/admin-layout.tsx`
- `apps/web/src/components/admin/styles.css`
- `apps/web/src/components/editorial/detail-view.tsx`
- `apps/web/src/components/institutional/professional-views.tsx`
- `apps/web/src/components/site/content-cards.tsx`
- `apps/web/src/lib/public-media.ts`
- `apps/web/src/proxy.ts`
- `apps/web/test/public-routing.test.mjs`
- `docs/api.md`
- `docs/database.md`
- `docs/editorial.md`
- `docs/public-site.md`
- `docs/security.md`
- `package.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/test/environment.test.ts`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/types/src/index.ts`
- `packages/ui/package.json`
- `plan.md`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `relate.md`

Removidos: nenhum. Total: 78 arquivos versionados da F6. Ambientes reais, logs, JSON/PNG de QA, scripts auxiliares e builds temporários permanecem ignorados. Migrations anteriores e seeds existentes foram preservados.

#### Funcionalidades e decisões

- CMS: `/admin/login`, dashboard, usuários, artigos, categorias, tags, áreas, profissionais, páginas com seções, FAQ, biblioteca de mídia, configurações e redirects. Listas/formulários usam a API existente, com loading/vazio/erro e controle de versão. ADMIN mantém usuários/configurações/redirects; EDITOR aprova/publica; AUTHOR mantém seus rascunhos e mídias. Backend revalida role e propriedade. Seletores AUTHOR carregam catálogos públicos paginados sem cookies.
- Editor: TipTap com schema permitido da F2/F5, campos de título/slug/resumo/SEO, autor/tipo, relacionamentos, capa/PDF e destaque. Salvar, publicar, agendar, retirar e arquivar são ações distintas. Alterações pendentes bloqueiam publicação/preview; gravações bloqueiam edição, inclusive links do editor. Conflito 409 preserva o texto local e não sobrescreve silenciosamente. JSON limitado a 512 KiB acomoda documentos multibyte válidos; corpos excessivos retornam 413 sanitizado.
- Sessão: BFF `/api/cms/*` restrito a auth/admin, cookies HttpOnly com Path do BFF, Origin/CSRF preservados, corpo bounded de 11 MiB. Tokens de sessão não entram em JSON/localStorage; refresh concorrente deduplicado. Configuração local alinha o segredo da API/web sem imprimir nem sobrescrever valores existentes.
- Preview: token opaco, hash HMAC persistido, TTL configurável, expiração/revogação/reemissão e bloqueio para emissor inativo/sem permissão. Proxy valida antes do streaming para HTTP 404/503 real; renderer seguro compartilhado com F5. Admin/preview no-store, noindex e no-referrer. Logs sanitizados e sem analytics no preview.
- Mídia: multipart administrativo; JPG/JPEG, PNG, WebP, AVIF até 5 MiB e PDF até 10 MiB. Decoder raster completo/reencode, limite de pixels e remoção de metadados; PDF com parse estrutural e bloqueio de ações ativas, inclusive dicionários aninhados. Extensão/MIME/bytes/tamanho concordam; SVG/HTML/executáveis/truncados/animados são rejeitados. Chaves UUID aleatórias, metadados, proprietário, busca e versão. Migration aditiva inclui driver/version/index; storage público/privado separado local e adaptador R2 implementado.
- Fachada `/media/public/<chave>` verifica registro público e ausência de vínculo com contatos a cada leitura. Imagens geridas pelo CMS usam `unoptimized`/no-store; Proxy bloqueia também chamadas manuais ao cache Next Image, inclusive variantes codificadas, segmentos e query/fragmento. Fixtures estáticos continuam otimizáveis. Exclusão impede uso por FKs e links JSON em artigos/profissionais/páginas/áreas/FAQ; remove registro na transação e bytes via outbox com retry.
- Publicação: datas exibidas em Brasília e persistidas UTC; worker a cada minuto e na inicialização. PostgreSQL com advisory lock e SKIP LOCKED impede duplicação entre instâncias, recupera vencidos após reinício e revalida emissor/autor/relacionamentos. Outbox tem lease/fencing, tentativas limitadas, backoff e códigos sanitizados. Callback web server-only valida segredo/path/body, invalida dependências do layout e devolve ack com mesma chave idempotente. No-store público garante nova consulta atualizada mesmo se o callback falhar.
- URLs: grafo interno sem ciclos/destinos externos/caminhos privados. Troca de slug enquanto artigo/página está publicado ou perfil/área ativo preserva a URL anterior; rascunhos e registros inativos não criam aliases públicos. URLs reservadas não podem ser reutilizadas. O Proxy atende também fontes antigas `.html`; destinos absolutos são construídos na mesma origem validada pelo caminho. Slugs estruturais home/escritório/privacidade/cookies ficam fixos.

#### Validações executadas e resultados

- `pnpm install --frozen-lockfile`: passou; `pnpm audit --prod`: sem vulnerabilidades conhecidas. Nenhuma biblioteca/lockfile mudou após esses checks.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check`, `git diff --check`: passaram na base integrada final, sem erros/warnings de lint. Build normal Next otimizado separado do artefato QA.
- `pnpm test`: **45 testes aprovados**, 34 web, 8 configuração e 3 fundação HTTP/API; zero falha/skip. Inclui refresh concorrente, preservação de conflitos, catálogos públicos sem sessão e exclusão dos ativos geridos do cache de imagens.
- `pnpm test:integration`: **39 testes aprovados**, PostgreSQL/HTTP reais, zero falha/skip. Bancos temporários próprios recebem três migrations, seeds repetidos/idempotentes, provisão de primeiro ADMIN isolada e bloqueio de seed fictício em produção. Novos casos cobrem privacidade dos slugs, JSON multibyte/413, quatro formatos raster/PDF inválido/nested, preview, papéis, publicação/retirada, conflitos/redirects, duas instâncias, reinício, leases/retry/exaustão, referências JSON e remoção durável. Os bancos próprios foram removidos pelo runner. Aviso de depreciação `pg` em concorrência permanece não impeditivo com a versão fixada; não foi feita migração para release candidate.
- `pnpm --filter @filaretti/api db:validate` e `pnpm db:migrate`: passaram; migration `202610030001_f6_media` aplicada ao `filaretti_dev`, sem reset/reseed/remover volume.
- `pnpm test:design-system`: **44 combinações semânticas de contraste aprovadas**.
- `pnpm test:cms` com Playwright já disponível e Edge 154.0.4258.53: **25 verificações aprovadas**, 81 layouts: 16 templates em 375/768/1024/1440/1920 e editor AUTHOR móvel. **4415 amostras de texto sólido ≥ 4,5:1, zero ignoradas**, zero overflow global, labels/nomes/IDs/alt/imagens válidos. Login por teclado, criar/salvar/upload/preview/publicar/retirar, read-only pendente, conflito sem perda, papel AUTHOR, logout, mídia privada/inválida/em uso/excluída, aliases publicados/legacy, restart real e callback persistido passaram. Zero erro JS ou console inesperado; três 401/409 esperados. Retirada observada em 564 ms nas três dependências verificadas, resultado local sem garantia de SLA.
- Revisão visual manual: folhas dos 16 templates nas cinco larguras, editor móvel completo em cinco recortes e estado de conflito. Navegador local/teclado e inspeção estática com subagente; não equivale a WCAG completo/leitor de tela/outros navegadores.
- Isolamento/cleanup confirmado em `.local/f6-qa-smoke.json`: processos/banco/storage/fixtures/build/tsconfig próprios removidos e portas 3024/3025 liberadas. PNGs em `.local/f6-qa-evidence/`; inventário em `.local/f6-files.json`. Artefato de QA tem origem/build próprios porque rewrites são fixados no build; não substitui o build de uso normal.
- Preview local atualizado para `0.6.0`: API 3001/Next 3000 em loopback, health/login/home HTTP 200, conteúdo e fornecedores exclusivamente locais/fictícios. Login: http://localhost:3000/admin/login. PIDs atuais e checks sanitizados em `.local/f6-preview.json`. Abertura no painel Codex foi solicitada; ferramenta retornou queued.

Falhas intermediárias de harness/origem/labels e de contraste, Location relativo, resposta 413, cache de imagem e aliases privados foram resolvidas. Os resultados acima são os checks finais; não houve aceite baseado em mocks de HTTP, porta fechada ou apenas configuração.

#### Limitações, pendências e próximo passo

R2 possui adaptador e validação de configuração, mas **não foi acessado/validado externamente**; contas, buckets, isolamento e recuperação real permanecem na F8 autorizada. PDFs editoriais têm validação estrutural; scanner/quarentena de anexos de contato permanece nas F7/F8. Nenhuma integração Resend/Turnstile/analytics, e-mail real, homologação ou produção foi ativada.

Contatos/assinantes completos, busca global, SEO/sitemap e privacidade são F7. CMS salva páginas estruturadas; templates públicos FAQ/contato/privacidade/cookies entram na F7. Criar outra página no CMS não cria automaticamente rota/template público. Agendamento exige instância API/worker ativa; recupera vencidos quando retorna. Edição de slug enquanto retirado não publica alias: renomear e republicar exige redirect ADMIN explícito para uma URL histórica se necessário. Imagens CMS não usam cache de otimização; derivados revogáveis no storage podem ser avaliados na homologação.

CI remoto, navegadores/dispositivos adicionais, leitor de tela, Lighthouse, integrações reais, backups/restauração e SLA de produção não foram comprovados nesta etapa. Material institucional/identidade seguem fictícios até aprovação. **F6 entregue; aguardar autorização para F7.** Sem push/PR/release/deploy/DNS/publicação.

### RP-006 — 03/10/2026 — F5 — Portal editorial e leitura de conteúdos

**SHA confirmado na retomada F6:** `a0bf265`, commit local da F5. Branch `dev` e árvore inicialmente limpa; autorização F6 recebida em 03/10/2026.

**Escopo autorizado:** “Inicie a F5”. Implementação e aceite da F5, incluindo commit local conforme AGENTS.md. **Estado: concluída tecnicamente; aceite local aprovado.** F6, push, PR, homologação externa e publicação exigem autorização própria.

**Versão:** `0.4.0` → `0.5.0`; oito manifests privados alinhados. Nenhuma biblioteca externa, mudança de schema, migration ou seed existente. Lockfile preservado e instalação frozen aprovada.

**Git e continuidade:** cwd real `C:\Users\Samuel\Documents\Projetos\Filaretti`, pois o caminho antigo `Projeto` está ausente. Branch `dev` inicialmente limpa; base F4 confirmada `e96b124`. Commit F5 previsto: `feat(editorial): implementa portal e leitura de conteúdos (v0.5.0)`; SHA real informado após commit e registrado na próxima retomada, sem commit circular.

#### Arquivos criados, alterados e removidos

Criados (14):

- `apps/web/src/app/(institutional)/conteudos/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/conteudos/layout.tsx`
- `apps/web/src/app/(institutional)/conteudos/page.tsx`
- `apps/web/src/components/editorial/article-card.module.css`
- `apps/web/src/components/editorial/article-card.tsx`
- `apps/web/src/components/editorial/detail-view.tsx`
- `apps/web/src/components/editorial/index-view.tsx`
- `apps/web/src/components/editorial/outline-links.tsx`
- `apps/web/src/components/editorial/share-links.tsx`
- `apps/web/src/components/editorial/styles.css`
- `apps/web/src/lib/editorial-query.ts`
- `apps/web/test/editorial-query.test.mjs`
- `docs/editorial.md`
- `scripts/test-editorial.mjs`

Alterados (36):

- `README.md`
- `apps/api/package.json`
- `apps/api/src/domain/articles.service.ts`
- `apps/api/src/domain/domain.controllers.ts`
- `apps/api/src/domain/domain.module.ts`
- `apps/api/src/domain/institution.service.ts`
- `apps/api/src/domain/responses.ts`
- `apps/api/src/domain/shared.ts`
- `apps/api/test/domain.integration.test.ts`
- `apps/web/package.json`
- `apps/web/src/app/(institutional)/layout.tsx`
- `apps/web/src/components/institutional/home-view.tsx`
- `apps/web/src/components/institutional/shared.tsx`
- `apps/web/src/lib/public-api-core.ts`
- `apps/web/src/lib/public-api.ts`
- `apps/web/src/lib/public-content-core.ts`
- `apps/web/src/lib/public-content.tsx`
- `apps/web/src/lib/public-media.ts`
- `apps/web/src/lib/public-routing.ts`
- `apps/web/src/proxy.ts`
- `apps/web/test/public-api.test.mjs`
- `apps/web/test/public-content.test.mjs`
- `apps/web/test/public-routing.test.mjs`
- `docs/api.md`
- `docs/public-site.md`
- `docs/security.md`
- `docs/seo.md`
- `package.json`
- `packages/config/package.json`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/types/src/domain.ts`
- `packages/ui/package.json`
- `plan.md`
- `relate.md`

Removidos: nenhum. Inventário de 50 arquivos pertinente à fase revisado para staging explícito. Ambientes, builds, fixtures temporárias e evidências ignoradas não integram o commit.

#### Implementação e decisões

- `/conteudos` lista ARTICLE/UPDATE/GUIDE com paginação real de 12 registros e filtros GET por área, categoria, autor, tag, tipo, ano e ordem. URL preserva a interseção na paginação/reabertura. Valores repetidos/inválidos são normalizados; seleção que saiu do catálogo permanece identificada no formulário, sem alterar silenciosamente o resultado. A busca global/overlay funcional segue F7.
- `GET /api/v1/editorial/filters` entrega opções completas derivadas de publicações visíveis e relações ativas. Transação RepeatableRead mantém snapshot consistente; anos usam UTC como o filtro existente. Endpoint separado preserva slugs anteriores, inclusive `filters`, protegido por regressão. A API decide publicação, visibilidade, filtros e ordenação; cliente servidor projeta somente DTOs públicos e não duplica essas regras.
- Leitura SSR traz categorias, título, resumo, datas em America/Sao_Paulo, estimativa de tempo da API, capa otimizada, texto, sumário H2, compartilhamento, perfil do autor, áreas e relacionados. Home, áreas, profissionais, menu e footer agora levam a leitura/listagem editorial. Cards reutilizam o design aprovado, com navegação por requisição nova.
- `PublicContent` produz JSX escapado de árvore TipTap limitada e permitida, sem HTML bruto, scripts ou embeds. URLs perigosas perdem a marca de link; texto é preservado. IDs H2 determinísticos têm índice para impedir colisões entre títulos repetidos/vazios/Unicode e recebem foco pelo sumário. Renderer fica reutilizável pelo preview F6, que não foi antecipado.
- Compartilhamento usa canonical da configuração pública, nunca Host do visitante; links WhatsApp/LinkedIn/e-mail e cópia com aria-live. Falha de Clipboard oferece campo readOnly rotulado, focado e selecionado para cópia manual por teclado. Não há carregamento de analytics/envio externo automático.
- PDF aparece somente em GUIDE com referência pública local, MIME/extension corretos e tamanho positivo até 10 MiB. Serializer da API também verifica tipo de mídia, path público e ausência de vínculo com contato; integridade PostgreSQL existente permanece intacta. O teste serve PNG/PDF reais fictícios em arquivos owned temporários; upload, validação de bytes/storage completo/R2 seguem F6. Retirada de publicação remove a referência do site, não torna privado um arquivo previamente público ou baixado.
- Política explícita de cache: fetch no-store, grupo force-dynamic e Cache-Control no-store, sem Data Cache/Full Route Cache persistentes; React.cache apenas deduplica na renderização. Primeiro pedido após a transação de retirada remove detalhe, listas, relações e opções, sem rebuild/restart/TTL. Proxy consulta publicação antes do streaming para HTTP404/503 reais. Não apaga documento já aberto/histórico/download e não cria snapshot transacional entre Proxy/API/renderização. Decisão, fontes oficiais Next 16.3.8 e dependências futuras em docs/editorial.md/public-site.md.
- Três subagentes apoiaram API/cliente, UI e QA com arquivos distintos. Principal estabilizou contratos, implementou helpers/renderer/cache, revisou código/8 PNGs, executou integração e documentou/commitou a entrega.

#### Validação executada

| Check                   | Resultado/evidência                                                                                                                                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuidade/instalação | RTK.md, AGENTS.md, plan inteiro, RP-005 e docs aplicáveis lidos; cwd/dev/base/árvore/Compose verificados; pnpm install --frozen-lockfile passou                                                                                                                                     |
| Lint/tipagem/build      | pnpm lint, pnpm typecheck e pnpm build passaram; rotas editoriais dinâmicas SSR no build otimizado, demais rotas preservadas                                                                                                                                                        |
| Testes básicos          | pnpm test: 37 aprovados (27 web, 7 config, 3 API/fundação), zero falhas/skips                                                                                                                                                                                                       |
| PostgreSQL real         | pnpm test:integration: 30 aprovados, zero falhas/skips; migrations/seeds/idempotência, roles/CSRF/sessões, filtros combinados/paginação/ordenação, facets com mais de 50 categorias, anos UTC, mídia/paths, slug filters, retirada e provisionamento isolado                        |
| Contraste tokens        | pnpm test:design-system: 44 combinações aprovadas                                                                                                                                                                                                                                   |
| Smoke real otimizado    | pnpm test:editorial: 38 checks aprovados,20 layouts (índice/leitura/guia/segunda página filtrada × 375/768/1024/1440/1920), Edge 154.0.4258.53; zero falhas/console/overflow/labels/IDs/alt/imagens;1932 amostras de texto sólido com contraste ≥ 4,5:1, zero ignoradas             |
| Navegação/teclado       | Links Home/área/perfil→leitura; GET por teclado e filtros mantidos sem pagina antiga; URLs/reload repetem seleção; TOC focaliza H2; copiar e fallback com input selecionado aprovados                                                                                               |
| Conteúdo/arquivos       | Nove ocultos (DRAFT/SCHEDULED/ARCHIVED/PUBLISHED futuro) fora do site e 404 no detalhe; dez documentos inseguros rejeitados antes de SSR; texto XSS escapado sem execução; URLs PDF perigosas sem download; raster 512×384→256×192 pelo otimizador e PDF fictício 610 bytes servido |
| Retirada/falha          | Primeira nova consulta remove publicação de cinco superfícies em 581 ms no ensaio (medição local, sem SLA); autor inativo oculto; API parada produz 503/no-store e reiniciada volta 200 sem rebuild                                                                                 |
| Limpeza/local           | Banco/PNG/PDF/processos owned do smoke removidos e portas3014/3015 liberadas; preview local atualizado em 3000/API 3001 com 200 e /conteudos no-store; banco de desenvolvimento preservado                                                                                          |
| Formato/diff            | Prettier e git diff --check aprovados antes do commit; staging somente inventário explícito da fase                                                                                                                                                                                 |

A primeira integração falhou porque uma fixture SCHEDULED nova não tinha scheduledAt; fixture corrigida para respeitar a constraint vigente, sem alterar produto/migration. Repetição passou 30/30. Primeiro smoke teve duas asserções de runner corrigidas: estado streaming/skeleton capturado como página vazia e tentativa de converter PDF vinculado para PRIVATE corretamente rejeitada pela integridade. Run final passou 38/38, sem mudança de produto após build. Uma primeira inicialização do smoke não resolveu o path Playwright por quoting PowerShell; wrapper Node corrigiu antes de criar recursos. Aviso herdado de depreciação pg sobre consultas concorrentes não causou falha; não é teste pendente.

Evidências ignoradas: `.local/f5-smoke.json`, `.local/f5-first-smoke.json`, `.local/f5-evidence/*.png` e registros .local/f5-cleanup.json e .local/f5-qa.md. Runner produziu 42 capturas; QA inspecionou também cinco pranchas e dois recortes. Confirmação independente em pg_database/processos/arquivos/portas comprovou a remoção dos dois bancos dos smokes, seus PNG/PDF e dez PIDs próprios; serviços 3000/3001 permaneceram 200. Capturas mostram dados fictícios do banco temporário. Não foram certificadas WCAG completa, leitores de tela, dispositivos físicos, Safari/Firefox/Chrome nem metas Lighthouse; gates F8 preservados.

#### Limites e ponto de parada

- Aceite local com PostgreSQL/API/SSR e Edge reais. Materiais oficiais permanecem pendentes; não houve cadastro, upload externo, e-mail, túnel, DNS, push, PR, merge ou deploy. PDF/imagens dos testes não foram adicionados ao banco de desenvolvimento nem versionados.
- CMS/preview/upload/storage/agendamento e tarefas persistidas seguem F6; busca global, relacionamento, sitemap/SEO completo e consentimento seguem F7; fornecedores reais/homologação/produção têm gates próprios. Nenhuma dessas funcionalidades é apresentada como entregue por este smoke.
- Preview atualizado em loopback `http://127.0.0.1:3000/conteudos`, API 3001 e PostgreSQL 5434. Processos existentes de preview foram identificados antes de reiniciar; somente listeners Filaretti foram interrompidos, sem mexer em outros projetos. Revalidar processos/portas ao retomar.

**Ponto de parada:** F5 concluída em `0.5.0` com commit local verificado. **Próxima etapa:** F6 — CMS, mídia e publicação ponta a ponta. **Aguardando confirmação do usuário para F6; push não autorizado.**

### RP-005 — 03/10/2026 — F4 — Site institucional conectado à API

**Escopo autorizado:** “Design aprovado, ficou ótima estilização, prossiga para f4”. Aprovação visual da F3 e execução da F4, incluindo commit local conforme AGENTS.md. **Estado: concluída tecnicamente; aceite local aprovado.** F5, push, PR e publicação exigem autorização própria. Materiais oficiais continuam pendentes até F9.

**Versão:** `0.3.0` → `0.4.0`; oito manifests privados alinhados. Web passou a declarar somente a dependência local `@filaretti/types`; lockfile recebeu três linhas desse vínculo. Nenhuma biblioteca externa nova, alteração de schema, migration, seed ou dados de desenvolvimento.

**Git e continuidade:** cwd real `C:\Users\Samuel\Documents\Projetos\Filaretti`, pois o caminho antigo `Projeto` está ausente. Branch `dev` inicialmente limpa; base F3 real `cf5dedcd358c474d17cf3287238aca20c5bb629d`, um commit à frente de origin/dev. A autorização de push anterior cobria F2. Commit F4 previsto: `feat(site): conecta páginas institucionais à API (v0.4.0)`; SHA real informado na entrega e registrado na próxima retomada, sem commit circular.

**SHA confirmado na retomada F5:** `e96b124`, commit local da F4; branch `dev` sem alterações locais antes do início da fase seguinte.

#### Arquivos criados, alterados e removidos

Criados (32):

- `apps/web/src/app/(institutional)/areas-de-atuacao/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/areas-de-atuacao/page.tsx`
- `apps/web/src/app/(institutional)/error.tsx`
- `apps/web/src/app/(institutional)/layout.tsx`
- `apps/web/src/app/(institutional)/loading.tsx`
- `apps/web/src/app/(institutional)/not-found.tsx`
- `apps/web/src/app/(institutional)/o-escritorio/page.tsx`
- `apps/web/src/app/(institutional)/page.tsx`
- `apps/web/src/app/(institutional)/profissionais/[slug]/page.tsx`
- `apps/web/src/app/(institutional)/profissionais/page.tsx`
- `apps/web/src/components/institutional/area-views.tsx`
- `apps/web/src/components/institutional/home-view.tsx`
- `apps/web/src/components/institutional/index.ts`
- `apps/web/src/components/institutional/office-view.tsx`
- `apps/web/src/components/institutional/professional-views.tsx`
- `apps/web/src/components/institutional/shared.tsx`
- `apps/web/src/components/institutional/styles.css`
- `apps/web/src/components/institutional/types.ts`
- `apps/web/src/lib/public-api-core.ts`
- `apps/web/src/lib/public-api.ts`
- `apps/web/src/lib/public-content-core.ts`
- `apps/web/src/lib/public-content.tsx`
- `apps/web/src/lib/public-media.ts`
- `apps/web/src/lib/public-metadata.ts`
- `apps/web/src/lib/public-routing.ts`
- `apps/web/src/lib/public-status.ts`
- `apps/web/test/public-api.test.mjs`
- `apps/web/test/public-content.test.mjs`
- `apps/web/test/public-metadata.test.mjs`
- `apps/web/test/public-routing.test.mjs`
- `docs/public-site.md`
- `scripts/test-institutional.mjs`

Alterados (25):

- `README.md`
- `apps/api/package.json`
- `apps/api/src/domain/articles.service.ts`
- `apps/api/src/domain/dto.ts`
- `apps/api/test/domain.integration.test.ts`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/proxy.ts`
- `docs/api.md`
- `docs/architecture.md`
- `docs/design-system.md`
- `docs/security.md`
- `docs/seo.md`
- `package.json`
- `packages/config/package.json`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/ui/package.json`
- `plan.md`
- `pnpm-lock.yaml`
- `relate.md`

Removidos (1):

- `apps/web/src/app/page.tsx`

A página raiz inicial foi substituída pela Home dentro do grupo institucional. Inventário de 58 arquivos revisto para staging explícito. Helpers, ambientes, builds, JSONs e PNGs de evidência em `.local/` continuam ignorados.

#### Implementação e decisões

- Rotas `/`, `/o-escritorio`, `/areas-de-atuacao`, `/areas-de-atuacao/[slug]`, `/profissionais` e `/profissionais/[slug]` renderizadas no servidor com contratos reais da API. Header/footer e templates preservam o visual aprovado; menu, marca, conteúdo institucional, serviços, bio, formação, experiência, canais e relações recebem DTOs públicos. A única ilustração permanente é o artwork CSS substituível da F3; fotos ausentes usam iniciais.
- Home apresenta introdução, destaques, áreas, escritório, recentes, profissionais, guias, contato e newsletter. Recentes/destaques/guias usam consultas próprias de três itens, com filtro booleano `featured` acrescentado à API e seleção GUIDE já existente. Isso impede falso vazio quando há mais de cinquenta artigos recentes. O Nest/Prisma filtra publicações, datas e autores ativos; query inválida ou repetida é recusada. Nenhuma regra de publicação foi duplicada na interface.
- Índices usam paginação real de 12 itens; query `pagina` é limitada e traduzida ao backend. Detalhes renderizam serviços, relações e resumos de artigos publicados vinculados. Não há link de leitura para rotas F5 ainda ausentes; newsletter indica disponibilidade futura sem formulário/sucesso simulado. Canais vêm somente de settings.
- Cliente `server-only` com timeout cinco segundos, `no-store`, credenciais omitidas, redirecionamentos recusados, projeção/checagem de DTOs e erros fixos. React.cache deduplica por renderização, sem cache persistente. Mudanças aparecem na nova requisição. Dependências para futura invalidação estão documentadas em docs/public-site.md; F5/F6 definirão cache e revalidação operacional.
- PublicContent renderiza o subset institucional permitido pela API como JSX escapado, com headings/listas/marcas/URLs seguras. HTML bruto não é inserido. O renderer foi necessário para Page.sections, bios e descrições desta fase; não implementa páginas editoriais, sumário, compartilhamento ou PDF da F5.
- Metadata básica usa títulos/SEO/textos públicos e canonical da configuração pública, sem query/fragmento ou Host do visitante. Desenvolvimento continua noindex/nofollow. Next Image admite apenas raster público local em /media/public/**; rejeita origem externa, SVG, query, traversal e caminho privado. Storage/upload/hosts de fornecedor seguem F6.
- Proxy verifica o status do recurso público antes do streaming: inexistência/retirada retorna HTTP404 navegável; erro da API retorna HTTP503 com Retry-After30/no-store e mensagem sanitizada. Guardas servidor, loading, error boundary e estados vazios também existem. Há uma consulta adicional por rota; não é um snapshot transacional entre Proxy e renderização.
- Três subagentes apoiaram cliente/renderer, views e QA com propriedade de arquivos distinta; principal revisou, integrou e verificou resultados. Revisão corrigiu anchor Conteúdos, consultas independentes da Home, especificidade CSS em 320px, quebra de palavras longas e tipos gerados antigos após a mudança da rota raiz.
- Runner versionado test:institutional cria banco PostgreSQL, processos e raster próprios; não migra/reseeda/reset o banco existente. Exige desenvolvimento, loopback, portas livres e navegador já instalado. Smoke visual fica local; CI existente mantém os checks de API/monorepo e não foi apresentado como navegador executado remotamente.

#### Validação executada

| Check                   | Resultado/evidência                                                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuidade/instalação | RTK.md, AGENTS.md, plan inteiro, RP-004 e docs aplicáveis lidos; Git/cwd/base/serviços verificados; pnpm install --frozen-lockfile passou                                                                                                                 |
| Lint/typecheck          | pnpm lint e pnpm typecheck passaram após integração final                                                                                                                                                                                                 |
| Testes                  | pnpm test: 29 aprovados (19 web, 7 config, 3 API/fundação); sem falhas/skips                                                                                                                                                                              |
| PostgreSQL/API          | pnpm test:integration: 28 aprovados em banco real isolado; featured true/false/combinação GUIDE, query inválida, visibilidade, auth/CSRF/roles, integridade e health. Migrations/seeds/idempotência/gate de seed e provisionamento isolado passaram       |
| Build                   | pnpm build passou; seis rotas institucionais dinâmicas, demos preservadas, Proxy e icon.svg; nenhum backend necessário para pré-renderizar conteúdo institucional                                                                                         |
| Contraste               | pnpm test:design-system: 44 combinações aprovadas; browser analisou 2033 amostras de texto sólido, zero abaixo de 4,5:1 e zero ignoradas                                                                                                                  |
| Smoke integrado         | test:institutional em Edge `154.0.4258.53` headless: 43 checks aprovados, 30 layouts em 320/768/1024/1440/1920, 62 PNG, zero falhas/console/overflow. Um h1/main por template, labels, skip, alt/imagens e foco/teclado foram verificados                 |
| Dados mutáveis          | Banco/API/SSR real: alteração de settings, área/serviços, perfil/bio/formação/experiência e seções/SEO do escritório refletida sem rebuild. Rich document preservou semântica e exibiu script como texto, sem execução                                    |
| Seleções Home           | Catálogo de teste com 67 publicados, sendo 55 ARTICLE novos não destacados: destaques e guias antigos continuaram na Home; drafts/scheduled/archived marcados featured permaneceram ocultos                                                               |
| Estados e privacidade   | Slugs ausentes, área/perfil inativo e escritório draft: HTTP404 real; listas vazias e página distante:200 com estado vazio; API interrompida:503 em seis rotas com no-store/Retry-After30; recuperação:200. Erros/corpos SSR sem segredos/campos internos |
| Imagem                  | PNG fictício owned 512×384 em mídia pública da API, relacionado a foto/capa: Next Image respondeu200 e redimensionou para256×192; origens/path inseguros protegidos por unitários/allowlist                                                               |
| Limpeza e ambiente      | Banco temporário, raster e processos de teste removidos; confirmação independente em pg_database/arquivo/portas3004–3005. API3001/Next3000 existentes continuaram200 e PostgreSQL permaneceu saudável                                                     |
| Formato/diff            | Prettier e git diff --check passaram; inventário revisado, sem ambientes/artefatos privados staged                                                                                                                                                        |

Houve correção de referência stale em .next/dev/types após mover a raiz; somente esse diretório gerado foi removido e regenerado, sem alterar fonte/dados. A integração herdada emitiu aviso de depreciação pg sobre consultas concorrentes; não causou falha e não representa teste pendente desta entrega.

Evidências ignoradas: .local/f4-smoke.json, .local/f4-cleanup.json, .local/f4-qa.md e .local/f4-evidence/*.png. O principal inspecionou imagens de todos os seis templates e do documento rico, além da inspeção do QA. Os screenshots usam dados/raster do banco temporário, sem identidade ou fotografia real.

#### Limites e ponto de parada

- Aceite local de desenvolvimento com PostgreSQL/API reais. Não certifica dispositivos físicos, Firefox/Safari, leitor de tela, WCAG completa, Lighthouse/metas de desempenho, storage R2, e-mails, Turnstile ou produção; esses gates permanecem F6–F10.
- Fotos/identidade/textos oficiais, contatos aprovados, domínio e política jurídica continuam pendentes. Aprovação da estilização foi registrada, sem carga de material real. Leitura editorial completa/cache F5, CMS F6 e busca/relacionamento/SEO completo F7 não foram antecipados.
- Nenhum push, PR, merge, deploy, túnel, DNS, cadastro externo ou envio real foi executado. Commit local está incluído na autorização da etapa. Preview atual em loopback3000; API3001 e PostgreSQL5434. Processos desta sessão: API90853 e Next85062; revalidar portas/PIDs ao retomar.

**Ponto de parada:** F4 concluída, versão `0.4.0`. **Próxima etapa:** F5 — Portal editorial e leitura de conteúdos, somente após confirmação do usuário. Reler documentos e verificar Git/serviços antes de prosseguir; registrar SHA real da F4 na próxima retomada.

### RP-004 — 03/10/2026 — F3 — Design System e estrutura de interfaces

**Escopo autorizado:** “Inicie a fase F3”. Implementação da F3 e commit local conforme AGENTS.md. **Estado: concluída tecnicamente; aceite local aprovado.** F4, push, PR e publicação dependem de autorização própria.

**Versão:** `0.2.0` → `0.3.0`; oito manifests privados alinhados. Nenhuma dependência nova, alteração de schema, migration, seed ou consulta. Lockfile preservado e instalação frozen aprovada.

**Git e continuidade:** cwd real `C:\Users\Samuel\Documents\Projetos\Filaretti`; caminho antigo `Projeto` ausente. Branch `dev` inicialmente limpa, base F2 `93ac520ea35fa11a291c271a9d707d65a3f90b59`; remoto existente `origin` em samuel-dsev/filaretti. SHA real da F2 confirmado nesta retomada. Commit F3 previsto: `feat(ui): implementa design system e layouts (v0.3.0)`; SHA informado após commit e registrado na próxima retomada, sem commit circular.

#### Arquivos criados e alterados

Criados (34):

- `apps/web/src/app/dev/design-system/admin/page.tsx`
- `apps/web/src/app/dev/design-system/demo-content.ts`
- `apps/web/src/app/dev/design-system/demo.css`
- `apps/web/src/app/dev/design-system/layout.tsx`
- `apps/web/src/app/dev/design-system/page.tsx`
- `apps/web/src/app/dev/design-system/showcase.tsx`
- `apps/web/src/app/icon.svg`
- `apps/web/src/components/admin/admin-layout.tsx`
- `apps/web/src/components/admin/index.ts`
- `apps/web/src/components/admin/styles.css`
- `apps/web/src/components/site/brand.tsx`
- `apps/web/src/components/site/breadcrumb.tsx`
- `apps/web/src/components/site/content-cards.tsx`
- `apps/web/src/components/site/hero.tsx`
- `apps/web/src/components/site/icons.tsx`
- `apps/web/src/components/site/index.ts`
- `apps/web/src/components/site/public-layout.tsx`
- `apps/web/src/components/site/search-overlay.tsx`
- `apps/web/src/components/site/site-footer.tsx`
- `apps/web/src/components/site/site-header.tsx`
- `apps/web/src/components/site/styles.css`
- `apps/web/src/components/site/types.ts`
- `apps/web/src/lib/local-demo.ts`
- `apps/web/src/proxy.ts`
- `apps/web/test/local-demo.test.mjs`
- `packages/ui/src/accordion.tsx`
- `packages/ui/src/avatar.tsx`
- `packages/ui/src/button.tsx`
- `packages/ui/src/dialog.tsx`
- `packages/ui/src/fields.tsx`
- `packages/ui/src/styles.css`
- `packages/ui/src/surfaces.tsx`
- `packages/ui/src/toast.tsx`
- `scripts/check-design-system.mjs`

Alterados (20):

- `.github/workflows/ci.yml`
- `README.md`
- `apps/api/package.json`
- `apps/web/package.json`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `docs/architecture.md`
- `docs/design-system.md`
- `docs/security.md`
- `package.json`
- `packages/config/package.json`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `packages/ui/src/panel.tsx`
- `plan.md`
- `relate.md`

Nenhum arquivo removido. Helpers, JSONs e imagens de evidência em `.local/` permanecem ignorados, como ambientes privados e builds. Inventário de 54 arquivos revisado para staging explícito.

#### Implementação e decisões

- Tokens semânticos da paleta prevista, cores de status, foco claro/escuro, escala tipográfica/espaçamento, containers e breakpoints. Inter e Cormorant Garamond via next/font, hospedadas no build com fallback e display swap. O primeiro build usa rede para obter fontes; o navegador não consulta Google Fonts.
- Biblioteca UI compartilhada: botões/links, campos/FormField com erros e ajuda associados, cards/badges/avatar, Dialog/Drawer, Accordion, Pagination, Skeleton, Toast e vazio/erro. Panel preservado. HTML dialog mantém foco, bloqueia scroll e devolve foco ao acionador; Escape explícito cobre o comportamento particular do search input no Edge. Componentes não importam módulos do backend.
- Layout público: header configurável, mega menu, navegação mobile, footer, hero, breadcrumb, cards editoriais/áreas/profissionais e busca demonstrativa. Layout administrativo: sidebar responsiva, navegação, cabeçalho e slots. Conteúdo vem de props; a integração com domínio fica nas fases consumidoras. Marca tipográfica, SVG e ilustrações CSS substituíveis, sem imagens/identidades reais.
- Demonstrações `/dev/design-system` e `/dev/design-system/admin`: somente APP_ENV development e Host loopback exato, no-store/noindex. Proxy Next bloqueia antes do streaming com 404, complementado pela guarda de layout servidor. Nenhuma sessão administrativa, API, envio ou persistência de campo da demo.
- Formulário de exemplo valida localmente, associa feedback ARIA e focaliza o primeiro inválido; sucesso informa ausência de envio. Paginação altera query/aria-current. Toast mantém mensagem até fechamento pelo usuário. Menus e acordeões usam semântica de navegação/divulgação, sem dependência de hover. Reduced motion e estados loading/empty/error presentes.
- Três subagentes trabalharam em UI, layouts e QA com arquivos separados; principal integrou, revisou código/evidências e executou checks. Correções decorrentes da revisão: skip link único/main consistente, keys de links com mesmo destino, Escape no search, rejeição antes do streaming, ícone local, botão busca sem quebra em 1024 px e espaçamento entre blocos admin.
- Checker de contraste sem dependências acrescentado como `pnpm test:design-system` e ao CI. Dois testes da allowlist entram em `pnpm test` da web; manifesto web declara ESM para executá-los nativamente no Node 24. Workflow foi atualizado, sem execução remota nesta sessão.

#### Validação executada

| Check                   | Resultado/evidência                                                                                                                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Continuidade/instalação | AGENTS.md, plan inteiro, RP-003 e docs aplicáveis lidos; dev limpa/base F2 confirmadas; pnpm install --frozen-lockfile passou                                                                                                                                                 |
| Lint/typecheck          | pnpm lint e pnpm typecheck passaram; checks focados de UI/layouts também passaram                                                                                                                                                                                             |
| Testes                  | pnpm test: 12 aprovados (7 config, 3 API/fundação, 2 allowlist de demonstração); sem falhas/skips                                                                                                                                                                             |
| Build                   | pnpm build passou para monorepo; web otimizada repetida após correções finais, com duas demos dinâmicas, Proxy e icon.svg                                                                                                                                                     |
| Contraste               | 44 combinações semânticas aprovadas; mínimo de texto 5,025:1 e de controle 3,082:1. Duas paletas degradadas foram rejeitadas em cópias isoladas, sem tocar fonte                                                                                                              |
| Navegador/layouts       | Edge `154.0.4258.53` headless, bundle otimizado em loopback3003: público/admin em 375/768/1024/1440/1920 px; 10 layouts, um h1/main, labels/noindex/skip e sem overflow horizontal ou falha no contraste de texto sólido                                                      |
| Interações              | 15 cenários aprovados: mega menu por Enter/ArrowDown/Escape; busca com foco inicial/estado/vazio e Escape; modal/drawer com Tab/Escape/restauração; accordion; form inválido/válido sem mutação de rede; toast; paginação; reduced motion; menus mobile/admin e host negativo |
| Gates reais locais      | Bundle otimizado iniciado somente no host local sob development/staging/production: duas rotas200 em development e404 nos outros ambientes; três hosts negativos404; no-store. Não é deploy em ambiente externo                                                               |
| Inspeção visual         | 20 PNGs dos layouts (10 fullPage + 10 viewport) e 4 overlays; principal inspecionou os cinco tamanhos e templates; correção1024 revisada. Rodada final sem console error, pageerror ou HTTP inesperado >=400                                                                  |
| Fronteiras              | Nenhum import de Prisma/Nest/config privado em fonte UI/web, e nenhum envio de dados no formulário/busca demo; ambientes/builds/evidências ignorados pelo Git                                                                                                                 |
| Formatação/Git          | Prettier e git diff --check no fechamento; staging explícito dos arquivos desta etapa, sem push                                                                                                                                                                               |

Evidências ignoradas: `.local/f3-smoke.json`, `f3-contrast.json`, `f3-contrast-negative.json`, `f3-gates.json` e `f3-evidence/`. Smokes/browser helpers são locais, não testes Playwright portáveis/CI; a consolidação E2E está prevista na F8. Não declarar execução remota do workflow.

#### Limites e encerramento

- Nenhuma verificação com Safari/Firefox, dispositivos físicos ou leitor de tela. Contraste sólido/teclado e inspeção visual não certificam conformidade WCAG completa; revisão abrangente na F8.
- PostgreSQL/integracao de domínio não repetidos nesta fase: schema, migrations e consultas não mudaram; o aceite real da F2 permanece no RP-003. Nenhum fornecedor, e-mail, storage remoto, DNS, conta ou dado real foi operado.
- Busca é estrutura visual; páginas/API na F4/F5, CMS na F6 e relacionamento/busca operacional na F7. Identidade, fotos e materiais oficiais dependem de aprovação até F9. O painel demonstrativo não autentica nem representa CMS concluído.
- Preview otimizado local disponibilizado em `http://127.0.0.1:3003/dev/design-system` durante a entrega; execução futura pelo README. Nenhum push, PR, merge, release ou deploy foi realizado.

**Ponto de parada:** F3 concluída, versão `0.3.0`. **Próxima etapa:** F4 — Site institucional conectado à API, somente após confirmação do usuário. Reler documentos, conferir Git/cwd e registrar o SHA real da F3 na próxima retomada.

### RP-003 — 03/10/2026 — F2 — Banco, autenticação e API de domínio

**Escopo autorizado:** “Inicie a F2 do desenvolvimento, não esqueça de ao final da fase, subir o projeto a branch dev remota”; retomada “continue de onde parou”. Implementação e fechamento da F2, commit local e push para `origin/dev` cobertos pela autorização. **Estado: concluída tecnicamente, com aceite local aprovado.** F3 aguarda autorização.

**Versão:** `0.1.0` → `0.2.0`; raiz e sete workspaces privados alinhados (oito manifests). Prisma Client gerado em `node_modules`, sem código gerado no Git. Novas APIs são o primeiro contrato de domínio; não há consumidores de produção anteriores.

**Git e continuidade:** cwd real `C:\Users\Samuel\Documents\Projetos\Filaretti`; o caminho antigo `Projeto` está ausente. Branch `dev` acompanha `origin/dev`; remoto existente `https://github.com/samuel-dsev/filaretti.git`. Base limpa da F1 confirmada: `1ffd1958d078fcf8390fb8f56da87557f0c750f3` — `docs(foundation): conclui aceite local da F1 (v0.1.0)`. Commit desta etapa previsto: `feat(api): implementa banco, autenticação e domínio (v0.2.0)`; SHA e confirmação do push serão informados após a operação e registrados na próxima retomada. Não criar commit circular somente para inserir o próprio hash.

#### Arquivos criados e alterados

Arquivos versionáveis criados (36):

- `apps/api/prisma/migrations/202610020001_f2_domain/migration.sql`
- `apps/api/prisma/migrations/202610020002_search_integrity/migration.sql`
- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/prisma/provision-admin.ts`
- `apps/api/prisma/seed-client.ts`
- `apps/api/prisma/seed-development.ts`
- `apps/api/prisma/seed-production.ts`
- `apps/api/prisma/tsconfig.json`
- `apps/api/scripts/run-integration.mjs`
- `apps/api/scripts/verify-provision.mjs`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/cookies.ts`
- `apps/api/src/auth/dto.ts`
- `apps/api/src/auth/guards.ts`
- `apps/api/src/auth/password.ts`
- `apps/api/src/auth/recovery.service.ts`
- `apps/api/src/auth/responses.ts`
- `apps/api/src/auth/types.ts`
- `apps/api/src/auth/users.controller.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/prisma.service.ts`
- `apps/api/src/domain/articles.service.ts`
- `apps/api/src/domain/content.ts`
- `apps/api/src/domain/domain.controllers.ts`
- `apps/api/src/domain/domain.module.ts`
- `apps/api/src/domain/dto.ts`
- `apps/api/src/domain/institution.service.ts`
- `apps/api/src/domain/responses.ts`
- `apps/api/src/domain/shared.ts`
- `apps/api/test/auth.integration.test.ts`
- `apps/api/test/database.integration.test.ts`
- `apps/api/test/domain.integration.test.ts`
- `packages/types/src/auth.ts`
- `packages/types/src/domain.ts`

Arquivos versionáveis alterados (28):

- `.github/workflows/ci.yml`
- `README.md`
- `apps/api/package.json`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/test/foundation.test.ts`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `docs/api.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/deployment.md`
- `docs/security.md`
- `package.json`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/eslint-config/package.json`
- `packages/tsconfig/package.json`
- `packages/types/package.json`
- `packages/types/src/index.ts`
- `packages/ui/package.json`
- `plan.md`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `relate.md`
- `turbo.json`

Nenhum arquivo do baseline removido. AGENTS.md, relatórios anteriores e documentos de design/SEO preservados. Helpers/evidências em `.local/`, builds, dependências e ambientes privados permanecem ignorados; os scripts temporários de diagnóstico não integram a entrega. Senhas versionadas são exclusivamente a fixture fictícia local documentada, bloqueada para o provisionamento de produção.

#### Implementação e decisões

- **Persistência:** 26 modelos/tabelas Prisma, UUIDs, relações/FKs com exclusão explícita, slugs/e-mails únicos, datas UTC, checks de integridade e versões positivas. Duas migrations adicionam schema e Full Text Search PostgreSQL em português, com vetores atualizados por triggers e três índices GIN parciais. Referências de mídia editorial pública e anexos privados são protegidas no banco, inclusive contra alteração posterior de visibilidade.
- **Seeds:** desenvolvimento exige APP_ENV/NODE_ENV de desenvolvimento e MOCK_CONTENT=true; cria 3 usuários de roles distintas, 4 profissionais, 5 áreas, 20 conteúdos (12 publicados, 4 drafts, 2 agendados, 2 arquivados), 6 categorias, 20 tags, 6 FAQ, 4 páginas, 3 contatos e 3 assinantes fictícios. Registros aplicáveis têm isMock=true. Repetição não duplica, sobrescreve edições nem redefine senhas. Produção cria somente configuração estrutural vazia, sem conteúdo ou senha padrão; não realiza limpeza implícita de mocks.
- **Identidade:** Argon2id, access JWT de até 900 segundos, cookies HttpOnly/Secure em produção, CSRF assinado e validação de Origin. Refresh rotativo persiste hashes, tem expiração absoluta e revoga a família na reutilização; todas as requisições autenticadas verificam sessão e usuário no banco. Logout, desativação e troca/reset de senha revogam sessões. Rate limits persistidos e travas transacionais protegem múltiplas instâncias e concorrência. ADMIN cria/lista/desativa usuários; recuperação usa tokens expirantes de consumo único, sem entrega real nesta fase.
- **Primeiro ADMIN:** ferramenta exige ambiente de produção configurado e senha por stdin, sem valor padrão; valida identidade, usa Argon2id e advisory lock, cria auditoria atomicamente e recusa novo provisionamento se ADMIN ativo existir. Seu comportamento foi comprovado somente em banco temporário local com identidade fictícia, sem operar produção.
- **Domínio:** APIs públicas/administrativas de artigos, taxonomias, profissionais, áreas, páginas, FAQ, configurações e redirects. AUTHOR mantém apenas os próprios drafts; EDITOR/ADMIN publicam. DTOs rejeitam campos extras, respostas usam allowlists, paginação padrão 1/12 e limite 50, filtros editoriais combinados e conflitos de edição retornam códigos estáveis. TipTap admite somente nós/marks/URLs definidos e limitados; redirects internos são validados contra ciclos em transação serializável.
- **Integração:** Next encaminha `/api/v1` para a API na mesma origem; regras permanecem no Nest. Swagger 0.2.0 descreve rotas/DTOs/schemas reais e autenticação por cookie. Pacotes de tipos exportam contratos públicos e interfaces para fluxos posteriores, sem modelos Prisma ou segredos. Configuração mantém fornecedores desabilitados até suas fases; CI gera Prisma Client antes dos checks e não publica automaticamente.
- **Dependências:** Prisma Client/adapter 7.10.0, Nest JWT 12.0.2, Argon2 0.45.1 e tsx 4.23.15 fixados no lockfile; build nativo de Argon2 explicitamente permitido. DATABASE_URL é repassada somente a tarefas de servidor que exigem o Prisma config, sem inclusão em configuração pública da web.
- **Revisão:** subagentes de banco, autenticação e domínio trabalharam com arquivos/responsabilidades separados; principal integrou, revisou e executou os checks completos. Correções de validação incluíram branches específicos nos triggers de mídia, ordenação Prisma com desempate separado, Swagger/cookie consistente, fixtures compatíveis com validação e verificação de parâmetros Argon2 independente da ordem textual.

#### Validação executada

| Check                           | Resultado/evidência                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalação reproduzível         | `rtk proxy pnpm install --frozen-lockfile` passou, incluindo suporte nativo Argon2 verificado                                                                                                                                               |
| Prisma                          | Schema validado e Client 7.10.0 gerado; seeds/provisionamento incluídos em TypeScript estrito e lint                                                                                                                                        |
| Lint                            | `rtk proxy pnpm lint` passou nos oito tasks; lint da API repetido após os últimos ajustes de scripts/fixtures também passou                                                                                                                 |
| Typecheck                       | `rtk proxy pnpm typecheck` passou nos oito tasks, incluindo testes e ferramentas Prisma                                                                                                                                                     |
| Build                           | `rtk proxy pnpm build` passou nos cinco tasks; API compilada e Next otimizado                                                                                                                                                               |
| Testes de configuração/fundação | `rtk proxy pnpm test` passou: sete casos de configuração e três de fundação/HTTP, incluindo rotas e scheme de cookie do Swagger                                                                                                             |
| Integração completa             | `rtk proxy pnpm test:integration` terminou com exit 0: 27 entradas Node aprovadas (25 cenários e dois agrupamentos), zero falhas/skips, HTTP e PostgreSQL 17.11 reais                                                                       |
| Migrations e seeds              | Dois bancos novos isolados receberam ambas as migrations; seed dev executado duas vezes e contagens de todas as tabelas preservadas; execução fora de dev recusada pelo código esperado; seed estrutural repetido criou somente um settings |
| Banco/consultas                 | Relações e contagens, unicidade/FKs, exclusões em uso, stemming português, três GINs, atualização/retirada dos vetores e privacidade de vínculos de mídia comprovados                                                                       |
| Autenticação/segurança          | Login, cookies/hashes, CSRF/origem, overposting, expiração/tampering, refresh/reuse concorrente, logout, roles, ADMIN/desativação concorrente, troca/reset de senha e limites compartilhados comprovados                                    |
| Domínio                         | Visitante sem acesso administrativo/pessoal, ownership AUTHOR, conteúdo/URLs maliciosos rejeitados, filtros combinados, publicação/retirada, edição concorrente, CRUD institucional, settings/redirects e Swagger comprovados               |
| Provisionamento isolado         | Primeiro ADMIN, hash/parâmetros Argon2id, auditoria, recusa da repetição e ausência de credenciais nas saídas comprovados em banco temporário local com flags de produção; nenhuma conta de produção real criada                            |
| Ambiente local existente        | `rtk proxy pnpm db:migrate` e `rtk proxy pnpm db:seed:development` passaram no banco local existente, sem reset/exclusão de dados/volumes                                                                                                   |
| Smoke mesma origem              | Web 200, health 200; leitura pública direta e proxy idênticas com 12 artigos publicados; admin anônimo 401; Swagger com versão 0.2.0 e 42 paths; CSRF → login ADMIN → me → logout 204 → sessão antiga 401                                   |
| Git/segredos                    | Ambientes reais, .local, builds e dist-test ignorados; inventário versionável revisado explicitamente, sem arquivos temporários/credenciais reais                                                                                           |

O runner cria e remove exclusivamente seus bancos temporários de nomes aleatórios, preservando o banco/volume de desenvolvimento. A execução integrada exibiu um aviso de depreciação do driver pg sobre consultas enfileiradas no mesmo client; não houve falha e a versão atual permanece fixada no lockfile. Compatibilidade com pg 9 não foi declarada.

#### Limites, pendências e encerramento

- O aceite é local com PostgreSQL e HTTP reais. Workflow GitHub atualizado, mas sua execução remota não foi observada nesta sessão; CLI `gh` indisponível. Nenhum deploy, merge, PR, release, DNS, contratação ou envio externo foi executado. O push do código para `origin/dev` é a ação remota expressamente solicitada.
- Interfaces visuais/design entram na F3; páginas conectadas na F4/F5. Upload, preview, agendamento operacional e revalidação entram na F6; contato/newsletter/busca/envio real/antispam na F7. Entidades/interfaces/triggers preparadas não equivalem a esses fluxos concluídos. Agendados fictícios ficam fora da leitura pública; não há worker funcionando ainda.
- Recuperação tem serviço e segurança testados com entrega injetada em memória, mas não envia e-mail nem permite concluir o fluxo pela interface nesta fase. R2/Resend/Turnstile e homologação/produção permanecem gates próprios. Materiais e identidades reais dependem de aprovação nas fases previstas.
- `pnpm format:check` e `git diff --check` passaram no fechamento. Inventário dos 64 arquivos da fase revisado para staging explícito; commit coeso na branch dev e push conforme autorização. SHA local/remoto será conferido na entrega ao usuário, sem force push.

**Ponto de parada:** F2 concluída, versão `0.2.0`. **Próxima etapa:** F3 — Design System e estrutura de interfaces, **somente após confirmação do usuário**. Ao retomar, reler AGENTS.md/plan.md/relate.md, verificar Git/cwd e serviços locais, registrar SHA real da F2 e então executar apenas a próxima etapa autorizada.

### RP-002 — 02/10/2026 — F1 — Aceite local concluído

**Escopo autorizado:** "docker disponivel, conclua a f1". Retomada limitada ao aceite pendente da F1 e ao fechamento documental/local. **Estado: concluída tecnicamente.** F2 não iniciada.

**Versão:** `0.1.0` → `0.1.0`; sem alteração de aplicação/manifest/lockfile. Completar a validação/documentação do mesmo marco não gera outro bump, conforme a política do plano.

**Git e continuidade:** cwd `C:\Users\Samuel\Documents\Projetos\Filaretti`, branch `dev`, Git limpo na retomada, remoto `origin` existente. Commit parcial anterior confirmado: `4e1cae8a3b489094a3a809bfd27b1bec809a7b15` — `feat(foundation): prepara base local da F1 (v0.1.0)`. Esse SHA registra a entrega parcial do RP-001, que foi preservado integralmente. Commit de fechamento previsto: `docs(foundation): conclui aceite local da F1 (v0.1.0)`; SHA real informado na entrega e registrado na próxima retomada, sem commit circular para inserir o próprio hash.

#### Arquivos e mudanças

- Alterados: `plan.md` (estado F1, checkpoint, próxima fase/gate e atualização final) e `relate.md` (situação atual, RP-002, evidências e SHA anterior).
- Nenhum arquivo versionável novo/removido; código, manifests, lockfile, README, sete docs técnicos e AGENTS.md preservados.
- Evidências locais ignoradas criadas: `.local/f1-acceptance.cjs`, `.local/f1-runtime-up.json`, `.local/f1-runtime-down.json`, `.local/f1-runtime-recovered.json` e script local de atualização do checkpoint. Sem credenciais/strings de conexão nessas evidências.
- Infraestrutura real de desenvolvimento iniciada: rede `filaretti-local_default`, volume `filaretti-local_postgres_data` e contêiner `filaretti-local-postgres-1`. Volume persistente mantido; nenhuma migration, tabela de domínio, seed ou reset executado.

#### Validação e evidências do aceite

| Check                   | Resultado                                                                                                                                                                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker e isolamento     | Engine 29.7.2 disponível; Compose 5.4.0, desktop-linux. Somente serviço PostgreSQL do projeto filaretti-local operado; serviços WAIA existentes não alterados                                                                                                                                             |
| Instalação reproduzível | `rtk proxy pnpm install --frozen-lockfile` passou; ambiente local existente preservado, sem repetir setup ou expor valores                                                                                                                                                                                |
| Compose/configuração    | `rtk proxy docker compose config --quiet` passou; `rtk proxy docker compose up -d --wait --wait-timeout 120` baixou a imagem fixada, criou volume/rede e atingiu estado healthy                                                                                                                           |
| Banco real              | `SHOW server_version` retornou 17.11; imagem/digest igual ao Compose/CI versionados; bind restrito a 127.0.0.1:5434                                                                                                                                                                                       |
| Inicialização dos apps  | `rtk proxy pnpm dev` iniciou Next/Nest e compilação compartilhada; web200/noindex e APIhealth200/up. A primeira sondagem antecipou a conclusão do startup da API e foi refeita após sua inicialização                                                                                                     |
| Integração PostgreSQL   | `rtk proxy pnpm test:integration` passou: um teste Node/HTTP executou SELECT1 contra banco real; não houve skip ou adaptador simulado                                                                                                                                                                     |
| Banco disponível        | GET /health200, corpo exato `{"status":"ok","database":"up"}`, no-store e UUID próprio; resposta em124ms na sondagem inicial                                                                                                                                                                              |
| Banco parado            | `rtk proxy docker compose stop postgres`; GET /health503, corpo exato `{"status":"error","database":"down"}`, no-store; resposta em69ms, sem credenciais/stack                                                                                                                                            |
| Recuperação             | `rtk proxy docker compose start postgres` e Compose up com espera; GET /health200/up em90ms, sem reiniciar API. Mesmo PID da API permaneceu atendendo                                                                                                                                                     |
| Persistência            | Compose recriou o contêiner durante a subida; volume com mesmo nome/mount e identificador do cluster PostgreSQL antes/depois iguais. Nenhum volume removido ou dado resetado                                                                                                                              |
| Web após recuperação    | Página da fundação200, conteúdo fictício explícito e header noindex preservados                                                                                                                                                                                                                           |
| Checks da aplicação     | Os dez testes de configuração/HTTP, lint sem warnings, typecheck, build otimizado, Prisma validate, format/diff e audit de produção já passaram no RP-001 para o commit4e1cae8. Não houve alteração de aplicação nesta retomada; foram executados os checks pendentes do banco, sem repetir a suíte ampla |
| Revisão independente    | Subagente realizou revisão estática de plano/README/docs/Turbo/CI/hook/config/health/logs/testes/fronteira web; nenhum achado impeditivo. Principal executou todo o runtime e integração; subagente não editou ou operou serviços                                                                         |

O resultado agregado da F1 é **11 testes aprovados**: dez da preparação (RP-001) e um de integração real nesta retomada, além do smoke de disponibilidade/indisponibilidade/recuperação. As evidências visuais e de teclado em375/1440px estão no RP-001; interface não mudou e não foi alegada validação em outros navegadores/dispositivos.

#### Operação, limites e próxima etapa

- O bloqueio anterior de Docker/WSL2 foi resolvido no ambiente após o reinício informado pelo usuário. Não foi necessário alterar BIOS/boot/Windows por ferramenta nesta retomada.
- Web/API permanecem em desenvolvimento local (127.0.0.1:3000/3001) e PostgreSQL saudável com volume persistente. O processo pnpm dev desta sessão usa o contexto de execução 77567; para iniciar outra sessão, encerrar/reutilizar a existente, evitando conflito de portas.
- Toda a fundação prevista na F1 está implementada e seu aceite local comprovado. A ressalva de atualização do ESLint9 por compatibilidade de plugins, já registrada em RP-001, permanece; o audit de produção anterior não reportou vulnerabilidades conhecidas.
- Workflow CI está versionado; não foi executado no GitHub nesta sessão. Fornecedores reais, auth/domínio, migrations e demais funcionalidades pertencem às fases futuras. Não há publicação ou aceite de produção.
- Versão única 0.1.0 mantida. `pnpm format:check` e `git diff --check` passaram; o staging explícito do fechamento contém somente `plan.md` e `relate.md`. Não houve push, PR, merge, release, deploy ou envio externo.

**Ponto de parada:** F1 concluída. **Próxima etapa:** F2 — banco, autenticação e API de domínio, somente após confirmação do usuário. Ao retomar, reler os três documentos, conferir Git/cwd, registrar SHA do fechamento e verificar os serviços locais existentes.

### RP-001 — 02/10/2026 — F1 — Fundação local; aceite PostgreSQL pendente

**Escopo autorizado:** iniciar e concluir somente F1, com Git já preparado pelo usuário. Durante a execução, o usuário pediu: "Quando terminar aguarde o reinicio do computador, para o docker disponibilizar". Preparação/checks independentes concluídos; aguardando reinício para finalizar o aceite, sem iniciar F2.

**Estado:** **parcial**. Código da fundação e checks locais aprovados; a etapa inteira não está concluída porque PostgreSQL/Compose e health 200 reais não foram comprovados.

**Versão:** `0.0.0` documental → `0.1.0`; referência na raiz e oito workspaces privados alinhados. Não há mudança de contrato de produção preexistente.

**Git/cwd:** pasta atual `C:\Users\Samuel\Documents\Projetos\Filaretti`; antiga `Projeto` ausente. Repositório inicialmente limpo, branch `dev` acompanhando `origin/dev`; remoto `https://github.com/samuel-dsev/filaretti.git`. Baseline do usuário `6c84b6a9d06d10cc48a104525f99b377d3eaef41`. Nenhum repositório/branch/remoto foi criado. Commit local previsto da base: `feat(foundation): prepara base local da F1 (v0.1.0)`; SHA real será informado após o commit e registrado na próxima retomada. Este commit parcial não equivale ao aceite completo da F1.

#### Arquivos criados e alterados

Arquivos versionáveis criados nesta preparação (70):

- `.editorconfig`
- `.env.example`
- `.gitattributes`
- `.github/workflows/ci.yml`
- `.gitignore`
- `.husky/pre-commit`
- `.node-version`
- `.prettierignore`
- `.prettierrc.json`
- `README.md`
- `apps/api/.env.example`
- `apps/api/eslint.config.mjs`
- `apps/api/package.json`
- `apps/api/prisma.config.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/common/sanitized-logger.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/health/health.service.ts`
- `apps/api/src/main.ts`
- `apps/api/test/foundation.test.ts`
- `apps/api/test/health.integration.test.ts`
- `apps/api/test/helpers.ts`
- `apps/api/tsconfig.json`
- `apps/api/tsconfig.test.json`
- `apps/web/.env.example`
- `apps/web/eslint.config.mjs`
- `apps/web/next.config.ts`
- `apps/web/package.json`
- `apps/web/postcss.config.mjs`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/tsconfig.json`
- `compose.yaml`
- `docs/api.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/deployment.md`
- `docs/design-system.md`
- `docs/security.md`
- `docs/seo.md`
- `package.json`
- `packages/config/eslint.config.mjs`
- `packages/config/package.json`
- `packages/config/src/index.ts`
- `packages/config/test/environment.test.ts`
- `packages/config/tsconfig.json`
- `packages/config/tsconfig.test.json`
- `packages/eslint-config/base.js`
- `packages/eslint-config/package.json`
- `packages/tsconfig/base.json`
- `packages/tsconfig/nextjs.json`
- `packages/tsconfig/package.json`
- `packages/types/eslint.config.mjs`
- `packages/types/package.json`
- `packages/types/src/index.ts`
- `packages/types/tsconfig.json`
- `packages/ui/eslint.config.mjs`
- `packages/ui/package.json`
- `packages/ui/src/index.ts`
- `packages/ui/src/panel.tsx`
- `packages/ui/tsconfig.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `scripts/setup-local.mjs`
- `turbo.json`

Arquivos preexistentes alterados: `plan.md` e `relate.md`, para checkpoint, versão, estado real do Git e histórico. `AGENTS.md` preservado. Nenhum arquivo do baseline foi removido. Prettier normalizou apresentação de documentos sem apagar o histórico RP-000.

Arquivos locais ignorados gerados: `.env`, `apps/api/.env`, `apps/web/.env.local`, pacotes instalados/builds, tipos Next e evidências `.local/smoke.cjs`, `.local/smoke-mobile.png` e `.local/smoke-desktop.png`. Contêm somente ambiente local de desenvolvimento; segredos aleatórios não foram exibidos/versionados. Os arquivos `apps/web/AGENTS.md`/`CLAUDE.md`, gerados automaticamente pelo Next durante o smoke, foram lidos e removidos; `agentRules: false` evita regeneração e mantém as regras canônicas na raiz.

#### Implementação e decisões

- Monorepo na mesma base, pnpm/Turbo, Next App Router/React/Tailwind e NestJS. Pacotes config/types compilam antes de dev/build; UI usa fonte TypeScript transpilada pelo Next. TypeScript estrito, ESLint/Prettier, Husky/lint-staged e lockfile únicos.
- Configuração de servidor validada, APP_ENV obrigatório distinto de NODE_ENV, flags booleanas exatas, mocks proibidos em produção, URLs HTTPS/cookies seguros exigidos nesse ambiente. Turbo inclui APP_ENV/configuração pública no repasse e no hash, também para typecheck. Campos de integrações existem como contratos inativos; habilitar fornecedores sem adaptadores falha explicitamente.
- Exemplos por app/Compose e gerador local sem overwrite; senhas/chaves de desenvolvimento aleatórias. pnpm 11 usa allowBuilds explícito para scripts nativos necessários; telemetria de instalação Scarf/Nest bloqueada. ESLint 9 foi mantido por compatibilidade declarada com plugins React/JSX do Next selecionado; o registry o marca sem suporte, exigindo revisão de atualização quando esses plugins suportarem ESLint 10. Não há vulnerabilidade conhecida de produção no audit executado.
- PostgreSQL 17.11-alpine fixado por digest oficial `sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` no Compose e CI; projeto filaretti-local, bind127.0.0.1:5434, volume persistente e healthcheck. Manifest da imagem confirmado no Docker Hub; imagem/serviço não puderam ser iniciados nesta máquina.
- API GET /health usa SELECT1, pool limitado e timeouts; retorna 200/up ou503/down, no-store. Request IDs sempre gerados pela API; respostas genéricas e logger por campos permitidos descartam corpo, headers, URLs e exceções. Swagger só em APP_ENV/NODE_ENV development; validação global e limite JSON64kb preparados.
- Web contém página local fictícia, noindex, skip link, erro/404 e primitivo Panel; sem site institucional/admin/CRUD/proxy de domínio. Prisma tem somente datasource/config, sem entidades/migrations/client de domínio. CI executa lint→typecheck→testes→integração PostgreSQL→build, sem publicação.
- Subagentes trabalharam em apps/web+ui e docs isoladamente, conforme AGENTS; principal integrou e revisou. A revisão identificou/corrigiu bootstrap ^build, repasse/hash de APP_ENV, variáveis CI no typecheck, ignore de dist-test e divergências documentais. Nenhum subagente fez commit/operação externa.

#### Validação executada

| Check                                    | Resultado/evidência                                                                                                                                                   |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline/cwd/branch/remoto               | dev limpo inicialmente, baseline 6c84b6a, remoto confirmado; caminho Filaretti                                                                                        |
| Compatibilidade/versões                  | Registry npm e docs oficiais Next/Nest/Prisma/Node; Node24.18.0/pnpm11.25.0; digest PostgreSQL oficial conferido                                                      |
| pnpm install --frozen-lockfile           | Passou; instalação inicial teve timeout de rede, resolvido aumentando timeout/concurrency somente no comando; instalação frozen final padrão também passou            |
| Setup local / proteção contra overwrite  | Passou; geração sem imprimir valores; repetição recusada e hashes dos três arquivos preservados                                                                       |
| docker compose config --quiet            | Passou; validação de configuração somente, sem comprovar serviço                                                                                                      |
| pnpm lint                                | Passou sem erros/warnings após correções                                                                                                                              |
| pnpm typecheck                           | Passou nos apps/pacotes e testes; erros iniciais de tipagem dos JSON HTTP foram corrigidos                                                                            |
| pnpm test                                | Dez testes passaram: sete Vitest de configuração e três Node/HTTP de API; sem mocks do banco para indisponibilidade, conexão real a porta fechada                     |
| Proteção contra config inválida          | Teste encontrou refine URL lançando TypeError; corrigido com parser protegido. Testes finais confirmam campo público sem segredo e rejeição de protocolo inválido     |
| pnpm build                               | API/pacotes e Next otimizado passaram; páginas / e /_not-found geradas                                                                                                |
| pnpm --filter @filaretti/api db:validate | Datasource/schema vazio Prisma válido; não comprova conexão nem migration                                                                                             |
| pnpm audit --prod --audit-level=high     | Nenhuma vulnerabilidade conhecida reportada pelo registry                                                                                                             |
| pnpm dev                                 | Iniciou web em127.0.0.1:3000 e API em127.0.0.1:3001; processos desta sessão encerrados depois do smoke                                                                |
| Smoke HTTP/browser                       | Edge headless real: web200, noindex, APIhealth503/down sem DB; inspeção visual PNGs em375x812 e1440x1000, sem overflow horizontal e skip link por teclado funcionando |
| Git ignore/segredos                      | .env reais, evidências, builds e dist-test ignorados; somente placeholders e credenciais explicitamente de teste nos arquivos versionáveis                            |

`pnpm format:check` e `git diff --check` passaram; arquivos de staging revisados explicitamente antes do commit. A tentativa inicial de commit encontrou `pnpm: command not found` no shell do hook Git/Windows; o hook foi ajustado para invocar a CLI local de lint-staged diretamente por Node, sem depender do wrapper `.cmd` do pnpm. A lista acima registra verificações locais, sem alegar execução do workflow no GitHub. Nenhum push/PR/deploy/envio externo ou conta de fornecedor foi executado.

#### Bloqueio do ambiente e retomada exata

Docker client29.7.2 e Compose5.4.0 disponíveis, contexto desktop-linux. Docker Desktop permaneceu stopped/API500. Tentativa de iniciar WSL Ubuntu24.04 retornou `Wsl/Service/CreateInstance/CreateVm/HCS/HCS_E_HYPERV_NOT_INSTALLED`. Consulta Windows confirmou `VirtualizationFirmwareEnabled=True` e `HypervisorPresent=False`; leitura de feature/BCD exigiu elevação e foi negada. Nenhuma configuração de BIOS/boot/Windows foi alterada e nenhum reinício foi solicitado por ferramenta. O usuário providenciará o reinício.

**Não executados/pendentes:** Docker Compose up real, download/inicialização do container/volume, `pnpm test:integration` com PostgreSQL real, health200 e transição200→503→200 com stop/start preservando volume; workflow remoto. Banco/schema/queries de domínio são escopo F2, não pendência de implementação da F1.

Após o reinício, nesta mesma pasta/branch:

1. Reler AGENTS.md, plan.md completo e este checkpoint; conferir cwd/Git e registrar o SHA real do commit local anterior.
2. Confirmar `rtk proxy docker info` e que Docker está disponível; executar `rtk proxy pnpm install --frozen-lockfile`. Não repetir setup:local sobre env existentes.
3. Executar `rtk proxy docker compose up -d --wait` e verificar healthcheck; não alterar/remover volumes de outros projetos.
4. Executar `rtk proxy pnpm test:integration`, iniciar `rtk proxy pnpm dev` e confirmar /health200; parar/iniciar somente postgres deste Compose para verificar503/200, preservando o volume.
5. Resolver eventual falha pertinente, registrar RP-002, marcar F1 concluída somente se todo o aceite passar e commitar o fechamento local verificado. Aguardar confirmação do usuário antes de F2; a autorização da F1 continua válida para esta retomada.

**Ponto de parada:** aguardando reinício/Docker para terminar F1. **F2 não iniciada e não autorizada.**

### RP-000 — 02/10/2026 — Planejamento inicial

**Escopo autorizado:** converter o plano mestre fornecido pelo usuário em um planejamento técnico cronológico; criar os arquivos de continuidade e regras na raiz. Sem implementação de aplicação ou operações externas.

**Versão:** referência inicial `0.0.0`; esse número ainda não representa release executável.

#### Arquivos criados

| Arquivo     | Conteúdo                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plan.md`   | Dez grandes atualizações, dependências, entregáveis, aceite, arquitetura, modelo de dados mínimo, riscos/gates, versões previstas e checkpoint                     |
| `AGENTS.md` | Leitura obrigatória do plano/relatório, preservação das regras RTK, escopo por autorização, segurança, subagentes, validação, SemVer, commits e pausa entre etapas |
| `relate.md` | Situação inicial, histórico da entrega e modelo de relatório para continuidade                                                                                     |

Nenhum arquivo preexistente foi alterado/removido. O nome canônico `AGENTS.md` permite descoberta automática das regras; em Windows não deve ser criado outro arquivo `agents.md` com conteúdo diferente.

#### Decisões incorporadas

- Manter a stack oficial Next.js/NestJS/PostgreSQL/Prisma e os fornecedores do plano; usar a raiz atual como monorepo.
- Consolidar a implementação em F1–F10, com versão funcional de desenvolvimento ao término da F7, homologação na F8, migração na F9 e produção na F10.
- Modelar FAQ, páginas institucionais, tokens de recuperação/confirmação/preview e tarefas persistidas, que eram necessárias aos fluxos mas não constavam integralmente da lista inicial de tabelas.
- Separar autor profissional de usuário administrativo, ativos públicos de anexos privados e mocks de dados reais.
- Prever publicação agendada com trava/idempotência, atualização de cache, double opt-in/descadastro, validação server-side do antispam, recuperação de senha e rollback com ordem correta de migrations/API/web.
- Registrar que contas, materiais aprovados, privacidade/retenção, infraestrutura e produção são gates próprios; desenvolvimento local utiliza adaptadores explicitamente simulados quando necessário.
- Reservar o primeiro commit/setup Git ao usuário. Após esse baseline, etapas autorizadas incluem o commit local explicativo correspondente; avanço de etapa, push, merge e deploy não são automáticos.

#### Validação e evidências

- Plano mestre lido do anexo fornecido; escopo público, editorial, administrativo, operação e exclusões incorporados.
- Cwd confirmado: `C:\Users\Samuel\Documents\Projetos\Projeto`; listagem inicial sem arquivos.
- `RTK.md` lido; RTK `0.42.4` identificado. Consulta Git executada com configuração apenas no processo e confirmou **“Not a git repository”**. Não foi executado `git init`.
- Documentação oficial de Next.js, NestJS, Turnstile, R2, Resend e SemVer consultada para as decisões citadas em `plan.md`.
- Revisão documental: ordem/dependências, cobertura do plano mestre, links internos, estados/versões e coerência das pausas; leitura final dos três arquivos e verificação UTF-8 sem caracteres de substituição.
- Não há lint, build ou testes funcionais de aplicação a executar nesta entrega: nenhum código/dependência foi criado ou instalado. A leitura documental não comprova funcionalidades futuras.

#### Limitações e pendências

- Aplicação, migrations, API, UI, CMS, infraestrutura e integrações permanecem **planejados**, sem implementação.
- Nenhum commit, branch, remoto, conta, upload, envio de e-mail, publicação ou alteração de DNS foi realizado.
- Versões de bibliotecas serão selecionadas/verificadas na F1; domínios/hosting são propostas a confirmar antes de uso externo.
- Materiais institucionais e regras finais de privacidade/retenção serão aprovados pelo responsável do escritório nas etapas indicadas.

**Ponto de parada:** documentação inicial concluída. **Próxima ação:** aguardar confirmação do usuário para F1; ao retomar, conferir o baseline Git preparado por ele e reler os documentos. Não iniciar bootstrap nesta entrega.

## Modelo para próximas entradas

Copiar este modelo para o histórico e preencher somente fatos verificados. Atualizar também o quadro de situação atual e o checkpoint de `plan.md`.

```markdown
### RP-NNN — DD/MM/AAAA — F# — Nome da entrega

Escopo autorizado:
Estado: concluída tecnicamente / parcial / bloqueada no item descrito
Versão anterior → versão atual:
Branch e commit-base verificados:
Commit de entrega: assunto previsto; SHA real informado após o commit

Arquivos criados:
Arquivos alterados:
Arquivos removidos:
Funcionalidades e mudanças de comportamento:
Decisões e motivo:
Migrations/configuração/impacto operacional, se houver:

Validação:

- Comando ou procedimento executado, ambiente e resultado.
- Distinguir PostgreSQL/fornecedores reais de mocks e adaptadores simulados.
- Registrar falhas, limites e checks não executados.

Pendências técnicas e externas:
Riscos ou limitações materiais:
Ponto exato de retomada em caso de interrupção:
Próxima etapa e dependências:
Confirmação para avançar: aguardando usuário.
```

O SHA do commit de entrega pode ser registrado no início da próxima retomada após consultar o Git. Não inventar hash nem criar commit adicional exclusivamente para inserir o próprio hash neste arquivo.
