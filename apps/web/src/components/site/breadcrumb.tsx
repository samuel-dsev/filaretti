import Link from 'next/link';
import type { BreadcrumbProps } from './types';

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Caminho da página" className="site-breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 ? (
              <span aria-hidden="true" className="site-breadcrumb-separator">
                /
              </span>
            ) : null}
            {item.href && index < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={index === items.length - 1 ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
