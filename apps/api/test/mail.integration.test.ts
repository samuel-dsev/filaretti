import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Webhook } from 'svix';
import { createApplication } from '../src/app';
import { testEnvironment } from './helpers';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { PrismaService } from '../src/database/prisma.service';
import { RelationshipWorker } from '../src/relationship/email-worker.service';
import { decryptMail, encryptMail, queueEmail } from '../src/relationship/email-outbox';
import { PasswordRecoveryService } from '../src/auth/recovery.service';

test('F7 transactional mail protects tokens, resumes durable work and authenticates raw webhooks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'filaretti-f7-mail-'));
  const secret = `whsec_${randomBytes(32).toString('base64')}`;
  const logs: string[] = [];
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
    MAIL_LOCAL_PATH: root,
    RESEND_WEBHOOK_SECRET: secret,
    RELATIONSHIP_WORKER_ENABLED: false,
  });
  const app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const worker = app.get(RelationshipWorker);
  const token = randomBytes(32).toString('hex');
  const key = `mail-test:${randomUUID()}`;
  const mail = {
    kind: 'newsletter-confirm' as const,
    recipient: 'ficticio@example.invalid',
    token,
  };
  try {
    await t.test(
      'authenticated encryption conceals recipients/tokens and rejects tampering',
      () => {
        const encrypted = encryptMail(environment, mail, key);
        assert.equal(JSON.stringify(encrypted).includes(token), false);
        assert.equal(JSON.stringify(encrypted).includes(mail.recipient), false);
        assert.deepEqual(decryptMail(environment, encrypted, key), mail);
        assert.throws(() => decryptMail(environment, encrypted, `${key}-changed`));
        assert.throws(() =>
          decryptMail(
            { ...environment, PREVIEW_SECRET: 'other-local-secret-at-least-32-characters' },
            encrypted,
            key,
          ),
        );
      },
    );
    await t.test(
      'disabled recovery delivery has equal HTTP responses and creates no reset token or outbox entry',
      async () => {
        const disabled = await createApplication(
          testEnvironment({
            DATABASE_URL: process.env.DATABASE_URL,
            DATABASE_TIMEOUT_MS: 2000,
            MOCK_INTEGRATIONS: false,
            RELATIONSHIP_ENABLED: false,
            RESEND_ENABLED: false,
            TURNSTILE_ENABLED: false,
          }),
          new SanitizedLogger((line) => logs.push(line)),
        );
        await disabled.listen(0, '127.0.0.1');
        try {
          const existing = await db.user.findFirstOrThrow({ where: { isActive: true } });
          const beforeTokens = await db.passwordResetToken.count();
          const beforeMail = await db.outboxTask.count({ where: { topic: 'mail.send' } });
          const base = await disabled.getUrl();
          const csrf = await fetch(`${base}/api/v1/auth/csrf`);
          assert.equal(csrf.status, 200);
          const body = (await csrf.json()) as { csrfToken: string };
          const cookie = csrf.headers
            .getSetCookie()
            .map((value) => value.split(';')[0])
            .join('; ');
          const request = (email: string) =>
            fetch(`${base}/api/v1/auth/password/recovery`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
                'X-CSRF-Token': body.csrfToken,
                cookie,
              },
              body: JSON.stringify({ email }),
            });
          const known = await request(existing.email);
          const missing = await request(`missing-${randomUUID()}@example.invalid`);
          assert.equal(known.status, 202);
          assert.equal(missing.status, 202);
          assert.deepEqual(await known.json(), await missing.json());
          assert.equal(await db.passwordResetToken.count(), beforeTokens);
          assert.equal(await db.outboxTask.count({ where: { topic: 'mail.send' } }), beforeMail);
        } finally {
          await disabled.close();
        }
      },
    );
    await t.test(
      'password recovery queues atomically without returning or logging its token',
      async () => {
        const user = await db.user.findFirstOrThrow({ where: { isActive: true } });
        await app.get(PasswordRecoveryService).request(user.email);
        const reset = await db.passwordResetToken.findFirstOrThrow({
          where: { userId: user.id, usedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        const task = await db.outboxTask.findUniqueOrThrow({
          where: { idempotencyKey: `recovery:${reset.id}` },
        });
        const message = decryptMail(environment, task.payload, task.idempotencyKey);
        assert.equal(message.kind, 'recovery');
        assert.equal(message.recipient, user.email);
        assert.match(message.token!, /^[a-f0-9]{64}$/u);
        assert.equal(logs.join('').includes(message.token!), false);
        await Promise.all([worker.tick(), worker.tick()]);
        assert.equal(
          (await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } })).status,
          'COMPLETED',
        );
        const local = JSON.parse(await readFile(join(root, `${task.id}.json`), 'utf8')) as {
          payload: Parameters<typeof decryptMail>[1];
          idempotencyKey: string;
        };
        assert.equal(
          decryptMail(environment, local.payload, local.idempotencyKey).token,
          message.token,
        );
        assert.deepEqual(
          (await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } })).payload,
          { redacted: true },
        );
      },
    );
    await t.test(
      'local encrypted captures and private HTML expire while recent and unrelated files remain',
      async () => {
        const expiredId = randomUUID();
        const recentId = randomUUID();
        const files = [
          `${expiredId}.json`,
          `${expiredId}.html`,
          `${recentId}.json`,
          'unrelated.json',
        ];
        for (const name of files) await writeFile(join(root, name), 'private local fixture');
        const old = new Date(Date.now() - 8 * 86400000);
        for (const name of [`${expiredId}.json`, `${expiredId}.html`, 'unrelated.json'])
          await utimes(join(root, name), old, old);
        await worker.tick();
        const kept = await readdir(root);
        assert.equal(kept.includes(`${expiredId}.json`), false);
        assert.equal(kept.includes(`${expiredId}.html`), false);
        assert.equal(kept.includes(`${recentId}.json`), true);
        assert.equal(kept.includes('unrelated.json'), true);
      },
    );
    await t.test('stale processing lease resumes once across two worker instances', async () => {
      const other = await createApplication(environment, new SanitizedLogger(() => undefined));
      await other.init();
      try {
        const task = await db.$transaction((tx) =>
          queueEmail(
            tx,
            environment,
            { kind: 'contact', recipient: 'ficticio@example.invalid', contactId: randomUUID() },
            `resume:${randomUUID()}`,
          ),
        );
        await db.outboxTask.update({
          where: { id: task.id },
          data: {
            status: 'PROCESSING',
            lockedAt: new Date(Date.now() - 10 * 60000),
            lockedBy: 'crashed-instance',
            attempts: 1,
          },
        });
        await Promise.all([worker.tick(), other.get(RelationshipWorker).tick()]);
        const final = await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } });
        assert.equal(final.status, 'COMPLETED');
        assert.equal(final.attempts, 2);
      } finally {
        await other.close();
      }
    });
    await t.test(
      'invalid envelopes retry with bounded attempts and sanitized error codes',
      async () => {
        const task = await db.outboxTask.create({
          data: {
            topic: 'mail.send',
            payload: { invalid: true },
            idempotencyKey: `failure:${randomUUID()}`,
            maxAttempts: 2,
          },
        });
        await worker.tick();
        let failed = await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } });
        assert.equal(failed.status, 'PENDING');
        assert.equal(failed.lastErrorCode, 'MAIL_DELIVERY_FAILED');
        await db.outboxTask.update({ where: { id: task.id }, data: { availableAt: new Date() } });
        await worker.tick();
        failed = await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } });
        assert.equal(failed.status, 'FAILED');
        assert.equal(failed.attempts, 2);
      },
    );
    await t.test(
      'raw webhook signature, timestamp and event deduplication are enforced over HTTP',
      async () => {
        const id = `msg_${randomUUID()}`;
        const raw = '{ "type": "email.delivered", "data": {"email_id":"fictitious-email"} }';
        const timestamp = new Date();
        const headers = {
          'Content-Type': 'application/json',
          'svix-id': id,
          'svix-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
          'svix-signature': new Webhook(secret).sign(id, timestamp, raw),
        };
        const send = (body: string, h: Record<string, string> = headers) =>
          fetch(`${awaitableUrl}/api/v1/webhooks/resend`, { method: 'POST', headers: h, body });
        const awaitableUrl = await app.getUrl();
        assert.equal((await send(raw)).status, 200);
        assert.equal((await send(raw)).status, 200);
        assert.equal(await db.mailWebhookEvent.count({ where: { id } }), 1);
        assert.equal((await send(JSON.stringify(JSON.parse(raw)))).status, 401);
        const old = new Date(Date.now() - 600000);
        assert.equal(
          (
            await send(raw, {
              ...headers,
              'svix-timestamp': String(Math.floor(old.getTime() / 1000)),
              'svix-signature': new Webhook(secret).sign(id, old, raw),
            })
          ).status,
          401,
        );
        assert.equal((await send(raw, { ...headers, 'svix-signature': 'v1,invalid' })).status, 401);
        assert.equal(logs.join('').includes(secret), false);
      },
    );
    assert.ok((await readdir(root)).length > 0);
  } finally {
    await app.close();
    const target = resolve(root);
    assert.ok(target.startsWith(resolve(tmpdir()) + sep));
    await rm(target, { recursive: true, force: true });
  }
});
