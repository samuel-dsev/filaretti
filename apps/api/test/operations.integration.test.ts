import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import type { AuthenticationResponse, CsrfResponse } from '@filaretti/types';
import { UserRole } from '@prisma/client';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_COOKIES } from '../src/auth/cookies';
import { hashPassword } from '../src/auth/password';
import { RelationshipWorker } from '../src/relationship/email-worker.service';
import { testEnvironment } from './helpers';

test('F8 trusted visitors, private operations and scanner outage use real PostgreSQL/HTTP', async (t) => {
  assert.ok(process.env.DATABASE_URL);
  const storageRoot = await mkdtemp(join(tmpdir(), 'filaretti-f8-operations-'));
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
    STORAGE_LOCAL_PATH: join(storageRoot, 'storage'),
    MAIL_LOCAL_PATH: join(storageRoot, 'mail'),
    BFF_CLIENT_IP_SECRET: 'bc'.repeat(32),
    CONTACT_SCANNER_DRIVER: 'clamav',
    CLAMAV_HOST: '127.0.0.1',
    CLAMAV_PORT: 1,
    CLAMAV_TIMEOUT_MS: 100,
  });
  const logs: string[] = [];
  const app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService);
  const auth = app.get(AuthService);
  const base = await app.getUrl();
  const prefix = `f8-${randomUUID()}`;
  const password = 'F8-Fictitious-Test!2026';
  const passwordHash = await hashPassword(password);
  const admin = await db.user.create({
    data: {
      name: 'Administrador fictício F8',
      email: `${prefix}-admin@example.invalid`,
      passwordHash,
      role: UserRole.ADMIN,
      isMock: true,
    },
  });
  const editor = await db.user.create({
    data: {
      name: 'Editor fictício F8',
      email: `${prefix}-editor@example.invalid`,
      passwordHash,
      role: UserRole.EDITOR,
      isMock: true,
    },
  });
  const adminSession = await auth.login(admin.email, password, '198.51.100.21');
  const editorSession = await auth.login(editor.email, password, '198.51.100.22');
  const adminCookie = `${AUTH_COOKIES.access}=${adminSession.accessToken}`;
  const editorCookie = `${AUTH_COOKIES.access}=${editorSession.accessToken}`;
  const signed = (path: string, ip: string) => {
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', Buffer.from(environment.BFF_CLIENT_IP_SECRET!, 'hex'))
      .update(`${timestamp}\nPOST\n/api/v1${path}\n${ip}`)
      .digest('hex');
    return {
      Origin: environment.WEB_PUBLIC_URL,
      'x-filaretti-client-ip': ip,
      'x-filaretti-client-timestamp': timestamp,
      'x-filaretti-client-signature': signature,
    };
  };
  try {
    await t.test(
      'ADMIN only metrics exclude task payloads, IDs, errors and personal data',
      async () => {
        const marker = 'fictitious-sensitive-observability-marker';
        await db.outboxTask.create({
          data: {
            topic: 'mail.send',
            idempotencyKey: `${prefix}-failed`,
            status: 'FAILED',
            payload: { marker },
            lastErrorCode: marker,
          },
        });
        await db.outboxTask.create({
          data: {
            topic: marker,
            idempotencyKey: `${prefix}-unknown`,
            status: 'FAILED',
            payload: { marker },
          },
        });
        assert.equal((await fetch(`${base}/api/v1/admin/operations`)).status, 401);
        assert.equal(
          (await fetch(`${base}/api/v1/admin/operations`, { headers: { Cookie: editorCookie } }))
            .status,
          403,
        );
        const response = await fetch(`${base}/api/v1/admin/operations`, {
          headers: { Cookie: adminCookie },
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        const snapshot = await response.text();
        assert.equal(snapshot.includes(marker), false);
        assert.equal(snapshot.includes(admin.email), false);
        assert.equal(snapshot.includes(admin.id), false);
        const parsed = JSON.parse(snapshot) as {
          status: string;
          alerts: { exhaustedTasks: number };
          queues: unknown[];
        };
        assert.equal(parsed.status, 'attention');
        assert.ok(parsed.alerts.exhaustedTasks >= 1);
        assert.equal(parsed.queues.length, 4);
      },
    );
    await t.test(
      'signed visitors have independent PostgreSQL counters and forged headers cannot change identity',
      async () => {
        for (let index = 0; index < 10; index++) {
          const response = await fetch(`${base}/api/v1/public/contact`, {
            method: 'POST',
            headers: {
              ...signed('/public/contact', '198.51.100.23'),
              'Content-Type': 'application/json',
            },
            body: '{}',
          });
          assert.equal(response.status, 400);
        }
        assert.equal(
          (
            await fetch(`${base}/api/v1/public/contact`, {
              method: 'POST',
              headers: {
                ...signed('/public/contact', '198.51.100.23'),
                'Content-Type': 'application/json',
              },
              body: '{}',
            })
          ).status,
          429,
        );
        assert.equal(
          (
            await fetch(`${base}/api/v1/public/contact`, {
              method: 'POST',
              headers: {
                ...signed('/public/contact', '198.51.100.24'),
                'Content-Type': 'application/json',
              },
              body: '{}',
            })
          ).status,
          400,
        );
        const forged = signed('/public/contact', '198.51.100.24');
        forged['x-filaretti-client-ip'] = '198.51.100.25';
        assert.equal(
          (
            await fetch(`${base}/api/v1/public/contact`, {
              method: 'POST',
              headers: { ...forged, 'Content-Type': 'application/json' },
              body: '{}',
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'unavailable scanner persists quarantine and ADMIN cannot obtain a download ticket',
      async () => {
        const png = await sharp({
          create: { width: 24, height: 24, channels: 3, background: '#102A43' },
        })
          .png()
          .toBuffer();
        const key = randomUUID();
        const form = new FormData();
        for (const [field, value] of Object.entries({
          name: 'Pessoa fictícia F8',
          email: `${prefix}-contact@example.invalid`,
          subject: 'Quarentena fictícia',
          message: 'Mensagem fictícia para indisponibilidade do scanner.',
          privacyAccepted: 'true',
          turnstileToken: 'local-development-contact',
          idempotencyKey: key,
        }))
          form.set(field, value);
        form.append(
          'attachments',
          new Blob([new Uint8Array(png)], { type: 'image/png' }),
          'ficticio.png',
        );
        assert.equal(
          (
            await fetch(`${base}/api/v1/public/contact`, {
              method: 'POST',
              headers: signed('/public/contact', '198.51.100.26'),
              body: form,
            })
          ).status,
          202,
        );
        const contact = await db.contact.findUniqueOrThrow({
          where: { idempotencyKey: key },
          include: { files: true },
        });
        assert.equal(contact.files[0]!.scanStatus, 'QUARANTINED');
        const response = await fetch(
          `${base}/api/v1/admin/contacts/${contact.id}/attachments/${contact.files[0]!.id}/download-ticket`,
          {
            method: 'POST',
            headers: {
              Cookie: `${adminCookie}; ${AUTH_COOKIES.csrf}=${adminSession.csrfToken}`,
              Origin: environment.WEB_PUBLIC_URL,
              'X-CSRF-Token': adminSession.csrfToken,
              'Content-Type': 'application/json',
            },
            body: '{}',
          },
        );
        assert.equal(response.status, 403);
        assert.equal(
          ((await response.json()) as { error: { code: string } }).error.code,
          'ATTACHMENT_QUARANTINED',
        );
        assert.equal(
          (await fetch(`${base}/api/v1/media/public/${contact.files[0]!.storageKey}`)).status,
          404,
        );
      },
    );
    await t.test(
      'last delivery failure becomes a durable exhausted-task alert without payload logging',
      async () => {
        const task = await db.outboxTask.create({
          data: {
            topic: 'mail.send',
            idempotencyKey: `${prefix}-exhaust`,
            attempts: 4,
            maxAttempts: 5,
            payload: { malformed: 'fictitious-private-worker-payload' },
          },
        });
        await app.get(RelationshipWorker).tick();
        assert.equal(
          (await db.outboxTask.findUniqueOrThrow({ where: { id: task.id } })).status,
          'FAILED',
        );
        const response = await fetch(`${base}/api/v1/admin/operations`, {
          headers: { Cookie: adminCookie },
        });
        const body = (await response.json()) as {
          status: string;
          alerts: { exhaustedTasks: number; quarantinedAttachments: number };
        };
        assert.equal(body.status, 'attention');
        assert.ok(body.alerts.exhaustedTasks >= 2);
        assert.ok(body.alerts.quarantinedAttachments >= 1);
        assert.equal(logs.join('\n').includes('fictitious-private-worker-payload'), false);
        assert.equal(logs.join('\n').includes(admin.email), false);
      },
    );
    await t.test(
      'authentication mutation uses signed client IP before consuming login quota',
      async () => {
        const csrf = await fetch(`${base}/api/v1/auth/csrf`);
        const token = ((await csrf.json()) as CsrfResponse).csrfToken;
        const cookie = csrf.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        const response = await fetch(`${base}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            ...signed('/auth/login', '198.51.100.27'),
            Cookie: cookie,
            'X-CSRF-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: admin.email, password }),
        });
        assert.equal(response.status, 200);
        const body = (await response.json()) as AuthenticationResponse;
        assert.equal(body.user.id, admin.id);
      },
    );
  } finally {
    await app.close();
    const target = resolve(storageRoot);
    assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`));
    await rm(target, { recursive: true, force: true });
  }
});
