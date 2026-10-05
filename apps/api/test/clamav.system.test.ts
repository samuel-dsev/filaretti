import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Client } from 'pg';
import sharp from 'sharp';
import { UserRole } from '@prisma/client';
import { createApplication } from '../src/app';
import { PrismaService } from '../src/database/prisma.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_COOKIES } from '../src/auth/cookies';
import { hashPassword } from '../src/auth/password';
import { AttachmentScanner } from '../src/relationship/attachment-scanner';
import { testEnvironment } from './helpers';

// Invoked explicitly after starting a real, private ClamD. Never joins the ordinary CI suite.
test(
  'real ClamAV clean/infected intake and downloads use an owned PostgreSQL database',
  { timeout: 120000 },
  async () => {
    assert.equal(process.env.APP_ENV, 'development', 'Use an isolated development/CI environment.');
    assert.ok(process.env.DATABASE_URL, 'Configure a local PostgreSQL connection internally.');
    assert.ok(
      process.env.F8_CLAMAV_PORT,
      'Start a real private ClamD and configure F8_CLAMAV_PORT.',
    );
    const databaseName = `filaretti_clamav_test_${randomUUID().replaceAll('-', '')}`;
    assert.match(databaseName, /^filaretti_clamav_test_[a-f0-9]{32}$/u);
    const baseUrl = new URL(process.env.DATABASE_URL);
    const testUrl = new URL(baseUrl);
    testUrl.pathname = `/${databaseName}`;
    const operator = new Client({ connectionString: baseUrl.href, connectionTimeoutMillis: 5000 });
    const storageRoot = await mkdtemp(join(tmpdir(), 'filaretti-f8-clamav-'));
    let created = false;
    let app: Awaited<ReturnType<typeof createApplication>> | undefined;
    try {
      await operator.connect().catch(() => {
        throw new Error('Local PostgreSQL unavailable.');
      });
      await operator.query(`CREATE DATABASE "${databaseName}"`);
      created = true;
      const migrationClient = new Client({ connectionString: testUrl.href });
      try {
        await migrationClient.connect();
        const directory = resolve('prisma/migrations');
        const entries = (await readdir(directory, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory())
          .sort((left, right) => left.name.localeCompare(right.name));
        for (const entry of entries)
          await migrationClient.query(
            await readFile(join(directory, entry.name, 'migration.sql'), 'utf8'),
          );
      } finally {
        await migrationClient.end();
      }
      const environment = testEnvironment({
        DATABASE_URL: testUrl.href,
        STORAGE_LOCAL_PATH: join(storageRoot, 'storage'),
        MAIL_LOCAL_PATH: join(storageRoot, 'mail'),
        DATABASE_TIMEOUT_MS: 2000,
        CONTACT_SCANNER_DRIVER: 'clamav',
        CLAMAV_HOST: '127.0.0.1',
        CLAMAV_PORT: Number(process.env.F8_CLAMAV_PORT),
        CLAMAV_TIMEOUT_MS: 10000,
      });
      const logs: string[] = [];
      app = await createApplication(environment, new SanitizedLogger((line) => logs.push(line)));
      await app.listen(0, '127.0.0.1');
      const scanner = app.get(AttachmentScanner);
      const db = app.get(PrismaService);
      const png = await sharp({
        create: { width: 24, height: 24, channels: 3, background: '#102A43' },
      })
        .png()
        .toBuffer();
      const eicar = Buffer.from(
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
        'base64',
      );
      assert.equal(await scanner.scan(png), 'CLEAN', 'The real daemon must accept a benign PNG.');
      assert.equal(
        await scanner.scan(eicar),
        'INFECTED',
        'The real daemon must detect the standard EICAR test string.',
      );
      // A test-only real-engine signature targets this marker. EICAR's standard standalone
      // signature is not guaranteed to match arbitrary bytes appended to a PNG container.
      const infectedPng = Buffer.concat([png, Buffer.from('F8-ANTIVIRUS-FIXTURE')]);
      assert.equal(
        await scanner.scan(infectedPng),
        'INFECTED',
        'Load the documented test-only ClamAV signature.',
      );
      const base = await app.getUrl();
      const form = (key: string, bytes: Buffer) => {
        const value = new FormData();
        for (const [field, text] of Object.entries({
          name: 'Pessoa fictícia scanner F8',
          email: 'scanner-f8@example.invalid',
          subject: 'Anexo fictício para scanner',
          message: 'Teste local do scanner com dados inteiramente fictícios.',
          privacyAccepted: 'true',
          turnstileToken: 'local-development-contact',
          idempotencyKey: key,
        }))
          value.set(field, text);
        value.append(
          'attachments',
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
          'ficticio.png',
        );
        return value;
      };
      const cleanKey = randomUUID();
      const clean = await fetch(`${base}/api/v1/public/contact`, {
        method: 'POST',
        headers: { Origin: environment.WEB_PUBLIC_URL },
        body: form(cleanKey, png),
      });
      assert.equal(clean.status, 202);
      const stored = await db.contact.findUniqueOrThrow({
        where: { idempotencyKey: cleanKey },
        include: { files: true },
      });
      assert.equal(stored.files[0]!.scanStatus, 'VERIFIED');
      const infectedKey = randomUUID();
      const infected = await fetch(`${base}/api/v1/public/contact`, {
        method: 'POST',
        headers: { Origin: environment.WEB_PUBLIC_URL },
        body: form(infectedKey, infectedPng),
      });
      assert.equal(
        infected.status,
        400,
        'The original bytes must be scanned before sanitized bytes are marked verified.',
      );
      assert.equal(
        ((await infected.json()) as { error: { code: string } }).error.code,
        'ATTACHMENT_REJECTED',
      );
      assert.equal(await db.contact.count({ where: { idempotencyKey: infectedKey } }), 0);
      assert.equal(await db.contactFile.count(), 1);
      const password = 'F8-Fictitious-Scanner-Test!2026';
      const admin = await db.user.create({
        data: {
          name: 'Administrador fictício scanner F8',
          email: 'scanner-admin-f8@example.invalid',
          passwordHash: await hashPassword(password),
          role: UserRole.ADMIN,
          isMock: true,
        },
      });
      const session = await app.get(AuthService).login(admin.email, password, '127.0.0.1');
      const cookie = `${AUTH_COOKIES.access}=${session.accessToken}; ${AUTH_COOKIES.csrf}=${session.csrfToken}`;
      const ticket = await fetch(
        `${base}/api/v1/admin/contacts/${stored.id}/attachments/${stored.files[0]!.id}/download-ticket`,
        {
          method: 'POST',
          headers: {
            Cookie: cookie,
            Origin: environment.WEB_PUBLIC_URL,
            'X-CSRF-Token': session.csrfToken,
            'Content-Type': 'application/json',
          },
          body: '{}',
        },
      );
      assert.equal(ticket.status, 200);
      const url = ((await ticket.json()) as { url: string }).url;
      const download = await fetch(`${base}${url}`, { headers: { Cookie: cookie } });
      assert.equal(download.status, 200);
      assert.ok((await download.arrayBuffer()).byteLength > 0);
      assert.equal((await fetch(`${base}${url}`, { headers: { Cookie: cookie } })).status, 404);
      assert.equal(
        (await fetch(`${base}/api/v1/media/public/${stored.files[0]!.storageKey}`)).status,
        404,
      );
      assert.equal(logs.join('\n').includes(admin.email), false);
      assert.equal(logs.join('\n').includes(session.accessToken), false);
    } finally {
      if (app) await app.close();
      if (created) await operator.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      await operator.end();
      const target = resolve(storageRoot);
      assert.ok(target.startsWith(`${resolve(tmpdir())}${sep}`));
      await rm(target, { recursive: true, force: true });
    }
  },
);
