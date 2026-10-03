# Design System

Decisões iniciais da F1, 02/10/2026. O pacote `packages/ui` organiza o compartilhamento; a biblioteca visual, os layouts do portal e sua validação pertencem à F3. A tela inicial da fundação serve ao setup local e não é a Home institucional.

## Direção visual para F3

Linguagem institucional/editorial, títulos expressivos, espaços amplos e leitura confortável. A referência Silveiro orienta o princípio visual; a identidade será própria e dependerá de materiais aprovados. Fotografias locais de desenvolvimento serão fictícias ou substituíveis, sem representar pessoas reais ou credenciais profissionais.

| Uso previsto     | Cor inicial |
| ---------------- | ----------- |
| Azul profundo    | `#102A43`   |
| Azul principal   | `#1D4E89`   |
| Azul de ação     | `#2563A6`   |
| Azul suave       | `#DCEAF7`   |
| Fundo suave      | `#F7F8FA`   |
| Superfície       | `#FFFFFF`   |
| Texto secundário | `#404852`   |
| Texto principal  | `#161A1D`   |

Esses valores são pontos de partida do plano, sem alegação de contraste já validado. A F3 definirá tokens semânticos de texto, fundo, borda, ação, foco e estados, e verificará cada combinação usada.

Cormorant Garamond e Inter são as famílias previstas para títulos e corpo, carregadas com `next/font` quando os layouts forem implementados. Escala tipográfica, pesos, largura de leitura, espaçamento, containers e breakpoints serão definidos na F3. Evitar downloads de fontes durante testes sem necessidade e prever fallback adequado.

## Componentes e estrutura previstos

Na F3: botões/links, campos e feedback de formulário, cards, badges, avatar, modal/drawer, accordion, paginação, skeleton e toast. Componentes com uso real serão compartilhados; criar uma abstração não substitui a validação da interação.

Layouts público/administrativo terão header, mega menu, menu mobile, footer, hero, breadcrumb, cards editoriais/áreas/profissionais e estrutura da busca. Microinterações serão discretas; uma dependência de animação será acrescentada apenas se houver necessidade demonstrada.

## Acessibilidade e estados

Todo componente interativo deverá incluir foco visível, navegação por teclado, rótulos e semântica apropriados. Erro, vazio e carregamento serão tratados desde a implementação. Não comunicar estado somente por cor; respeitar reduced motion. Modal/drawer deverá gerir foco e fechamento; menus deverão permitir uso sem hover obrigatório.

A meta da V1 é WCAG 2.2 AA nos fluxos principais; a [norma WCAG 2.2](https://www.w3.org/TR/WCAG22/) é a referência de verificação. Declarar essa meta não certifica a interface. A revisão completa e as limitações ficam no relatório da F8.

## Aceite e dependências

Na F3, apresentar componentes em rota de demonstração local, validar contraste e uso por teclado, e inspecionar layouts em 375, 768, 1024, 1440 e 1920 px. Registrar tamanhos/navegadores efetivamente verificados. Nenhum teste ou compatibilidade de interface futura é considerado concluído nesta documentação.

Identidade definitiva, logo, fotos e materiais oficiais dependem do escritório; sua aprovação deve ocorrer até a F9. Textos institucionais e dados de contato virão da API/configurações nas fases consumidoras, permitindo manutenção sem editar componentes.
