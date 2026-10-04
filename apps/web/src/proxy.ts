import { NextResponse, type NextRequest } from 'next/server';

import { isLocalDemoAllowed } from './lib/local-demo';
import { publicRouteResource } from './lib/public-routing';
import { publicStatusHtml } from './lib/public-status';
import { isPrivateCmsPath, previewTokenPath, publicRedirectPath } from './lib/cms-routing';
import { isManagedPublicMedia } from './lib/public-media';

function privateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/_next/image') {
    try {
      let assetPath = new URL(request.nextUrl.searchParams.get('url') ?? '', request.nextUrl)
        .pathname;
      for (let index = 0; index < 3 && assetPath.includes('%'); index++)
        assetPath = decodeURIComponent(assetPath);
      assetPath = new URL(assetPath, request.nextUrl).pathname;
      if (isManagedPublicMedia(assetPath))
        return new NextResponse('Use the public media facade.', {
          status: 400,
          headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
        });
    } catch {
      // Invalid optimizer inputs remain subject to Next's own validation.
    }
    return NextResponse.next();
  }
  if (isPrivateCmsPath(pathname)) {
    if (pathname.startsWith('/preview/')) {
      const token = previewTokenPath(pathname);
      let status = 404;
      if (token) {
        try {
          const api = process.env.API_INTERNAL_URL;
          if (!api) throw new Error('Missing server configuration');
          const result = await fetch(`${api.replace(/\/$/u, '')}/api/v1/preview/${token}`, {
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.timeout(5000),
            headers: { Accept: 'application/json' },
          });
          status = result.ok ? 200 : result.status === 404 ? 404 : 503;
          await result.body?.cancel();
        } catch {
          status = 503;
        }
      }
      if (status !== 200) {
        return privateResponse(
          new NextResponse(publicStatusHtml(status === 404 ? 404 : 503), {
            status,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }),
        );
      }
    }
    return privateResponse(NextResponse.next());
  }
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
  // Redirect resolution is owned by the backend. Never follow an arbitrary remote destination.
  if (publicRedirectPath(pathname)) {
    try {
      const api = process.env.API_INTERNAL_URL;
      if (api) {
        const result = await fetch(
          `${api.replace(/\/$/u, '')}/api/v1/redirects/resolve?path=${encodeURIComponent(pathname)}`,
          { cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(5000) },
        );
        if (result.ok) {
          const redirect: unknown = await result.json();
          if (
            redirect &&
            typeof redirect === 'object' &&
            'sourcePath' in redirect &&
            redirect.sourcePath === pathname &&
            'targetPath' in redirect &&
            publicRedirectPath(redirect.targetPath) &&
            redirect.targetPath !== pathname &&
            'statusCode' in redirect &&
            (redirect.statusCode === 301 ||
              redirect.statusCode === 302 ||
              redirect.statusCode === 307 ||
              redirect.statusCode === 308)
          ) {
            const response = NextResponse.redirect(
              new URL(redirect.targetPath, request.nextUrl),
              redirect.statusCode,
            );
            response.headers.set('Cache-Control', 'no-store');
            return response;
          }
        } else await result.body?.cancel();
      }
    } catch {
      /* Existing public resource checks still determine availability below. */
    }
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
  const response = NextResponse.next();
  // Revalidate every editorial request. No public payload may survive withdrawal in a CDN cache.
  if (
    request.nextUrl.pathname === '/conteudos' ||
    request.nextUrl.pathname.startsWith('/conteudos/')
  ) {
    response.headers.set('Cache-Control', 'no-store');
  }
  return response;
}

export const config = {
  matcher: ['/((?!api(?:/|$)|_next(?:/|$)|media(?:/|$)|favicon\\.ico).*)', '/_next/image'],
};
