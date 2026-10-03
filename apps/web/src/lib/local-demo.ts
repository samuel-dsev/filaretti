export function isLocalDemoAllowed(environment: string | undefined, host: string | null): boolean {
  return (
    environment === 'development' &&
    /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/.test(host ?? '')
  );
}
