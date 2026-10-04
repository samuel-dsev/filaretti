import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import type { AuthenticationResponse, CsrfResponse } from '@filaretti/types';
import { createApplication } from '../src/app';
import { AuthService } from '../src/auth/auth.service';
import { AUTH_COOKIES, tokenHash } from '../src/auth/cookies';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { PasswordRecoveryService } from '../src/auth/recovery.service';
import { SanitizedLogger } from '../src/common/sanitized-logger';
import { PrismaService } from '../src/database/prisma.service';
import { testEnvironment } from './helpers';

class Browser {
  readonly cookies = new Map<string, string>();
  csrfToken = '';

  constructor(readonly baseUrl: string) {}

  clone(): Browser {
    const clone = new Browser(this.baseUrl);
    for (const [key, value] of this.cookies) clone.cookies.set(key, value);
    clone.csrfToken = this.csrfToken;
    return clone;
  }

  async request(
    path: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '),
        ...(method !== 'GET'
          ? { Origin: 'http://localhost:3000', 'X-CSRF-Token': this.csrfToken }
          : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const equals = pair!.indexOf('=');
      const key = pair!.slice(0, equals);
      const value = pair!.slice(equals + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return response;
  }

  async login(email: string, password: string): Promise<Response> {
    const csrf = await this.request('/auth/csrf');
    assert.equal(csrf.status, 200);
    this.csrfToken = ((await csrf.json()) as CsrfResponse).csrfToken;
    const response = await this.request('/auth/login', 'POST', { email, password });
    if (response.status === 200) {
      const data = (await response.clone().json()) as AuthenticationResponse;
      this.csrfToken = data.csrfToken;
    }
    return response;
  }
}

test('authentication, revocation, CSRF and roles use real PostgreSQL and HTTP', async (t) => {
  assert.ok(process.env.DATABASE_URL, 'Use the isolated integration database runner.');
  const environment = testEnvironment({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_TIMEOUT_MS: 2000,
  });
  const app = await createApplication(environment, new SanitizedLogger(() => undefined));
  await app.listen(0, '127.0.0.1');
  const prisma = app.get(PrismaService);
  const auth = app.get(AuthService);
  const password = 'Fictitious-Test-Password-2026!';
  const passwordHash = await hashPassword(password);
  const prefix = `auth-${randomUUID()}`;
  async function fixture(role: UserRole = UserRole.AUTHOR) {
    return prisma.user.create({
      data: {
        email: `${prefix}-${randomUUID().slice(0, 12)}@example.invalid`,
        name: 'Usuário fictício de teste',
        role,
        passwordHash,
        isMock: true,
      },
    });
  }
  const adminUser = await fixture(UserRole.ADMIN);
  const authorUser = await fixture(UserRole.AUTHOR);
  const admin = new Browser(await app.getUrl());
  const author = new Browser(await app.getUrl());

  try {
    await t.test(
      'login rejects foreign origin, unsigned CSRF, overposting and unknown credentials',
      async () => {
        const browser = new Browser(await app.getUrl());
        const csrf = await browser.request('/auth/csrf');
        browser.csrfToken = ((await csrf.json()) as CsrfResponse).csrfToken;
        assert.equal(
          (
            await browser.request(
              '/auth/login',
              'POST',
              { email: authorUser.email, password },
              { Origin: 'https://attacker.example.invalid' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await browser.request(
              '/auth/login',
              'POST',
              { email: authorUser.email, password },
              { 'X-CSRF-Token': 'forged' },
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await browser.request('/auth/login', 'POST', {
              email: authorUser.email,
              password,
              role: 'ADMIN',
            })
          ).status,
          400,
        );
        assert.equal(
          (await browser.login(`${prefix}-missing@example.invalid`, password)).status,
          401,
        );
        const unsigned = new Browser(await app.getUrl());
        unsigned.csrfToken = 'a'.repeat(64);
        unsigned.cookies.set(AUTH_COOKIES.csrf, unsigned.csrfToken);
        assert.equal(
          (await unsigned.request('/auth/login', 'POST', { email: authorUser.email, password }))
            .status,
          403,
        );
      },
    );

    await t.test(
      'login cookies are HttpOnly and responses/DB contain only allowed fields and token hashes',
      async () => {
        const response = await admin.login(adminUser.email.toUpperCase(), password);
        assert.equal(response.status, 200);
        const payload = (await response.json()) as AuthenticationResponse;
        assert.deepEqual(Object.keys(payload).sort(), ['csrfToken', 'user']);
        assert.deepEqual(Object.keys(payload.user).sort(), [
          'email',
          'id',
          'isActive',
          'name',
          'role',
        ]);
        const cookies = response.headers.getSetCookie();
        assert.equal(cookies.length, 3);
        for (const cookie of cookies) {
          assert.ok(/HttpOnly/i.test(cookie), 'Session cookie must be HttpOnly.');
          assert.ok(/SameSite=Lax/i.test(cookie), 'Local session cookie must be SameSite=Lax.');
          assert.ok(/Path=\/api\/v1/i.test(cookie), 'Cookie must be scoped to the API.');
        }
        assert.equal((await admin.request('/auth/me')).status, 200);
        const token = await prisma.refreshToken.findUniqueOrThrow({
          where: { tokenHash: tokenHash(environment, admin.cookies.get(AUTH_COOKIES.refresh)!) },
        });
        assert.ok(
          token.tokenHash !== admin.cookies.get(AUTH_COOKIES.refresh),
          'Refresh must be stored only as a hash.',
        );
        const csrf = await admin.request('/auth/csrf');
        assert.ok(
          ((await csrf.json()) as CsrfResponse).csrfToken === admin.csrfToken,
          'Existing session CSRF must be restored.',
        );
        assert.match(adminUser.passwordHash, /^\$argon2id\$/);
      },
    );

    await t.test(
      'anonymous/author access denied, ADMIN user CRUD validated and list paginated',
      async () => {
        assert.equal((await new Browser(await app.getUrl()).request('/admin/users')).status, 401);
        assert.equal((await author.login(authorUser.email, password)).status, 200);
        assert.equal((await author.request('/admin/users')).status, 403);
        assert.equal(
          (
            await author.request('/admin/users', 'POST', {
              email: `${prefix}-forbidden@example.invalid`,
              name: 'Fictício',
              password,
              role: 'ADMIN',
            })
          ).status,
          403,
        );
        const payload = {
          email: `${prefix}-created@example.invalid`,
          name: 'Fictício criado por ADMIN',
          password,
          role: 'EDITOR',
        };
        assert.equal(
          (await admin.request('/admin/users', 'POST', payload, { 'X-CSRF-Token': 'forged' }))
            .status,
          403,
        );
        assert.equal(
          (await admin.request('/admin/users', 'POST', { ...payload, password: 'short' })).status,
          400,
        );
        const created = await admin.request('/admin/users', 'POST', payload);
        assert.equal(created.status, 201);
        assert.equal((await admin.request('/admin/users', 'POST', payload)).status, 409);
        const list = await admin.request('/admin/users?page=1&limit=2');
        const paginated = (await list.json()) as {
          data: unknown[];
          meta: { page: number; limit: number; total: number };
        };
        assert.equal(paginated.data.length, 2);
        assert.equal(paginated.meta.page, 1);
        assert.equal(paginated.meta.limit, 2);
        assert.equal((await admin.request('/admin/users?limit=51')).status, 400);
        assert.equal(
          (await admin.request(`/admin/users/${adminUser.id}/deactivate`, 'POST')).status,
          409,
        );
      },
    );

    await t.test(
      'rotating refresh rejects old reuse and revokes the whole family/access',
      async () => {
        const user = await fixture();
        const browser = new Browser(await app.getUrl());
        assert.equal((await browser.login(user.email, password)).status, 200);
        const old = browser.clone();
        assert.equal((await browser.request('/auth/refresh', 'POST')).status, 200);
        assert.ok(
          browser.cookies.get(AUTH_COOKIES.refresh) !== old.cookies.get(AUTH_COOKIES.refresh),
          'Refresh cookie must rotate.',
        );
        assert.equal((await browser.request('/auth/me')).status, 200);
        const reuse = await old.request('/auth/refresh', 'POST');
        assert.equal(reuse.status, 401);
        assert.equal((await browser.request('/auth/me')).status, 401);
        assert.equal((await browser.request('/auth/refresh', 'POST')).status, 401);
      },
    );

    await t.test(
      'concurrent refresh serializes consumption and detects duplicate use',
      async () => {
        const user = await fixture();
        const browser = new Browser(await app.getUrl());
        assert.equal((await browser.login(user.email, password)).status, 200);
        const [first, second] = await Promise.all([
          browser.clone().request('/auth/refresh', 'POST'),
          browser.clone().request('/auth/refresh', 'POST'),
        ]);
        assert.deepEqual([first.status, second.status].sort(), [200, 401]);
        assert.equal(
          await prisma.session.count({ where: { userId: user.id, revokedAt: null } }),
          0,
        );
      },
    );

    await t.test(
      'logout revokes cookies/access; expired JWT/session and tampered JWT rejected',
      async () => {
        const user = await fixture();
        const browser = new Browser(await app.getUrl());
        assert.equal((await browser.login(user.email, password)).status, 200);
        const copy = browser.clone();
        const missingCsrf = await browser.request('/auth/logout', 'POST', undefined, {
          'X-CSRF-Token': '',
        });
        assert.equal(missingCsrf.status, 403);
        const tampered = browser.clone();
        tampered.cookies.set(
          AUTH_COOKIES.access,
          `${tampered.cookies.get(AUTH_COOKIES.access)!}tampered`,
        );
        assert.equal((await tampered.request('/auth/me')).status, 401);
        const token = await prisma.refreshToken.findUniqueOrThrow({
          where: { tokenHash: tokenHash(environment, browser.cookies.get(AUTH_COOKIES.refresh)!) },
        });
        const expiredJwt = await new JwtService().signAsync(
          { sub: user.id, sid: token.sessionId, type: 'access' },
          {
            secret: environment.JWT_SECRET,
            algorithm: 'HS256',
            issuer: 'filaretti-api',
            audience: 'filaretti-admin',
            expiresIn: -1,
          },
        );
        tampered.cookies.set(AUTH_COOKIES.access, expiredJwt);
        assert.equal((await tampered.request('/auth/me')).status, 401);
        assert.equal((await browser.request('/auth/logout', 'POST')).status, 204);
        assert.equal(browser.cookies.size, 0);
        assert.equal((await copy.request('/auth/me')).status, 401);
        const expiring = new Browser(await app.getUrl());
        assert.equal((await expiring.login(user.email, password)).status, 200);
        await prisma.session.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal((await expiring.request('/auth/me')).status, 401);
        assert.equal((await expiring.request('/auth/refresh', 'POST')).status, 401);
      },
    );

    await t.test('password change rejects wrong password and revokes every session', async () => {
      const user = await fixture();
      const one = new Browser(await app.getUrl());
      const two = new Browser(await app.getUrl());
      assert.equal((await one.login(user.email, password)).status, 200);
      assert.equal((await two.login(user.email, password)).status, 200);
      const newPassword = 'Changed-Fictitious-Password-2026!';
      assert.equal(
        (await one.request('/auth/password', 'POST', { currentPassword: 'wrong', newPassword }))
          .status,
        401,
      );
      assert.equal(
        (await one.request('/auth/password', 'POST', { currentPassword: password, newPassword }))
          .status,
        204,
      );
      assert.equal((await two.request('/auth/me')).status, 401);
      assert.equal((await two.request('/auth/refresh', 'POST')).status, 401);
      const changed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      assert.equal(await verifyPassword(changed.passwordHash, password), false);
      assert.equal(await verifyPassword(changed.passwordHash, newPassword), true);
    });

    await t.test('ADMIN deactivation immediately blocks existing access and refresh', async () => {
      const user = await fixture();
      const browser = new Browser(await app.getUrl());
      assert.equal((await browser.login(user.email, password)).status, 200);
      assert.equal((await admin.request(`/admin/users/${user.id}/deactivate`, 'POST')).status, 201);
      assert.equal((await browser.request('/auth/me')).status, 401);
      assert.equal((await browser.request('/auth/refresh', 'POST')).status, 401);
      assert.equal((await new Browser(await app.getUrl()).login(user.email, password)).status, 401);
    });

    await t.test(
      'recovery response hides account/tokens; token expires, single use and revokes sessions',
      async () => {
        const user = await fixture();
        const browser = new Browser(await app.getUrl());
        assert.equal((await browser.login(user.email, password)).status, 200);
        const anonymous = new Browser(await app.getUrl());
        const csrf = await anonymous.request('/auth/csrf');
        anonymous.csrfToken = ((await csrf.json()) as CsrfResponse).csrfToken;
        const existing = await anonymous.request('/auth/password/recovery', 'POST', {
          email: user.email,
        });
        const missing = await anonymous.request('/auth/password/recovery', 'POST', {
          email: `${prefix}-unknown-reset@example.invalid`,
        });
        assert.equal(existing.status, 202);
        assert.equal(missing.status, 202);
        assert.deepEqual(await existing.json(), await missing.json());
        let deliveredToken = '';
        const delivery = new PasswordRecoveryService(prisma, environment, {
          async deliver(input) {
            deliveredToken = input.token;
          },
        });
        await delivery.request(user.email);
        assert.equal(deliveredToken.length, 64);
        const expiredToken = deliveredToken;
        await prisma.passwordResetToken.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        assert.equal(
          (
            await anonymous.request('/auth/password/reset', 'POST', {
              token: expiredToken,
              newPassword: password,
            })
          ).status,
          401,
        );
        await delivery.request(user.email);
        const token = deliveredToken;
        const stored = await prisma.passwordResetToken.findUniqueOrThrow({
          where: { tokenHash: tokenHash(environment, token) },
        });
        assert.ok(stored.tokenHash !== token, 'Recovery must be stored only as a hash.');
        const body = { token, newPassword: 'Recovered-Fictitious-Password-2026!' };
        const [first, second] = await Promise.all([
          anonymous.clone().request('/auth/password/reset', 'POST', body),
          anonymous.clone().request('/auth/password/reset', 'POST', body),
        ]);
        assert.deepEqual([first.status, second.status].sort(), [204, 401]);
        assert.equal((await browser.request('/auth/me')).status, 401);
        assert.equal((await anonymous.request('/auth/password/reset', 'POST', body)).status, 401);
      },
    );

    await t.test('administrator lock prevents concurrent mutual deactivation', async () => {
      const first = await fixture(UserRole.ADMIN);
      const second = await fixture(UserRole.ADMIN);
      const outcomes = await Promise.allSettled([
        auth.deactivateUser(second.id, first.id),
        auth.deactivateUser(first.id, second.id),
      ]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'rejected').length, 1);
      assert.equal(
        await prisma.user.count({ where: { id: { in: [first.id, second.id] }, isActive: true } }),
        1,
      );
    });

    await t.test(
      'login limits are persisted and shared by independent service instances',
      async () => {
        const ip = `fictitious-ip-${randomUUID()}`;
        const email = `${prefix}-rate@example.invalid`;
        for (let attempt = 0; attempt < 5; attempt++)
          await auth.consumeAttempt('test-login', ip, email);
        const independent = new AuthService(prisma, new JwtService(), environment);
        await assert.rejects(
          independent.consumeAttempt('test-login', ip, email),
          (error: unknown) =>
            typeof error === 'object' &&
            error !== null &&
            'getStatus' in error &&
            typeof error.getStatus === 'function' &&
            error.getStatus() === 429,
        );
        const stored = await prisma.loginRateLimit.findUniqueOrThrow({
          where: { key: `test-login:email:${tokenHash(environment, email)}` },
        });
        assert.equal(stored.count, 6);
        assert.ok(stored.blockedUntil);
        assert.ok(!stored.key.includes(email));
      },
    );
    await t.test(
      'concurrent first-use login counters are shared without unique-key failures',
      async () => {
        const other = await createApplication(environment, new SanitizedLogger(() => undefined));
        await other.init();
        try {
          const independent = other.get(AuthService);
          const ip = `fictitious-first-use-${randomUUID()}`;
          const email = `${prefix}-first-use@example.invalid`;
          const scope = 'test-first-use';
          const emailKey = `${scope}:email:${tokenHash(environment, email)}`;
          const ipKey = `${scope}:ip:${tokenHash(environment, ip)}`;
          assert.equal(
            await prisma.loginRateLimit.count({ where: { key: { in: [emailKey, ipKey] } } }),
            0,
          );
          const outcomes = await Promise.allSettled(
            Array.from({ length: 8 }, (_, index) =>
              (index % 2 ? independent : auth).consumeAttempt(scope, ip, email),
            ),
          );
          assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 5);
          const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
          assert.equal(rejected.length, 3);
          for (const outcome of rejected) {
            const error: unknown = outcome.reason;
            assert.ok(
              error &&
                typeof error === 'object' &&
                'getStatus' in error &&
                typeof error.getStatus === 'function',
            );
            assert.equal(error.getStatus(), 429);
          }
          const emailCounter = await prisma.loginRateLimit.findUniqueOrThrow({
            where: { key: emailKey },
          });
          const ipCounter = await prisma.loginRateLimit.findUniqueOrThrow({
            where: { key: ipKey },
          });
          assert.equal(emailCounter.count, 6);
          assert.ok(emailCounter.blockedUntil);
          assert.equal(ipCounter.count, 8);
        } finally {
          await other.close();
        }
      },
    );
  } finally {
    // These identities belong exclusively to this test; seeded/other data is preserved.
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await app.close();
  }
});
