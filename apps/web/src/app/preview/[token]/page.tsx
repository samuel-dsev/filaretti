import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { PublicArticle } from '@filaretti/types';
import { ErrorState } from '@filaretti/ui';
import { EditorialDetailView } from '@/components/editorial/detail-view';
import { parsePublicDocument } from '@/lib/public-content-core';
import '@/components/editorial/styles.css';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const metadata: Metadata = {
  title: 'Preview editorial | Filaretti',
  robots: { index: false, follow: false, noarchive: true },
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-zA-Z0-9_-]{43}$/u.test(token)) notFound();
  let preview: { article: PublicArticle; expiresAt: string } | undefined;
  try {
    const base = process.env.API_INTERNAL_URL;
    if (!base) throw new Error('UNAVAILABLE');
    const response = await fetch(
      `${base.replace(/\/$/u, '')}/api/v1/preview/${encodeURIComponent(token)}`,
      { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8000) },
    );
    if (response.status === 404 || response.status === 401 || response.status === 410) notFound();
    if (!response.ok) throw new Error('UNAVAILABLE');
    const result = (await response.json()) as { article: PublicArticle; expiresAt: string };
    const document = parsePublicDocument(result.article.content);
    if (!document || !Number.isFinite(Date.parse(result.expiresAt))) notFound();
    // Only allowed editorial fields reach the renderer. Session/user fields are
    // never used, shared, indexed or added to metadata on this surface.
    const article = result.article;
    preview = {
      expiresAt: result.expiresAt,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        type: article.type,
        featured: article.featured,
        publishedAt: article.publishedAt || article.updatedAt,
        updatedAt: article.updatedAt,
        readingTimeMinutes: article.readingTimeMinutes,
        author: article.author,
        cover: article.cover,
        categories: article.categories,
        tags: article.tags,
        practiceAreas: article.practiceAreas,
        content: document,
        pdf: article.pdf,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
      },
    };
  } catch (error) {
    // Next navigation errors must retain their original 404 behavior.
    if (typeof error === 'object' && error !== null && 'digest' in error) throw error;
  }
  return (
    <main id="conteudo" tabIndex={-1}>
      <div className="cms-preview-banner">
        <div className="f-container">
          <strong>Preview editorial · conteúdo em revisão</strong>
          <p>
            {preview
              ? `Este link expira em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(preview.expiresAt))}. As datas mostradas no conteúdo são referências de edição.`
              : 'O serviço está temporariamente indisponível. Tente novamente mais tarde.'}
          </p>
          <Link href="/admin/artigos">Voltar ao CMS</Link>
        </div>
      </div>
      {preview ? (
        <EditorialDetailView article={preview.article} author={null} related={[]} />
      ) : (
        <div className="f-container cms-session">
          <ErrorState
            title="Preview indisponível"
            description="Não foi possível validar este link agora. Nenhum conteúdo foi carregado."
          />
        </div>
      )}
    </main>
  );
}
