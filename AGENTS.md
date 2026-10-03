# Regras de desenvolvimento — Filaretti Advocacia

## Instrução de ambiente

@C:\Users\Samuel\.codex\RTK.md

Ler a instrução referenciada e prefixar comandos de shell com `rtk`. Para comandos não filtrados, usar `rtk proxy`. Se o RTK exigir configuração no Windows, usar `CLAUDE_CONFIG_DIR=C:\Users\Samuel\.codex` somente no processo necessário, sem alterar configurações globais. Isso não se aplica a ferramentas de leitura/edição que não executem shell.

## 1. Fontes de verdade e retomada obrigatória

- **`plan.md`** é o planejamento e checkpoint de implementação; **`relate.md`** guarda a situação atual e o histórico; este arquivo define o modo de trabalho.
- Antes de qualquer implementação, inclusive retomada após interrupção, ler este arquivo, **o `plan.md` inteiro** e a situação atual/último relatório relevante de `relate.md`. Ler também documentos de `docs/` relativos à tarefa, quando existirem.
- Confirmar cwd, branch, último commit e alterações locais. Trabalhar nesta base; não criar outro projeto ou sobrescrever o trabalho do usuário.
- Identificar a última etapa concluída, a etapa autorizada, as pendências e o ponto exato de retomada. Não confundir uma proposta do plano com algo já implementado.
- Em divergência entre relatório e código/Git, verificar os fatos e corrigir o registro antes de continuar. Instruções explícitas do usuário prevalecem; registrar mudanças de escopo e impactos no plano.

## 2. Autorização por etapa

- Implementar **somente a etapa expressamente autorizada**. Aprovar uma etapa, receber seu relatório ou vê-la marcada como concluída não autoriza a próxima.
- Resolver escolhas técnicas rotineiras dentro do escopo, sem pedir confirmação a cada arquivo. Se uma dependência ausente puder ser resolvida na etapa corrente, registrar a decisão; mudanças de escopo que afetem outra etapa devem ser submetidas ao usuário antes da execução.
- Ao terminar ou interromper, salvar a situação atual, entregar o relatório e **parar aguardando confirmação para prosseguir**.
- Planejamento não autoriza implementação, contratação, publicação, uso de dados reais, alteração de DNS, push ou merge. As ações externas precisam estar cobertas por autorização explícita.
- Enquanto um gate externo faltar, avançar apenas no trabalho independente autorizado, registrar a pendência e não declarar validação real com base em simulação.

## 3. Arquitetura e implementação

- Seguir a stack e a ordem do `plan.md`: arquitetura/contratos → persistência/API → componentes → páginas → integração → otimização. Segurança e testes acompanham cada camada.
- Next.js cuida de interface e renderização; NestJS concentra regras, validação e autorização. Não duplicar regras no frontend nem importar Prisma/segredos em código do navegador.
- Usar TypeScript estrito, DTOs validados, respostas públicas com campos permitidos e configuração por ambiente. Não usar `any` para contornar contratos; justificar exceções inevitáveis.
- Preferir módulos e componentes simples, compartilhados quando houver uso real. Não acrescentar funcionalidades da V2, bibliotecas ou serviços sem necessidade da etapa.
- Mudanças de banco usam migrations revisáveis; nunca alterar migration já aplicada em ambiente compartilhado, nem fazer reset/destruição de dados sem autorização específica.
- Textos institucionais, contatos, mídias, FAQ e conteúdo editorial devem ser administráveis conforme o plano; evitar dados operacionais hardcoded.

## 4. Dados, segurança e ambientes

- Usar somente dados e identidades explicitamente fictícios no desenvolvimento. Biografias, promessas, contatos e credenciais profissionais reais precisam de material aprovado.
- Mocks e credenciais locais de teste ficam isolados; seed de desenvolvimento é bloqueado em produção. Flag de mock desligada não substitui inspeção de dados/ativos antes da publicação.
- Nunca versionar `.env` real, senhas, tokens, chaves, documentos de clientes ou dumps com dados pessoais. Exemplos contêm placeholders; relatórios e logs mostram somente informações sanitizadas.
- Autorizar no backend por role e propriedade. Rascunhos, previews, anexos e dados de contato/assinantes não podem vazar em API, cache, busca ou sitemap públicos.
- Validar uploads e conteúdo do editor; anexos de contato ficam privados. Verificar antispam no servidor, assinaturas de webhooks e idempotência de tarefas.
- Dados, contas, buckets, e-mails e secrets de desenvolvimento/homologação/produção são isolados. Não iniciar envio real, homologação externa ou produção sem autorização que cubra a ação.

## 5. Trabalho com subagentes

O plano mestre prevê subagentes especializados durante o desenvolvimento. Usá-los em tarefas isoláveis e úteis, respeitando dependências, escopo autorizado e ferramentas disponíveis.

- O agente principal é responsável pela integração, qualidade, documentação, commit e entrega.
- Delegar com objetivo, arquivos permitidos, contratos/dependências, critérios de aceite e limites. Perfis possíveis: arquitetura, banco, backend, frontend, design, admin, SEO, segurança e QA.
- Não editar os mesmos arquivos simultaneamente. Schema, contratos compartilhados, manifests/lockfile e os três documentos de continuidade têm um responsável por vez.
- Banco/contratos devem estabilizar antes de tarefas consumidoras; design pode avançar em paralelo quando independente. Segurança/QA revisam desde as primeiras entregas.
- Subagentes não fazem commit, push, merge, deploy ou expansão de escopo por iniciativa própria. Devem devolver arquivos alterados, evidências de validação, limitações e pendências ao principal.
- O principal revisa resultados e executa validação integrada. Se paralelismo não ajudar ou não estiver disponível, executar sequencialmente e registrar limitações relevantes.

## 6. Qualidade e validação

- Uma tarefa concluída funciona com dados/contratos reais da etapa, trata erro/loading/vazio e atende tipagem, responsividade e acessibilidade pertinentes.
- Rodar lint, typecheck, build e testes relevantes quando houver aplicação; verificar integração com PostgreSQL real em mudanças de schema/consulta. Não escrever testes que apenas repitam a implementação.
- Testar permissões e cenários negativos em auth, publicação, uploads e exposição de dados. Adaptadores simulados e testes unitários não comprovam R2/Resend/Turnstile reais.
- Inspecionar interfaces visualmente nos tamanhos previstos e com teclado; manter evidências do que foi verificado. Não afirmar compatibilidade com navegador/dispositivo não testado.
- Testes devem proteger comportamento e riscos relevantes. Não instalar dependências ou executar uma suíte ampla sem necessidade em mudanças exclusivamente documentais.
- Declarar precisamente checks executados, resultados, falhas e verificações não executadas. Falha relevante impede marcar a entrega correspondente como concluída.

## 7. Versionamento e Git

- **O primeiro commit, a configuração do remoto e da branch de desenvolvimento pertencem ao usuário.** Nesta entrega documental não inicializar Git, criar branch, commit ou remoto.
- Após esse baseline, a autorização para implementar uma etapa inclui o commit local das alterações pertinentes e verificadas. Não exigir outra confirmação para esse commit já previsto. Se o Git não estiver preparado, não configurá-lo no lugar do usuário: registrar commit pendente e continuar apenas o trabalho autorizado independente.
- Verificar a branch efetivamente escolhida; `develop`, `feature/*` e `fix/*` são convenções sugeridas, não nomes a criar automaticamente. Não trabalhar/commitar diretamente na branch protegida de produção.
- Usar `MAJOR.MINOR.PATCH`, sem prefixos no valor do manifesto. Baseline documental `0.0.0`; marcos funcionais `0.1.0`, `0.2.0` etc.; correções compatíveis `0.2.1` etc.; primeira V1 operacional `1.0.0`. Quebras em 0.x incrementam MINOR e são explicadas; após 1.0, quebra incrementa MAJOR.
- Na F1 definir `package.json` raiz como referência da versão. Atualizar arquivos necessários e documentação de forma coerente. Não criar um manifesto nesta entrega apenas para registrar `0.0.0`.
- Usar commits explicativos e coesos em Conventional Commits: `feat`, `fix`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`. Título descreve a mudança; corpo registra motivo, escopo, validação e limitações. Usar `BREAKING CHANGE` quando pertinente.
- Uma grande etapa gera um commit de entrega; commits intermediários são permitidos quando representam mudanças completas e revisadas. Nunca misturar alterações alheias, commitar testes relevantes falhando ou usar mensagens como “update”/“ajustes” sem explicar.
- Revisar diff e listar explicitamente os arquivos ao fazer staging. Não usar `git add .` indiscriminadamente, sobrescrever mudanças do usuário, amend/rebase destrutivo ou force push sem pedido explícito.
- Push, abertura/merge de PR, criação de release remota e publicação são ações separadas que dependem de autorização. Não executar apenas porque o commit local foi concluído.

Exemplo de commit de etapa:

```text
feat(cms): implementa publicação editorial (v0.6.0)

Etapa: F6
Motivo: permitir gestão de conteúdo sem editar código.
Mudanças: editor, mídia, preview, agendamento e atualização do site.
Validação: listar somente checks executados e seus resultados.
Limitações: registrar integrações ainda simuladas ou gates pendentes.
```

## 8. Encerramento, relatório e checkpoint

1. Revisar escopo/diff, executar checks pertinentes e resolver falhas da entrega.
2. Atualizar **`plan.md`**: estado da etapa, versão real, data, último relatório, última entrega concluída, próximo passo e gate de autorização. Atualizar também o registro da última atualização. Etapa parcial permanece parcial, com ponto de retomada específico.
3. Atualizar **`relate.md`**: situação atual no topo e nova entrada `RP-NNN` no histórico. Registrar todos os arquivos criados/alterados/removidos, funcionalidades, decisões, comandos/checks e resultados, limitações, pendências externas, versão, branch e commit previsto/real conforme disponível. Não apagar entradas anteriores nem registrar segredos.
4. Quando Git estiver preparado, fazer o commit local somente após incluir plano/relatório e os arquivos validados; conferir o commit. O próprio SHA será informado na mensagem de entrega e registrado na próxima retomada. Não criar commit extra só para armazenar o hash do commit anterior.
5. Entregar ao usuário resumo completo da etapa, versão, arquivos, validações, limites, commit real ou pendência, e próxima etapa. **Aguardar confirmação antes de iniciá-la.** Não terminar somente com uma alegação de sucesso sem evidências.

Se houver interrupção, salvar relatório/checkpoint com o que está implementado, o que falta, checks pendentes e o comando/contexto necessário para retomar, sem declarar a etapa concluída.
