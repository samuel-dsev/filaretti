import assert from 'node:assert/strict';
import test from 'node:test';
import { relationshipApi } from '../src/lib/relationship-api.ts';

test('public relationship requests omit credentials and referrers and use bounded gateway paths', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, options });
    return Response.json({ accepted: true, message: 'Recebido.' }, { status: 202 });
  });
  assert.deepEqual(
    await relationshipApi('newsletter/subscribe', {
      email: 'ficticio@example.test',
      consent: true,
    }),
    { accepted: true, message: 'Recebido.' },
  );
  assert.equal(calls[0].path, '/api/relationship/newsletter/subscribe');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
  const multipart = new FormData();
  multipart.set('name', 'Contato fictício');
  await relationshipApi('contact', multipart);
  assert.equal(calls[1].options.body, multipart);
  assert.equal(calls[1].options.headers, undefined);
  await assert.rejects(() => relationshipApi('../admin/contacts', {}), /não disponível/u);
  assert.equal(calls.length, 2);
});

test('backend and network errors do not expose response messages or submitted data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { error: { code: 'UNKNOWN', message: 'secret-email@example.test SQL token' } },
      { status: 500 },
    ),
  );
  await assert.rejects(
    () => relationshipApi('contact', {}),
    (error) => !error.message.includes('secret') && !error.message.includes('SQL'),
  );
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('internal secret');
  });
  await assert.rejects(() => relationshipApi('contact', {}), /campos foram preservados/u);
});
