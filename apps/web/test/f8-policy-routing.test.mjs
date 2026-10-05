import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import * as localDemo from '../src/lib/local-demo.ts';
import * as publicRouting from '../src/lib/public-routing.ts';
import * as publicStatus from '../src/lib/public-status.ts';
import * as cmsRouting from '../src/lib/cms-routing.ts';
import * as publicMedia from '../src/lib/public-media.ts';
import * as securityPolicy from '../src/lib/security-policy.ts';

const source = ts.transpileModule(
  readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

class TestResponse extends Response {
  static next() {
    return new TestResponse(null);
  }
  static redirect(url, status) {
    return new TestResponse(null, { status, headers: { Location: url.href } });
  }
}

function proxyWithResponse(status) {
  const requests = [];
  const exports = {};
  const dependencies = {
    'next/server': { NextResponse: TestResponse },
    './lib/local-demo': localDemo,
    './lib/public-routing': publicRouting,
    './lib/public-status': publicStatus,
    './lib/cms-routing': cmsRouting,
    './lib/public-media': publicMedia,
    './lib/security-policy': securityPolicy,
  };
  runInNewContext(source, {
    exports,
    require: (name) => {
      assert.ok(Object.hasOwn(dependencies, name));
      return dependencies[name];
    },
    process: {
      env: {
        APP_ENV: 'development',
        NODE_ENV: 'production',
        API_INTERNAL_URL: 'http://api.example.test',
        NEXT_PUBLIC_SITE_URL: 'http://site.example.test',
      },
    },
    Buffer,
    crypto: webcrypto,
    Headers,
    URL,
    AbortSignal,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return new Response(null, {
        status: url.includes('/redirects/resolve?') ? 404 : status,
      });
    },
  });
  return { proxy: exports.proxy, requests };
}

test('withdrawn privacy and cookie policies return HTTP 404 before streaming, with no cache or indexing', async () => {
  for (const slug of ['privacidade', 'cookies']) {
    const { proxy, requests } = proxyWithResponse(404);
    const response = await proxy({
      nextUrl: new URL(`http://site.example.test/${slug}`),
      headers: new Headers(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(await response.text(), /<main id="conteudo"/u);
    assert.ok(requests.some(({ url }) => url.endsWith(`/api/v1/pages/${slug}`)));
    for (const { options } of requests) assert.equal(options.cache, 'no-store');
  }
});

test('policy API failures return HTTP 503 and published policies continue to the renderer', async () => {
  for (const slug of ['privacidade', 'cookies']) {
    for (const status of [500, 200]) {
      const { proxy } = proxyWithResponse(status);
      const response = await proxy({
        nextUrl: new URL(`http://site.example.test/${slug}`),
        headers: new Headers(),
      });
      assert.equal(response.status, status === 500 ? 503 : 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      if (status === 500) assert.equal(response.headers.get('Retry-After'), '30');
    }
  }
});
