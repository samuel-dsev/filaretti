import type { SiteFooterProps, SiteHeaderProps } from '../../../components/site';

export const demoHeader: SiteHeaderProps = {
  brand: {
    name: 'Filaretti',
    monogram: 'F',
    caption: 'Advocacia · demonstração',
    href: '/dev/design-system',
  },
  navigation: [
    { id: 'escritorio', label: 'O escritório', href: '#institucional' },
    {
      id: 'areas',
      label: 'Áreas de atuação',
      description: 'Conheça as possibilidades de apresentação de cada área.',
      children: [
        {
          label: 'Área demonstrativa 01',
          href: '#areas',
          description: 'Visão de negócios e relações.',
        },
        {
          label: 'Área demonstrativa 02',
          href: '#areas',
          description: 'Uma perspectiva para cada contexto.',
        },
        {
          label: 'Área demonstrativa 03',
          href: '#areas',
          description: 'Informação com clareza e precisão.',
        },
      ],
    },
    { id: 'conteudos', label: 'Conteúdos', href: '#conteudos' },
    { id: 'equipe', label: 'Profissionais', href: '#equipe' },
    { id: 'componentes', label: 'Componentes', href: '#componentes' },
  ],
};

export const demoFooter: SiteFooterProps = {
  brand: demoHeader.brand,
  description: 'Um espaço para apresentar ideias com profundidade, clareza e cuidado.',
  groups: [
    {
      title: 'Explore o exemplo',
      links: [
        { label: 'Áreas de atuação', href: '#areas' },
        { label: 'Profissionais', href: '#equipe' },
        { label: 'Conteúdos', href: '#conteudos' },
      ],
    },
    {
      title: 'Biblioteca visual',
      links: [
        { label: 'Componentes e estados', href: '#componentes' },
        { label: 'Layout administrativo', href: '/dev/design-system/admin' },
      ],
    },
  ],
  note: 'Demonstração local com textos, pessoas e áreas fictícios. Materiais sujeitos à aprovação.',
  copyright: 'Filaretti · ambiente de demonstração',
};
