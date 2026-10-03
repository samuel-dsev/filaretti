# API e contratos

Referência inicial: F1, 02/10/2026. Health e o envelope de erro pertencem à fundação. As rotas de domínio desta página são previstas para F2 em diante.

## Saúde do serviço

`GET /health` fica fora do prefixo de domínio. Consulta o PostgreSQL com `SELECT 1` e responde sem cache (`Cache-Control: no-store`). Não depende de schema ou migration.

| Condição                           | HTTP  | Corpo                                  |
| ---------------------------------- | ----- | -------------------------------------- |
| Banco responde                     | `200` | `{"status":"ok","database":"up"}`      |
| Banco indisponível ou probe expira | `503` | `{"status":"error","database":"down"}` |

O retorno de indisponibilidade contém somente estado; não expõe host, credenciais, driver, SQL ou stack. Uma resposta `200` comprova a consulta no instante do probe, sem certificar os fluxos futuros, os fornecedores ou a operação de produção. Liveness/readiness separados serão avaliados na F8.

## Erros e correlação

Falhas da API usam um contrato público estável:

```json
{
  "error": {
    "code": "CODIGO_ESTAVEL",
    "message": "Mensagem pública sem detalhes internos",
    "requestId": "UUID-gerado-pela-API"
  }
}
```

O exemplo é o formato, não uma listagem de códigos implementados. Os códigos reais acompanham os contratos compartilhados e o filtro da API. A API sempre gera um UUID próprio, sem confiar no identificador enviado pelo cliente, e o retorna também em `X-Request-Id`. O identificador permite correlacionar a resposta com logs sanitizados. Exceções inesperadas não devolvem stack ou mensagem do driver.

## Documentação e validação

Swagger fica em `/api/docs` somente quando `APP_ENV` e `NODE_ENV` são `development`; é desativado nos demais casos. Ele descreve os endpoints existentes; o planejamento abaixo não deve gerar rotas fictícias na documentação executável. A configuração segue a [integração OpenAPI do NestJS](https://docs.nestjs.com/openapi/introduction).

A fundação prepara tratamento global e validação. DTOs de domínio, whitelist de entrada, limites e autorização serão implementados junto com cada endpoint. `packages/types` publica contratos permitidos; nenhum modelo Prisma, token ou campo interno é exportado para o navegador.

## Contratos de domínio previstos

As rotas REST usarão `/api/v1`. Endpoints públicos serão separados dos administrativos, com leitura pública somente de conteúdo publicado. Nomes finais, schemas e filtros serão fixados na F2.

| Grupo                                         | Fase responsável | Comportamento previsto                                                             |
| --------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| Auth e usuários                               | F2               | Login, refresh rotativo, logout, me, troca/recuperação de senha e gestão por ADMIN |
| Artigos e taxonomias                          | F2 / F5–F6       | CRUD autorizado, filtros, leitura pública e publicação controlada                  |
| Áreas/profissionais/páginas/FAQ/configurações | F2 / F4          | Conteúdo administrável e respostas públicas com campos permitidos                  |
| Mídia e preview                               | F6               | Validação de arquivo, acesso conforme visibilidade e token expirante de preview    |
| Contato/newsletter/busca                      | F7               | Persistência, anexos privados, confirmação/descadastro e busca somente pública     |
| Tarefas/webhooks/revalidação                  | F6–F7            | Idempotência, verificação de origem/assinatura e retries persistidos               |

Listagens de domínio seguirão `{ data, meta: { page, limit, total, pages } }`. O padrão previsto é `page=1&limit=12`; o teto será documentado e testado na F2. Filtros editoriais incluem área, categoria, autor, tag, tipo e ano. Payloads de criação/edição usarão DTOs explícitos e schemas permitidos de conteúdo.

Sessões futuras usarão cookies HttpOnly, Secure em produção, proteção CSRF e validação de origem. AUTHOR só poderá alterar seus próprios rascunhos; EDITOR poderá aprovar/publicar; ADMIN administrará usuários, configurações, contatos e assinantes. Essas regras não estão implementadas pela F1.

## Validação exigida

F1 exige health disponível/indisponível, erros sem vazamento e request IDs sanitizados. F2 exige cenários positivos e negativos de autenticação, roles/propriedade e acesso público, com PostgreSQL real. F6/F7 acrescentam preview, uploads privados, publicação, webhooks e tarefas. Evidências e limitações ficam no relatório da fase, sem presumir êxito pela existência de um contrato escrito.
