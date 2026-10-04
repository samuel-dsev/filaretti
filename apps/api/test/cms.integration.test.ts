import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import sharp from 'sharp';
import { PDFDocument, PDFName } from 'pdf-lib';
import { UserRole } from '@prisma/client';
import type {
  AdminMedia,
  PreviewIssued,
  ArticlePreview,
  PublicArticle,
  AuthenticationResponse,
  CsrfResponse,
  PaginatedResponse,
} from '@filaretti/types';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { ArticlesService } from '../src/domain/articles.service';
import { CmsWorker } from '../src/cms/worker.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { hashPassword } from '../src/auth/password';
import { testEnvironment } from './helpers';

class Browser {
  private cookies = new Map<string, string>();
  private csrf = '';
  constructor(
    private base: string,
    private origin: string,
  ) {}
  async request(path: string, method = 'GET', body?: unknown) {
    const multipart = body instanceof FormData;
    const response = await fetch(`${this.base}/api/v1${path}`, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(method !== 'GET' ? { Origin: this.origin, 'X-CSRF-Token': this.csrf } : {}),
        ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]!;
      const index = pair.indexOf('=');
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async login(email: string, password: string) {
    this.csrf = ((await (await this.request('/auth/csrf')).json()) as CsrfResponse).csrfToken;
    const response = await this.request('/auth/login', 'POST', { email, password });
    assert.equal(response.status, 200);
    this.csrf = ((await response.json()) as AuthenticationResponse).csrfToken;
  }
  upload(bytes: Uint8Array, name: string, mime: string, visibility = 'PUBLIC') {
    const data = new FormData();
    data.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), name);
    data.set('alt', 'Imagem fictícia do CMS');
    data.set('visibility', visibility);
    return this.request('/admin/media', 'POST', data);
  }
}
type Article = PublicArticle & { version: number; status: string };
test('F6 CMS enforces storage, preview, publication, concurrency and durable retries in PostgreSQL', async (t) => {
  assert.ok(process.env.DATABASE_URL);
  const storageRoot = await mkdtemp(join(tmpdir(), 'filaretti-f6-'));
  let callbackAvailable = false;
  const calls: string[] = [];
  const logs: string[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    assert.equal(
      request.headers['x-revalidation-secret'],
      'test-only-revalidation-secret-at-least-32-characters',
    );
    const payload = JSON.parse(Buffer.concat(chunks).toString()) as {
      idempotencyKey: string;
      paths: string[];
    };
    assert.ok(payload.paths.includes('/'));
    calls.push(payload.idempotencyKey);
    response.writeHead(callbackAvailable ? 200 : 503, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({ revalidated: callbackAvailable, idempotencyKey: payload.idempotencyKey }),
    );
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
    STORAGE_LOCAL_PATH: storageRoot,
    WEB_PUBLIC_URL: origin,
  });
  let app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
  await app.listen(0, '127.0.0.1');
  let db = app.get(PrismaService);
  const prefix = `cms-${randomUUID()}`;
  const password = 'F6-Fictitious-Test!2026';
  const passwordHash = await hashPassword(password);
  const editorUser = await db.user.create({
    data: {
      email: `${prefix}-editor@example.invalid`,
      name: 'Editor fictício F6',
      role: UserRole.EDITOR,
      passwordHash,
      isMock: true,
    },
  });
  const authorUser = await db.user.create({
    data: {
      email: `${prefix}-author@example.invalid`,
      name: 'Autor fictício F6',
      role: UserRole.AUTHOR,
      passwordHash,
      isMock: true,
    },
  });
  let editor = new Browser(await app.getUrl(), origin);
  const author = new Browser(await app.getUrl(), origin);
  const visitor = new Browser(await app.getUrl(), origin);
  await editor.login(editorUser.email, password);
  await author.login(authorUser.email, password);
  const professional = await db.professional.findFirstOrThrow({ where: { isActive: true } });
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Conteúdo fictício exclusivamente para validação F6.' }],
      },
    ],
  };
  let article!: Article;
  let image!: AdminMedia;
  let privateMedia!: AdminMedia;
  let pdf!: AdminMedia;
  try {
    await t.test('unpublished slugs never enter public redirects', async () => {
      const draftResponse = await author.request('/admin/articles', 'POST', {
        title: 'Rascunho fictício privado',
        slug: `${prefix}-private`,
        excerpt: '',
        type: 'ARTICLE',
        authorId: professional.id,
        content,
      });
      assert.equal(draftResponse.status, 201);
      const draft = (await draftResponse.json()) as Article;
      assert.equal(
        (
          await author.request(`/admin/articles/${draft.id}`, 'PATCH', {
            version: draft.version,
            slug: `${prefix}-private-new`,
          })
        ).status,
        200,
      );
      const page = await db.page.create({
        data: {
          title: 'Página fictícia privada',
          slug: `${prefix}-page`,
          status: 'DRAFT',
          sections: [{ key: 'body', body: content }],
          isMock: true,
        },
      });
      assert.equal(
        (
          await editor.request(`/admin/pages/${page.id}`, 'PATCH', {
            version: page.version,
            slug: `${prefix}-page-new`,
          })
        ).status,
        200,
      );
      const person = await db.professional.create({
        data: {
          name: 'Profissional fictício inativo',
          title: 'Perfil fictício',
          slug: `${prefix}-person`,
          bio: content,
          education: [],
          experience: [],
          isActive: false,
          isMock: true,
        },
      });
      assert.equal(
        (
          await editor.request(`/admin/professionals/${person.id}`, 'PATCH', {
            version: person.version,
            slug: `${prefix}-person-new`,
          })
        ).status,
        200,
      );
      const area = await db.practiceArea.create({
        data: {
          name: 'Área fictícia inativa',
          slug: `${prefix}-area`,
          description: content,
          summary: 'Área fictícia de teste.',
          services: [],
          isActive: false,
          isMock: true,
        },
      });
      assert.equal(
        (
          await editor.request(`/admin/practice-areas/${area.id}`, 'PATCH', {
            version: area.version,
            slug: `${prefix}-area-new`,
          })
        ).status,
        200,
      );
      for (const path of [
        `/conteudos/${draft.slug}`,
        `/${page.slug}`,
        `/profissionais/${person.slug}`,
        `/areas-de-atuacao/${area.slug}`,
      ])
        assert.equal(
          (await visitor.request(`/redirects/resolve?path=${encodeURIComponent(path)}`)).status,
          404,
        );
      const redirects = await (await visitor.request('/redirects')).json();
      assert.equal(JSON.stringify(redirects).includes(prefix), false);
    });
    await t.test('valid multibyte editor content fits the bounded JSON parser', async () => {
      const text = 'áéíóú'.repeat(8000);
      const response = await editor.request('/admin/articles', 'POST', {
        title: 'Documento fictício extenso',
        slug: `${prefix}-long`,
        excerpt: 'Texto extenso fictício para validar o editor.',
        type: 'ARTICLE',
        authorId: professional.id,
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        },
      });
      assert.equal(response.status, 201);
      const saved = (await response.json()) as Article;
      const stored = await db.article.findUniqueOrThrow({ where: { id: saved.id } });
      assert.deepEqual(stored.content, {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
      });
      assert.equal(
        (await editor.request('/admin/articles', 'POST', { title: 'x'.repeat(512 * 1024) })).status,
        413,
      );
    });
    await t.test(
      'uploads fully decode images/PDF, enforce MIME/extension/limits and keep private assets inaccessible',
      async () => {
        assert.equal(
          (await visitor.upload(Buffer.from('invalid'), 'bad.png', 'image/png')).status,
          401,
        );
        const imageBytes = await sharp({
          create: { width: 16, height: 16, channels: 3, background: '#102a43' },
        })
          .png()
          .toBuffer();
        const uploaded = await editor.upload(imageBytes, '../imagem-ficticia.png', 'image/png');
        assert.equal(uploaded.status, 201);
        image = (await uploaded.json()) as AdminMedia;
        assert.match(image.url!, /^\/media\/public\/[a-f0-9-]{36}\.png$/u);
        assert.equal(image.version, 1);
        assert.equal('storageKey' in image, false);
        const otherFormats = [
          {
            extension: 'jpg',
            mime: 'image/jpeg',
            bytes: await sharp(imageBytes).jpeg().toBuffer(),
          },
          {
            extension: 'webp',
            mime: 'image/webp',
            bytes: await sharp(imageBytes).webp().toBuffer(),
          },
          {
            extension: 'avif',
            mime: 'image/avif',
            bytes: await sharp(imageBytes).avif().toBuffer(),
          },
        ];
        for (const format of otherFormats) {
          const response = await editor.upload(
            format.bytes,
            `ficticio.${format.extension}`,
            format.mime,
          );
          assert.equal(response.status, 201, `${format.extension} must decode and persist`);
          assert.equal(((await response.json()) as AdminMedia).mimeType, format.mime);
        }
        const asset = await visitor.request(image.url!.replace('/media/public/', '/media/public/'));
        assert.equal(asset.status, 200);
        assert.equal((await sharp(Buffer.from(await asset.arrayBuffer())).metadata()).width, 16);
        assert.equal((await editor.upload(imageBytes, 'wrong.jpg', 'image/jpeg')).status, 400);
        assert.equal(
          (await editor.upload(Buffer.from('<svg/>'), 'evil.svg', 'image/svg+xml')).status,
          400,
        );
        assert.equal(
          (
            await editor.upload(
              Buffer.concat([imageBytes, Buffer.alloc(5 * 1024 * 1024)]),
              'big.png',
              'image/png',
            )
          ).status,
          413,
        );
        assert.equal(
          (
            await editor.upload(
              Buffer.from('%PDF-1.7\ncorrupt\n%%EOF'),
              'invalid.pdf',
              'application/pdf',
            )
          ).status,
          400,
        );
        const document = await PDFDocument.create();
        document.addPage();
        const pdfResponse = await editor.upload(
          await document.save(),
          'guide.pdf',
          'application/pdf',
        );
        assert.equal(pdfResponse.status, 201);
        pdf = (await pdfResponse.json()) as AdminMedia;
        const active = await PDFDocument.create();
        active.addPage();
        active.catalog.set(
          PDFName.of('OpenAction'),
          active.context.obj({ S: 'JavaScript', JS: 'app.alert(1)' }),
        );
        assert.equal(
          (await editor.upload(await active.save(), 'active.pdf', 'application/pdf')).status,
          400,
        );
        const nested = await PDFDocument.create();
        const page = nested.addPage();
        page.node.set(
          PDFName.of('Annots'),
          nested.context.obj([{ AA: { E: { S: 'JavaScript', JS: 'app.alert(1)' } } }]),
        );
        assert.equal(
          (await editor.upload(await nested.save(), 'nested.pdf', 'application/pdf')).status,
          400,
        );
        privateMedia = (await (
          await author.upload(imageBytes, 'private.png', 'image/png', 'PRIVATE')
        ).json()) as AdminMedia;
        assert.equal(privateMedia.url, null);
        const privateRow = await db.media.findUniqueOrThrow({ where: { id: privateMedia.id } });
        assert.equal((await visitor.request(`/media/public/${privateRow.storageKey}`)).status, 404);
        assert.equal((await author.request(`/admin/media/${image.id}`)).status, 403);
        const catalog = (await (
          await editor.request('/admin/media?q=fict%C3%ADcia&kind=image')
        ).json()) as PaginatedResponse<AdminMedia>;
        assert.ok(catalog.data.some((row) => row.id === image.id));
        const meta = await editor.request(`/admin/media/${image.id}`, 'PATCH', {
          version: 1,
          alt: 'Nova descrição fictícia',
        });
        assert.equal(meta.status, 200);
        image = (await meta.json()) as AdminMedia;
        assert.equal(
          (
            await editor.request(`/admin/media/${image.id}`, 'PATCH', {
              version: 1,
              alt: 'Obsoleto',
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      'AUTHOR edits own drafts, preview hashes expire/revoke and public content stays hidden',
      async () => {
        assert.equal((await author.request('/admin/taxonomies/categories')).status, 200);
        assert.equal((await author.request('/admin/professionals')).status, 200);
        assert.equal((await author.request('/admin/practice-areas')).status, 200);
        const created = await author.request('/admin/articles', 'POST', {
          title: 'Artigo fictício F6',
          slug: prefix,
          excerpt: 'Resumo fictício',
          content,
          type: 'GUIDE',
          authorId: professional.id,
          coverMediaId: image.id,
          pdfMediaId: pdf.id,
        });
        assert.equal(created.status, 201);
        article = (await created.json()) as Article;
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}/publication`, 'POST', {
              version: article.version,
              status: 'PUBLISHED',
            })
          ).status,
          403,
        );
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 404);
        const first = (await (
          await author.request(`/admin/articles/${article.id}/preview`, 'POST', {
            version: article.version,
          })
        ).json()) as PreviewIssued;
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}/preview`, 'POST', {
              version: article.version + 1,
            })
          ).status,
          409,
        );
        const anotherDraft = await db.article.findFirstOrThrow({
          where: { status: 'DRAFT', createdById: { not: authorUser.id } },
        });
        assert.equal(
          (
            await author.request(`/admin/articles/${anotherDraft.id}/preview`, 'POST', {
              version: anotherDraft.version,
            })
          ).status,
          403,
        );
        assert.match(first.token, /^[A-Za-z0-9_-]{43}$/u);
        const stored = await db.previewToken.findFirstOrThrow({ where: { articleId: article.id } });
        assert.notEqual(stored.tokenHash, first.token);
        assert.equal(stored.tokenHash.length, 64);
        const response = await visitor.request(`/preview/${first.token}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.ok(response.headers.get('x-robots-tag')?.includes('noindex'));
        const preview = (await response.json()) as ArticlePreview;
        assert.equal(preview.article.title, article.title);
        assert.ok(Date.parse(preview.article.publishedAt));
        assert.equal('createdById' in preview.article, false);
        const second = (await (
          await author.request(`/admin/articles/${article.id}/preview`, 'POST', {
            version: article.version,
          })
        ).json()) as PreviewIssued;
        assert.equal((await visitor.request(`/preview/${first.token}`)).status, 404);
        await db.previewToken.updateMany({
          where: { articleId: article.id, revokedAt: null },
          data: { expiresAt: new Date(0) },
        });
        assert.equal((await visitor.request(`/preview/${second.token}`)).status, 404);
        const third = (await (
          await author.request(`/admin/articles/${article.id}/preview`, 'POST', {
            version: article.version,
          })
        ).json()) as PreviewIssued;
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}/preview`, 'DELETE', {
              version: article.version,
            })
          ).status,
          200,
        );
        assert.equal((await visitor.request(`/preview/${third.token}`)).status, 404);
        assert.equal(logs.join('').includes(first.token), false);
        assert.equal(
          (await editor.request(`/admin/media/${image.id}`, 'DELETE', { version: image.version }))
            .status,
          409,
        );
      },
    );
    await t.test(
      'publication/withdrawal are immediate, slug redirects survive changes and stale writes conflict',
      async () => {
        let response = await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
          version: article.version,
          status: 'PUBLISHED',
        });
        assert.equal(response.status, 201);
        article = (await response.json()) as Article;
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 200);
        const originalSlug = article.slug;
        response = await editor.request(`/admin/articles/${article.id}`, 'PATCH', {
          version: article.version,
          slug: `${prefix}-changed`,
        });
        assert.equal(response.status, 200);
        article = (await response.json()) as Article;
        const redirect = await visitor.request(
          `/redirects/resolve?path=${encodeURIComponent(`/conteudos/${originalSlug}`)}`,
        );
        assert.equal(redirect.status, 200);
        assert.equal(
          ((await redirect.json()) as { targetPath: string }).targetPath,
          `/conteudos/${article.slug}`,
        );
        assert.equal(
          (
            await editor.request(`/admin/articles/${article.id}`, 'PATCH', {
              version: article.version - 1,
              title: 'Obsoleto',
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await editor.request(`/admin/articles/${article.id}`, 'PATCH', {
              version: article.version,
              slug: originalSlug,
            })
          ).status,
          400,
        );
        response = await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
          version: article.version,
          status: 'DRAFT',
        });
        article = (await response.json()) as Article;
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 404);
        assert.ok(
          await db.outboxTask.count({ where: { topic: 'cache.revalidate', status: 'PENDING' } }),
        );
      },
    );
    await t.test(
      'overdue schedules survive app restart and concurrent PostgreSQL workers publish once',
      async () => {
        assert.equal(
          (
            await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
              version: article.version,
              status: 'SCHEDULED',
              scheduledAt: new Date(Date.now() - 1000).toISOString(),
            })
          ).status,
          400,
        );
        const response = await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
          version: article.version,
          status: 'SCHEDULED',
          scheduledAt: new Date(Date.now() + 60000).toISOString(),
        });
        assert.equal(response.status, 201);
        article = (await response.json()) as Article;
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 404);
        await app.close();
        app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
        await app.listen(0, '127.0.0.1');
        db = app.get(PrismaService);
        await db.article.update({
          where: { id: article.id },
          data: { scheduledAt: new Date(Date.now() - 1000) },
        });
        const another = await createApplication(environment, new SanitizedLogger(() => undefined));
        await another.listen(0, '127.0.0.1');
        try {
          const counts = await Promise.all([
            app.get(ArticlesService).publishDue(),
            another.get(ArticlesService).publishDue(),
          ]);
          assert.equal(
            counts.reduce((sum, value) => sum + value, 0),
            1,
          );
        } finally {
          await another.close();
        }
        const row = await db.article.findUniqueOrThrow({ where: { id: article.id } });
        assert.equal(row.status, 'PUBLISHED');
        assert.equal(row.scheduledAt, null);
        assert.equal(row.version, article.version + 1);
        assert.equal(
          await db.auditEvent.count({
            where: { resourceId: article.id, action: 'article.scheduled.published' },
          }),
          1,
        );
        editor = new Browser(await app.getUrl(), origin);
        await editor.login(editorUser.email, password);
      },
    );
    await t.test(
      'cache outbox survives failed delivery, restores expired leases, fences concurrency and retries',
      async () => {
        const worker = app.get(CmsWorker);
        await worker.tick();
        const pending = await db.outboxTask.findFirstOrThrow({
          where: { topic: 'cache.revalidate', status: 'PENDING', attempts: { gt: 0 } },
        });
        assert.equal(pending.lastErrorCode, 'CACHE_REVALIDATION_FAILED');
        assert.ok(pending.availableAt.getTime() > Date.now());
        const leased = await db.outboxTask.create({
          data: {
            topic: 'cache.revalidate',
            idempotencyKey: `lease:${prefix}`,
            payload: { paths: ['/'] },
            status: 'PROCESSING',
            attempts: 1,
            lockedBy: 'crashed-worker',
            lockedAt: new Date(Date.now() - 360000),
          },
        });
        callbackAvailable = true;
        await db.outboxTask.updateMany({
          where: { topic: 'cache.revalidate', status: 'PENDING' },
          data: { availableAt: new Date(0) },
        });
        const another = await createApplication(environment, new SanitizedLogger(() => undefined));
        await another.listen(0, '127.0.0.1');
        try {
          await Promise.all([worker.tick(), another.get(CmsWorker).tick()]);
        } finally {
          await another.close();
        }
        assert.equal(
          (await db.outboxTask.findUniqueOrThrow({ where: { id: pending.id } })).status,
          'COMPLETED',
        );
        assert.equal(
          (await db.outboxTask.findUniqueOrThrow({ where: { id: leased.id } })).status,
          'COMPLETED',
        );
        assert.equal(calls.filter((key) => key === leased.idempotencyKey).length, 1);
        const exhausted = await db.outboxTask.create({
          data: {
            topic: 'cache.revalidate',
            idempotencyKey: `exhausted:${prefix}`,
            payload: { paths: ['/'] },
            attempts: 4,
            maxAttempts: 5,
          },
        });
        callbackAvailable = false;
        await worker.tick();
        const failed = await db.outboxTask.findUniqueOrThrow({ where: { id: exhausted.id } });
        assert.equal(failed.status, 'FAILED');
        assert.equal(failed.attempts, 5);
        assert.equal(failed.lastErrorCode, 'CACHE_REVALIDATION_FAILED');
        callbackAvailable = true;
      },
    );
    await t.test(
      'media deletion waits for references and cleans bytes through durable tasks',
      async () => {
        const row = await db.article.findUniqueOrThrow({ where: { id: article.id } });
        let response = await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
          version: row.version,
          status: 'DRAFT',
        });
        article = (await response.json()) as Article;
        response = await editor.request(`/admin/articles/${article.id}`, 'PATCH', {
          version: article.version,
          coverMediaId: null,
          pdfMediaId: null,
        });
        assert.equal(response.status, 200);
        const stored = await db.media.findUniqueOrThrow({ where: { id: image.id } });
        const linkedPageResponse = await editor.request('/admin/pages', 'POST', {
          title: 'Página fictícia com mídia vinculada por link',
          slug: `${prefix}-linked-page`,
          sections: [
            {
              key: 'intro',
              body: {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: 'Arquivo fictício',
                        marks: [{ type: 'link', attrs: { href: image.url } }],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        });
        assert.equal(linkedPageResponse.status, 201);
        const linkedPage = (await linkedPageResponse.json()) as { id: string; version: number };
        assert.equal(
          (await editor.request(`/admin/media/${image.id}`, 'DELETE', { version: image.version }))
            .status,
          409,
        );
        assert.equal(
          (
            await editor.request(`/admin/pages/${linkedPage.id}`, 'DELETE', {
              version: linkedPage.version,
            })
          ).status,
          200,
        );
        const linkedFaqResponse = await editor.request('/admin/faqs', 'POST', {
          question: 'Como acessar o arquivo fictício usado neste teste?',
          answer: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'Arquivo fictício',
                    marks: [{ type: 'link', attrs: { href: image.url } }],
                  },
                ],
              },
            ],
          },
        });
        assert.equal(linkedFaqResponse.status, 201);
        const linkedFaq = (await linkedFaqResponse.json()) as { id: string; version: number };
        assert.equal(
          (await editor.request(`/admin/media/${image.id}`, 'DELETE', { version: image.version }))
            .status,
          409,
        );
        assert.equal(
          (
            await editor.request(`/admin/faqs/${linkedFaq.id}`, 'DELETE', {
              version: linkedFaq.version,
            })
          ).status,
          200,
        );
        assert.equal(
          (await editor.request(`/admin/media/${image.id}`, 'DELETE', { version: 1 })).status,
          409,
        );
        assert.equal(
          (await editor.request(`/admin/media/${image.id}`, 'DELETE', { version: image.version }))
            .status,
          200,
        );
        const worker = app.get(CmsWorker);
        await worker.tick();
        assert.equal(
          (
            await new Browser(await app.getUrl(), origin).request(
              image.url!.replace('/media/public/', '/media/public/'),
            )
          ).status,
          404,
        );
        await assert.rejects(stat(join(storageRoot, 'public', stored.storageKey)));
        assert.equal(
          (
            await db.outboxTask.findUniqueOrThrow({
              where: { idempotencyKey: `media-delete:${image.id}` },
            })
          ).status,
          'COMPLETED',
        );
      },
    );
  } finally {
    await app.close();
    await new Promise<void>((done) => server.close(() => done()));
    assert.ok(resolve(storageRoot).startsWith(resolve(tmpdir()) + sep));
    await rm(storageRoot, { recursive: true, force: true });
  }
});
