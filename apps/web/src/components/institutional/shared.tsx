import type { ReactNode } from 'react';
import Link from 'next/link';
import type {
  PublicArticleSummary,
  PublicPage,
  PublicProfessional,
  PublicSiteSettings,
  ProfessionalSummary,
  PublicPracticeArea,
} from '@filaretti/types';
import { EmptyState, LinkButton } from '@filaretti/ui';
import { PublicContent, contentText } from '@/lib/public-content';
import { safePublicUrl } from '@/lib/public-content-core';
import { publicImage } from '@/lib/public-media';
import { PracticeAreaCard, ProfessionalCard } from '@/components/site';
import { EditorialArticleCard } from '@/components/editorial/article-card';

export function InstitutionalSection({
  id,
  title,
  eyebrow,
  description,
  action,
  children,
  soft = false,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  action?: { label: string; href: string };
  children: ReactNode;
  soft?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={`institution-section${soft ? ' institution-section-soft' : ''}`}
    >
      <div className="f-container">
        <div className="institution-section-heading">
          <div>
            {eyebrow ? <p className="site-eyebrow">{eyebrow}</p> : null}
            <h2 id={`${id}-heading`}>{title}</h2>
            {description ? <p className="institution-section-description">{description}</p> : null}
          </div>
          {action ? (
            <LinkButton href={action.href} variant="secondary">
              {action.label}
              <span aria-hidden="true">↗</span>
            </LinkButton>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function PageSections({ page }: { page: PublicPage }) {
  if (!page.sections.length) {
    return (
      <div className="f-container institution-page-content">
        <EmptyState
          title="Conteúdo em preparação"
          description="Esta página ainda não possui seções publicadas."
        />
      </div>
    );
  }

  return (
    <div className="f-container institution-page-content">
      {page.sections.map((section, index) => (
        <section
          key={`${section.key}-${index}`}
          className={`institution-copy-section${section.heading ? '' : ' institution-copy-section-unheaded'}`}
          aria-labelledby={section.heading ? `${page.slug}-section-${index}` : undefined}
        >
          {section.heading ? <h2 id={`${page.slug}-section-${index}`}>{section.heading}</h2> : null}
          <PublicContent document={section.body} />
        </section>
      ))}
    </div>
  );
}

export function AreaGrid({ areas }: { areas: PublicPracticeArea[] }) {
  if (!areas.length)
    return (
      <EmptyState
        title="Nenhuma área publicada"
        description="As áreas de atuação serão apresentadas aqui quando estiverem disponíveis."
      />
    );
  return (
    <div className="institution-grid">
      {areas.map((area, index) => (
        <PracticeAreaCard
          key={area.id}
          number={String(index + 1).padStart(2, '0')}
          title={area.name}
          description={area.summary}
          href={`/areas-de-atuacao/${encodeURIComponent(area.slug)}`}
        />
      ))}
    </div>
  );
}

export function ProfessionalGrid({
  professionals,
}: {
  professionals: (PublicProfessional | ProfessionalSummary)[];
}) {
  if (!professionals.length)
    return (
      <EmptyState
        title="Nenhum profissional publicado"
        description="Os perfis serão apresentados aqui quando estiverem disponíveis."
      />
    );
  return (
    <div className="institution-grid">
      {professionals.map((professional) => (
        <ProfessionalCard
          key={professional.id}
          name={professional.name}
          role={professional.title}
          description={'bio' in professional ? contentText(professional.bio, 180) : undefined}
          href={`/profissionais/${encodeURIComponent(professional.slug)}`}
          image={publicImage(professional.photo, professional.name)}
          areas={
            'practiceAreas' in professional
              ? professional.practiceAreas.map((area) => area.name)
              : undefined
          }
        />
      ))}
    </div>
  );
}

export function ArticlePreviewGrid({
  articles,
  emptyTitle = 'Nenhum conteúdo publicado',
}: {
  articles: PublicArticleSummary[];
  emptyTitle?: string;
}) {
  if (!articles.length)
    return (
      <EmptyState
        title={emptyTitle}
        description="Os conteúdos publicados serão apresentados aqui quando estiverem disponíveis."
      />
    );

  return (
    <div className="institution-grid">
      {articles.map((article) => (
        <EditorialArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}

export function ContactChannels({ settings }: { settings: PublicSiteSettings }) {
  const emailHref = settings.publicEmail ? safePublicUrl(`mailto:${settings.publicEmail}`) : null;
  const phone = settings.publicPhone?.replace(/[^\d+]/g, '');
  const phoneHref = phone ? safePublicUrl(`tel:${phone}`) : null;
  const whatsappHref = safePublicUrl(settings.whatsappUrl);
  const address = Object.values(settings.address)
    .filter((part) => part.trim())
    .join(', ');
  const socialLinks = settings.socialLinks.flatMap((link) => {
    const href = safePublicUrl(link.url);
    return href ? [{ ...link, href }] : [];
  });
  const hasContacts = emailHref || phoneHref || whatsappHref || address || socialLinks.length;

  return (
    <div className="institution-contact-grid">
      <div>
        {hasContacts ? (
          <>
            <dl className="institution-contact-list">
              {emailHref ? (
                <div>
                  <dt>E-mail</dt>
                  <dd>
                    <a href={emailHref}>{settings.publicEmail}</a>
                  </dd>
                </div>
              ) : null}
              {phoneHref ? (
                <div>
                  <dt>Telefone</dt>
                  <dd>
                    <a href={phoneHref}>{settings.publicPhone}</a>
                  </dd>
                </div>
              ) : null}
              {address ? (
                <div>
                  <dt>Endereço</dt>
                  <dd>
                    <address>{address}</address>
                  </dd>
                </div>
              ) : null}
            </dl>
            {whatsappHref ? (
              <LinkButton href={whatsappHref}>
                WhatsApp<span aria-hidden="true">↗</span>
              </LinkButton>
            ) : null}
            {socialLinks.length ? (
              <nav aria-label="Redes sociais" className="institution-social-links">
                <ul>
                  {socialLinks.map((link, index) => (
                    <li key={`${link.label}-${index}`}>
                      <a href={link.href}>
                        {link.label}
                        <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="Canais de contato em preparação"
            description="Os canais serão apresentados quando estiverem disponíveis."
          />
        )}
      </div>
      <aside className="institution-newsletter" aria-labelledby="newsletter-heading">
        <p className="site-eyebrow">Newsletter</p>
        <h3 id="newsletter-heading">Receber conteúdos</h3>
        <p>A inscrição na newsletter estará disponível em uma próxima etapa.</p>
        <p className="institution-availability-note">Nenhum dado é coletado por esta seção.</p>
      </aside>
    </div>
  );
}

export function AreaRelationLinks({
  areas,
}: {
  areas: { id: string; slug: string; name: string }[];
}) {
  if (!areas.length) return <EmptyState title="Nenhuma área vinculada" />;
  return (
    <ul className="institution-relation-links">
      {areas.map((area) => (
        <li key={area.id}>
          <Link href={`/areas-de-atuacao/${encodeURIComponent(area.slug)}`}>
            {area.name}
            <span aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
