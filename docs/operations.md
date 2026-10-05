# F8 — operação, recuperação e homologação protegida

Referência: `0.8.0`, 05/10/2026. As evidências locais e pendências estão no RP-009 de `../relate.md`. Homologação externa permanece parcial; esta entrega não provisiona ambientes nem altera DNS.

## Saúde e tarefas

`GET /health/live` confirma processo vivo sem consultar banco. `GET /health/ready` e o compatível `/health` consultam PostgreSQL com timeout e retornam 503 sanitizado quando indisponível. Readiness deve preceder tráfego; liveness não deve reiniciar o processo por indisponibilidade transitória do banco.

`GET /api/v1/admin/operations` exige sessão ADMIN. Retorna somente contagens por tópico permitido, filas pending/processing/failed e alertas de exaustão, pendência maior que 15 minutos, lease maior que cinco minutos e anexos em quarentena. Não inclui destinatário, corpo, endereço IP, token ou payload. `status=attention` é um sinal operacional; configurar monitor privado e destinatário aprovado antes da homologação. A entrega local verifica o sinal, mas não envia alertas externos. Não expor essa rota como métrica pública.

API/worker requerem processo continuamente ativo. O PostgreSQL conserva outbox, retries e leases; reiniciar recupera tarefas, sem garantir entrega imediata. Confirmar em staging duas instâncias, falha de rede, reinício, exaustão e retirada de publicação. Não habilitar Sentry somente por DSN: a integração não está implementada. Antes de instalar, definir allowlist de eventos e redaction de cookies, headers, URL/query, corpos e identificadores pessoais; comprovar captura com erro fictício.

## Backup e ensaio de recuperação local

`pnpm backup:local` aceita somente APP_ENV development, storage local e PostgreSQL Filaretti em loopback5434. Requer `BACKUP_ENCRYPTION_KEY` de 32 bytes hex no ambiente privado do operador. Não imprimir, versionar ou passar essa chave como argumento shell. Usar chave distinta do outbox, conservada separadamente do backup.

O utilitário captura `pg_dump --format=custom --no-owner --no-acl`, objetos das classes public/private e metadados em AES-256-GCM, com IV aleatório, AAD e SHA-256. O snapshot só recebe seu nome final após completar todos os arquivos. Dump e manifesto não são gravados em claro durante backup. Diretórios/symlinks e chaves de storage são validados; restauração não sobrescreve destino existente. Os backups locais ficam ignorados em `.local/backups`, com permissões solicitadas restritas. No Windows, validar ACLs do diretório e conta operacional; modo POSIX solicitado pelo Node não comprova ACL Windows.

**Consistência:** pausar mutações e aguardar workers concluírem o lote antes de um snapshot operacional. PostgreSQL e arquivos não compartilham transação; o ensaio usa recursos isolados e sem escritores concorrentes. Em homologação, comprovar que cada chave referenciada no banco está incluída e validada no snapshot de arquivos. A cópia local não substitui backup fora do host.

`pnpm test:recovery` cria dois bancos temporários e storage próprio; aplica as quatro migrations e seed fictício, insere metadado de anexo, faz backup, restaura efetivamente com `pg_restore --single-transaction --exit-on-error`, compara todas as contagens/migrations e chave de anexo, recupera bytes públicos/privados e compara hashes. Também verifica chave incorreta, adulteração, traversal e proteção contra sobrescrita. Remove somente bancos/arquivos próprios; preserva o banco/volume de desenvolvimento. Evidência sanitizada: `.local/f8-recovery.json`. O runner também aceita o ID exato do container PostgreSQL do CI por `F8_PG_CONTAINER`.

**Política proposta para aprovação:** backup diário, sete cópias diárias e quatro semanais, criptografia, cópia externa e ensaio mensal; RPO 24 horas e RTO quatro horas são metas a medir, ainda não compromissos aprovados. Nenhuma agenda diária foi ativada. Aprovar retenção, orçamento, responsável e armazenamento antes de configurar scheduler/expurgo. Exercitar recuperação de R2 por cópia/exportação explícita; não presumir versionamento nativo. Registrar tempo real de restauração e recuperação de chaves. O ensaio local não certifica restore de R2, produção ou serviço gerenciado.

## Homologação e CI

Preparar `staging.filarettiadvocacia.com.br` com HTTPS, proteção de acesso além de noindex e origens privadas. Banco/buckets/secrets isolados, recipients Resend em allowlist e domínio remetente validado. Turnstile deve verificar hostname/action; webhook Resend deve comprovar assinatura/replay. Configurar ingress para sobrescrever exatamente um `WEB_CLIENT_IP_HEADER` e bloquear acesso direto; confirmar isso antes de `WEB_TRUSTED_PROXY_CONFIRMED=true`. Web/API compartilham `BFF_CLIENT_IP_SECRET`; assinatura HMAC vincula IP, timestamp de 60 segundos, método e pathname. Headers X-Forwarded-For/Proto arbitrários não concedem confiança.

O bootstrap rejeita URLs públicas HTTP em staging e production e exige `COOKIE_SECURE=true` na API nesses ambientes. HTTP continua permitido para a conexão interna privada web/API e para development em loopback. Confirmar os headers HTTPS na resposta efetivamente entregue pelo provedor; validação de configuração local não comprova TLS externo.

ClamAV deve usar rede privada, daemon e definições atualizadas, limites de stream/tempo compatíveis. `CLAMAV_PRIVATE_NETWORK_CONFIRMED=true` registra verificação operacional. Scanner indisponível mantém QUARANTINED, sem ticket/download. Não há liberação automática posterior: revisar fila e reenviar arquivo após corrigir serviço conforme procedimento autorizado. Desabilitar scanner fora do mock local nunca promove arquivo a VERIFIED.

CI mantém checks de código, PostgreSQL, recuperação e QA Chromium/Lighthouse; publica evidências sanitizadas e build de revisão identificado pelo SHA. O build com development/mocks é **não promovível**: reconstruir com configuração staging isolada e aprovada. CI remoto só será considerado comprovado com run/artifact reais após ação remota autorizada. O workflow manual `staging-readiness.yml` usa environment `staging` e valida SHA, autorização e flags de ingress/recuperação; configurar required reviewers no GitHub. Esse workflow é um gate de preparação, sem adapter de deploy. As flags não substituem evidências nem autorização humana. Registrar os comandos/adapters concretos de Vercel/Railway somente após ambiente definido.

## Rollback revisável

Identificar SHA e artefatos anteriores de web/API/config; preservar configuração privada por ambiente. Ordem de atualização: backup comprovado → migrations aditivas → API/worker + readiness → web → smoke → tráfego autorizado. Em falha de código, voltar web/API ao artefato anterior compatível; migrations F7 permanecem aplicadas. Não executar reset/down migration como rollback automático. Se uma migration futura não for compatível, interromper e usar plano de restauração revisado; restore exige destino novo e validação antes do corte. Ensaiar rollback e provider real em staging antes de produção. A F8 local não executou deploy/rollback externo.

Referências: [pg_dump PostgreSQL17](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore PostgreSQL17](https://www.postgresql.org/docs/17/app-pgrestore.html), [protocolo ClamD](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).
