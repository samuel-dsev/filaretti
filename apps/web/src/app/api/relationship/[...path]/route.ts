import { NextRequest, NextResponse } from 'next/server';
import { relationshipEndpoint } from '@/lib/relationship-routing';
import { validateWebEnvironment } from '@filaretti/config';
import { signVisitorHeaders } from '@/lib/bff-client-ip';

export const dynamic = 'force-dynamic';
const cacheHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};
const maximumBody = 16 * 1024 * 1024;

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const endpoint = relationshipEndpoint(path, request.method);
  if (!endpoint)
    return NextResponse.json(
      { error: { code: 'NOT_FOUND' } },
      { status: 404, headers: cacheHeaders },
    );
  let base: string;
  let publicOrigin: string;
  try {
    const environment = validateWebEnvironment(process.env);
    base = environment.apiInternalUrl;
    publicOrigin = new URL(environment.publicSiteUrl).origin;
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE' } },
      { status: 503, headers: cacheHeaders },
    );
  }
  if (
    request.headers.get('origin') !== publicOrigin ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    return NextResponse.json(
      { error: { code: 'FORBIDDEN' } },
      { status: 403, headers: cacheHeaders },
    );
  if (Number(request.headers.get('content-length') ?? 0) > maximumBody)
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE' } },
      { status: 413, headers: cacheHeaders },
    );
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (request.body) {
      const reader = request.body.getReader();
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > maximumBody) {
          await reader.cancel();
          return NextResponse.json(
            { error: { code: 'PAYLOAD_TOO_LARGE' } },
            { status: 413, headers: cacheHeaders },
          );
        }
        chunks.push(next.value);
      }
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const headers = signVisitorHeaders(request, 'POST', endpoint);
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('Content-Type', contentType);
    headers.set('Origin', request.headers.get('origin')!);
    const response = await fetch(`${base.replace(/\/$/u, '')}${endpoint}`, {
      method: 'POST',
      headers,
      body,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(25000),
    });
    const output = new Headers(cacheHeaders);
    output.set('Content-Type', 'application/json');
    const retry = response.headers.get('retry-after');
    if (retry) output.set('Retry-After', retry);
    return new NextResponse(response.body, { status: response.status, headers: output });
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAVAILABLE' } },
      { status: 503, headers: cacheHeaders },
    );
  }
}

export { forward as POST };
