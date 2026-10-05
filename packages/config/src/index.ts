import { z } from 'zod';

type EnvironmentInput = Record<string, unknown>;
const optionalText = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);
const flag = (defaultValue: boolean) =>
  z.preprocess(
    (value) =>
      value === undefined
        ? defaultValue
        : value === 'true'
          ? true
          : value === 'false'
            ? false
            : value,
    z.boolean(),
  );
function hasProtocol(value: string, allowed: string[]): boolean {
  try {
    return allowed.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
const httpUrl = z.url().refine((value) => hasProtocol(value, ['http:', 'https:']));
const appEnvironment = z.enum(['development', 'staging', 'production']);

function readConfiguration<T>(schema: z.ZodType<T>, input: EnvironmentInput): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'environment')),
    ];
    // Paths only: Zod messages or input values can include secrets.
    throw new Error(`Invalid environment fields: ${fields.join(', ')}`);
  }
  return result.data;
}

const webSchema = z
  .object({
    APP_ENV: appEnvironment,
    API_INTERNAL_URL: httpUrl,
    NEXT_PUBLIC_SITE_URL: httpUrl,
    NEXT_PUBLIC_API_BASE_PATH: z.literal('/api/v1').default('/api/v1'),
    MOCK_CONTENT: flag(true),
    NEXT_PUBLIC_MOCK_INTEGRATIONS: flag(false),
    GA4_ENABLED: flag(false),
    GA4_ENHANCED_MEASUREMENT_DISABLED: flag(false),
    SEO_INDEXING_ENABLED: flag(false),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText,
    NEXT_PUBLIC_GA4_ID: optionalText,
    NEXT_PUBLIC_SENTRY_DSN: optionalText,
    BFF_CLIENT_IP_SECRET: optionalText,
    WEB_CLIENT_IP_HEADER: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(['x-real-ip', 'cf-connecting-ip']).optional(),
    ),
    WEB_TRUSTED_PROXY_CONFIRMED: flag(false),
  })
  .superRefine((env, ctx) => {
    if (env.BFF_CLIENT_IP_SECRET && !/^[a-f0-9]{64}$/u.test(env.BFF_CLIENT_IP_SECRET))
      ctx.addIssue({
        code: 'custom',
        path: ['BFF_CLIENT_IP_SECRET'],
        message: '32 byte hex required',
      });
    if (env.APP_ENV !== 'development') {
      for (const key of [
        'BFF_CLIENT_IP_SECRET',
        'WEB_CLIENT_IP_HEADER',
        'WEB_TRUSTED_PROXY_CONFIRMED',
      ] as const)
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'Trusted ingress required' });
    }
    if (env.NEXT_PUBLIC_MOCK_INTEGRATIONS && env.APP_ENV !== 'development')
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_MOCK_INTEGRATIONS'],
        message: 'Local only',
      });
    if (env.GA4_ENABLED && !/^G-[A-Z0-9]+$/u.test(env.NEXT_PUBLIC_GA4_ID ?? ''))
      ctx.addIssue({
        code: 'custom',
        path: ['NEXT_PUBLIC_GA4_ID'],
        message: 'Required analytics ID',
      });
    if (env.GA4_ENABLED && !env.GA4_ENHANCED_MEASUREMENT_DISABLED)
      ctx.addIssue({
        code: 'custom',
        path: ['GA4_ENHANCED_MEASUREMENT_DISABLED'],
        message: 'Automatic collection must be disabled in provider',
      });
    if (env.SEO_INDEXING_ENABLED && env.APP_ENV !== 'production')
      ctx.addIssue({ code: 'custom', path: ['SEO_INDEXING_ENABLED'], message: 'Production only' });
    if (env.APP_ENV !== 'development' && !env.NEXT_PUBLIC_SITE_URL.startsWith('https:'))
      ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SITE_URL'], message: 'HTTPS required' });
    if (env.APP_ENV === 'production') {
      if (env.MOCK_CONTENT)
        ctx.addIssue({ code: 'custom', path: ['MOCK_CONTENT'], message: 'Mocks forbidden' });
    }
  });

export function validateWebEnvironment(input: EnvironmentInput) {
  const env = readConfiguration(webSchema, {
    NEXT_PUBLIC_MOCK_INTEGRATIONS: input.APP_ENV === 'development',
    ...input,
  });
  return {
    appEnvironment: env.APP_ENV,
    apiInternalUrl: env.API_INTERNAL_URL,
    publicSiteUrl: env.NEXT_PUBLIC_SITE_URL,
    publicApiBasePath: env.NEXT_PUBLIC_API_BASE_PATH,
    mockContent: env.MOCK_CONTENT,
    mockIntegrations: env.NEXT_PUBLIC_MOCK_INTEGRATIONS,
    analyticsEnabled: env.GA4_ENABLED,
    seoIndexingEnabled: env.SEO_INDEXING_ENABLED,
    turnstileSiteKey: env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    analyticsId: env.NEXT_PUBLIC_GA4_ID,
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

const apiSchema = z
  .object({
    APP_ENV: appEnvironment,
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('127.0.0.1'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.url().refine((value) => hasProtocol(value, ['postgres:', 'postgresql:'])),
    DATABASE_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
    WEB_PUBLIC_URL: httpUrl,
    API_PUBLIC_URL: httpUrl,
    MOCK_CONTENT: flag(true),
    MOCK_INTEGRATIONS: flag(false),
    RELATIONSHIP_ENABLED: flag(true),
    RELATIONSHIP_WORKER_ENABLED: flag(true),
    CONTACT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(180),
    SUBSCRIBER_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(365),
    PRIVACY_VERSION: z.string().min(1).max(80).default('development-v1'),
    NEWSLETTER_CONSENT_VERSION: z.string().min(1).max(80).default('development-v1'),
    CONTACT_NOTIFICATION_EMAIL: optionalText,
    MAIL_ENCRYPTION_KEY: optionalText,
    MAIL_LOCAL_PATH: z.string().default('../../.local/mail'),
    RESEND_TEST_RECIPIENTS: optionalText,
    COOKIE_SECURE: flag(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict']).default('lax'),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(900),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
    PREVIEW_SECRET: z.string().min(32),
    PREVIEW_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REVALIDATION_SECRET: z.string().min(32),
    REVALIDATION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
    CMS_WORKER_ENABLED: flag(true),
    STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
    STORAGE_LOCAL_PATH: z.string().default('../../.local/storage'),
    R2_ENABLED: flag(false),
    R2_ACCOUNT_ID: optionalText,
    R2_ACCESS_KEY_ID: optionalText,
    R2_SECRET_ACCESS_KEY: optionalText,
    R2_PUBLIC_BUCKET: optionalText,
    R2_PRIVATE_BUCKET: optionalText,
    R2_PUBLIC_BASE_URL: optionalText,
    RESEND_ENABLED: flag(false),
    RESEND_API_KEY: optionalText,
    RESEND_FROM_EMAIL: optionalText,
    RESEND_WEBHOOK_SECRET: optionalText,
    TURNSTILE_ENABLED: flag(false),
    TURNSTILE_SECRET_KEY: optionalText,
    TURNSTILE_EXPECTED_HOSTNAME: optionalText,
    TURNSTILE_EXPECTED_ACTION: optionalText,
    SENTRY_DSN: optionalText,
    BFF_CLIENT_IP_SECRET: optionalText,
    CONTACT_SCANNER_DRIVER: z.enum(['disabled', 'clamav']).default('disabled'),
    CLAMAV_HOST: z
      .string()
      .regex(/^[A-Za-z0-9.-]+$/u)
      .default('127.0.0.1'),
    CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
    CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(10000),
    CLAMAV_PRIVATE_NETWORK_CONFIRMED: flag(false),
  })
  .superRefine((env, ctx) => {
    if (env.BFF_CLIENT_IP_SECRET && !/^[a-f0-9]{64}$/u.test(env.BFF_CLIENT_IP_SECRET))
      ctx.addIssue({
        code: 'custom',
        path: ['BFF_CLIENT_IP_SECRET'],
        message: '32 byte hex required',
      });
    if (env.APP_ENV !== 'development' && !env.BFF_CLIENT_IP_SECRET)
      ctx.addIssue({
        code: 'custom',
        path: ['BFF_CLIENT_IP_SECRET'],
        message: 'Trusted BFF required',
      });
    if (
      env.APP_ENV !== 'development' &&
      env.CONTACT_SCANNER_DRIVER === 'clamav' &&
      !env.CLAMAV_PRIVATE_NETWORK_CONFIRMED
    )
      ctx.addIssue({
        code: 'custom',
        path: ['CLAMAV_PRIVATE_NETWORK_CONFIRMED'],
        message: 'Private scanner required',
      });
    if (env.APP_ENV === 'production' && env.MOCK_CONTENT)
      ctx.addIssue({ code: 'custom', path: ['MOCK_CONTENT'], message: 'Mocks forbidden' });
    if (env.APP_ENV !== 'development') {
      if (!env.COOKIE_SECURE)
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Secure required' });
      for (const key of ['WEB_PUBLIC_URL', 'API_PUBLIC_URL'] as const) {
        if (!env[key].startsWith('https:'))
          ctx.addIssue({ code: 'custom', path: [key], message: 'HTTPS required' });
      }
    }
    if (
      env.MOCK_INTEGRATIONS &&
      (env.APP_ENV !== 'development' ||
        env.API_HOST !== '127.0.0.1' ||
        !['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.WEB_PUBLIC_URL).hostname))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['MOCK_INTEGRATIONS'],
        message: 'Loopback development only',
      });
    if (env.MOCK_INTEGRATIONS && (env.RESEND_ENABLED || env.TURNSTILE_ENABLED))
      ctx.addIssue({
        code: 'custom',
        path: ['MOCK_INTEGRATIONS'],
        message: 'Choose one adapter mode',
      });
    if (env.MAIL_ENCRYPTION_KEY && !/^[a-f0-9]{64}$/u.test(env.MAIL_ENCRYPTION_KEY))
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_ENCRYPTION_KEY'],
        message: '32 byte hex required',
      });
    if (env.RESEND_ENABLED) {
      for (const key of [
        'RESEND_API_KEY',
        'RESEND_FROM_EMAIL',
        'RESEND_WEBHOOK_SECRET',
        'MAIL_ENCRYPTION_KEY',
      ] as const)
        if (!env[key]?.trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'Required' });
      if (env.APP_ENV === 'staging' && !env.RESEND_TEST_RECIPIENTS?.trim())
        ctx.addIssue({
          code: 'custom',
          path: ['RESEND_TEST_RECIPIENTS'],
          message: 'Test recipients required',
        });
    }
    if (env.TURNSTILE_ENABLED) {
      for (const key of ['TURNSTILE_SECRET_KEY', 'TURNSTILE_EXPECTED_HOSTNAME'] as const)
        if (!env[key]?.trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'Required' });
    }
    if (env.RELATIONSHIP_ENABLED && !env.MOCK_INTEGRATIONS) {
      for (const key of ['RESEND_ENABLED', 'TURNSTILE_ENABLED'] as const)
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'Required for relationship' });
      if (!z.email().safeParse(env.CONTACT_NOTIFICATION_EMAIL).success)
        ctx.addIssue({
          code: 'custom',
          path: ['CONTACT_NOTIFICATION_EMAIL'],
          message: 'Required recipient',
        });
      for (const key of ['PRIVACY_VERSION', 'NEWSLETTER_CONSENT_VERSION'] as const)
        if (env[key].startsWith('development'))
          ctx.addIssue({ code: 'custom', path: [key], message: 'Approved version required' });
    }
    if (env.R2_ENABLED !== (env.STORAGE_DRIVER === 'r2'))
      ctx.addIssue({ code: 'custom', path: ['R2_ENABLED'], message: 'Driver mismatch' });
    if (env.R2_ENABLED) {
      for (const key of [
        'R2_ACCOUNT_ID',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_PUBLIC_BUCKET',
        'R2_PRIVATE_BUCKET',
      ] as const) {
        if (!env[key]?.trim()) ctx.addIssue({ code: 'custom', path: [key], message: 'Required' });
      }
      if (env.R2_ACCOUNT_ID && !/^[a-f0-9]{32}$/u.test(env.R2_ACCOUNT_ID))
        ctx.addIssue({ code: 'custom', path: ['R2_ACCOUNT_ID'], message: 'Invalid account' });
      if (env.R2_PUBLIC_BUCKET === env.R2_PRIVATE_BUCKET)
        ctx.addIssue({
          code: 'custom',
          path: ['R2_PRIVATE_BUCKET'],
          message: 'Separate buckets required',
        });
    }
  });

export function validateApiEnvironment(input: EnvironmentInput) {
  return readConfiguration(apiSchema, {
    MOCK_INTEGRATIONS: input.APP_ENV === 'development',
    RELATIONSHIP_ENABLED: input.APP_ENV === 'development',
    ...input,
  });
}

export type ApiEnvironment = ReturnType<typeof validateApiEnvironment>;
