import assert from 'node:assert/strict';
import test from 'node:test';
import { browserSecurityHeaders, contentSecurityPolicy } from '../src/lib/security-policy.ts';
import { publicStatusHtml } from '../src/lib/public-status.ts';

const nonce = Buffer.from('fictitious-request-nonce-12345').toString('base64');
const base = { nonce, developmentServer: false, https: false, turnstile: false, analytics: false };

test('optimized documents block arbitrary scripts, frames, objects and uncontrolled endpoints', () => {
  const csp = contentSecurityPolicy(base);
  const script = csp.split('; ').find((directive) => directive.startsWith('script-src '));
  assert.match(script, /'strict-dynamic'/u);
  assert.match(script, new RegExp(`'nonce-${nonce}'`, 'u'));
  assert.doesNotMatch(script, /unsafe-inline|unsafe-eval/u);
  for (const required of [
    "script-src-attr 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "connect-src 'self'",
    "frame-src 'none'",
  ])
    assert.ok(csp.includes(required));
  assert.doesNotMatch(csp, /google|cloudflare|upgrade-insecure-requests|ws:/u);
});

test('third-party endpoints and development eval are enabled only by their explicit gates', () => {
  const production = contentSecurityPolicy({
    ...base,
    https: true,
    turnstile: true,
    analytics: true,
  });
  assert.match(production, /frame-src https:\/\/challenges.cloudflare.com/u);
  assert.match(
    production,
    /connect-src 'self' https:\/\/challenges.cloudflare.com https:\/\/www.google-analytics.com/u,
  );
  assert.match(production, /upgrade-insecure-requests/u);
  assert.doesNotMatch(production, /unsafe-eval/u);
  assert.match(contentSecurityPolicy({ ...base, developmentServer: true }), /'unsafe-eval'/u);
  for (const hostileNonce of ['', "abc';script-src *", '<script>', 'a'.repeat(100)])
    assert.throws(
      () => contentSecurityPolicy({ ...base, nonce: hostileNonce }),
      /Invalid security nonce/u,
    );
});

test('transport headers do not activate HSTS locally and error styles carry only validated nonce', () => {
  assert.equal(browserSecurityHeaders(false)['Strict-Transport-Security'], undefined);
  assert.equal(browserSecurityHeaders(true)['Strict-Transport-Security'], 'max-age=31536000');
  assert.equal(browserSecurityHeaders(false)['Referrer-Policy'], 'no-referrer');
  assert.match(publicStatusHtml(503, nonce), new RegExp(`<style nonce="${nonce}">`, 'u'));
  assert.doesNotMatch(publicStatusHtml(404, '"><script>'), /<script>/u);
});
