import Image from 'next/image';
import type { PublicArticle, PublicArticleSummary, PublicProfessional } from '@filaretti/types';
import { Badge, EmptyState, LinkButton } from '@filaretti/ui';
import { Breadcrumb } from '@/components/site';
import {
  AreaRelationLinks,
  ArticlePreviewGrid,
  InstitutionalSection,
  ProfessionalGrid,
} from '@/components/institutional/shared';
import { PublicContent } from '@/lib/public-content';
import { contentText, getContentOutline } from '@/lib/public-content-core';
import { publicImage, publicPdf } from '@/lib/public-media';
import { articleTypeLabels, publicationDate } from './article-card';
import { OutlineLinks } from './outline-links';
import { ShareLinks } from './share-links';

export function EditorialDetailView({
  article,
  author,
  related,
  shareUrl,
}: {
  article: PublicArticle;
  author: PublicProfessional | null;
  related: PublicArticleSummary[];
  shareUrl?: string;
}) {
  const cover = publicImage(article.cover, article.title);
  const authorPhoto = article.author
    ? publicImage(article.author.photo, article.author.name)
    : undefined;
  const pdf = article.type === 'GUIDE' ? publicPdf(article.pdf) : undefined;
  const outline = getContentOutline(article.content, 'leitura');
  const updated = new Date(article.updatedAt).getTime() > new Date(article.publishedAt).getTime();

  return (
    <>
      <div className="f-container institution-breadcrumb">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Conteúdos', href: '/conteudos' },
            { label: article.title },
          ]}
        />
      </div>
      <article className="editorial-article" aria-labelledby="publicacao-titulo">
        <header className="editorial-article-header">
          <div className="f-container">
            <div className="editorial-article-intro">
              <div className="editorial-category-line">
                <p className="site-eyebrow">{article.categories[0]?.name ?? 'Publicações'}</p>
                <Badge variant="brand">{articleTypeLabels[article.type]}</Badge>
              </div>
              <h1 id="publicacao-titulo">{article.title}</h1>
              <p className="editorial-excerpt">{article.excerpt}</p>
              <div className="editorial-publication-meta">
                {article.author ? (
                  <a
                    href={`/profissionais/${encodeURIComponent(article.author.slug)}`}
                    className="editorial-author-byline"
                  >
                    {authorPhoto ? (
                      <Image src={authorPhoto.src} alt="" width={48} height={48} sizes="48px" />
                    ) : null}
                    <span>
                      <span className="editorial-meta-label">Por</span>
                      {article.author.name}
                    </span>
                  </a>
                ) : null}
                <dl className="editorial-date-list">
                  <div>
                    <dt>Publicado em</dt>
                    <dd>
                      <time dateTime={article.publishedAt}>
                        {publicationDate.format(new Date(article.publishedAt))}
                      </time>
                    </dd>
                  </div>
                  {updated ? (
                    <div>
                      <dt>Atualizado em</dt>
                      <dd>
                        <time dateTime={article.updatedAt}>
                          {publicationDate.format(new Date(article.updatedAt))}
                        </time>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <span className="editorial-reading-time">
                  {article.readingTimeMinutes} min de leitura
                </span>
              </div>
            </div>
            {cover ? (
              <figure className="editorial-cover">
                <Image
                  src={cover.src}
                  alt={cover.alt}
                  fill
                  sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1439px) calc(100vw - 96px), 1312px"
                />
              </figure>
            ) : null}
          </div>
        </header>
        <div
          className={`f-container editorial-reading-layout${outline.length ? '' : ' editorial-reading-without-outline'}`}
        >
          {outline.length ? (
            <aside className="editorial-reading-aside">
              <OutlineLinks entries={outline} />
            </aside>
          ) : null}
          <div className="editorial-reading-body">
            {contentText(article.content, 1) ? (
              <PublicContent document={article.content} headingPrefix="leitura" />
            ) : (
              <EmptyState
                title="Texto em preparação"
                description="O texto desta publicação ainda não está disponível."
              />
            )}
            {pdf ? (
              <section className="editorial-download" aria-labelledby="download-heading">
                <p className="site-eyebrow">Guia</p>
                <h2 id="download-heading">Leve o conteúdo com você</h2>
                <p>Consulte o guia completo em PDF.</p>
                <LinkButton href={pdf.href} download>
                  Baixar guia · PDF · {pdf.sizeLabel}
                  <span aria-hidden="true">↓</span>
                </LinkButton>
              </section>
            ) : null}
            {article.categories.length || article.tags.length ? (
              <div className="editorial-taxonomies">
                {article.categories.length ? (
                  <nav aria-label="Categorias desta publicação">
                    <span className="editorial-meta-label">Categorias</span>
                    <ul>
                      {article.categories.map((category) => (
                        <li key={category.id}>
                          <a href={`/conteudos?categoria=${encodeURIComponent(category.slug)}`}>
                            {category.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
                {article.tags.length ? (
                  <nav aria-label="Tags desta publicação">
                    <span className="editorial-meta-label">Tags</span>
                    <ul>
                      {article.tags.map((tag) => (
                        <li key={tag.id}>
                          <a href={`/conteudos?tag=${encodeURIComponent(tag.slug)}`}>{tag.name}</a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                ) : null}
              </div>
            ) : null}
            {shareUrl ? (
              <section className="editorial-share-section" aria-labelledby="compartilhar-heading">
                <h2 id="compartilhar-heading">Compartilhar publicação</h2>
                <ShareLinks title={article.title} url={shareUrl} />
              </section>
            ) : null}
          </div>
        </div>
      </article>
      {article.author ? (
        <InstitutionalSection id="autor" title="Sobre o autor" eyebrow="Autoria" soft>
          <div className="editorial-author-profile">
            <ProfessionalGrid professionals={[author ?? article.author]} />
          </div>
        </InstitutionalSection>
      ) : null}
      {article.practiceAreas.length ? (
        <InstitutionalSection id="areas" title="Áreas relacionadas" eyebrow="Atuação">
          <AreaRelationLinks areas={article.practiceAreas} />
        </InstitutionalSection>
      ) : null}
      <InstitutionalSection
        id="relacionados"
        title="Continue a leitura"
        eyebrow="Conteúdos relacionados"
        action={{ label: 'Todos os conteúdos', href: '/conteudos' }}
        soft
      >
        <ArticlePreviewGrid articles={related} emptyTitle="Nenhum conteúdo relacionado publicado" />
      </InstitutionalSection>
    </>
  );
}
