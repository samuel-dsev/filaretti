import assert from 'node:assert/strict';
import test from 'node:test';

import { isLocalDemoAllowed } from '../src/lib/local-demo.ts';

test('showcase accepts only development requests with an exact loopback Host', () => {
  for (const host of ['localhost', 'localhost:3000', '127.0.0.1:3000', '[::1]', '[::1]:3000']) {
    assert.equal(isLocalDemoAllowed('development', host), true, host);
  }
  for (const host of [
    null,
    '',
    'example.test',
    'localhost.example.test',
    '127.0.0.1.example.test',
    'localhost@evil.test',
    'localhost:3000/evil',
    'https://localhost',
    '0.0.0.0:3000',
  ]) {
    assert.equal(isLocalDemoAllowed('development', host), false, String(host));
  }
});

test('showcase remains blocked in staging, production and unconfigured environments', () => {
  for (const environment of [undefined, '', 'staging', 'production', 'test']) {
    assert.equal(isLocalDemoAllowed(environment, 'localhost:3000'), false, String(environment));
  }
});
