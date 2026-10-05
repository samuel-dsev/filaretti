export interface BrowserSecurityOptions {
  nonce: string;
  developmentServer: boolean;
  https: boolean;
  turnstile: boolean;
  analytics: boolean;
}

/** Only configured integrations gain network access; request headers never choose origins. */
export function contentSecurityPolicy(options: BrowserSecurityOptions): string {
  if (!/^[A-Za-z\d+/]{20,80}={0,2}$/u.test(options.nonce))
    throw new Error('Invalid security nonce');
  const scripts = ["'self'", `'nonce-${options.nonce}'`, "'strict-dynamic'"];
  const connections = ["'self'"];
  const images = ["'self'", 'data:', 'blob:'];
  if (options.developmentServer) {
    scripts.push("'unsafe-eval'");
    connections.push('ws:', 'wss:');
  }
  if (options.turnstile) {
    scripts.push('https://challenges.cloudflare.com');
    connections.push('https://challenges.cloudflare.com');
  }
  if (options.analytics) {
    scripts.push('https://www.googletagmanager.com');
    connections.push(
      'https://www.google-analytics.com',
      'https://region1.google-analytics.com',
      'https://www.googletagmanager.com',
    );
    images.push('https://www.google-analytics.com');
  }
  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "script-src-attr 'none'",
    `style-src 'self' ${options.developmentServer ? "'unsafe-inline'" : `'nonce-${options.nonce}'`}`,
    // Next Image and TipTap use style attributes. No inline scripts or style elements are allowed.
    "style-src-attr 'unsafe-inline'",
    `img-src ${images.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connections.join(' ')}`,
    `frame-src ${options.turnstile ? 'https://challenges.cloudflare.com' : "'none'"}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function browserSecurityHeaders(https: boolean): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    ...(https ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };
}

/** Meta belongs to the initial document, preserving its nonce across client navigation. */
export function documentNonce(): string | undefined {
  return document.querySelector<HTMLMetaElement>('meta[name="filaretti-nonce"]')?.content;
}
