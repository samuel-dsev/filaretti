import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { ContactScanStatus, UserRole } from '@prisma/client';
import type {
  AdminContact,
  AdminSubscriber,
  AuthenticationResponse,
  ContactDownloadIssued,
  CsrfResponse,
  PaginatedResponse,
} from '@filaretti/types';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { hashPassword } from '../src/auth/password';
import { tokenHash } from '../src/auth/cookies';
import { RelationshipService } from '../src/relationship/relationship.service';
import { RelationshipRateLimiter } from '../src/relationship/rate-limit.service';
import { TurnstileService } from '../src/relationship/turnstile.service';
import { RelationshipWorker } from '../src/relationship/email-worker.service';
import { decryptMail } from '../src/relationship/email-outbox';
import { testEnvironment } from './helpers';

class Browser {
  private readonly cookies = new Map<string, string>();
  private csrf = '';
  constructor(
    private readonly base: string,
    private readonly origin: string,
  ) {}
  async request(path: string, method = 'GET', body?: unknown) {
    const multipart = body instanceof FormData;
    const response = await fetch(`${this.base}/api/v1${path}`, {
      method,
      headers: {
        Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(method === 'GET' ? {} : { Origin: this.origin, 'X-CSRF-Token': this.csrf }),
        ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }),
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
}

test('F7 contact, private downloads, double opt-in, quotas and retention use PostgreSQL', async (t) => {
  assert.ok(process.env.DATABASE_URL);
  const storageRoot = await mkdtemp(join(tmpdir(), 'filaretti-f7-'));
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
    STORAGE_LOCAL_PATH: join(storageRoot, 'storage'),
    MAIL_LOCAL_PATH: join(storageRoot, 'mail'),
    MOCK_INTEGRATIONS: true,
    RELATIONSHIP_WORKER_ENABLED: false,
  });
  const logs: string[] = [];
  const app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const relationship = app.get(RelationshipService);
  const worker = app.get(RelationshipWorker);
  const prefix = `f7-${randomUUID()}`;
  const password = 'F7-Fictitious-Test!2026';
  const passwordHash = await hashPassword(password);
  const adminUser = await db.user.create({
    data: {
      name: 'Administrador fictício F7',
      email: `${prefix}-admin@example.invalid`,
      role: UserRole.ADMIN,
      passwordHash,
      isMock: true,
    },
  });
  const editorUser = await db.user.create({
    data: {
      name: 'Editor fictício F7',
      email: `${prefix}-editor@example.invalid`,
      role: UserRole.EDITOR,
      passwordHash,
      isMock: true,
    },
  });
  const base = await app.getUrl();
  const origin = environment.WEB_PUBLIC_URL;
  const admin = new Browser(base, origin);
  const secondSession = new Browser(base, origin);
  const editor = new Browser(base, origin);
  const visitor = new Browser(base, origin);
  await admin.login(adminUser.email, password);
  await secondSession.login(adminUser.email, password);
  await editor.login(editorUser.email, password);
  const png = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#102A43' } })
    .png()
    .toBuffer();
  const contactKey = randomUUID();
  let contact: AdminContact;
  let subscriber: AdminSubscriber;
  let confirmation = '';
  let unsubscribe = '';
  const email = `${prefix}-subscriber@example.invalid`;
  const data = (key = contactKey, attachments = true) => {
    const form = new FormData();
    const fields = {
      name: 'Pessoa fictícia F7',
      email: `${prefix}-contact@example.invalid`,
      subject: 'Contato fictício para verificação',
      message: 'Mensagem fictícia criada exclusivamente para testes.',
      privacyAccepted: 'true',
      newsletterConsent: 'false',
      turnstileToken: 'local-development-contact',
      idempotencyKey: key,
    };
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    if (attachments)
      form.append(
        'attachments',
        new Blob([new Uint8Array(png)], { type: 'image/png' }),
        'imagem-ficticia.png',
      );
    return form;
  };
  try {
    await t.test(
      'public intake persists once, queues encrypted mail and excludes attachment from public media',
      async () => {
        const response = await visitor.request('/public/contact', 'POST', data());
        assert.equal(response.status, 202);
        const accepted: unknown = await response.json();
        assert.deepEqual(Object.keys(accepted as object).sort(), ['accepted', 'message']);
        const stored = await db.contact.findUniqueOrThrow({
          where: { idempotencyKey: contactKey },
          include: { files: true },
        });
        assert.equal(stored.files.length, 1);
        assert.equal(stored.files[0]!.scanStatus, 'LOCAL_VERIFIED');
        const mail = await db.outboxTask.findUniqueOrThrow({
          where: { idempotencyKey: `contact-notification:${stored.id}` },
        });
        assert.equal(JSON.stringify(mail.payload).includes(stored.email), false);
        assert.equal(
          (await visitor.request(`/media/public/${stored.files[0]!.storageKey}`)).status,
          404,
        );
        assert.equal(await db.newsletterSubscriber.count({ where: { email: stored.email } }), 0);
        assert.equal((await visitor.request('/public/contact', 'POST', data())).status, 202);
        assert.equal(await db.contact.count({ where: { idempotencyKey: contactKey } }), 1);
        const modified = data();
        modified.set('message', 'Outra mensagem fictícia com a mesma chave de idempotência.');
        assert.equal((await visitor.request('/public/contact', 'POST', modified)).status, 409);
        contact = (await (
          await admin.request(`/admin/contacts/${stored.id}`)
        ).json()) as AdminContact;
        assert.equal(JSON.stringify(contact).includes('storageKey'), false);
        await worker.tick();
        const delivered = await db.outboxTask.findUniqueOrThrow({ where: { id: mail.id } });
        assert.equal(delivered.status, 'COMPLETED');
        assert.ok(await stat(join(storageRoot, 'mail', `${mail.id}.json`)));
        assert.deepEqual(delivered.payload, { redacted: true });
      },
    );

    await t.test('ADMIN permissions and optimistic concurrency protect contacts', async () => {
      assert.equal((await visitor.request('/admin/contacts')).status, 401);
      assert.equal((await editor.request('/admin/contacts')).status, 403);
      assert.equal(
        (
          await admin.request(`/admin/contacts/${contact.id}`, 'PATCH', {
            status: 'IN_PROGRESS',
            version: contact.version,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await admin.request(`/admin/contacts/${contact.id}`, 'PATCH', {
            status: 'RESOLVED',
            version: contact.version,
          })
        ).status,
        409,
      );
      contact = await relationship.contactDetail(contact.id);
      assert.equal(contact.status, 'IN_PROGRESS');
    });

    await t.test(
      'download tickets bind session, expire, have single use and block quarantine',
      async () => {
        const route = `/admin/contacts/${contact.id}/attachments/${contact.attachments[0]!.id}/download-ticket`;
        const ticket = (await (
          await admin.request(route, 'POST', {})
        ).json()) as ContactDownloadIssued;
        assert.equal((await secondSession.request(ticket.url.replace('/api/v1', ''))).status, 404);
        assert.equal((await visitor.request(ticket.url.replace('/api/v1', ''))).status, 401);
        const download = await admin.request(ticket.url.replace('/api/v1', ''));
        assert.equal(download.status, 200);
        assert.equal(download.headers.get('cache-control'), 'private, no-store');
        assert.ok(download.headers.get('content-disposition')?.startsWith('attachment;'));
        assert.ok((await download.arrayBuffer()).byteLength > 0);
        assert.equal((await admin.request(ticket.url.replace('/api/v1', ''))).status, 404);
        const expired = (await (
          await admin.request(route, 'POST', {})
        ).json()) as ContactDownloadIssued;
        await db.contactDownloadTicket.updateMany({
          where: { fileId: contact.attachments[0]!.id, usedAt: null },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal((await admin.request(expired.url.replace('/api/v1', ''))).status, 404);
        await db.contactFile.update({
          where: { id: contact.attachments[0]!.id },
          data: { scanStatus: ContactScanStatus.QUARANTINED },
        });
        assert.equal((await admin.request(route, 'POST', {})).status, 403);
        await db.contactFile.update({
          where: { id: contact.attachments[0]!.id },
          data: { scanStatus: ContactScanStatus.LOCAL_VERIFIED },
        });
      },
    );

    await t.test(
      'missing privacy, unexpected fields, invalid MIME and wrong antispam action are rejected',
      async () => {
        const privacy = data(randomUUID(), false);
        privacy.set('privacyAccepted', 'false');
        assert.equal((await visitor.request('/public/contact', 'POST', privacy)).status, 400);
        const fields = data(randomUUID(), false);
        fields.set('status', 'RESOLVED');
        assert.equal((await visitor.request('/public/contact', 'POST', fields)).status, 400);
        const fake = data(randomUUID(), false);
        fake.append(
          'attachments',
          new Blob(['<html>ativo</html>'], { type: 'image/png' }),
          'arquivo.png',
        );
        assert.equal((await visitor.request('/public/contact', 'POST', fake)).status, 400);
        const wrongAction = data(randomUUID(), false);
        wrongAction.set('turnstileToken', 'local-development-newsletter');
        assert.equal((await visitor.request('/public/contact', 'POST', wrongAction)).status, 503);
        await assert.rejects(() =>
          new TurnstileService({ ...environment, MOCK_INTEGRATIONS: false }).verify(
            'local-development-contact',
            'contact',
            '127.0.0.1',
          ),
        );
        await assert.rejects(() =>
          new TurnstileService({
            ...environment,
            WEB_PUBLIC_URL: 'https://fictitious.example.invalid',
          }).verify('local-development-contact', 'contact', '127.0.0.1'),
        );
      },
    );

    await t.test('file count and aggregate quota reject before persistence', async () => {
      const dto = {
        name: 'Pessoa fictícia',
        email: `${prefix}-quota@example.invalid`,
        subject: 'Quota fictícia',
        message: 'Mensagem fictícia para verificar limite.',
        privacyAccepted: true as const,
        turnstileToken: 'local-development-contact',
        idempotencyKey: randomUUID(),
      };
      const file = {
        originalname: 'arquivo.pdf',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024,
        buffer: Buffer.alloc(6 * 1024 * 1024),
      };
      await assert.rejects(() => relationship.contact(dto, [file, file, file], 'quota-test'));
      await assert.rejects(() => relationship.contact(dto, [file, file, file, file], 'quota-test'));
      assert.equal(await db.contact.count({ where: { email: dto.email } }), 0);
    });

    await t.test(
      'subscription requires separate consent, remains PENDING and limits resend without enumeration',
      async () => {
        assert.equal(
          (
            await visitor.request('/public/newsletter/subscribe', 'POST', {
              email,
              consent: false,
              turnstileToken: 'local-development-newsletter',
            })
          ).status,
          400,
        );
        const subscription = {
          email,
          name: '=HYPERLINK("example.invalid")',
          consent: true,
          turnstileToken: 'local-development-newsletter',
        };
        const response = await visitor.request(
          '/public/newsletter/subscribe',
          'POST',
          subscription,
        );
        assert.equal(response.status, 202);
        const responseBody: unknown = await response.json();
        const repeated = await visitor.request(
          '/public/newsletter/subscribe',
          'POST',
          subscription,
        );
        assert.equal(repeated.status, 202);
        assert.deepEqual(await repeated.json(), responseBody);
        const stored = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
        assert.equal(stored.status, 'PENDING');
        subscriber = (await relationship.subscribers({ page: 1, limit: 12, q: email })).data[0]!;
        assert.equal(JSON.stringify(subscriber).includes('consentIpHash'), false);
        assert.equal(
          await db.newsletterToken.count({
            where: { subscriberId: stored.id, purpose: 'CONFIRM', usedAt: null },
          }),
          1,
        );
        const mail = await db.outboxTask.findFirstOrThrow({
          where: { idempotencyKey: { startsWith: `newsletter-confirm:${stored.id}:` } },
        });
        confirmation = decryptMail(environment, mail.payload, mail.idempotencyKey).token!;
        assert.equal(
          (await db.newsletterToken.findFirstOrThrow({ where: { subscriberId: stored.id } }))
            .tokenHash,
          tokenHash(environment, confirmation),
        );
      },
    );

    await t.test(
      'confirmation token purpose, expiry and concurrent consumption are enforced',
      async () => {
        assert.equal(
          (await visitor.request('/public/newsletter/unsubscribe', 'POST', { token: confirmation }))
            .status,
          400,
        );
        const responses = await Promise.all([
          visitor.request('/public/newsletter/confirm', 'POST', { token: confirmation }),
          visitor.request('/public/newsletter/confirm', 'POST', { token: confirmation }),
        ]);
        assert.deepEqual(responses.map((response) => response.status).sort(), [200, 400]);
        assert.equal(
          (await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status,
          'ACTIVE',
        );
        const mail = await db.outboxTask.findFirstOrThrow({
          where: { idempotencyKey: { startsWith: `newsletter-unsubscribe:${subscriber.id}:` } },
        });
        unsubscribe = decryptMail(environment, mail.payload, mail.idempotencyKey).token!;
        const expired = randomBytes(32).toString('hex');
        await db.newsletterToken.create({
          data: {
            subscriberId: subscriber.id,
            purpose: 'UNSUBSCRIBE',
            tokenHash: tokenHash(environment, expired),
            expiresAt: new Date(Date.now() - 1000),
          },
        });
        assert.equal(
          (await visitor.request('/public/newsletter/unsubscribe', 'POST', { token: expired }))
            .status,
          400,
        );
      },
    );

    await t.test(
      'ACTIVE subscribers recover expired unsubscribe links without changing consent or status',
      async () => {
        const before = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
        await db.newsletterToken.updateMany({
          where: { subscriberId: before.id, purpose: 'UNSUBSCRIBE' },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal(
          (await visitor.request('/public/newsletter/unsubscribe', 'POST', { token: unsubscribe }))
            .status,
          400,
        );
        await db.newsletterSubscriber.update({
          where: { id: before.id },
          data: { confirmationSentAt: new Date(Date.now() - 11 * 60000) },
        });
        const response = await visitor.request('/public/newsletter/subscribe', 'POST', {
          email,
          consent: true,
          turnstileToken: 'local-development-newsletter',
        });
        assert.equal(response.status, 202);
        const after = await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } });
        assert.equal(after.status, 'ACTIVE');
        assert.equal(after.consentVersion, before.consentVersion);
        assert.equal(after.consentedAt.getTime(), before.consentedAt.getTime());
        const mail = await db.outboxTask.findFirstOrThrow({
          where: { idempotencyKey: { startsWith: `newsletter-unsubscribe:${before.id}:` } },
          orderBy: { createdAt: 'desc' },
        });
        unsubscribe = decryptMail(environment, mail.payload, mail.idempotencyKey).token!;
        const token = await db.newsletterToken.findUniqueOrThrow({
          where: { tokenHash: tokenHash(environment, unsubscribe) },
        });
        assert.ok(token.expiresAt > new Date());
        assert.equal(token.usedAt, null);
      },
    );

    await t.test('only ADMIN exports formula-safe CSV and accesses subscribers', async () => {
      assert.equal((await visitor.request('/admin/subscribers/export')).status, 401);
      assert.equal((await editor.request('/admin/subscribers/export')).status, 403);
      const response = await admin.request(
        `/admin/subscribers/export?q=${encodeURIComponent(email)}`,
      );
      assert.equal(response.status, 200);
      const csv = await response.text();
      assert.ok(csv.includes('"\'=HYPERLINK('));
      assert.equal(
        (await admin.request(`/admin/subscribers/${subscriber.id}`, 'DELETE', { version: 999 }))
          .status,
        409,
      );
      const list = (await (
        await admin.request(`/admin/subscribers?q=${encodeURIComponent(email)}`)
      ).json()) as PaginatedResponse<AdminSubscriber>;
      assert.equal(list.data.length, 1);
    });

    await t.test(
      'unsubscribe consumes one token, stops old mail and persists a transactional acknowledgment',
      async () => {
        assert.equal(
          (await visitor.request('/public/newsletter/unsubscribe', 'POST', { token: unsubscribe }))
            .status,
          200,
        );
        assert.equal(
          (await db.newsletterSubscriber.findUniqueOrThrow({ where: { email } })).status,
          'UNSUBSCRIBED',
        );
        assert.equal(
          (await visitor.request('/public/newsletter/unsubscribe', 'POST', { token: unsubscribe }))
            .status,
          400,
        );
        const mail = await db.outboxTask.findFirstOrThrow({
          where: {
            idempotencyKey: { startsWith: `newsletter-unsubscribe:${subscriber.id}:confirmation:` },
          },
        });
        assert.equal(decryptMail(environment, mail.payload, mail.idempotencyKey).token, undefined);
      },
    );

    await t.test('rate counters are shared and serialized across limiter instances', async () => {
      const key = `${prefix}-rate`;
      const left = new RelationshipRateLimiter(db, environment);
      const right = new RelationshipRateLimiter(db, environment);
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, (_, index) =>
          (index % 2 ? left : right).consume('integration-rate', key, 5),
        ),
      );
      assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 5);
      assert.equal(attempts.filter((item) => item.status === 'rejected').length, 3);
    });

    await t.test(
      'retention preserves ACTIVE subscribers and durably removes stale contacts and orphaned files',
      async () => {
        const aged = new Date(Date.now() - 400 * 86400000);
        await db.contact.update({ where: { id: contact.id }, data: { createdAt: aged } });
        await db.newsletterSubscriber.update({
          where: { id: subscriber.id },
          data: { updatedAt: aged },
        });
        const active = await db.newsletterSubscriber.create({
          data: {
            email: `${prefix}-active@example.invalid`,
            consentVersion: 'f7-test',
            consentedAt: aged,
            confirmedAt: aged,
            status: 'ACTIVE',
            updatedAt: aged,
            isMock: true,
          },
        });
        const orphan = await db.contactFile.create({
          data: {
            storageKey: `${randomUUID()}.png`,
            storageDriver: 'local',
            filename: 'temporario-ficticio.png',
            mimeType: 'image/png',
            size: 1,
            expiresAt: new Date(Date.now() - 1000),
          },
        });
        const result = await relationship.purgeExpired();
        assert.ok(result.contacts >= 1);
        assert.ok(result.subscribers >= 1);
        assert.ok(result.temporaryFiles >= 1);
        assert.equal(await db.contact.findUnique({ where: { id: contact.id } }), null);
        assert.equal(
          await db.newsletterSubscriber.findUnique({ where: { id: subscriber.id } }),
          null,
        );
        assert.ok(await db.newsletterSubscriber.findUnique({ where: { id: active.id } }));
        assert.equal(await db.contactFile.findUnique({ where: { id: orphan.id } }), null);
        assert.equal(
          await db.outboxTask.count({
            where: {
              idempotencyKey: { startsWith: `contact-file-delete:${contact.attachments[0]!.id}` },
            },
          }),
          1,
        );
        await worker.tick();
        const deletion = await db.outboxTask.findUniqueOrThrow({
          where: { idempotencyKey: `contact-file-delete:${contact.attachments[0]!.id}` },
        });
        assert.equal(deletion.status, 'COMPLETED');
        assert.equal(JSON.stringify(logs).includes(email), false);
        assert.equal(JSON.stringify(logs).includes(confirmation), false);
      },
    );
  } finally {
    await app.close();
    const temp = resolve(tmpdir());
    const target = resolve(storageRoot);
    assert.ok(target.startsWith(`${temp}${sep}`) && target !== temp);
    const directory = await stat(target).catch(() => null);
    if (directory) await rm(target, { recursive: true, force: true });
  }
});
