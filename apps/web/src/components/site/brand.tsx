import Link from 'next/link';
import Image from 'next/image';
import type { SiteBrand } from './types';

export function Brand({ brand, inverse = false }: { brand: SiteBrand; inverse?: boolean }) {
  return (
    <Link
      prefetch={false}
      className={`site-brand${inverse ? ' site-brand-inverse' : ''}`}
      href={brand.href}
    >
      <span className="site-brand-logo">
        <Image src="/brand/logomarca.jpg" alt={brand.name} width={1254} height={1254} unoptimized />
      </span>
    </Link>
  );
}
