import { Badge } from '@filaretti/ui';

import {
  Breadcrumb,
  EditorialCard,
  Hero,
  PlaceholderArtwork,
  PracticeAreaCard,
  ProfessionalCard,
  PublicLayout,
} from '../../../components/site';
import { DemoComponents } from './showcase';
import { demoFooter, demoHeader } from './demo-content';

export default async function DesignSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const rawPage = Number((await searchParams).pagina ?? 2);
  const currentPage = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 5 ? rawPage : 2;

  return (
    <PublicLayout header={demoHeader} footer={demoFooter}>
      <div className="demo-notice">
        <span className="f-container">
          Demonstração local · F3 · conteúdo inteiramente fictício
        </span>
      </div>
      <div id="institucional">
        <Hero
          eyebrow="Perspectivas que aproximam"
          title="Clareza para pensar. Cuidado para construir."
          description="Uma proposta visual para conectar conhecimento, pessoas e novas perspectivas. Este é um estudo de interface, com conteúdo de demonstração."
          visual={<PlaceholderArtwork />}
          actions={[
            { label: 'Explore as áreas', href: '#areas' },
            { label: 'Conheça a biblioteca', href: '#componentes', secondary: true },
          ]}
        />
      </div>
      <div className="f-container demo-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Design System' }]} />
      </div>
      <section id="areas" className="demo-section f-container" aria-labelledby="areas-title">
        <div className="demo-section-heading">
          <div>
            <p className="demo-eyebrow">Conhecimento em contexto</p>
            <h2 id="areas-title">
              Diferentes olhares.
              <br />A mesma atenção.
            </h2>
          </div>
          <p>
            Estruturas para apresentar as áreas do escritório. Os exemplos abaixo não representam
            serviços aprovados.
          </p>
        </div>
        <div className="demo-grid demo-grid--three">
          {[
            [
              '01',
              'Área demonstrativa 01',
              'Relações, escolhas e possibilidades para um cenário em transformação.',
            ],
            [
              '02',
              'Área demonstrativa 02',
              'Uma visão atenta aos detalhes, com espaço para compreender cada contexto.',
            ],
            [
              '03',
              'Área demonstrativa 03',
              'Informação organizada para tornar temas complexos mais próximos.',
            ],
          ].map(([number, title, description]) => (
            <PracticeAreaCard
              key={number}
              number={number}
              title={title ?? ''}
              description={description ?? ''}
            />
          ))}
        </div>
      </section>
      <section id="conteudos" className="demo-editorial" aria-labelledby="editorial-title">
        <div className="f-container">
          <div className="demo-section-heading">
            <div>
              <p className="demo-eyebrow">Ideias em circulação</p>
              <h2 id="editorial-title">
                Leituras para ampliar
                <br />a perspectiva.
              </h2>
            </div>
            <Badge variant="brand">Conteúdo fictício</Badge>
          </div>
          <div className="demo-grid demo-grid--three">
            {[
              [
                'Artigo',
                'O valor de uma informação bem apresentada',
                'Um exemplo editorial sobre leitura, organização e compreensão.',
              ],
              [
                'Atualização',
                'Novas perspectivas para conversas importantes',
                'Uma estrutura para compartilhar mudanças e contextualizar assuntos.',
              ],
              [
                'Guia',
                'Um percurso para compreender o essencial',
                'Um modelo visual para materiais de consulta e leituras mais longas.',
              ],
            ].map(([category, title, description]) => (
              <EditorialCard
                key={title}
                category={category ?? ''}
                title={title ?? ''}
                description={description ?? ''}
                dateLabel="03 de outubro de 2026"
                readingTimeLabel="4 min de leitura"
                label="Exemplo editorial"
              />
            ))}
          </div>
        </div>
      </section>
      <section id="equipe" className="demo-section f-container" aria-labelledby="equipe-title">
        <div className="demo-section-heading">
          <div>
            <p className="demo-eyebrow">Pessoas e perspectivas</p>
            <h2 id="equipe-title">
              O cuidado começa
              <br />
              pela escuta.
            </h2>
          </div>
          <p>
            Avatares e perfis substituíveis. Nenhuma identidade ou credencial profissional real é
            apresentada.
          </p>
        </div>
        <div className="demo-grid demo-grid--three">
          {[1, 2, 3].map((number) => (
            <ProfessionalCard
              key={number}
              name={`Pessoa fictícia 0${number}`}
              role="Perfil de demonstração"
              description="Texto de exemplo para apresentar uma trajetória. A biografia final depende de material aprovado."
              areas={[`Área demonstrativa 0${number}`]}
            />
          ))}
        </div>
      </section>
      <DemoComponents currentPage={currentPage} />
    </PublicLayout>
  );
}
