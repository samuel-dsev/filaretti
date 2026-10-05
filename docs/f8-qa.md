# QA integrado da F8

## Reprodução e isolamento

Depois de instalar o lockfile, gerar Prisma e compilar a API, executar `pnpm test:f8`. O runner compila seu próprio artefato web, exige `APP_ENV=development`, PostgreSQL em loopback com permissão de criar banco e browsers já instalados. Lê a configuração local internamente, gera segredos fictícios por execução e não imprime conexões, tokens ou credenciais. Não instala browsers nem ativa fornecedores externos.

Cada execução cria um banco `filaretti_f8_test_<UUID>`, aplica as migrations versionadas e o seed fictício, sobe API/worker e um build Next otimizado próprios nas portas 3037/3036. Storage, capturas locais de e-mail, fixtures, build e tsconfig ficam em diretórios próprios com UUID. A limpeza verifica os caminhos resolvidos e remove somente os recursos criados pela execução; o banco de desenvolvimento, seu volume e o preview 3000/3001 são preservados.

O build usa `NODE_ENV=production` com `APP_ENV=development`, `FILARETTI_QA_PHASE=f8` e origem pública dedicada. Mantém CSP aplicada, analytics desligado, mocks fictícios explícitos, robots bloqueado e `noindex`. Não habilitar indexação de produção nem remover essas proteções para aumentar uma nota.

Comandos incrementais:

- `pnpm test:f8 --skip-lighthouse`: templates, acessibilidade, teclado, sessão, headers e inventário de browsers.
- `pnpm test:f8 --lighthouse-only`: novo ambiente isolado e medições Lighthouse, sem repetir a matriz visual.
- `pnpm test:f8 --http-only`: somente verificações HTTP; não representa validação de browser ou desempenho.

O runner resolve Playwright e axe pelo lockfile do projeto. `PLAYWRIGHT_MODULE_PATH` pode indicar um runtime existente. `F8_TEST_BROWSER_CHANNEL` seleciona o canal principal, com `msedge` por padrão. `F8_LIGHTHOUSE_BROWSER_PATH` pode indicar outro Chromium existente; por padrão usa Chrome do Windows. CI Linux deve configurar os canais/caminhos disponíveis, sem atribuir resultados futuros a esta máquina.

## Escopo da matriz

Templates públicos: Home, escritório, listagem/detalhe de áreas, listagem/perfil de profissionais, listagem editorial, artigo, atualização, guia, contato, newsletter, confirmação, descadastro, busca, FAQ, privacidade e cookies. Também são inspecionados login, recuperação e redefinição administrativa, 404 e preview válido privado com token redigido. O ADMIN percorre dashboard e listagens de artigos, categorias, tags, áreas, profissionais, páginas, FAQ, mídia, contatos, assinantes, usuários, redirects e configurações, além dos oito formulários de criação de recursos editoriais/institucionais.

O canal principal percorre 375, 768, 1024, 1440 e 1920 px. Chrome adicional percorre os templates públicos/autenticação/auxiliares a 1440 px e os fluxos de teclado/sessão. Capturas completas, overflow, landmark principal, H1, nomes de controles, labels, IDs, carregamento/alt de imagens e contraste de texto sólido são registrados. Axe verifica regras WCAG A/AA, incluindo etiquetas 2.1/2.2 e best practices para hierarquia/landmarks, em 375 e 1440 px. Casos incompletos do axe ficam explícitos e exigem avaliação humana; ausência de violações automáticas não certifica WCAG.

Teclado verifica skip link e foco no conteúdo, FAQ por Enter, abertura/fechamento/restauração de foco em preferências de cookies e diálogo de contato. A sessão administrativa é obtida pela API real e os cookies de acesso precisam ser HttpOnly; tokens não são gravados em localStorage. Um script inline sem nonce é inserido em fixture de teste e deve permanecer bloqueado pela CSP aplicada. Não há `bypassCSP`.

A navegação pública é verificada pelo tráfego real de RSC: o artigo não busca outras páginas antes de interação, e clicar no link do escritório continua carregando seu destino. Isso protege o comportamento após desativar prefetch especulativo nos links compartilhados.

Em ambos os browsers, um contexto adicional com JavaScript desativado verifica título e corpo da publicação visíveis no HTML renderizado pelo servidor. Isso protege a leitura principal contra regressão para um bloco oculto que depende de hidratação. Complementos transmitidos posteriormente e widgets interativos não fazem parte dessa alegação.

O check HTTP de CSS confirma que a Home não carrega regras de admin/demo, o login carrega administração e a demonstração recebe ambos os estilos. Os bytes não comprimidos de stylesheets ficam no resumo, e a matriz visual confirma a aparência após mover imports para layouts específicos.

Após deferir layout/paint das seções fora do viewport, Edge/Chrome também focam o link do bloco relacionado ao final do artigo, confirmam que ele entra no viewport e navegam por Enter. Isso verifica acesso por teclado ao conteúdo adiado, sem alegar validação de leitor de tela. Capturas completas conservam a inspeção do conteúdo e seus tamanhos.

Fluxos completos de publicação/preview/mídia/agendamento, contato/anexo privado, inscrição/confirmação/descadastro, recuperação e cenários negativos são complementados pelos runners `test:cms`, `test:relationship` e pela suíte de integração PostgreSQL. O relatório de continuidade identifica quais deles foram efetivamente executados na F8.

## Lighthouse e metas

Cada template público recebe três medições em build otimizado, dispositivo móvel emulado e throttling simulado do Lighthouse fixado no lockfile. A origem, versão, caminho do browser, forma de throttling, horários, notas, métricas numéricas e auditorias não aprovadas ficam no relatório. O protocolo final escolhe a execução com nota Performance mediana; Accessibility e Best Practices precisam passar nas três. A regra é fixada antes da execução, sem repetir até obter aprovação. Todas as amostras e relatórios originais são preservados, incluindo notas inferiores à meta. Isso reduz a influência de variação pontual da máquina e não representa dados de usuários reais. As primeiras rodadas exploratórias tinham uma execução por template e são identificadas separadamente no RP-009. Referência: [variabilidade do Lighthouse](https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md).

As metas são Performance 90, Accessibility 90, Best Practices 90 e SEO 95. Performance mediana abaixo de 90 ou Accessibility/Best Practices abaixo de 90 em qualquer amostra fazem o runner falhar, inclusive em CI. O campo `lighthouseTargetsMet` informa o atendimento integral da execução representativa; as falhas permanecem no JSON, inclusive SEO afetado pelo `noindex` legítimo do ambiente protegido. `passed` informa a conclusão dos checks funcionais/automáticos e da execução, separadamente da meta SEO. Não confundir os dois campos. SEO abaixo do esperado exige pendência explícita da homologação; um runner concluído não comprova aceite integral da F8.

## Evidências e limites

O resumo sanitizado da execução completa é `.local/f8-qa-smoke.json`; os comandos incrementais gravam `.local/f8-layout-smoke.json` e `.local/f8-lighthouse-smoke.json`, preservando o resumo dos demais checks. Screenshots completos e relatórios originais por template ficam em `.local/f8-qa-evidence/`; são artefatos locais ignorados pelo Git. O histórico de execução identifica browsers/versões, verificações, violações, erros e limpeza. As capturas devem ser abertas para inspeção visual antes de relatar revisão humana.

Chromium não pinta trechos adiados por content-visibility ao capturar além do viewport. Nesses templates, o runner conserva uma imagem do viewport original de1000px e expande temporariamente sua altura somente para pintar o documento completo; os arquivos com sufixo `-viewport` conservam a primeira dobra real. O resumo registra o modo. Geometria, teclado, axe e Lighthouse usam seus próprios viewports originais; nenhuma regra CSS ou proteção é desativada. A captura expandida pode conservar espaço adicional após o rodapé e posicionar elementos fixos no final do documento; não representa a primeira dobra. Consultar a imagem de viewport para esse estado.

Chrome e Edge desktop são evidência de seus próprios canais. Viewports móveis não comprovam Android/iOS físicos. Firefox/WebKit só são executados quando existe binário compatível; sua ausência permanece na matriz. Um smoke WebKit não certifica Safari macOS ou iOS. Leitor de tela requer sessão real de tecnologia assistiva e não é substituído por axe, árvore acessível ou síntese de voz.

Este runner usa PostgreSQL/HTTP/storage/worker locais. Não comprova R2, Resend, Turnstile, scanner externo, GA4 remoto, HTTPS/HSTS no provedor, CI remoto, dispositivos físicos ou publicação protegida. Esses gates e as aprovações operacionais permanecem distintos da validação local.
