import Link from 'next/link';
import type { SiteBrand } from './types';

export function Brand({ brand, inverse = false }: { brand: SiteBrand; inverse?: boolean }) {
  return (
    <Link
      prefetch={false}
      className={`site-brand${inverse ? ' site-brand-inverse' : ''}`}
      href={brand.href}
    >
      {brand.monogram ? (
        <span className="site-brand-monogram" aria-hidden="true">
          {brand.monogram}
        </span>
      ) : null}
      <span className="site-brand-wordmark">
        <span className="site-brand-name">{brand.name}</span>
        {brand.caption ? <span className="site-brand-caption">{brand.caption}</span> : null}
      </span>
    </Link>
  );
}
