import { validateApiEnvironment } from '@filaretti/config';

export function testEnvironment(overrides: Record<string, unknown> = {}) {
  return validateApiEnvironment({
    NODE_ENV: 'test',
    CMS_WORKER_ENABLED: false,
    APP_ENV: 'development',
    DATABASE_URL: 'postgresql://test:secret-not-for-logs@127.0.0.1:1/test',
    DATABASE_TIMEOUT_MS: 100,
    WEB_PUBLIC_URL: 'http://localhost:3000',
    API_PUBLIC_URL: 'http://localhost:3001',
    JWT_SECRET: 'test-only-jwt-secret-at-least-32-characters',
    REFRESH_TOKEN_SECRET: 'test-only-refresh-secret-at-least-32-characters',
    PREVIEW_SECRET: 'test-only-preview-secret-at-least-32-characters',
    REVALIDATION_SECRET: 'test-only-revalidation-secret-at-least-32-characters',
    ...overrides,
  });
}
