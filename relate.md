# Filaretti Advocacia — situação atual e relatórios

## Situação atual

| Campo | Estado |
| --- | --- |
| Última atualização | 02/10/2026 — RP-000 |
| Etapa | F0 — planejamento inicial concluído |
| Versão | `0.0.0` documental; sem manifesto de aplicação |
| Código/aplicação | Não implementado |
| Ambiente | Raiz do projeto inicialmente vazia; sem aplicações, banco ou serviços iniciados |
| Git | Sem repositório; primeiro commit, remoto e branch serão configurados pelo usuário |
| Commit desta entrega | Não realizado, conforme instrução do usuário |
| Próxima etapa | F1 — Fundação técnica e ambiente local |
| Autorização | Aguardando confirmação para iniciar F1 |
| Checkpoint | Quadro inicial e registro da última atualização de `plan.md` |

Este documento distingue implementação, validação e pendências externas. Atualizar este quadro em toda entrega ou interrupção e acrescentar uma entrada ao histórico, preservando as anteriores. Datas e horários informados ao usuário seguem America/Sao_Paulo.

## Histórico

### RP-000 — 02/10/2026 — Planejamento inicial

**Escopo autorizado:** converter o plano mestre fornecido pelo usuário em um planejamento técnico cronológico; criar os arquivos de continuidade e regras na raiz. Sem implementação de aplicação ou operações externas.

**Versão:** referência inicial `0.0.0`; esse número ainda não representa release executável.

#### Arquivos criados

| Arquivo | Conteúdo |
| --- | --- |
| `plan.md` | Dez grandes atualizações, dependências, entregáveis, aceite, arquitetura, modelo de dados mínimo, riscos/gates, versões previstas e checkpoint |
| `AGENTS.md` | Leitura obrigatória do plano/relatório, preservação das regras RTK, escopo por autorização, segurança, subagentes, validação, SemVer, commits e pausa entre etapas |
| `relate.md` | Situação inicial, histórico da entrega e modelo de relatório para continuidade |

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
