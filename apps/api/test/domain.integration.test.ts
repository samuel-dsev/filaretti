import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserRole } from '@prisma/client';
import type {
  AuthenticationResponse,
  CsrfResponse,
  PaginatedResponse,
  PublicArticle,
  PublicArticleSummary,
  PublicPage,
  PublicProfessional,
  PublicSiteSettings,
  TaxonomySummary,
  TipTapDocument,
} from '@filaretti/types';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { hashPassword } from '../src/auth/password';
import { testEnvironment } from './helpers';

class Browser {
  private readonly cookies = new Map<string, string>();
  private csrfToken = '';
  constructor(private readonly base: string) {}
  async request(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(`${this.base}/api/v1${path}`, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(method !== 'GET'
          ? { Origin: 'http://localhost:3000', 'X-CSRF-Token': this.csrfToken }
          : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]!;
      const split = pair.indexOf('=');
      const key = pair.slice(0, split);
      const value = pair.slice(split + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return response;
  }
  async login(email: string, password: string) {
    this.csrfToken = ((await (await this.request('/auth/csrf')).json()) as CsrfResponse).csrfToken;
    const response = await this.request('/auth/login', 'POST', { email, password });
    assert.equal(response.status, 200);
    this.csrfToken = ((await response.json()) as AuthenticationResponse).csrfToken;
  }
}
const content: TipTapDocument = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Texto fictício de teste' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Conteúdo exclusivamente fictício para verificar a API.' }],
    },
  ],
};
type AdminArticle = PublicArticle & { version: number; createdById: string; status: string };
type AdminProfessional = PublicProfessional & { version: number };

test('domain permissions, publication, relations and conflicts use real PostgreSQL and HTTP', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'Use the isolated integration database runner.');
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
    NODE_ENV: 'development',
    REFRESH_TOKEN_SECRET: 'domain-local-only-secret-at-least-32-characters',
    MOCK_CONTENT: true,
  });
  const app = await createApplication(environment, new SanitizedLogger(() => undefined));
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const prefix = `domain-${randomUUID()}`;
  const password = 'Domain-Fictitious-Test!2026';
  const passwordHash = await hashPassword(password);
  async function user(role: UserRole) {
    return db.user.create({
      data: {
        email: `${prefix}-${role.toLowerCase()}@example.invalid`,
        name: 'Pessoa fictícia de teste',
        passwordHash,
        role,
        isMock: true,
      },
    });
  }
  const adminUser = await user(UserRole.ADMIN);
  const editorUser = await user(UserRole.EDITOR);
  const authorUser = await user(UserRole.AUTHOR);
  const base = await app.getUrl();
  const visitor = new Browser(base);
  const admin = new Browser(base);
  const editor = new Browser(base);
  const author = new Browser(base);
  await admin.login(adminUser.email, password);
  await editor.login(editorUser.email, password);
  await author.login(authorUser.email, password);
  const area = await db.practiceArea.findUniqueOrThrow({ where: { slug: 'area-ficticia-1' } });
  const professional = await db.professional.findUniqueOrThrow({
    where: { slug: 'profissional-ficticio-1' },
  });
  const category = await db.category.findFirstOrThrow({ where: { isActive: true } });
  const tag = await db.tag.findFirstOrThrow({ where: { isActive: true } });
  const articlePayload = {
    slug: `${prefix}-article`,
    title: 'Artigo fictício da integração',
    excerpt: 'Resumo fictício',
    content,
    type: 'GUIDE',
    authorId: professional.id,
    categoryIds: [category.id],
    tagIds: [tag.id],
    practiceAreaIds: [area.id],
  };
  let article: AdminArticle;
  try {
    await t.test(
      'visitors cannot reach administrative or deferred personal-data flows',
      async () => {
        for (const path of [
          '/admin/articles',
          '/admin/taxonomies/categories',
          '/admin/taxonomies/tags',
          '/admin/professionals',
          '/admin/practice-areas',
          '/admin/pages',
          '/admin/faqs',
          '/admin/settings',
          '/admin/redirects',
        ])
          assert.equal((await visitor.request(path)).status, 401, path);
        for (const path of [
          '/contacts',
          '/newsletter',
          '/media',
          '/admin/contacts',
          '/admin/newsletter',
        ])
          assert.equal((await visitor.request(path)).status, 404, path);
        const response = await visitor.request('/articles');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const result = (await response.json()) as PaginatedResponse<PublicArticleSummary>;
        assert.equal(result.meta.page, 1);
        assert.equal(result.meta.limit, 12);
        assert.ok(result.meta.total > 0);
        assert.ok(result.data.length <= 12);
        assert.doesNotMatch(
          JSON.stringify(result),
          /passwordHash|storageKey|ownerId|createdById|updatedById|sessionId|isMock|status|version/u,
        );
        for (const query of [
          'limit=51',
          'page=0',
          'page=1.2',
          'limit=abc',
          'sort=createdById',
          'sort=name',
          'status=DRAFT',
          'year=9999',
          'featured=1',
          'featured=yes',
          'featured=true&featured=false',
          'unexpected=true',
        ])
          assert.equal((await visitor.request(`/articles?${query}`)).status, 400, query);
        const empty = (await (
          await visitor.request('/articles?page=100000')
        ).json()) as PaginatedResponse<PublicArticleSummary>;
        assert.deepEqual(empty.data, []);
      },
    );
    await t.test(
      'featured selections are filtered in PostgreSQL and retain public visibility',
      async () => {
        const all = (await (
          await visitor.request('/articles?limit=50')
        ).json()) as PaginatedResponse<PublicArticleSummary>;
        const highlighted = await visitor.request('/articles?featured=true&limit=50');
        const regular = await visitor.request('/articles?featured=false&limit=50');
        assert.equal(highlighted.status, 200);
        assert.equal(regular.status, 200);
        const featured = (await highlighted.json()) as PaginatedResponse<PublicArticleSummary>;
        const nonFeatured = (await regular.json()) as PaginatedResponse<PublicArticleSummary>;
        assert.deepEqual(
          featured.data.map((row) => row.id),
          all.data.filter((row) => row.featured).map((row) => row.id),
        );
        assert.deepEqual(
          nonFeatured.data.map((row) => row.id),
          all.data.filter((row) => !row.featured).map((row) => row.id),
        );
        assert.equal(featured.meta.total + nonFeatured.meta.total, all.meta.total);
        const guides = (await (
          await visitor.request('/articles?featured=true&type=GUIDE&limit=3')
        ).json()) as PaginatedResponse<PublicArticleSummary>;
        assert.ok(guides.data.every((row) => row.featured && row.type === 'GUIDE'));
        assert.doesNotMatch(
          JSON.stringify(featured),
          /conteudo-ficticio-(?:13|14|15|16|17|18|19|20)/u,
        );
      },
    );
    await t.test(
      'AUTHOR creates own drafts and cannot overpost, publish or edit another owner',
      async () => {
        const created = await author.request('/admin/articles', 'POST', articlePayload);
        assert.equal(created.status, 201);
        article = (await created.json()) as AdminArticle;
        assert.equal(article.status, 'DRAFT');
        assert.equal(article.createdById, authorUser.id);
        assert.equal(article.version, 1);
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 404);
        for (const extra of [
          { status: 'PUBLISHED' },
          { createdById: adminUser.id },
          { isMock: false },
        ])
          assert.equal(
            (
              await author.request('/admin/articles', 'POST', {
                ...articlePayload,
                slug: `${prefix}-${randomUUID()}`,
                ...extra,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}/publication`, 'POST', {
              version: 1,
              status: 'PUBLISHED',
            })
          ).status,
          403,
        );
        const otherResponse = await editor.request('/admin/articles', 'POST', {
          ...articlePayload,
          slug: `${prefix}-other`,
        });
        assert.equal(otherResponse.status, 201);
        const other = (await otherResponse.json()) as AdminArticle;
        assert.equal((await author.request(`/admin/articles/${other.id}`)).status, 403);
        assert.equal(
          (
            await author.request(`/admin/articles/${other.id}`, 'PATCH', {
              version: other.version,
              title: 'Tentativa alheia fictícia',
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await author.request(`/admin/articles/${other.id}`, 'DELETE', {
              version: other.version,
            })
          ).status,
          403,
        );
        const ownList = (await (
          await author.request('/admin/articles?limit=50')
        ).json()) as PaginatedResponse<AdminArticle>;
        assert.ok(ownList.data.length > 0);
        assert.ok(
          ownList.data.every((row) => row.createdById === authorUser.id && row.status === 'DRAFT'),
        );
        assert.equal(
          (
            await author.request(
              `/admin/articles/${article.id}`,
              'PATCH',
              { version: 1, title: 'Rejeita CSRF' },
              { 'X-CSRF-Token': 'forged' },
            )
          ).status,
          403,
        );
        const update = await author.request(`/admin/articles/${article.id}`, 'PATCH', {
          version: 1,
          title: 'Rascunho fictício atualizado',
        });
        assert.equal(update.status, 200);
        article = (await update.json()) as AdminArticle;
        assert.equal(article.version, 2);
        const stale = await author.request(`/admin/articles/${article.id}`, 'PATCH', {
          version: 1,
          title: 'Edição antiga',
        });
        assert.equal(stale.status, 409);
        assert.equal(
          ((await stale.json()) as { error: { code: string } }).error.code,
          'VERSION_CONFLICT',
        );
        assert.equal((await author.request('/admin/pages')).status, 403);
      },
    );
    await t.test(
      'content and relations reject executable payloads, unknown fields and private media',
      async () => {
        const privateMedia = await db.media.create({
          data: {
            ownerId: adminUser.id,
            visibility: 'PRIVATE',
            storageKey: `${prefix}-private`,
            publicUrl: null,
            mimeType: 'application/pdf',
            size: 100,
            isMock: true,
          },
        });
        const invalidDocuments = [
          { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
          {
            type: 'doc',
            content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' }, content: [] }],
          },
          {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'unsafe',
                    marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                  },
                ],
              },
            ],
          },
          {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: 'unsafe',
                    marks: [{ type: 'link', attrs: { href: '//attacker.example.invalid' } }],
                  },
                ],
              },
            ],
          },
          {
            type: 'doc',
            content: [{ type: 'image', attrs: { src: 'https://example.invalid/image' } }],
          },
        ];
        for (const invalid of invalidDocuments)
          assert.equal(
            (
              await author.request('/admin/articles', 'POST', {
                ...articlePayload,
                slug: `${prefix}-${randomUUID()}`,
                content: invalid,
              })
            ).status,
            400,
          );
        assert.equal(
          (
            await author.request('/admin/articles', 'POST', {
              ...articlePayload,
              slug: `${prefix}-private`,
              pdfMediaId: privateMedia.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await author.request('/admin/articles', 'POST', {
              ...articlePayload,
              slug: `${prefix}-missing`,
              authorId: randomUUID(),
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}`, 'PATCH', {
              version: article.version,
              title: null,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}`, 'PATCH', {
              version: article.version,
              categoryIds: [category.id, category.id],
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'EDITOR publishes, all combined filters work and AUTHOR cannot alter published content',
      async () => {
        const publication = await editor.request(
          `/admin/articles/${article.id}/publication`,
          'POST',
          { version: article.version, status: 'PUBLISHED' },
        );
        assert.equal(publication.status, 201);
        article = (await publication.json()) as AdminArticle;
        const publicResponse = await visitor.request(`/articles/${article.slug}`);
        assert.equal(publicResponse.status, 200);
        const publicArticle = (await publicResponse.json()) as PublicArticle;
        assert.equal(publicArticle.author?.slug, professional.slug);
        assert.deepEqual(
          publicArticle.practiceAreas.map((row) => row.id),
          [area.id],
        );
        assert.doesNotMatch(
          JSON.stringify(publicArticle),
          /createdById|updatedById|storageKey|passwordHash|isMock|version|status/u,
        );
        const filtered = await visitor.request(
          `/articles?area=${area.slug}&category=${category.slug}&professional=${professional.slug}&tag=${tag.slug}&type=GUIDE&year=${new Date().getUTCFullYear()}&limit=50`,
        );
        assert.equal(filtered.status, 200);
        assert.ok(
          ((await filtered.json()) as PaginatedResponse<PublicArticleSummary>).data.some(
            (row) => row.id === article.id,
          ),
        );
        const alias = await visitor.request(`/articles?author=${professional.slug}&limit=50`);
        assert.equal(alias.status, 200);
        assert.ok(
          ((await alias.json()) as PaginatedResponse<PublicArticleSummary>).data.some(
            (row) => row.id === article.id,
          ),
        );
        const missing = await visitor.request(`/articles?area=${prefix}-missing`);
        assert.equal(
          ((await missing.json()) as PaginatedResponse<PublicArticleSummary>).meta.total,
          0,
        );
        assert.equal(
          (
            await author.request(`/admin/articles/${article.id}`, 'PATCH', {
              version: article.version,
              title: 'Publicação indevida',
            })
          ).status,
          403,
        );
        const own = (await (
          await author.request('/admin/articles')
        ).json()) as PaginatedResponse<AdminArticle>;
        assert.ok(!own.data.some((row) => row.id === article.id));
        assert.equal(
          (
            await admin.request(`/admin/professionals/${professional.id}`, 'DELETE', {
              version: professional.version,
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await admin.request(`/admin/taxonomies/categories/${category.id}`, 'DELETE', {
              version: category.version,
            })
          ).status,
          409,
        );
        const audit = await db.auditEvent.count({
          where: { resourceId: article.id, action: 'article.published' },
        });
        assert.equal(audit, 1);
      },
    );
    await t.test(
      'parallel writers get one winner and unpublishing immediately removes public content',
      async () => {
        const [one, two] = await Promise.all([
          editor.request(`/admin/articles/${article.id}`, 'PATCH', {
            version: article.version,
            title: 'Edição concorrente A',
          }),
          editor.request(`/admin/articles/${article.id}`, 'PATCH', {
            version: article.version,
            title: 'Edição concorrente B',
          }),
        ]);
        assert.deepEqual([one.status, two.status].sort(), [200, 409]);
        article = (await (one.status === 200 ? one : two).json()) as AdminArticle;
        const archived = await editor.request(`/admin/articles/${article.id}/publication`, 'POST', {
          version: article.version,
          status: 'ARCHIVED',
        });
        assert.equal(archived.status, 201);
        article = (await archived.json()) as AdminArticle;
        assert.equal((await visitor.request(`/articles/${article.slug}`)).status, 404);
        const list = (await (
          await visitor.request(`/articles?professional=${professional.slug}&limit=50`)
        ).json()) as PaginatedResponse<PublicArticleSummary>;
        assert.ok(!list.data.some((row) => row.id === article.id));
      },
    );
    await t.test(
      'institutional CRUD persists JSON, active flags, page publication and version guards',
      async () => {
        const areaResponse = await editor.request('/admin/practice-areas', 'POST', {
          name: 'Área fictícia criada',
          slug: `${prefix}-area`,
          summary: 'Resumo fictício',
          description: content,
          services: ['Serviço fictício'],
        });
        assert.equal(areaResponse.status, 201);
        const createdArea = (await areaResponse.json()) as { id: string; version: number };
        const professionalResponse = await editor.request('/admin/professionals', 'POST', {
          name: 'Profissional fictício criado',
          slug: `${prefix}-professional`,
          title: 'Identidade fictícia',
          bio: content,
          education: ['Formação fictícia'],
          experience: ['Experiência fictícia'],
          practiceAreaIds: [createdArea.id],
        });
        assert.equal(professionalResponse.status, 201);
        const createdProfessional = (await professionalResponse.json()) as AdminProfessional;
        const publicProfessional = (await (
          await visitor.request(`/professionals/${prefix}-professional`)
        ).json()) as PublicProfessional;
        assert.deepEqual(publicProfessional.education, ['Formação fictícia']);
        assert.equal(publicProfessional.practiceAreas[0]?.id, createdArea.id);
        assert.equal(
          (
            await editor.request(`/admin/professionals/${createdProfessional.id}`, 'PATCH', {
              version: 1,
              isActive: false,
            })
          ).status,
          200,
        );
        assert.equal((await visitor.request(`/professionals/${prefix}-professional`)).status, 404);
        assert.equal(
          (
            await editor.request(`/admin/practice-areas/${createdArea.id}`, 'DELETE', {
              version: 1,
            })
          ).status,
          409,
        );
        const pageResponse = await editor.request('/admin/pages', 'POST', {
          slug: `${prefix}-page`,
          title: 'Página fictícia',
          sections: [{ key: 'intro', heading: 'Introdução fictícia', body: content }],
        });
        assert.equal(pageResponse.status, 201);
        const createdPage = (await pageResponse.json()) as { id: string; version: number };
        assert.equal((await visitor.request(`/pages/${prefix}-page`)).status, 404);
        assert.equal(
          (
            await editor.request(`/admin/pages/${createdPage.id}/publication`, 'POST', {
              version: 1,
              status: 'PUBLISHED',
            })
          ).status,
          201,
        );
        const publicPage = (await (
          await visitor.request(`/pages/${prefix}-page`)
        ).json()) as PublicPage;
        assert.equal(publicPage.sections[0]?.key, 'intro');
        assert.doesNotMatch(JSON.stringify(publicPage), /isMock|status|version/u);
        assert.equal(
          (await editor.request(`/admin/pages/${createdPage.id}`, 'DELETE', { version: 2 })).status,
          400,
        );
        const faqResponse = await editor.request('/admin/faqs', 'POST', {
          question: 'Pergunta fictícia?',
          answer: content,
          practiceAreaId: createdArea.id,
        });
        assert.equal(faqResponse.status, 201);
        const createdFaq = (await faqResponse.json()) as { id: string };
        assert.equal((await visitor.request(`/faqs/${createdFaq.id}`)).status, 200);
        assert.equal(
          (
            await editor.request(`/admin/practice-areas/${createdArea.id}`, 'PATCH', {
              version: 1,
              isActive: false,
            })
          ).status,
          200,
        );
        assert.equal((await visitor.request(`/faqs/${createdFaq.id}`)).status, 404);
        const taxonomyResponse = await editor.request('/admin/taxonomies/tags', 'POST', {
          slug: `${prefix}-tag`,
          name: 'Tag fictícia',
          isActive: false,
        });
        assert.equal(taxonomyResponse.status, 201);
        assert.equal((await visitor.request(`/taxonomies/tags/${prefix}-tag`)).status, 404);
        assert.equal(
          (
            await editor.request('/admin/taxonomies/tags', 'POST', {
              slug: `${prefix}-tag`,
              name: 'Duplicada fictícia',
            })
          ).status,
          409,
        );
        const categories = await visitor.request('/taxonomies/categories');
        assert.equal(categories.status, 200);
        assert.ok(
          ((await categories.json()) as PaginatedResponse<TaxonomySummary>).data.length > 0,
        );
        for (const path of [
          '/professionals',
          '/practice-areas',
          '/pages',
          '/faqs',
          '/taxonomies/tags',
          '/admin/professionals',
          '/admin/practice-areas',
        ]) {
          assert.equal(
            (await (path.startsWith('/admin') ? editor : visitor).request(path)).status,
            200,
            path,
          );
        }
      },
    );
    await t.test(
      'settings and redirects require ADMIN, explicit fields, internal destinations and acyclic graphs',
      async () => {
        for (const path of ['/admin/settings', '/admin/redirects'])
          assert.equal((await editor.request(path)).status, 403);
        const current = (await (
          await admin.request('/admin/settings')
        ).json()) as PublicSiteSettings & { version: number };
        assert.equal(
          (
            await admin.request('/admin/settings', 'PATCH', {
              version: current.version,
              address: { street: 'Endereço fictício', secret: 'overpost' },
            })
          ).status,
          400,
        );
        const updated = await admin.request('/admin/settings', 'PATCH', {
          version: current.version,
          siteName: 'Portal fictício da integração',
          address: { city: 'Cidade fictícia' },
          socialLinks: [{ label: 'Exemplo fictício', url: 'https://example.invalid/social' }],
        });
        assert.equal(updated.status, 200);
        assert.equal(
          (
            await admin.request('/admin/settings', 'PATCH', {
              version: current.version,
              siteName: 'Versão antiga',
            })
          ).status,
          409,
        );
        const publicSettings = (await (
          await visitor.request('/settings')
        ).json()) as PublicSiteSettings;
        assert.equal(publicSettings.siteName, 'Portal fictício da integração');
        assert.deepEqual(publicSettings.address, { city: 'Cidade fictícia' });
        assert.doesNotMatch(JSON.stringify(publicSettings), /version|isMock/u);
        for (const targetPath of [
          'https://example.invalid/evil',
          '//example.invalid/evil',
          '/api/v1/auth/login',
          '/a/../b',
          '/%2e%2e/private',
          '/admin',
          '/target/',
        ])
          assert.equal(
            (
              await admin.request('/admin/redirects', 'POST', {
                sourcePath: `/${prefix}-invalid`,
                targetPath,
              })
            ).status,
            400,
            targetPath,
          );
        const first = await admin.request('/admin/redirects', 'POST', {
          sourcePath: `/${prefix}-a`,
          targetPath: `/${prefix}-b`,
        });
        assert.equal(first.status, 201);
        const created = (await first.json()) as { id: string; version: number };
        const loop = await admin.request('/admin/redirects', 'POST', {
          sourcePath: `/${prefix}-b`,
          targetPath: `/${prefix}-a`,
        });
        assert.equal(loop.status, 400);
        assert.equal(
          ((await loop.json()) as { error: { code: string } }).error.code,
          'REDIRECT_LOOP',
        );
        assert.equal(
          (
            await admin.request(`/admin/redirects/${created.id}`, 'PATCH', {
              version: 1,
              isActive: false,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await admin.request(`/admin/redirects/${created.id}`, 'PATCH', {
              version: 1,
              isActive: true,
            })
          ).status,
          409,
        );
        const [one, two] = await Promise.all([
          admin.request('/admin/redirects', 'POST', {
            sourcePath: `/${prefix}-x`,
            targetPath: `/${prefix}-y`,
          }),
          admin.request('/admin/redirects', 'POST', {
            sourcePath: `/${prefix}-y`,
            targetPath: `/${prefix}-x`,
          }),
        ]);
        assert.equal([one, two].filter((response) => response.status === 201).length, 1);
        assert.ok([one, two].some((response) => [400, 409].includes(response.status)));
      },
    );
    await t.test(
      'Swagger describes implemented routes, input DTOs and allowed public fields',
      async () => {
        const response = await fetch(`${base}/api/docs-json`);
        assert.equal(response.status, 200);
        const swagger = (await response.json()) as {
          paths: Record<
            string,
            {
              get?: {
                responses?: Record<
                  string,
                  {
                    content?: Record<string, { schema?: { properties?: Record<string, unknown> } }>;
                  }
                >;
              };
            }
          >;
        };
        assert.ok(swagger.paths['/api/v1/admin/articles/{id}/publication']);
        assert.ok(swagger.paths['/api/v1/taxonomies/{kind}']);
        const articleSchema =
          swagger.paths['/api/v1/articles/{slug}']?.get?.responses?.['200']?.content?.[
            'application/json'
          ]?.schema;
        assert.ok(articleSchema?.properties?.content);
        assert.ok(!articleSchema?.properties?.createdById);
        assert.ok(!swagger.paths['/api/v1/contacts']);
      },
    );
  } finally {
    await app.close();
  }
});
