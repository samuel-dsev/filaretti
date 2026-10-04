import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fragmentToken,
  recoveryFragmentToken,
  privateDownloadPath,
  relationshipEndpoint,
} from '../src/lib/relationship-routing.ts';

test('relationship gateway exposes only the four public POST mutations', () => {
  for (const path of [
    'contact',
    'newsletter/subscribe',
    'newsletter/confirm',
    'newsletter/unsubscribe',
  ]) {
    assert.equal(relationshipEndpoint(path.split('/'), 'POST'), `/api/v1/public/${path}`);
    for (const method of ['GET', 'DELETE', 'PATCH', 'HEAD'])
      assert.equal(relationshipEndpoint(path.split('/'), method), null);
  }
  for (const path of [
    'admin/contacts',
    'auth/login',
    'contact/../admin',
    'newsletter/subscribe?x=1',
    'contact%2f',
    'contact/',
  ])
    assert.equal(relationshipEndpoint(path.split('/'), 'POST'), null);
});

test('authenticated attachment downloads require the exact bounded same-origin ticket path', () => {
  const token = 'a'.repeat(64);
  assert.equal(
    privateDownloadPath(`/api/v1/admin/contact-downloads/${token}`),
    `/api/cms/admin/contact-downloads/${token}`,
  );
  for (const path of [
    'https://example.test/api/v1/admin/contact-downloads/' + token,
    '/api/v1/admin/contact-downloads/' + token + '?x=1',
    '/api/v1/admin/contact-downloads/' + token + '/other',
    '/api/v1/admin/contact-downloads/' + 'a'.repeat(63),
    '/api/v1/admin/contact-downloads/' + 'z'.repeat(64),
    '//example.test',
    '/api/v1/admin/subscribers/export',
  ])
    assert.equal(privateDownloadPath(path), null);
});

test('newsletter and recovery read only one valid fragment token', () => {
  const token = 'b'.repeat(64);
  for (const read of [fragmentToken, recoveryFragmentToken]) {
    assert.equal(read(`#token=${token}`), token);
    for (const input of [
      '',
      '#token=invalid',
      `#token=${token}&email=x`,
      `#token=${token}&token=${token}`,
      '#token=' + 'b'.repeat(65),
      '#token=' + 'Z'.repeat(64),
      '#other=' + token,
    ])
      assert.equal(read(input), null);
  }
});
