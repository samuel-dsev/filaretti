'use client';

import { useState } from 'react';

export interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | undefined>();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`.toUpperCase() ||
    '?';

  return (
    <span
      className={['f-avatar', `f-avatar--${size}`, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={name || 'Avatar'}
    >
      {src && src !== failedSource ? (
        /* A reusable avatar accepts application URLs; image optimization belongs to the consumer. */
        <img src={src} alt="" onError={() => setFailedSource(src)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
