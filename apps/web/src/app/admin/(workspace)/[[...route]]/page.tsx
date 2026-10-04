import { CmsPage } from '@/components/admin/cms-page';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ route?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const requested = typeof query.pagina === 'string' ? Number(query.pagina) : 1;
  const page =
    Number.isSafeInteger(requested) && requested >= 1 && requested <= 100000 ? requested : 1;
  const status =
    typeof query.status === 'string' &&
    ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].includes(query.status)
      ? query.status
      : '';
  const type =
    typeof query.tipo === 'string' && ['ARTICLE', 'UPDATE', 'GUIDE'].includes(query.tipo)
      ? query.tipo
      : '';
  return <CmsPage route={route.route ?? []} page={page} status={status} type={type} />;
}
