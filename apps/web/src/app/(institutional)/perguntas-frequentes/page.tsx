import { Pagination } from '@filaretti/ui';
import { Breadcrumb, Hero } from '@/components/site';
import { FaqList } from '@/components/search/faq-list';
import { JsonLd, faqSchema, breadcrumbSchema } from '@/components/seo/structured-data';
import { getFaqs } from '@/lib/public-api';
import { publicMetadata } from '@/lib/public-metadata';
import { publicPageNumber } from '@/lib/public-routing';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return publicMetadata({
    title: 'Perguntas frequentes',
    path: '/perguntas-frequentes',
    noIndex: Object.keys(await searchParams).length > 0,
  });
}

export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const area =
    typeof params.area === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(params.area) &&
    params.area.length <= 120
      ? params.area
      : undefined;
  const faqs = await getFaqs({ page: publicPageNumber(params.pagina), limit: 12, area });
  return (
    <>
      <JsonLd
        data={[
          faqSchema(faqs.data),
          breadcrumbSchema([
            { name: 'Início', path: '/' },
            { name: 'Perguntas frequentes', path: '/perguntas-frequentes' },
          ]),
        ]}
      />
      <div className="f-container institution-breadcrumb">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Perguntas frequentes' }]} />
      </div>
      <Hero eyebrow="Informações" title="Perguntas frequentes" />
      <div className="f-container institution-index-content">
        <FaqList faqs={faqs.data} />
        <Pagination
          currentPage={faqs.meta.page}
          totalPages={faqs.meta.pages}
          getHref={(page) =>
            `/perguntas-frequentes?${new URLSearchParams({ pagina: String(page), ...(area ? { area } : {}) })}`
          }
          className="institution-pagination"
        />
      </div>
    </>
  );
}
