import type { TipTapDocument, TipTapNode } from '@filaretti/types';

const stjThemes = 'https://processo.stj.jus.br/repetitivos/temas_repetitivos/pesquisa.jsp';
const stjTheme = (theme: number) =>
  `${stjThemes}?cod_tema_final=${theme}&cod_tema_inicial=${theme}&novaConsulta=true&tipo_pesquisa=T`;
const text = (value: string): TipTapNode => ({ type: 'text', text: value });
const paragraph = (value: string): TipTapNode => ({ type: 'paragraph', content: [text(value)] });
const heading = (value: string): TipTapNode => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [text(value)],
});
const list = (...items: string[]): TipTapNode => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
});
function document(content: TipTapNode[], sources: [string, string][]): TipTapDocument {
  return {
    type: 'doc',
    content: [
      ...content,
      heading('Fontes oficiais'),
      {
        type: 'bulletList',
        content: sources.map(([label, href]) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ ...text(label), marks: [{ type: 'link', attrs: { href } }] }],
            },
          ],
        })),
      },
    ],
  };
}

export const realEstateArticles = [
  {
    id: 'c4eb3c8e-acd7-4eb0-ab77-18d434abbb34',
    slug: 'locacao-curta-duracao-condominio-tema-1443',
    title: 'Locação de curta duração em condomínios. O que o STJ vai decidir?',
    excerpt:
      'O Tema 1.443 discute se a destinação residencial prevista na convenção basta para restringir a oferta de unidades por plataformas digitais.',
    content: document(
      [
        paragraph(
          'Para quem pretende anunciar um apartamento por poucos dias, a convenção do condomínio pode ser tão importante quanto o contrato. A Segunda Seção do Superior Tribunal de Justiça (STJ) selecionou dois recursos para decidir se a cláusula que prevê uso residencial já basta para impedir a locação de curta duração por plataformas digitais ou se a convenção precisa proibi-la expressamente.',
        ),
        heading('O que está em discussão'),
        paragraph(
          'No Tema 1.443, o tribunal vai examinar os Recursos Especiais 2.272.537 e 2.272.536 sob o rito dos repetitivos. O STJ determinou a suspensão dos processos individuais e coletivos que discutem essa mesma questão. Em 13 de novembro de 2026, o painel do tribunal ainda indicava o tema como afetado, etapa em que os recursos já foram escolhidos para julgamento.',
        ),
        heading('O uso do imóvel pesa na análise'),
        paragraph(
          'Em outro julgamento, no REsp 2.121.055/MG, a Segunda Seção examinou a oferta habitual de estadias curtas. O colegiado considerou a forma de exploração da unidade e entendeu que a mudança da destinação residencial, nas circunstâncias do caso, exigia aprovação de dois terços dos condôminos. O precedente também distingue essa exploração da locação para temporada prevista no artigo 48 da Lei do Inquilinato, voltada à residência temporária por até 90 dias.',
        ),
        heading('O que conferir antes de anunciar'),
        list(
          'Leia a convenção, o regimento interno e as atas de assembleias que tratem da destinação da unidade e da entrada de visitantes.',
          'Observe a duração, a frequência das estadias e a forma de exploração do imóvel. Esses fatos ajudam a identificar como a atividade se enquadra.',
          'Verifique se a controvérsia envolve a regra discutida no Tema 1.443 ou outra questão, como descumprimento do regimento ou perturbação do sossego.',
        ),
      ],
      [
        ['STJ — Tema Repetitivo 1.443', stjTheme(1443)],
        [
          'STJ — Informativo sobre o REsp 2.121.055/MG',
          'https://scon.stj.jus.br/jurisprudencia/externo/informativo/?livre=%40CNOT%3D022336',
        ],
        [
          'Lei do Inquilinato — artigo 48',
          'https://www2.camara.leg.br/legin/fed/lei/1991/lei-8245-18-outubro-1991-322506-normaatualizada-pl.html',
        ],
      ],
    ),
  },
  {
    id: 'f6b5b54d-d587-4b66-88b3-a0d15f298f89',
    slug: 'cadastro-imobiliario-brasileiro-cib-imovel',
    title: 'Cadastro Imobiliário Brasileiro. Onde encontrar o CIB do seu imóvel?',
    excerpt:
      'A Receita Federal orienta como consultar o identificador nacional e informa o cronograma para imóveis urbanos nas capitais e nos demais municípios.',
    content: document(
      [
        paragraph(
          'Um mesmo imóvel pode aparecer na prefeitura com uma inscrição fiscal e no cartório com um número de matrícula. O Cadastro Imobiliário Brasileiro (CIB) acrescenta um identificador nacional a esse conjunto de informações. O código é gerado a partir dos dados compartilhados com o Sistema Nacional de Gestão de Informações Territoriais (Sinter).',
        ),
        heading('A implantação em 2026 e 2027'),
        paragraph(
          'Segundo a Receita Federal, a inscrição dos imóveis urbanos no CIB passou a ser exigida nas capitais estaduais e no Distrito Federal em 2026. Nos demais municípios, a obrigação começa em janeiro de 2027. Imóveis rurais seguem o cadastro próprio e já devem contar com o identificador. O Decreto nº 12.955/2026 inclui o CIB entre os cadastros administrados pela Receita usados para a identificação única.',
        ),
        heading('Cadastro fiscal, CIB e matrícula'),
        paragraph(
          'A inscrição municipal identifica o imóvel no cadastro da prefeitura. O CIB permite cruzar informações entre sistemas. A matrícula reúne os atos registrados sobre aquele imóvel, como a titularidade e os ônus, e continua sendo consultada no Registro de Imóveis. Numa compra e venda, a comparação entre os cadastros pode revelar divergências de endereço, área ou titular que precisam ser apuradas antes da transferência.',
        ),
        heading('Como verificar os dados'),
        list(
          'Consulte o imóvel no serviço Sinter Cidadão e confira se o código corresponde à unidade e ao endereço corretos.',
          'Para imóveis urbanos sem código ou com divergência cadastral, verifique a situação com a prefeitura. Se a divergência estiver na matrícula, consulte o Registro de Imóveis competente.',
          'Para imóveis rurais, consulte o Cadastro Nacional de Imóveis Rurais (CNIR) e confira os dados do imóvel antes de solicitar ajustes.',
        ),
      ],
      [
        [
          'Receita Federal — Cronograma do CIB',
          'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/cadastros/cib/o-que-o-cidadao-precisa',
        ],
        [
          'Receita Federal — Sinter Cidadão',
          'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/sinter/cidadao',
        ],
        [
          'Decreto nº 12.955/2026',
          'https://www2.camara.leg.br/legin/fed/decret/2026/decreto-12955-29-abril-2026-799019-normaatualizada-pe.html',
        ],
      ],
    ),
  },
  {
    id: 'c48b4043-ab74-42ae-b60e-efb9744e2f86',
    slug: 'cotas-condominio-compra-imovel-entrega-chaves',
    title: 'Cotas de condomínio na compra de um imóvel. Quando o comprador pode responder?',
    excerpt:
      'O STJ analisou a cobrança contra compradores que já constavam na matrícula, mas ainda não tinham recebido as chaves. Veja por que registro e posse precisam ser examinados.',
    content: document(
      [
        paragraph(
          'Assinar o contrato, registrar a compra e receber as chaves são eventos que podem ocorrer em datas diferentes. Essa diferença importa quando o condomínio cobra cotas vencidas durante a transição entre vendedor e comprador.',
        ),
        heading('O caso julgado pelo STJ'),
        paragraph(
          'No REsp 2.147.665, a Quarta Turma examinou a cobrança contra compradores que já figuravam como proprietários na matrícula, embora ainda não tivessem recebido as chaves. O colegiado reconheceu que eles podiam responder à cobrança. A decisão partiu da natureza da obrigação condominial, que se vincula ao imóvel, e da condição dos compradores como titulares registrados.',
        ),
        heading('Quando o compromisso ainda não foi registrado'),
        paragraph(
          'A situação pode ser diferente quando existe apenas compromisso de compra e venda. O Tema 886 considera a posse do comprador e a ciência do condomínio sobre a transação para definir quem pode ser cobrado. O STJ abriu a revisão desse entendimento no Tema 1.349, voltado à possível responsabilidade concorrente de vendedor e comprador por débitos posteriores à posse. Em 13 de novembro de 2026, o painel do tribunal ainda indicava essa revisão como afetada.',
        ),
        heading('Documentos que ajudam a esclarecer a cobrança'),
        list(
          'Matrícula atualizada e contrato de compra e venda, com as datas e cláusulas sobre a responsabilidade pelas despesas.',
          'Termo de entrega das chaves ou outro documento que registre quando o comprador assumiu a posse.',
          'Demonstrativo das cotas vencidas por competência e comunicações que informaram a venda ao condomínio.',
        ),
        paragraph(
          'Na prática, identificar quem pode ser cobrado pelo condomínio é uma questão. Entender como comprador e vendedor acertaram a divisão das despesas é outra. Os documentos e o período da dívida ajudam a esclarecer ambas.',
        ),
      ],
      [
        [
          'STJ — Decisão no REsp 2.147.665',
          'https://www.stj.jus.br/sites/portalp/paginas/comunicacao/noticias/2025/14102025-comprador-registrado-na-matricula-do-imovel-responde-por-condominio--mesmo-sem-receber-as-chaves-.aspx',
        ],
        ['STJ — Tema Repetitivo 886', stjTheme(886)],
        ['STJ — Tema Repetitivo 1.349', stjTheme(1349)],
      ],
    ),
  },
  {
    id: 'ce6818c9-a0aa-43a3-82a7-2d744d998b6e',
    slug: 'financiamento-imobiliario-alienacao-fiduciaria-tema-1288',
    title: 'Financiamento em atraso. O que muda quando o imóvel passa para o credor?',
    excerpt:
      'O Tema 1.288 do STJ explica como a consolidação da propriedade muda as possibilidades do devedor em financiamentos com alienação fiduciária.',
    content: document(
      [
        paragraph(
          'Num financiamento com alienação fiduciária, o imóvel serve de garantia da dívida. Se houver atraso, o procedimento pode avançar da intimação para pagamento até a consolidação da propriedade em nome do credor, ato registrado na matrícula. A etapa em que o procedimento se encontra faz diferença para quem pretende regularizar o financiamento.',
        ),
        heading('O que o Tema 1.288 decidiu'),
        paragraph(
          'Em decisão divulgada em fevereiro de 2026, a Segunda Seção do STJ distinguiu as situações anteriores e posteriores à entrada em vigor da Lei nº 13.465/2017. Para atos anteriores, quando a mora já havia sido regularizada nos termos da norma então aplicável, o tribunal reconheceu a possibilidade de desfazer a consolidação e retomar o contrato. Sob o regime posterior, se a propriedade já foi consolidada sem regularização da mora, o repetitivo reconhece o direito de preferência para adquirir o imóvel, nas condições do artigo 27, § 2º-B, da Lei nº 9.514/1997.',
        ),
        heading('Atraso, consolidação e preferência'),
        paragraph(
          'A intimação indica a etapa de regularização da mora e os valores exigidos. Nos financiamentos residenciais sujeitos ao artigo 26-A, a lei prevê a possibilidade de pagar as parcelas vencidas e as despesas aplicáveis até a averbação da consolidação. Depois dessa averbação, o direito de preferência segue condições e valores próprios. Ele funciona como possibilidade de aquisição do bem, enquanto o pagamento da mora, quando cabível, mantém o contrato.',
        ),
        heading('Como reconstruir a cronologia'),
        list(
          'Consulte a matrícula atualizada para identificar a garantia registrada e eventual averbação da consolidação.',
          'Reúna a intimação, os comprovantes de pagamento, as propostas do credor e os avisos de leilão.',
          'Confira as datas e os valores de cada etapa. O contrato, o tipo de financiamento e a lei vigente no momento dos atos influenciam a análise.',
        ),
      ],
      [
        [
          'STJ — Julgamento do Tema Repetitivo 1.288',
          'https://www.stj.jus.br/sites/portalp/paginas/comunicacao/noticias/2026/19022026-repetitivo-define-efeitos-da-quitacao-da-divida-em-imovel-com-alienacao-fiduciaria-apos-a-lei-13-4652017.aspx',
        ],
        [
          'Lei nº 9.514/1997 — artigos 26, 26-A e 27',
          'https://www2.camara.leg.br/legin/fed/lei/1997/lei-9514-20-novembro-1997-365383-normaatualizada-pl.html',
        ],
      ],
    ),
  },
] as const;
