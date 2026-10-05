import { describe, expect, it } from 'vitest';
import { validateApiEnvironment, validateWebEnvironment } from '../src/index';

const api = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgresql://test:local-test-only@localhost:5434/test',
  WEB_PUBLIC_URL: 'http://localhost:3000',
  API_PUBLIC_URL: 'http://localhost:3001',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret-at-least-32-characters',
  PREVIEW_SECRET: 'test-preview-secret-at-least-32-characters',
  REVALIDATION_SECRET: 'test-revalidation-secret-at-least-32-characters',
};
const web = {
  APP_ENV: 'development',
  API_INTERNAL_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
};

describe('configuration boundaries', () => {
  it('requires explicit signed ingress outside development', () => {
    expect(() =>
      validateWebEnvironment({ ...web, APP_ENV: 'staging', NEXT_PUBLIC_MOCK_INTEGRATIONS: false }),
    ).toThrow('BFF_CLIENT_IP_SECRET');
    expect(() =>
      validateApiEnvironment({
        ...api,
        APP_ENV: 'staging',
        MOCK_INTEGRATIONS: false,
        RELATIONSHIP_ENABLED: false,
      }),
    ).toThrow('BFF_CLIENT_IP_SECRET');
    expect(() => validateWebEnvironment({ ...web, BFF_CLIENT_IP_SECRET: 'invalid' })).toThrow(
      'BFF_CLIENT_IP_SECRET',
    );
    expect(
      validateWebEnvironment({
        ...web,
        APP_ENV: 'staging',
        NEXT_PUBLIC_MOCK_INTEGRATIONS: false,
        NEXT_PUBLIC_SITE_URL: 'https://staging.example.invalid',
        BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
        WEB_CLIENT_IP_HEADER: 'x-real-ip',
        WEB_TRUSTED_PROXY_CONFIRMED: true,
      }).appEnvironment,
    ).toBe('staging');
    expect(() =>
      validateWebEnvironment({
        ...web,
        APP_ENV: 'staging',
        NEXT_PUBLIC_MOCK_INTEGRATIONS: false,
        BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
        WEB_CLIENT_IP_HEADER: 'x-real-ip',
        WEB_TRUSTED_PROXY_CONFIRMED: true,
      }),
    ).toThrow('NEXT_PUBLIC_SITE_URL');
    expect(() =>
      validateApiEnvironment({
        ...api,
        APP_ENV: 'staging',
        MOCK_INTEGRATIONS: false,
        RELATIONSHIP_ENABLED: false,
        BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
      }),
    ).toThrow('COOKIE_SECURE');
  });
  it('keeps scanner disabled by default and requires a private network for external ClamAV', () => {
    expect(validateApiEnvironment(api).CONTACT_SCANNER_DRIVER).toBe('disabled');
    expect(() =>
      validateApiEnvironment({
        ...api,
        APP_ENV: 'staging',
        MOCK_INTEGRATIONS: false,
        RELATIONSHIP_ENABLED: false,
        BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
        CONTACT_SCANNER_DRIVER: 'clamav',
      }),
    ).toThrow('CLAMAV_PRIVATE_NETWORK_CONFIRMED');
  });
  it('allows offline local startup without external integrations', () => {
    expect(validateApiEnvironment(api).RESEND_ENABLED).toBe(false);
    expect(validateWebEnvironment({ ...web, NODE_ENV: 'production' }).mockContent).toBe(true);
    expect(
      validateWebEnvironment({ ...web, WEB_CLIENT_IP_HEADER: '', BFF_CLIENT_IP_SECRET: '' })
        .mockContent,
    ).toBe(true);
  });
  it('parses false and rejects ambiguous flags instead of treating them as truthy', () => {
    expect(validateApiEnvironment({ ...api, MOCK_CONTENT: 'false' }).MOCK_CONTENT).toBe(false);
    expect(() => validateApiEnvironment({ ...api, MOCK_CONTENT: 'yes' })).toThrow('MOCK_CONTENT');
  });
  it('blocks production mocks and insecure production cookies', () => {
    expect(() => validateApiEnvironment({ ...api, APP_ENV: 'production' })).toThrow('MOCK_CONTENT');
    expect(() => validateWebEnvironment({ ...web, APP_ENV: 'production' })).toThrow('MOCK_CONTENT');
    expect(() =>
      validateApiEnvironment({
        ...api,
        APP_ENV: 'production',
        MOCK_CONTENT: 'false',
        WEB_PUBLIC_URL: 'https://test.invalid',
        API_PUBLIC_URL: 'https://api.test.invalid',
      }),
    ).toThrow('COOKIE_SECURE');
  });
  it('permits production config only with explicit safe settings', () => {
    expect(
      validateApiEnvironment({
        ...api,
        APP_ENV: 'production',
        MOCK_CONTENT: 'false',
        COOKIE_SECURE: 'true',
        BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
        WEB_PUBLIC_URL: 'https://test.invalid',
        API_PUBLIC_URL: 'https://api.test.invalid',
      }).APP_ENV,
    ).toBe('production');
  });
  it('fails on malformed database config without disclosing input values', () => {
    const secret = 'secret-password-must-never-be-logged';
    try {
      validateApiEnvironment({ ...api, DATABASE_URL: secret });
    } catch (error) {
      expect(String(error)).toContain('DATABASE_URL');
      expect(String(error)).not.toContain(secret);
      return;
    }
    throw new Error('Expected validation failure');
  });
  it('requires provider credentials and an explicit adapter mode', () => {
    for (const field of ['R2_ENABLED', 'RESEND_ENABLED', 'TURNSTILE_ENABLED']) {
      expect(() =>
        validateApiEnvironment({
          ...api,
          MOCK_INTEGRATIONS: false,
          RELATIONSHIP_ENABLED: false,
          [field]: 'true',
        }),
      ).toThrow();
    }
  });
  it('rejects simulated integrations outside loopback development', () => {
    expect(() =>
      validateApiEnvironment({ ...api, MOCK_INTEGRATIONS: true, API_HOST: '0.0.0.0' }),
    ).toThrow('MOCK_INTEGRATIONS');
    expect(() =>
      validateApiEnvironment({ ...api, APP_ENV: 'staging', MOCK_INTEGRATIONS: true }),
    ).toThrow('MOCK_INTEGRATIONS');
    expect(() =>
      validateWebEnvironment({ ...web, APP_ENV: 'staging', NEXT_PUBLIC_MOCK_INTEGRATIONS: true }),
    ).toThrow('NEXT_PUBLIC_MOCK_INTEGRATIONS');
  });
  it('requires consent infrastructure before enabling real relationship', () => {
    expect(() =>
      validateApiEnvironment({ ...api, MOCK_INTEGRATIONS: false, RELATIONSHIP_ENABLED: true }),
    ).toThrow('RESEND_ENABLED');
    expect(() => validateWebEnvironment({ ...web, GA4_ENABLED: true })).toThrow(
      'NEXT_PUBLIC_GA4_ID',
    );
    expect(() => validateWebEnvironment({ ...web, SEO_INDEXING_ENABLED: true })).toThrow(
      'SEO_INDEXING_ENABLED',
    );
  });
  it('allows a configured R2 adapter only with separate buckets', () => {
    const r2 = {
      ...api,
      STORAGE_DRIVER: 'r2',
      R2_ENABLED: 'true',
      R2_ACCOUNT_ID: 'a'.repeat(32),
      R2_ACCESS_KEY_ID: 'test-only',
      R2_SECRET_ACCESS_KEY: 'test-only',
      R2_PUBLIC_BUCKET: 'test-public',
      R2_PRIVATE_BUCKET: 'test-private',
    };
    expect(validateApiEnvironment(r2).STORAGE_DRIVER).toBe('r2');
    expect(() => validateApiEnvironment({ ...r2, R2_PRIVATE_BUCKET: 'test-public' })).toThrow(
      'R2_PRIVATE_BUCKET',
    );
    expect(() => validateApiEnvironment({ ...r2, R2_ACCOUNT_ID: '../unsafe' })).toThrow(
      'R2_ACCOUNT_ID',
    );
  });
  it('rejects secret-looking public API paths and unsupported URL protocols', () => {
    expect(() =>
      validateWebEnvironment({ ...web, NEXT_PUBLIC_API_BASE_PATH: '/api/docs' }),
    ).toThrow('NEXT_PUBLIC_API_BASE_PATH');
    expect(() => validateWebEnvironment({ ...web, API_INTERNAL_URL: 'file:///secret' })).toThrow(
      'API_INTERNAL_URL',
    );
  });
});
