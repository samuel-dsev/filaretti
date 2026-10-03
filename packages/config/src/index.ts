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
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText,
    NEXT_PUBLIC_GA4_ID: optionalText,
    NEXT_PUBLIC_SENTRY_DSN: optionalText,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production') {
      if (env.MOCK_CONTENT)
        ctx.addIssue({ code: 'custom', path: ['MOCK_CONTENT'], message: 'Mocks forbidden' });
      if (!env.NEXT_PUBLIC_SITE_URL.startsWith('https:'))
        ctx.addIssue({ code: 'custom', path: ['NEXT_PUBLIC_SITE_URL'], message: 'HTTPS required' });
    }
  });

export function validateWebEnvironment(input: EnvironmentInput) {
  const env = readConfiguration(webSchema, input);
  return {
    appEnvironment: env.APP_ENV,
    apiInternalUrl: env.API_INTERNAL_URL,
    publicSiteUrl: env.NEXT_PUBLIC_SITE_URL,
    publicApiBasePath: env.NEXT_PUBLIC_API_BASE_PATH,
    mockContent: env.MOCK_CONTENT,
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
    COOKIE_SECURE: flag(false),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict']).default('lax'),
    JWT_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(900),
    REFRESH_TOKEN_SECRET: z.string().min(32),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
    PREVIEW_SECRET: z.string().min(32),
    REVALIDATION_SECRET: z.string().min(32),
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
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production') {
      if (env.MOCK_CONTENT)
        ctx.addIssue({ code: 'custom', path: ['MOCK_CONTENT'], message: 'Mocks forbidden' });
      if (!env.COOKIE_SECURE)
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Secure required' });
      for (const key of ['WEB_PUBLIC_URL', 'API_PUBLIC_URL'] as const) {
        if (!env[key].startsWith('https:'))
          ctx.addIssue({ code: 'custom', path: [key], message: 'HTTPS required' });
      }
    }
    // Vendor adapters remain deferred to F6/F7; configuration must not imply they exist.
    for (const key of ['R2_ENABLED', 'RESEND_ENABLED', 'TURNSTILE_ENABLED'] as const) {
      if (env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'Integration pending F6/F7' });
    }
    if (env.STORAGE_DRIVER !== 'local')
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Adapter pending F6' });
  });

export function validateApiEnvironment(input: EnvironmentInput) {
  return readConfiguration(apiSchema, input);
}

export type ApiEnvironment = ReturnType<typeof validateApiEnvironment>;
