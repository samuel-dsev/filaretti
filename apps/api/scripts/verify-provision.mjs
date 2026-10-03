import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { verify } from 'argon2';
import pg from 'pg';

let phase = 'configuration';

async function verifyProvision() {
  assert.equal(process.env.APP_ENV, 'production');
  assert.equal(process.env.NODE_ENV, 'production');
  assert.equal(process.env.MOCK_CONTENT, 'false');
  assert.ok(process.env.DATABASE_URL && process.env.npm_execpath);
  const databaseUrl = new URL(process.env.DATABASE_URL);
  // This verification can run only in the pristine temporary database of our runner.
  assert.match(databaseUrl.pathname, /^\/filaretti_test_[a-f0-9]{32}_structural$/);
  const email = 'first-admin@example.invalid';
  const name = 'Admin Fictício — teste de provisionamento';
  const password = `F2-ficticio-${randomBytes(32).toString('hex')}`;
  const environment = {
    ...process.env,
    PROVISION_ADMIN_EMAIL: email,
    PROVISION_ADMIN_NAME: name,
  };

  function provision() {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [process.env.npm_execpath, 'exec', 'tsx', 'prisma/provision-admin.ts'],
        { env: environment, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      let output = '';
      function collect(data) {
        output += data.toString();
        if (output.length > 131072) {
          child.kill();
          reject(new Error('PROVISION_OUTPUT_LIMIT'));
        }
      }
      child.stdout.on('data', collect);
      child.stderr.on('data', collect);
      child.once('error', () => reject(new Error('PROVISION_START_FAILED')));
      child.once('close', (code) => resolve({ code, output }));
      child.stdin.on('error', () => reject(new Error('PROVISION_STDIN_FAILED')));
      child.stdin.end(`${password}\n`);
    });
  }

  function assertNoExposure(output) {
    assert.equal(output.includes(password), false);
    assert.equal(output.includes(email), false);
    assert.equal(output.includes(databaseUrl.href), false);
    assert.equal(output.includes('$argon2id$'), false);
  }

  const client = new pg.Client({
    connectionString: databaseUrl.href,
    connectionTimeoutMillis: 5000,
  });
  try {
    phase = 'connect';
    await client.connect();
    phase = 'pristine-database';
    assert.equal((await client.query('SELECT count(*)::int AS total FROM users')).rows[0].total, 0);
    phase = 'first-provision';
    const first = await provision();
    phase = 'first-output';
    assertNoExposure(first.output);
    if (first.code !== 0) {
      for (const code of [
        'ADMIN_PROVISION_FORBIDDEN',
        'PASSWORD_STDIN_REQUIRED',
        'INVALID_PASSWORD',
        'INVALID_ADMIN_IDENTITY',
        'ADMIN_ALREADY_EXISTS',
        'ADMIN_PROVISION_FAILED',
      ]) {
        if (first.output.includes(code)) phase = `first-provision-${code}`;
      }
    }
    assert.equal(first.code, 0);
    assert.ok(first.output.includes('First administrator provisioned.'));
    phase = 'admin-record';
    const users = (
      await client.query('SELECT id, email, name, role, is_mock, password_hash FROM users')
    ).rows;
    assert.equal(users.length, 1);
    const admin = users[0];
    assert.equal(admin.email, email);
    assert.equal(admin.name, name);
    assert.equal(admin.role, 'ADMIN');
    assert.equal(admin.is_mock, false);
    phase = 'password-hash-format';
    const hashParts = admin.password_hash.split('$');
    assert.equal(hashParts[1], 'argon2id');
    assert.equal(hashParts[2], 'v=19');
    const parameters = Object.fromEntries(
      hashParts[3].split(',').map((parameter) => {
        const [key, value] = parameter.split('=');
        return [key, Number(value)];
      }),
    );
    assert.deepEqual(parameters, { m: 65536, t: 3, p: 1 });
    phase = 'password-hash-verification';
    assert.equal(await verify(admin.password_hash, password), true);
    phase = 'password-hash-not-plaintext';
    assert.notEqual(admin.password_hash, password);
    assertNoExposure(first.output);
    phase = 'audit';
    const audit = (
      await client.query(
        "SELECT actor_id, resource_id FROM audit_events WHERE action='user.provisioned' AND resource='user'",
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert.equal(audit[0].actor_id, admin.id);
    assert.equal(audit[0].resource_id, admin.id);

    phase = 'repeat-provision';
    const repeated = await provision();
    phase = 'repeat-output';
    assertNoExposure(repeated.output);
    assert.notEqual(repeated.code, 0);
    assert.ok(repeated.output.includes('ADMIN_ALREADY_EXISTS'));
    assert.equal((await client.query('SELECT count(*)::int AS total FROM users')).rows[0].total, 1);
    assert.equal(
      (
        await client.query(
          "SELECT count(*)::int AS total FROM audit_events WHERE action='user.provisioned'",
        )
      ).rows[0].total,
      1,
    );
    console.log(
      'Isolated first-admin provisioning, Argon2id, audit and repeated-call refusal verified.',
    );
  } finally {
    await client.end();
  }
}

verifyProvision().catch(() => {
  // Assertions/driver errors may carry compared identities, passwords or connection data.
  console.error(`ISOLATED_ADMIN_PROVISION_VERIFICATION_FAILED:${phase}`);
  process.exitCode = 1;
});
