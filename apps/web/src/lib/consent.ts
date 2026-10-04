export const consentStorageKey = 'filaretti-cookie-preferences-v1';
export const analyticsEvents = [
  'click_whatsapp',
  'submit_contact',
  'newsletter_signup',
  'article_share',
  'download_guide',
  'search',
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];
export interface CookiePreferences {
  version: 1;
  necessary: true;
  analytics: boolean;
}

export function parsePreferences(value: string | null): CookiePreferences | null {
  try {
    const data: unknown = JSON.parse(value ?? 'null');
    if (
      typeof data === 'object' &&
      data !== null &&
      'version' in data &&
      data.version === 1 &&
      'necessary' in data &&
      data.necessary === true &&
      'analytics' in data &&
      typeof data.analytics === 'boolean'
    )
      return { version: 1, necessary: true, analytics: data.analytics };
  } catch {
    /* Corrupt or unavailable storage defaults to denial. */
  }
  return null;
}

export function analyticsAllowed(
  environment: string,
  enabled: boolean,
  identifier: string | undefined,
  preferences: CookiePreferences | null,
  pathname: string,
): boolean {
  return (
    environment === 'production' &&
    enabled &&
    /^G-[A-Z0-9]{4,20}$/u.test(identifier ?? '') &&
    preferences?.analytics === true &&
    !/^\/(?:admin|preview)(?:\/|$)/u.test(pathname) &&
    !/^\/newsletter\/(?:confirmar|descadastrar)(?:\/|$)/u.test(pathname)
  );
}
