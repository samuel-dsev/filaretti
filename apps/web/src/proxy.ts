import { NextResponse, type NextRequest } from 'next/server';

import { isLocalDemoAllowed } from './lib/local-demo';

export function proxy(request: NextRequest) {
  if (!isLocalDemoAllowed(process.env.APP_ENV, request.headers.get('host'))) {
    // Reject before rendering: notFound() inside a streamed layout can carry HTTP 200.
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/dev/design-system/:path*'] };
