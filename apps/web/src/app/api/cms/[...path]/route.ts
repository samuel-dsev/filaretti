import { NextRequest, NextResponse } from 'next/server';
import { signVisitorHeaders } from '@/lib/bff-client-ip';

export const dynamic = 'force-dynamic';
const cacheHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (
    !['auth', 'admin'].includes(path[0] ?? '') ||
    path.some((part) => !/^[a-zA-Z0-9-]+$/u.test(part))
  ) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND' } },
      { status: 404, headers: cacheHeaders },
    );
  }
  const base = process.env.API_INTERNAL_URL;
  if (!base)
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE' } },
      { status: 503, headers: cacheHeaders },
    );
  const headers = new Headers();
  for (const key of ['cookie', 'content-type', 'x-csrf-token', 'origin', 'sec-fetch-site']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const readOnly = request.method === 'GET' || request.method === 'HEAD';
  if (!readOnly && Number(request.headers.get('content-length') ?? 0) > 11 * 1024 * 1024) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST' } },
      { status: 413, headers: cacheHeaders },
    );
  }
  try {
    for (const [key, value] of signVisitorHeaders(
      request,
      request.method,
      `/api/v1/${path.join('/')}`,
    ))
      headers.set(key, value);
    let body: Uint8Array<ArrayBuffer> | undefined;
    if (!readOnly && request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 11 * 1024 * 1024) {
          await reader.cancel();
          return NextResponse.json(
            { error: { code: 'PAYLOAD_TOO_LARGE' } },
            { status: 413, headers: cacheHeaders },
          );
        }
        chunks.push(next.value);
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
    }
    const response = await fetch(
      `${base.replace(/\/$/u, '')}/api/v1/${path.join('/')}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(20000),
      },
    );
    const outputHeaders = new Headers(cacheHeaders);
    const contentType = response.headers.get('content-type');
    if (contentType) outputHeaders.set('Content-Type', contentType);
    for (const key of ['retry-after', 'x-request-id']) {
      const value = response.headers.get(key);
      if (value) outputHeaders.set(key, value);
    }
    for (const cookie of response.headers.getSetCookie()) {
      outputHeaders.append(
        'Set-Cookie',
        cookie.replace(/Path=\/api\/v1(?=;|$)/iu, 'Path=/api/cms'),
      );
    }
    return new NextResponse(response.status === 204 ? null : response.body, {
      status: response.status,
      headers: outputHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE' } },
      { status: 503, headers: cacheHeaders },
    );
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
