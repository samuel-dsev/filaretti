import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function signer(environment) {
  const source = readFileSync(new URL('../src/lib/bff-client-ip.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    process: { env: environment },
    Headers,
    Buffer,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name === 'node:crypto') return { createHmac };
      if (name === 'node:net') return { isIP };
      throw new Error('Unexpected import');
    },
  });
  return exports.signVisitorHeaders;
}
const trusted = {
  APP_ENV: 'staging',
  BFF_CLIENT_IP_SECRET: 'a'.repeat(64),
  WEB_CLIENT_IP_HEADER: 'x-real-ip',
  WEB_TRUSTED_PROXY_CONFIRMED: 'true',
};
test('local direct mode ignores visitor-supplied forwarding and signing headers', () => {
  const headers = signer({ APP_ENV: 'development' })(
    new Request('http://localhost/', {
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'x-real-ip': '203.0.113.9',
        'x-filaretti-client-signature': 'forged',
      },
    }),
    'POST',
    '/api/v1/auth/login',
  );
  assert.equal([...headers].length, 0);
});
test('trusted ingress signs only a valid single IP and binds method and endpoint', () => {
  const headers = signer(trusted)(
    new Request('https://test.invalid/', { headers: { 'x-real-ip': '203.0.113.8' } }),
    'POST',
    '/api/v1/auth/login',
  );
  assert.equal(headers.get('x-filaretti-client-ip'), '203.0.113.8');
  const stamp = headers.get('x-filaretti-client-timestamp');
  assert.match(stamp, /^\d{13}$/u);
  const digest = (method, path) =>
    createHmac('sha256', Buffer.from(trusted.BFF_CLIENT_IP_SECRET, 'hex'))
      .update(`${stamp}\n${method}\n${path}\n203.0.113.8`)
      .digest('hex');
  assert.equal(headers.get('x-filaretti-client-signature'), digest('POST', '/api/v1/auth/login'));
  assert.notEqual(headers.get('x-filaretti-client-signature'), digest('GET', '/api/v1/auth/login'));
  assert.notEqual(
    headers.get('x-filaretti-client-signature'),
    digest('POST', '/api/v1/auth/reset'),
  );
});
test('external mode fails closed without a confirmed ingress or with ambiguous IPs', () => {
  const request = new Request('https://test.invalid/');
  assert.throws(() => signer({ APP_ENV: 'production' })(request, 'POST', '/api/v1/auth/login'));
  for (const value of ['', '203.0.113.8, 203.0.113.9', 'hostname.invalid']) {
    assert.throws(() =>
      signer(trusted)(
        new Request('https://test.invalid/', { headers: { 'x-real-ip': value } }),
        'POST',
        '/api/v1/auth/login',
      ),
    );
  }
});
