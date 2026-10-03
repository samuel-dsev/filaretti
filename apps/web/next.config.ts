import { validateWebEnvironment } from '@filaretti/config';
import type { NextConfig } from 'next';

// Fail before serving or building when required configuration is invalid.
// Server configuration is never copied into Next's public `env` option.
const environment = validateWebEnvironment(process.env);

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
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
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
