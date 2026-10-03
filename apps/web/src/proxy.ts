import { NextResponse, type NextRequest } from 'next/server';

import { isLocalDemoAllowed } from './lib/local-demo';
import { publicRouteResource } from './lib/public-routing';
import { publicStatusHtml } from './lib/public-status';

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/dev/design-system')) {
    if (isLocalDemoAllowed(process.env.APP_ENV, request.headers.get('host'))) {
      return NextResponse.next();
    }
    // Reject before rendering: notFound() inside a streamed layout can carry HTTP 200.
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  const resource = publicRouteResource(request.nextUrl.pathname);
  if (!resource) return NextResponse.next();
  let status: 404 | 503 | undefined;
  if (!resource.endpoint) status = 404;
  else {
    try {
      const api = process.env.API_INTERNAL_URL;
      if (!api) throw new Error('Missing server configuration');
      const response = await fetch(`${api.replace(/\/$/u, '')}/api/v1${resource.endpoint}`, {
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { Accept: 'application/json' },
      });
      // Do not forward backend error bodies, cookies, headers or transport diagnostics.
      if (response.status === 404 && resource.isDetail) status = 404;
      else if (!response.ok) status = 503;
      await response.body?.cancel();
    } catch {
      status = 503;
    }
  }
  if (status) {
    return new NextResponse(publicStatusHtml(status), {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        ...(status === 503 ? { 'Retry-After': '30' } : {}),
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dev/design-system/:path*',
    '/',
    '/o-escritorio',
    '/areas-de-atuacao',
    '/areas-de-atuacao/:slug',
    '/profissionais',
    '/profissionais/:slug',
  ],
};
