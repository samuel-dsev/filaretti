import 'server-only';
import { headers } from 'next/headers';
import type {
  PublicArticle,
  PublicFaq,
  PublicProfessional,
  PublicSiteSettings,
} from '@filaretti/types';
import { contentText } from '@/lib/public-content-core';
import { publicUrl } from '@/lib/public-metadata';

type Schema = Record<string, unknown>;

export async function JsonLd({ data }: { data: Schema | null | (Schema | null)[] }) {
  const schemas = (Array.isArray(data) ? data : [data]).filter(
    (item): item is Schema => item !== null,
  );
  if (!schemas.length) return null;
  // Escape HTML delimiters: API text cannot close the script element.
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': schemas })
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Schema | null {
  const urls = items.map((item) => ({ ...item, url: publicUrl(item.path) }));
  if (urls.some((item) => !item.url)) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: urls.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleSchema(article: PublicArticle): Schema | null {
  const url = publicUrl(`/conteudos/${article.slug}`);
  if (!url) return null;
  const image = article.cover?.url ? new URL(article.cover.url, url).href : undefined;
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: url,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: 'pt-BR',
    ...(image ? { image } : {}),
    ...(article.author
      ? {
          author: {
            '@type': 'Person',
            name: article.author.name,
            url: publicUrl(`/profissionais/${article.author.slug}`),
          },
        }
      : {}),
  };
}

export function personSchema(professional: PublicProfessional): Schema | null {
  const url = publicUrl(`/profissionais/${professional.slug}`);
  if (!url) return null;
  return {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: professional.name,
    jobTitle: professional.title,
    description: contentText(professional.bio),
    url,
    ...(professional.photo ? { image: new URL(professional.photo.url, url).href } : {}),
  };
}

export function legalServiceSchema(settings: PublicSiteSettings): Schema | null {
  const url = publicUrl('/');
  if (!url) return null;
  const address = settings.address;
  return {
    '@type': 'LegalService',
    '@id': `${url}#office`,
    name: settings.siteName,
    url,
    ...(settings.publicPhone ? { telephone: settings.publicPhone } : {}),
    ...(settings.publicEmail ? { email: settings.publicEmail } : {}),
    ...(Object.keys(address).length
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: address.street,
            addressLocality: address.city,
            addressRegion: address.state,
            postalCode: address.postalCode,
            addressCountry: address.country,
          },
        }
      : {}),
    ...(settings.socialLinks.length
      ? { sameAs: settings.socialLinks.map((link) => link.url) }
      : {}),
  };
}

export function faqSchema(faqs: PublicFaq[]): Schema | null {
  if (!faqs.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: contentText(faq.answer) },
    })),
  };
}
