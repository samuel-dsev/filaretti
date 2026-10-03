# Segurança e tratamento de dados

Referência inicial: F1, 02/10/2026. Este documento separa a proteção da fundação das capacidades que serão implementadas nas fases seguintes.

## Proteção da fundação

- Configuração validada antes de iniciar cada processo; valores inválidos ou obrigatórios ausentes impedem o bootstrap. O diagnóstico mostra nomes de campos, sem seus valores.
- Ambientes locais de API/web e banco ignorados pelo Git; exemplos contêm placeholders. O setup local gera segredos aleatórios, não imprime conteúdo e recusa sobrescrever arquivos existentes.
- Endpoints e portas locais em loopback; Compose isolado com volume persistente. A F1 não expõe serviço por túnel ou publica ambiente externo.
- Health e erros públicos sem credenciais, URLs internas, SQL ou stack; request IDs validados ou gerados pela API.
- Logging sanitizado: registrar somente o necessário para identificar evento, status e correlação. Não registrar corpo, cookies, Authorization, tokens, `.env`, query strings sensíveis ou detalhes de conexão.
- Swagger permitido somente com `APP_ENV=development` e `NODE_ENV=development`.
- `APP_ENV=production` rejeita `MOCK_CONTENT=true` e exige HTTPS/cookies seguros. `NODE_ENV=production` sozinho não caracteriza dados reais: um build local pode usar `APP_ENV=development`.
- `R2_ENABLED`, `RESEND_ENABLED` e `TURNSTILE_ENABLED` permanecem `false`; habilitá-los na F1 é rejeitado porque os adaptadores pertencem às fases futuras.

Esses limites devem ser verificados no código e nos testes da F1; a existência desta lista não é evidência de aprovação. O relatório registra checks efetivos, inclusive falhas e limitações.

## Segredos e configuração

URLs públicas são separadas das URLs internas. `DATABASE_URL` e chaves de JWT/refresh, webhook, storage, preview/revalidação e fornecedores são privadas. Apenas valores explicitamente públicos podem chegar ao bundle do navegador. Exemplos de ambiente definem placeholders para futuras integrações sem obrigar criação de contas externas.

Credenciais reais devem entrar por ambiente/canal seguro, com isolamento entre desenvolvimento, homologação e produção. Logs, relatórios, CI e API não devem copiar segredos. O lockfile e os manifests registram dependências; uma auditoria de dependências é evidência limitada aos advisories e ao instante consultado, sem certificar toda a aplicação.

## Controles futuros por fase

| Fase   | Controles a implementar e verificar                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| F2     | Argon2id; access JWT curto; refresh rotativo com hash, revogação e detecção de reuse; cookies/CSRF/origem; DTOs e roles/propriedade |
| F5–F6  | Schema permitido TipTap; sanitização de HTML/URLs; preview expirante privado; uploads validados e visibilidade explícita            |
| F6–F7  | Tarefas/outbox persistidas, retries/idempotência, assinatura/deduplicação de webhook e revalidação autenticada                      |
| F7     | Turnstile no backend, limites compartilhados, anexos privados, confirmação/descadastro, retenção e consentimento                    |
| F8     | CSP, HSTS no HTTPS, nosniff, Referrer/Permissions Policy, CORS, proxies, fornecedor real, quarentena e recuperação                  |
| F9–F10 | Inspeção contra mocks, materiais aprovados, provisionamento seguro de ADMIN e segredos de produção                                  |

Na F1 não existe login, autorização por role, upload, CSRF, serviço de e-mail, widget antispam ou adaptador de integração, inclusive simulado. Chaves e intenções no ambiente não representam esses recursos implementados.

## Dados e arquivos futuros

Somente dados fictícios são permitidos em desenvolvimento. Seeds de desenvolvimento serão bloqueados em produção. `MOCK_CONTENT=false` será uma proteção adicional; a limpeza de registros, ativos e placeholders deverá ser comprovada na F9.

Rascunhos, previews, anexos, contatos e assinantes não podem vazar para leitura pública, cache, busca, sitemap ou analytics. Usuário administrativo é separado do profissional público. ADMIN administrará dados pessoais; AUTHOR só poderá alterar seus próprios rascunhos e EDITOR controlará publicação conforme o plano.

Ativos editoriais públicos e anexos de contato privados terão storage separado. Upload deverá validar conteúdo, MIME, tamanho e extensão; SVG/HTML executável não será aceito no fluxo da V1. Download privado exigirá autorização e URL de curta duração. Scanner/quarentena e limites totais do contato serão definidos antes da homologação.

Turnstile será validado no servidor, com hostname/action previstos, conforme a [documentação oficial](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/). Webhooks de e-mail precisarão de assinatura sobre corpo bruto e deduplicação, conforme a [orientação do Resend](https://resend.com/docs/webhooks/verify-webhooks-requests). Essas integrações serão implementadas nas fases responsáveis e comprovadas com fornecedores reais na F8.

## Gates de publicação

Homologação real, contratação, dados reais, deploy, DNS e produção exigem autorização aplicável. Antes da produção: conteúdo e regras de retenção aprovados, integração real validada, ausência de mocks, backup/restauração e rollback comprovados. A fundação local não satisfaz esses gates e seu CI não publica automaticamente.
