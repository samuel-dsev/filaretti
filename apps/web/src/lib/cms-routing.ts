/** Only internal public destinations may be used by the routing proxy. */
export function publicRedirectPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 500 &&
    /^\/[a-zA-Z0-9_./-]*$/u.test(value) &&
    !value.includes('//') &&
    !(value.length > 1 && value.endsWith('/')) &&
    !value.split('/').some((part) => part === '.' || part === '..') &&
    !/^\/(?:api|admin|preview|_next|media|dev)(?:\/|$)/iu.test(value)
  );
}

export function previewTokenPath(pathname: string): string | null {
  const match = /^\/preview\/([a-zA-Z0-9_-]{43})$/u.exec(pathname);
  return match?.[1] ?? null;
}

export function isPrivateCmsPath(pathname: string): boolean {
  return /^\/(?:admin|preview)(?:\/|$)/u.test(pathname);
}
