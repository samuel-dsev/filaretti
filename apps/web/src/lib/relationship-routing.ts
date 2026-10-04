/** Only these public mutations are exposed by the same-origin relationship gateway. */
export function relationshipEndpoint(path: readonly string[], method: string): string | null {
  if (method !== 'POST') return null;
  const route = path.join('/');
  return [
    'contact',
    'newsletter/subscribe',
    'newsletter/confirm',
    'newsletter/unsubscribe',
  ].includes(route)
    ? `/api/v1/public/${route}`
    : null;
}

export function privateDownloadPath(value: string): string | null {
  const match = /^\/api\/v1\/admin\/contact-downloads\/([a-f0-9]{64})$/u.exec(value);
  return match ? `/api/cms/admin/contact-downloads/${match[1]}` : null;
}

/** Tokens travel in fragments and bodies, never in requests, referrers or analytics URLs. */
export function fragmentToken(fragment: string): string | null {
  const fields = new URLSearchParams(fragment.replace(/^#/u, ''));
  const value = fields.get('token');
  return value && fields.size === 1 && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}

export function recoveryFragmentToken(fragment: string): string | null {
  const fields = new URLSearchParams(fragment.replace(/^#/u, ''));
  const value = fields.get('token');
  return value && fields.size === 1 && /^[a-f0-9]{64}$/u.test(value) ? value : null;
}
