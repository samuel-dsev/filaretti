import type { TipTapDocument, TipTapNode } from '@filaretti/types';
import type { PracticeAreaDto } from '../src/domain/dto';

const civilCode =
  'https://www2.camara.leg.br/legin/fed/lei/2002/lei-10406-10-janeiro-2002-432893-normaatualizada-pl.html';

function section(title: string, text: string): TipTapNode[] {
  return [
    { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: title }] },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ];
}

function description(sections: TipTapNode[], sources: [string, string][]): TipTapDocument {
  return {
    type: 'doc',
    content: [
      ...sections,
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Fontes oficiais' }],
      },
      {
        type: 'bulletList',
        content: sources.map(([text, href]) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }],
            },
          ],
        })),
      },
    ],
  };
}

export const practiceAreaContent = [
  {
    id: 'ef4d9e21-6a25-4b79-9eb7-76c320fb2ce0',
    slug: 'imobiliario',
    name: 'Imobiliário',
    summary:
      'Orientação jurídica em compra, venda, financiamento e locação de imóveis, da análise da documentação à formalização do negócio.',
    description: description(
      [
        ...section(
          'Compra, venda e documentação do imóvel',
          'A análise começa pela matrícula atualizada. Ela ajuda a confirmar quem consta como titular e a identificar ônus ou restrições registrados que possam afetar o negócio. Também são examinados os documentos das partes, a descrição do imóvel e as condições de pagamento e entrega. A propriedade se transfere com o registro do título no Registro de Imóveis, conforme o artigo 1.245 do Código Civil.',
        ),
        ...section(
          'Financiamento e garantias',
          'Na compra financiada, a análise jurídica abrange prazos, encargos, condições de quitação e as consequências do atraso. Quando há alienação fiduciária, o imóvel serve de garantia e o procedimento em caso de inadimplência segue regras próprias de intimação, consolidação da propriedade e leilão.',
        ),
        ...section(
          'Locação e regularização',
          'Nos contratos de locação urbana, a revisão trata de reajuste, garantias, vistoria, despesas e devolução do imóvel. A Lei do Inquilinato distribui deveres entre locador e locatário. Quando há divergência entre o imóvel negociado e os documentos do registro, a orientação parte da identificação do dado que precisa ser corrigido e do procedimento aplicável.',
        ),
      ],
      [
        ['Código Civil — transferência da propriedade imobiliária', civilCode],
        [
          'Lei de Registros Públicos — matrícula e atos registrais',
          'https://www2.camara.leg.br/legin/fed/lei/1970-1979/lei-6015-31-dezembro-1973-357511-normaatualizada-pl.html',
        ],
        [
          'Lei do Inquilinato — direitos, deveres e garantias',
          'https://www2.camara.leg.br/legin/fed/lei/1991/lei-8245-18-outubro-1991-322506-normaatualizada-pl.html',
        ],
        [
          'Lei nº 9.514/1997 — alienação fiduciária de imóveis',
          'https://www2.camara.leg.br/legin/fed/lei/1997/lei-9514-20-novembro-1997-365383-normaatualizada-pl.html',
        ],
      ],
    ),
    services: [
      'Análise da matrícula e de documentos de compra e venda',
      'Elaboração e revisão de instrumentos de compra e venda',
      'Análise jurídica de financiamento e garantias imobiliárias',
      'Elaboração e revisão de contratos de locação',
      'Orientação sobre vistoria, encargos e devolução do imóvel',
      'Orientação em regularização imobiliária e registral',
    ],
  },
  {
    id: 'c61371b4-baa1-410b-9a88-91ff3c1c3b83',
    slug: 'resolucao-contratual',
    name: 'Resolução Contratual',
    summary:
      'Análise de contratos que precisam ser renegociados ou encerrados, com atenção a notificações, multas, devoluções e obrigações pendentes.',
    description: description(
      [
        ...section(
          'O motivo do encerramento orienta a análise',
          'O encerramento por acordo das partes é chamado de distrato. A saída por iniciativa de uma parte depende do que a lei ou o contrato permite. Já o descumprimento pode fundamentar a resolução do contrato ou a exigência do cumprimento da obrigação. Os artigos 472 a 475 do Código Civil tratam dessas hipóteses e ajudam a identificar a medida adequada.',
        ),
        ...section(
          'Notificações, valores e obrigações pendentes',
          'A análise reúne o contrato, seus aditivos, os comprovantes de pagamento e as comunicações entre as partes. Esses documentos ajudam a verificar se há prazo para regularizar o descumprimento, como deve ser feita a notificação e quais valores ou bens podem precisar ser devolvidos. A revisão por onerosidade excessiva depende dos requisitos legais aplicáveis ao caso.',
        ),
        ...section(
          'Negociação, mediação e medidas judiciais',
          'Quando há espaço para acordo, a negociação pode organizar prazos, pagamentos e obrigações que continuam após o encerramento. A mediação oferece apoio de um terceiro imparcial na busca de uma solução construída pelas partes. Quando o acordo é inviável, os documentos ajudam a avaliar as medidas judiciais cabíveis.',
        ),
      ],
      [
        ['Código Civil — extinção dos contratos e onerosidade excessiva', civilCode],
        [
          'Lei de Mediação — solução consensual entre particulares',
          'https://www2.camara.leg.br/legin/fed/lei/2015/lei-13140-26-junho-2015-781100-normaatualizada-pl.html',
        ],
      ],
    ),
    services: [
      'Análise das hipóteses de revisão e encerramento contratual',
      'Elaboração de notificações extrajudiciais',
      'Análise de multas, retenções e devoluções',
      'Negociação de aditivos, distratos e acordos',
      'Assessoria em procedimentos de mediação',
      'Avaliação de medidas judiciais em controvérsias contratuais',
    ],
  },
  {
    id: 'bbbe7a45-e8e0-4b41-9092-8cdf986acefa',
    slug: 'consultoria-empresarial',
    name: 'Consultoria Empresarial',
    summary:
      'Assessoria jurídica preventiva para decisões societárias, contratos comerciais e organização das rotinas da empresa.',
    description: description(
      [
        ...section(
          'Estrutura societária e poderes de administração',
          'A consultoria começa pela leitura do contrato social e de suas alterações. Em sociedades limitadas, pontos como participação dos sócios, poderes de administração e regras de deliberação interferem nas decisões do dia a dia. O Código Civil disciplina a estrutura da limitada, e o manual do DREI orienta o registro de atos como constituição e alterações contratuais.',
        ),
        ...section(
          'Contratos da operação',
          'A revisão de contratos com clientes, fornecedores e parceiros ajuda a definir o que será entregue, como a entrega será aceita e quais são os prazos e condições de pagamento. Também permite tratar de responsabilidade, confidencialidade e encerramento antes de a relação comercial começar. A documentação pode acompanhar o crescimento da empresa e as mudanças na operação.',
        ),
        ...section(
          'Proteção de dados e prevenção de riscos',
          'Quando a empresa trata dados pessoais, a análise pode incluir a identificação dos dados coletados, das finalidades de uso e de quem tem acesso a eles. A LGPD estabelece princípios de tratamento e exige medidas técnicas e administrativas de segurança. Mapear essas rotinas ajuda a priorizar ajustes em contratos, avisos e procedimentos internos.',
        ),
      ],
      [
        ['Código Civil — sociedade limitada e administração', civilCode],
        [
          'DREI — Manual de Registro de Sociedade Limitada',
          'https://www.gov.br/empresas-e-negocios/pt-br/drei/legislacao/instrucoes-normativas/arquivos-instrucoes-normativas-em-vigor/anexo-iv-limitada_compilada.pdf',
        ],
        [
          'LGPD — princípios de tratamento e segurança dos dados',
          'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html',
        ],
      ],
    ),
    services: [
      'Análise de contrato social e alterações societárias',
      'Orientação sobre poderes de administração e deliberações dos sócios',
      'Elaboração e revisão de contratos comerciais',
      'Análise jurídica de relações com fornecedores e parceiros',
      'Revisão de cláusulas de confidencialidade e tratamento de dados',
      'Mapeamento de riscos jurídicos da operação',
    ],
  },
] satisfies (PracticeAreaDto & { id: string })[];
