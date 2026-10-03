# Design System

Referência: F3, versão `0.3.0`, 03/10/2026. Biblioteca implementada em `packages/ui/src`; layouts em `apps/web/src/components/site` e `admin`. A demonstração é um estudo fictício de interface. Materiais oficiais e identidade definitiva continuam sujeitos à aprovação do escritório até a F9.

## Direção visual e tokens

Linguagem institucional/editorial, com títulos serifados, espaços amplos, superfícies claras e navegação em azul. A referência [Silveiro](https://silveiro.com.br/) orienta o princípio editorial; composição, monograma e ilustrações desta demonstração são próprios e substituíveis. Não há fotografias nem identidades profissionais reais.

Importar uma vez `@filaretti/ui/styles.css` antes dos estilos dos layouts. Tokens CSS possuem prefixo `--f-`; classes de componentes usam `f-`. As cores são semânticas e não dependem de Tailwind para funcionar.

| Token `--f-color-*`    | Valor                 | Uso                              |
| ---------------------- | --------------------- | -------------------------------- |
| navy                   | `#102A43`             | Títulos, fundo do footer/sidebar |
| primary                | `#1D4E89`             | Ações, links, foco claro         |
| action                 | `#2563A6`             | Azul de ação alternativo         |
| pale                   | `#DCEAF7`             | Fundo suave e foco inverso       |
| offwhite               | `#F7F8FA`             | Fundo de página                  |
| surface                | `#FFFFFF`             | Superfícies e texto inverso      |
| muted                  | `#404852`             | Texto secundário e ajuda         |
| ink                    | `#161A1D`             | Texto principal                  |
| border                 | `#778594`             | Limites de campos/controles      |
| success / success-soft | `#1B6141` / `#E8F4EC` | Feedback positivo                |
| warning / warning-soft | `#785000` / `#FFF4D6` | Avisos                           |
| danger / danger-soft   | `#A12430` / `#FDECEF` | Erros                            |

`focus` referencia primary; `focus-inverse` referencia pale. Usar `data-f-surface="dark"` em superfícies escuras para configurar foco/halo inversos. Bordas decorativas claras dos cards não são limites de campos interativos; o token border garante contraste nos controles.

`pnpm test:design-system` calcula luminância/contraste de 44 combinações usadas. Texto normal exige 4,5:1, controles/foco 3:1. Nesta paleta, o menor contraste de texto da matriz é **5,025:1** e de controle **3,082:1**. Mudanças nos tokens devem passar novamente pelo checker e pela inspeção renderizada. O cálculo não certifica conformidade WCAG completa.

## Tipografia e dimensões

- Cormorant Garamond 400/500/600 para títulos e Inter variável para corpo; carregadas no layout raiz via `next/font/google` com `display: swap`, subconjunto latin e variáveis `--font-display`/`--font-body`. `next/font` hospeda os arquivos no build; o navegador recebe fontes locais, conforme [documentação do Next.js](https://nextjs.org/docs/app/getting-started/fonts). A primeira compilação requer acesso ao fornecedor das fontes.
- Tokens `--f-font-display`/`--f-font-body` usam essas variáveis e fallback Georgia/Arial. Corpo 16 px e linha 1,6; escala 12/14/16/18/24 px, títulos fluidos e display até 104 px. Hero ajusta a escala ao espaço disponível.
- Espaçamento `--f-space-1` a `9`: 4/8/12/16/24/32/48/64/96 px.
- `.f-container`: largura máxima 1440 px, gutter fluido de 16 a 64 px; leitura máxima 720 px. Cards e grades usam colunas `minmax(0, 1fr)`.
- Breakpoints de referência: 768, 1024, 1440 e 1920 px (48/64/90/120 rem). Em 375 px as grades empilham; a partir de 768 px usam duas colunas; em 1024 px a navegação desktop aparece. Entre 1024–1199 px a busca usa ícone com rótulo acessível. O conteúdo mantém limite de largura em telas maiores.
- Alvos interativos de pelo menos 44 px, foco visível e transições de 150/220 ms; reduced motion desativa animações de loading e transições dos componentes/layouts.

## Componentes compartilhados

| Export                    | Contrato principal                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Button / LinkButton       | Variantes primary/secondary/ghost/danger; tamanhos sm/md/lg; loading no botão; link disabled sem href |
| Input / Textarea / Select | Props HTML tipadas, ref e estado invalid                                                              |
| FormField                 | id, label, help, error, required; função children recebe id/aria-describedby/aria-invalid/required    |
| Card / Panel              | Contêineres article/section; Card default/soft/dark; Panel compatível com a fundação                  |
| Badge / Avatar            | Estados textuais neutral/brand/success/warning/danger; imagem ou iniciais com fallback                |
| Dialog / Drawer           | open, onClose, title, description, children, footer, initialFocusRef; Drawer right/left               |
| Accordion                 | items com id/title/content; details/summary nativos, abertura múltipla opcional                       |
| Pagination                | currentPage, totalPages, getHref; links, aria-current e janela limitada                               |
| Skeleton / Toast          | Placeholder com anúncio de loading; toast textual com símbolo, live region e fechamento manual        |
| EmptyState / ErrorState   | title, description, action opcional; mensagem de erro com anúncio                                     |

Exemplo de formulário:

```tsx
<FormField id="email" label="E-mail" required error={error}>
  {(props) => <Input {...props} type="email" name="email" invalid={Boolean(error)} />}
</FormField>
```

FormField e controles sem hooks podem compor renderização no servidor; a função children deve ser criada no mesmo lado da fronteira servidor/cliente. Estados interativos e diálogos são componentes cliente. Os componentes não contêm Prisma, Nest, configuração privada nem regras de autorização.

Dialog/Drawer compartilham o mesmo mecanismo HTML [`dialog`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog): `showModal`, inert do restante da página, foco inicial, Tab/Shift+Tab, Escape explícito (inclusive em search input preenchido), fechamento pelo fundo e restauração de foco/scroll. Toast fecha por ação do usuário; nenhuma contagem regressiva remove a mensagem antes da leitura.

## Layouts e demonstração

SiteHeader recebe marca/navegação por props; mega menu abre por clique/ArrowDown, fecha por Escape/clique externo/saída de foco e devolve o foco ao acionador. Navegação mobile usa Drawer. SearchOverlay é somente uma estrutura de busca com campo rotulado e aviso de funcionalidade futura. SiteFooter, Hero, Breadcrumb e cards editoriais/áreas/profissionais recebem conteúdo por props para consumo da API nas fases seguintes.

PublicLayout e AdminLayout usam um `main#conteudo`; o skip link único é fornecido pelo RootLayout. AdminLayout contém sidebar responsiva, navegação e slots; identidade, números e listas demonstrativos não representam uma sessão ou CMS conectado.

Rotas `/dev/design-system` e `/dev/design-system/admin` exigem **APP_ENV=development e Host de loopback exato**, com servidor em bind local. Um Proxy Next rejeita a requisição com 404 antes de renderizar; o layout repete a guarda e força renderização dinâmica, no-store e noindex. A rejeição antes da renderização evita [HTTP 200 após início do streaming](https://nextjs.org/docs/app/api-reference/functions/not-found). O Proxy não modifica `/api/v1` nem substitui a autorização Nest. Testes unitários protegem a allowlist; smokes locais verificam o bundle otimizado sob development/staging/production.

O formulário demonstrativo valida campos no navegador, aponta erros por texto/ARIA e focaliza o primeiro inválido. Não envia nem persiste informações. Paginação muda a URL e o estado visual da página; não simula consultas. Nenhuma conexão com API, login, contato, inscrição ou busca real é apresentada como concluída pela F3.

## Verificação e limites

Aceite e evidências da F3 estão no RP-004 de `relate.md`. A revisão cobre Edge headless em 375, 768, 1024, 1440 e 1920 px, nos layouts público e administrativo, contraste renderizado, foco, teclado e reduced motion. Evidências locais em `.local/f3-evidence`, com JSONs `.local/f3-smoke.json`, `f3-contrast.json` e `f3-gates.json`, são ignoradas pelo Git.

Não foram certificados Safari/Firefox, dispositivos físicos ou leitores de tela; a revisão abrangente é prevista na F8. Mídias/identidade oficiais aguardam aprovação; páginas conectadas à API pertencem à F4/F5, CMS à F6 e busca/relacionamento à F7. A meta WCAG 2.2 AA segue a [norma W3C](https://www.w3.org/TR/WCAG22/) e exige a revisão dos fluxos completos.
