import { PageSections } from '@/components/institutional/shared';
import { getPage } from '@/lib/public-api';
import { PublicContent } from '@/lib/public-content';
import { publicMetadata } from '@/lib/public-metadata';

export async function generateMetadata() {
  const page = await getPage('sobre-nos');
  return publicMetadata({
    title: page?.seoTitle ?? 'Sobre nós',
    description: page?.seoDescription,
    path: '/sobre-nos',
  });
}

export default async function AboutPage() {
  const page = await getPage('sobre-nos');
  const intro = page?.sections.find((section) => section.key === 'intro');
  const sections = page?.sections.filter((section) => section !== intro);
  return (
    <>
      <div className="f-container institution-about-intro">
        <h1>{page?.title ?? 'Sobre nós'}</h1>
        {intro ? <PublicContent document={intro.body} className="institution-readable" /> : null}
      </div>
      {page && sections?.length ? <PageSections page={{ ...page, sections }} /> : null}
    </>
  );
}
