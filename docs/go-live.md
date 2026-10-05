# F10 — publicação controlada e entrega operacional

Referência: `0.10.0`, 05/10/2026. A implementação local da F10 prepara e verifica o processo. A V1 operacional continua sendo `1.0.0`, somente depois de aprovação, artefato real e aceites externos. Consulte [revisão das fases](phase-review.md), [migração](migration.md) e [operação/recuperação](operations.md).

## Pré-requisitos

O [plano operacional](go-live-plan.template.json) começa sem evidências. Preencher com referências aos documentos aprovados, mantendo valores reais e dados operacionais em arquivos privados fora do Git. Não incluir senhas, tokens, corpo de contato, lista de assinantes ou URLs com credenciais. Uma declaração no JSON identifica uma evidência; não cria aprovação humana nem comprova, por si só, o serviço externo.

A F8 deve comprovar CI remoto, staging protegido, R2 público/privado, Resend, Turnstile, ingress/TLS, scanner atualizado, worker contínuo, alertas, restauração externa e revisão de acessibilidade/navegadores. A F9 exige inventário, lote oficial, direitos de mídia e textos aprovados, identidade visual final, ausência de mocks e candidata verificável. Não aproveitar o banco de desenvolvimento como produção.

Preparar a release `1.0.0` em commit identificado e árvore limpa, com todos os manifests coerentes. Reconstruir web/API com configuração de produção aprovada e segredos somente no canal privado do provedor. O artefato de CI F8 usa development/mocks e não é promovível. O arquivo empacotado real deve acompanhar seu manifesto, digest SHA-256, origem final e referência do build. O manifesto é uma declaração operacional vinculada aos bytes; não é uma assinatura de procedência nem substitui revisão do pipeline de build.

## Verificação antes e depois do corte

`release:check` agora distingue a candidata controlada da publicação. Em ambas as fases verifica banco somente leitura, recibo/snapshot da migração, materiais, commit, evidências, canonical, conteúdo, mapeamentos 301 e retiradas. Não modifica flags nem faz deploy.

```text
pnpm release:check --checklist <checklist-privado.json> --batch <lote-aprovado.json> --phase controlled --http
pnpm release:check --checklist <checklist-privado.json> --batch <lote-aprovado.json> --phase public --http
```

No modo `controlled`, `SEO_INDEXING_ENABLED=false`, robots bloqueia crawlers, sitemap fica vazio e páginas têm noindex. O operador deve comprovar proteção de acesso no ingress separadamente: robots/noindex não restringe acesso. O transporte do checker usa a origem HTTPS aprovada, sem credenciais e sem seguir redirects; executá-lo por um acesso privado autorizado que permita verificar as páginas. Ele não automatiza login no provedor de proteção.

No modo `public`, somente após corte autorizado, `SEO_INDEXING_ENABLED=true`, robots permite indexação das rotas apropriadas e sitemap corresponde exatamente ao catálogo indexável. Manter ADMIN, preview, filtros, busca e tokens fora da indexação. O report inclui `phase`, `checkedAt`, commit, versão, origem e digest do lote; conservar os bytes originais para verificações posteriores.

O comando `pnpm go-live:check` verifica o histórico operacional em arquivos locais. Sem argumentos, examina o template pendente e devolve `ready=false`, com código de saída 1. Não lê `.env` automaticamente, não conecta ao banco, não envia HTTP e não faz deploy, DNS, restore ou envio de mensagens. Os reports de release são produzidos por um operador autorizado, conservados e vinculados por digest. A documentação do contrato exato está junto do template e do código do gate.

```text
pnpm go-live:check --plan <plano-privado.json> --artifact <arquivo-build-real> --artifact-manifest <manifesto-privado.json> --candidate-report <candidata-controlada.json> --controlled-report <smoke-controlado.json> --public-report <smoke-publico.json>
```

Usar o [manifesto modelo](release-artifact.template.json) como estrutura pendente: substituir null apenas após verificar o build e só então registrar `deployable=true`. O SHA-256 se refere aos bytes do arquivo de build real, não ao JSON do manifesto. Os hashes dos reports se referem aos bytes exatos dos JSONs conservados. O CLI aceita arquivos JSON de até 1 MB e artefato de até 5 GB, exige arquivos regulares e calcula os digests em leitura. As origens são HTTPS sem credenciais. Evidências usam IDs opacos de 3–160 caracteres (`A–Z`, `a–z`, números, ponto, hífen e underscore); um registro privado externo associa esses IDs aos documentos e responsáveis reais.

Cada item de `steps` contém `kind`, `result`, `reference`, `actor`, `at` UTC, `commit`, `artifactSha256` e `details`. As treze etapas são, na ordem: `candidateApproved`, `backupVerified`, `migrationsApplied`, `approvedDataLoaded`, `apiWorkerHealthy`, `controlledWeb`, `controlledSmoke`, `cutoverAuthorized`, `cutoverCompleted`, `publicIndexing`, `publicSmoke`, `monitoringActivated` e `handoff`. Os campos `details` são estritos por etapa, definidos em [operations-gate.ts](../apps/api/src/release/operations-gate.ts); smokes exigem todos os fluxos de `operationalSmokeChecks`. Não remover passos ou reutilizar um report controlado como público. Reports devem corresponder à origem, commit, versão, lote e janela temporal do passo.

Em `result=failed`, `details` contém somente `failureReference`. Depois de mutações, o gate retorna `rollback-required`; `rollbackEvent` identifica o responsável aprovado, etapa/artefato falhos e artefato anterior restaurado. O histórico precisa comprovar seus pré-requisitos para declarar `rolled-back`, que permanece `ready=false`. Campos desconhecidos, identidade divergente, tempo futuro/fora de ordem e ausência de provas bloqueiam a conclusão. `actionAuthorized=false` em todos os resultados.

## Ordem da operação

1. Confirmar responsáveis, conteúdo, privacidade, orçamento, ambiente, janela e rollback; aprovar a candidata identificada. Congelar alterações no site antigo antes do snapshot final.
2. Verificar backup de origem/destino, banco e arquivos públicos/privados, cópia externa, chave recuperável e restauração medida. Conservar o artefato anterior compatível. Não presumir versionamento do R2.
3. Aplicar migrations compatíveis antes da API. Usar `db:seed:production` apenas para estrutura, provisionar o primeiro ADMIN por entrada privada sem senha padrão e importar somente o lote aprovado, com dry-run e confirmação de banco/digest. O mecanismo atual exige ADMIN antes de `migration:apply`. Não executar seed de desenvolvimento.
4. Implantar API/worker e comprovar readiness e tarefas; depois implantar web sob acesso controlado. Verificar autenticação/roles, upload, preview, publicação/retirada/agendamento e retomada após reinício.
5. Exercitar R2 público e privado, contato/anexo/scanner, envio e entrega de e-mail, webhook/assinatura/replay, opt-in/descadastro e recuperação. `release:check --phase controlled --http` complementa esses smokes; o checker de páginas não envia formulários nem comprova entrega de e-mail.
6. Somente com evidências e autorização de corte/DNS registradas, transferir tráfego. Confirmar domínio/TLS e redirects. Habilitar indexação e repetir `release:check --phase public --http` e os fluxos públicos com material aprovado.
7. Registrar verificação e envio do sitemap no Search Console. Configurar GA4 com coleta automática sensível desabilitada; comprovar ausência de carga/eventos antes de consentimento e parada após revogação. Habilitar monitor sanitizado, destinatário de alertas e backup aprovado.
8. Entregar [manual do CMS](cms-handbook.md), treinamento e referências de manutenção/recuperação. Registrar responsável e janela de observação de 404/500, filas, entrega de e-mail, indexação e métricas. Nenhum scheduler/monitor recorrente é criado automaticamente.

## Falha e rollback

Smokes impeditivos bloqueiam a conclusão. O gate sinaliza necessidade de rollback quando o histórico contém falha; o operador usa o procedimento previamente aprovado. Não inferir autorização para restaurar dados por causa de um report falho.

Conservar acesso controlado quando o corte ainda não ocorreu. Após corte, recolocar a proteção/tráfego anterior conforme o plano aprovado, voltar web/API ao artefato compatível e verificar readiness/fluxos. Migrations aditivas permanecem; nunca usar reset/down migration automático. Restore usa destino novo, valida banco e bytes e somente depois pode participar de corte aprovado. Registrar falha, decisão e evidência da recuperação; um rollback concluído não significa publicação da candidata concluída.

## Estado desta entrega

F10 local parcial. Hosting e domínio operacional, materiais oficiais, ambiente/secrets seguros, artefato de produção `1.0.0`, evidências F8/F9, deploy, corte/DNS, Search Console, e-mails reais e monitor externo permanecem pendentes. A autorização desta etapa permite preparar/revisar os mecanismos locais; o gate de produção do [plan.md](../plan.md) continua exigindo o ambiente e as ações externas específicos.
