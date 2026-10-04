import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
const publicPath =
  /^\/(?:$|o-escritorio$|conteudos(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$|areas-de-atuacao(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$|profissionais(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$|perguntas-frequentes$|contato$|privacidade$|cookies$|busca$|sitemap\.xml$)/u;

export async function POST(request: NextRequest) {
  const expected = process.env.REVALIDATION_SECRET;
  const received = request.headers.get('X-Revalidation-Secret') ?? '';
  if (
    !expected ||
    received.length > 512 ||
    Buffer.byteLength(expected) !== Buffer.byteLength(received) ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  )
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers });
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  let input: unknown;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
      }
      chunks.push(next.value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      input = JSON.parse(new TextDecoder().decode(body));
    } catch {
      input = undefined;
    }
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('paths' in input) ||
    !Array.isArray(input.paths) ||
    input.paths.length > 100 ||
    !input.paths.every((path: unknown) => typeof path === 'string' && publicPath.test(path)) ||
    !('idempotencyKey' in input) ||
    typeof input.idempotencyKey !== 'string' ||
    input.idempotencyKey.length > 200 ||
    !input.idempotencyKey.length
  )
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400, headers });
  // revalidatePath is idempotent. Repeating delivery after a worker crash is safe;
  // the persistent queue in the API owns acknowledgement and retry history.
  for (const path of new Set(input.paths as string[])) {
    if (path === '/') revalidatePath('/', 'layout');
    else revalidatePath(path);
  }
  return NextResponse.json(
    { revalidated: true, idempotencyKey: input.idempotencyKey },
    { headers },
  );
}
