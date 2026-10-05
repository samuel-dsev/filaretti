import { validateWebEnvironment } from '@filaretti/config';
import type { NextConfig } from 'next';

// Fail before serving or building when required configuration is invalid.
// Server configuration is never copied into Next's public `env` option.
const environment = validateWebEnvironment(process.env);
const qaBuildId = process.env.FILARETTI_QA_BUILD_ID;
const qaPhase = ['f7', 'f8'].includes(process.env.FILARETTI_QA_PHASE ?? '')
  ? process.env.FILARETTI_QA_PHASE
  : 'f6';
const qaDistDir =
  process.env.APP_ENV === 'development' &&
  qaBuildId &&
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/u.test(qaBuildId)
    ? `.local/${qaPhase}-qa-build-${qaBuildId}`
    : undefined;

const nextConfig: NextConfig = {
  // Local QA builds use their own origin/rewrites without replacing the normal artifact.
  ...(qaDistDir
    ? {
        distDir: qaDistDir,
        typescript: { tsconfigPath: `.local/${qaPhase}-qa-tsconfig-${qaBuildId}.json` },
      }
    : {}),
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  logging: { incomingRequests: false, browserToTerminal: false },
  transpilePackages: ['@filaretti/ui'],
  images: {
    // Only public raster assets served by this application. Storage hosts join in F6.
    localPatterns: [{ pathname: '/media/public/**', search: '' }],
    remotePatterns: [],
    dangerouslyAllowSVG: false,
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${environment.apiInternalUrl.replace(/\/$/, '')}/api/v1/:path*`,
      },
      {
        source: '/media/public/:key',
        destination: `${environment.apiInternalUrl.replace(/\/$/, '')}/api/v1/media/public/:key`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
          },
          ...(environment.publicSiteUrl.startsWith('https://')
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
            : []),
          ...(!environment.seoIndexingEnabled
            ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
