import { Badge, Card, EmptyState, LinkButton } from '@filaretti/ui';

import { AdminLayout } from '../../../../components/admin';

export default function AdminDemoPage() {
  return (
    <AdminLayout
      brand="Filaretti"
      title="Visão geral"
      description="Layout de demonstração. Os dados e a identidade desta tela são fictícios."
      userLabel="Pessoa fictícia · Editor"
      navigation={[
        { label: 'Visão geral', href: '/dev/design-system/admin', current: true },
        { label: 'Conteúdos', href: '#admin-conteudos' },
        { label: 'Biblioteca visual', href: '/dev/design-system#componentes' },
        { label: 'Ver demonstração pública', href: '/dev/design-system' },
      ]}
    >
      <div className="demo-admin-notice">
        <Badge variant="warning">Demonstração local</Badge>
        <span>
          Estrutura visual do painel. Gestão e autenticação serão conectadas nas fases previstas.
        </span>
      </div>
      <div className="demo-grid demo-grid--three">
        {[
          ['Conteúdos', '12', 'Exemplo de itens publicados'],
          ['Rascunhos', '04', 'Exemplo de itens em preparação'],
          ['Profissionais', '03', 'Exemplo de perfis fictícios'],
        ].map(([label, value, note]) => (
          <Card key={label}>
            <p className="demo-eyebrow">{label}</p>
            <p className="demo-stat">{value}</p>
            <p className="demo-small">{note}</p>
          </Card>
        ))}
      </div>
      <Card id="admin-conteudos">
        <h2 className="demo-admin-title">Seu espaço de publicação</h2>
        <p>Um exemplo da organização de informações e ações do painel.</p>
        <EmptyState
          title="A biblioteca está pronta para começar"
          description="A lista de conteúdo será conectada ao CMS na fase correspondente."
          action={
            <LinkButton variant="secondary" href="/dev/design-system#componentes">
              Explorar os componentes
            </LinkButton>
          }
        />
      </Card>
    </AdminLayout>
  );
}
