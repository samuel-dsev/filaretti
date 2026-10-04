import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { analyticsAllowed, analyticsEvents, parsePreferences } from '../src/lib/consent.ts';
import * as consent from '../src/lib/consent.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const providerSource = ts.transpileModule(
  readFileSync(new URL('../src/components/privacy/consent-provider.tsx', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: 'consent-provider.tsx',
  },
).outputText;

const accepted = { version: 1, necessary: true, analytics: true };

test('missing, corrupt, old and incomplete preferences deny analytics', () => {
  for (const value of [
    null,
    '',
    'broken',
    '{}',
    'null',
    'true',
    '{"version":2,"necessary":true,"analytics":true}',
    '{"version":1,"necessary":false,"analytics":true}',
    '{"version":1,"necessary":true,"analytics":"true"}',
  ]) {
    assert.equal(parsePreferences(value), null);
  }
  assert.deepEqual(parsePreferences(JSON.stringify(accepted)), accepted);
  assert.deepEqual(
    parsePreferences(
      '{"version":1,"necessary":true,"analytics":false,"email":"ignored@example.test"}',
    ),
    { version: 1, necessary: true, analytics: false },
  );
});

test('analytics requires production, enabled configuration, identifier and explicit consent', () => {
  assert.equal(analyticsAllowed('production', true, 'G-TEST12345', accepted, '/contato'), true);
  assert.equal(analyticsAllowed('production', true, 'G-TEST12345', accepted, '/newsletter'), true);
  for (const environment of ['development', 'staging', '', 'test'])
    assert.equal(analyticsAllowed(environment, true, 'G-TEST12345', accepted, '/'), false);
  for (const id of [undefined, '', 'G-<script>', 'UA-12345', 'G-a', 'G-' + 'X'.repeat(21)])
    assert.equal(analyticsAllowed('production', true, id, accepted, '/'), false);
  assert.equal(analyticsAllowed('production', false, 'G-TEST12345', accepted, '/'), false);
  assert.equal(analyticsAllowed('production', true, 'G-TEST12345', null, '/'), false);
  assert.equal(
    analyticsAllowed('production', true, 'G-TEST12345', { ...accepted, analytics: false }, '/'),
    false,
  );
});

test('administration, preview and newsletter token surfaces never activate analytics', () => {
  for (const path of [
    '/admin',
    '/admin/login',
    '/admin/redefinir-senha',
    '/preview/token',
    '/newsletter/confirmar',
    '/newsletter/descadastrar',
  ]) {
    assert.equal(analyticsAllowed('production', true, 'G-TEST12345', accepted, path), false);
  }
  assert.deepEqual(analyticsEvents, [
    'click_whatsapp',
    'submit_contact',
    'newsletter_signup',
    'article_share',
    'download_guide',
    'search',
  ]);
});

/** Executes the real component's effects without loading React, Next.js or external scripts. */
function providerHarness({
  stored = null,
  environment = 'production',
  enabled = true,
  hydrating = false,
  unavailableStorage = false,
} = {}) {
  const states = [];
  const effects = [];
  const memos = [];
  const storage = new Map(stored ? [[consent.consentStorageKey, JSON.stringify(stored)]] : []);
  const cookies = new Map([
    ['_ga', 'fictitious'],
    ['_ga_TEST12345', 'fictitious'],
    ['_gid', 'fictitious'],
    ['necessary_test', 'preserved'],
  ]);
  const scripts = [];
  const windowListeners = new Map();
  const documentListeners = new Map();
  let stateIndex = 0;
  let effectIndex = 0;
  let memoIndex = 0;
  let dirty = true;
  let pendingEffects = [];
  let tree;
  let pathname = '/busca';
  const browser = {
    location: {
      hostname: 'www.filaretti.example.test',
      origin: 'https://www.filaretti.example.test',
      href: 'https://www.filaretti.example.test/busca?q=private-query#private-token',
    },
    addEventListener: (name, handler) => windowListeners.set(name, handler),
    removeEventListener: (name) => windowListeners.delete(name),
  };
  const document = {
    head: { append: (script) => scripts.push(script) },
    createElement: (tag) => {
      assert.equal(tag, 'script');
      const script = { dataset: {}, remove: () => scripts.splice(scripts.indexOf(script), 1) };
      return script;
    },
    querySelectorAll: (selector) => {
      assert.equal(selector, '[data-filaretti-analytics]');
      return [...scripts];
    },
    addEventListener: (name, handler) => documentListeners.set(name, handler),
    removeEventListener: (name) => documentListeners.delete(name),
    get cookie() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(value) {
      if (value.includes('Max-Age=0')) cookies.delete(value.split('=')[0]);
    },
  };
  const jsx = (type, props) => ({ type, props });
  const react = {
    createContext: () => ({ Provider: 'PreferencesProvider' }),
    useContext: () => null,
    useMemo(factory, dependencies) {
      const index = memoIndex++;
      const previous = memos[index];
      if (
        !previous ||
        dependencies.some((value, offset) => !Object.is(value, previous.deps[offset]))
      )
        memos[index] = { value: factory(), deps: dependencies };
      return memos[index].value;
    },
    useCallback(callback, dependencies) {
      return react.useMemo(() => callback, dependencies);
    },
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
      react.useEffect(
        () =>
          subscribe(() => {
            dirty = true;
          }),
        [subscribe],
      );
      return hydrating ? getServerSnapshot() : getSnapshot();
    },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [
        states[index],
        (value) => {
          if (!Object.is(states[index], value)) {
            states[index] = value;
            dirty = true;
          }
        },
      ];
    },
    useEffect(effect, dependencies) {
      const index = effectIndex++;
      const previous = effects[index];
      if (
        !previous ||
        dependencies.some((value, offset) => !Object.is(value, previous.deps[offset]))
      )
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects[index] = { deps: dependencies, cleanup: effect() };
        });
    },
  };
  const componentModule = { exports: {} };
  runInNewContext(providerSource, {
    exports: componentModule.exports,
    module: componentModule,
    window: browser,
    document,
    localStorage: {
      getItem: (key) => {
        if (unavailableStorage) throw new Error('Storage unavailable');
        return storage.get(key) ?? null;
      },
      setItem: (key, value) => {
        if (unavailableStorage) throw new Error('Storage unavailable');
        storage.set(key, value);
      },
    },
    URL,
    require: (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { usePathname: () => pathname };
      if (name === 'next/link') return { default: 'Link' };
      if (name === '@filaretti/ui') return { Button: 'Button', Dialog: 'Dialog' };
      if (name === '@/lib/consent') return consent;
      if (name === './styles.css') return {};
      throw new Error(`Unexpected component dependency: ${name}`);
    },
  });
  function flush() {
    let renders = 0;
    while (dirty) {
      assert.ok(++renders < 20, 'effects should settle');
      dirty = false;
      stateIndex = 0;
      effectIndex = 0;
      memoIndex = 0;
      pendingEffects = [];
      tree = componentModule.exports.ConsentProvider({
        children: 'Page',
        environment,
        enabled,
        identifier: 'G-TEST12345',
      });
      for (const effect of pendingEffects) effect();
    }
  }
  function nodes(node) {
    if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
    if (!node || typeof node !== 'object') return [];
    return [node, ...nodes(node.props?.children)];
  }
  flush();
  return {
    browser,
    scripts,
    cookies,
    storage,
    bannerVisible: () => nodes(tree).some((node) => node.type === 'aside'),
    track: componentModule.exports.trackAnalytics,
    commands: () => JSON.parse(JSON.stringify(browser.dataLayer.map((command) => [...command]))),
    click(label) {
      const button = nodes(tree).find(
        (node) => node.type === 'Button' && node.props.children === label,
      );
      assert.ok(button, `button ${label} should exist`);
      button.props.onClick();
      flush();
    },
    openPreferences() {
      tree.props.value();
      flush();
    },
    changePath(next) {
      pathname = next;
      dirty = true;
      flush();
    },
    hydrate() {
      hydrating = false;
      dirty = true;
      flush();
    },
    storageEvent(event) {
      windowListeners.get('storage')(event);
      flush();
    },
    unmount() {
      for (const effect of effects) effect.cleanup?.();
      assert.equal(windowListeners.size, 0);
      assert.equal(documentListeners.size, 0);
      assert.equal(scripts.length, 0);
      componentModule.exports.trackAnalytics('search');
      assert.equal(browser.dataLayer.length, 0);
    },
  };
}

test('enabled production provider loads only after consent and excludes private event data', () => {
  const runtime = providerHarness();
  assert.equal(runtime.scripts.length, 0);
  runtime.track('search');
  assert.deepEqual(runtime.commands(), []);
  runtime.click('Aceitar analytics');
  assert.equal(runtime.scripts.length, 1);
  assert.equal(runtime.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-TEST12345');
  assert.equal(runtime.browser['ga-disable-G-TEST12345'], false);
  const commands = runtime.commands();
  assert.deepEqual(commands[0], [
    'consent',
    'default',
    {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    },
  ]);
  assert.deepEqual(commands[2], [
    'config',
    'G-TEST12345',
    {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: 'https://www.filaretti.example.test/',
      page_referrer: '',
      page_title: 'Site institucional',
    },
  ]);
  for (const event of analyticsEvents) runtime.track(event, { query: 'private-query' });
  runtime.track('page_view');
  runtime.track('private-query');
  assert.deepEqual(
    runtime.commands().slice(3),
    analyticsEvents.map((event) => ['event', event]),
  );
  assert.doesNotMatch(JSON.stringify(runtime.commands()), /private-query|private-token/u);
  runtime.unmount();
});

test('revoking consent removes scripts and GA cookies and stops later events immediately', () => {
  const runtime = providerHarness({ stored: accepted });
  assert.equal(runtime.scripts.length, 1);
  runtime.cookies.set('_ga', 'created-after-consent');
  runtime.cookies.set('_ga_TEST12345', 'created-after-consent');
  runtime.cookies.set('_gid', 'created-after-consent');
  runtime.cookies.set('_gat', 'created-after-consent');
  runtime.openPreferences();
  runtime.click('Somente necessários');
  assert.equal(runtime.scripts.length, 0);
  assert.equal(runtime.browser['ga-disable-G-TEST12345'], true);
  assert.deepEqual([...runtime.cookies.keys()], ['necessary_test']);
  runtime.track('submit_contact');
  assert.deepEqual(runtime.commands(), []);
  assert.equal(parsePreferences(runtime.storage.get(consent.consentStorageKey)).analytics, false);
  runtime.unmount();
});

test('consent removal in another tab stops enabled analytics, while unrelated storage is ignored', () => {
  const runtime = providerHarness({ stored: accepted });
  runtime.storageEvent({ key: 'unrelated', newValue: null });
  assert.equal(runtime.scripts.length, 1);
  runtime.storageEvent({
    key: consent.consentStorageKey,
    newValue: JSON.stringify({ ...accepted, analytics: false }),
  });
  assert.equal(runtime.scripts.length, 0);
  runtime.track('newsletter_signup');
  assert.deepEqual(runtime.commands(), []);
  runtime.storageEvent({ key: consent.consentStorageKey, newValue: JSON.stringify(accepted) });
  assert.equal(runtime.scripts.length, 1);
  runtime.storageEvent({ key: null, newValue: null });
  assert.equal(runtime.scripts.length, 0);
  assert.equal(runtime.browser['ga-disable-G-TEST12345'], true);
  runtime.unmount();
});

test('restricted routes revoke an active provider and staging or disabled providers stay unloaded', () => {
  const runtime = providerHarness({ stored: accepted });
  for (const path of [
    '/admin/login',
    '/preview/token',
    '/newsletter/confirmar',
    '/newsletter/descadastrar',
  ]) {
    runtime.changePath(path);
    assert.equal(runtime.scripts.length, 0);
    runtime.track('search');
    assert.deepEqual(runtime.commands(), []);
    runtime.changePath('/contato');
    assert.equal(runtime.scripts.length, 1);
  }
  runtime.unmount();
  for (const options of [{ environment: 'staging' }, { enabled: false }]) {
    const denied = providerHarness({ stored: accepted, ...options });
    assert.equal(denied.scripts.length, 0);
    denied.track('search');
    assert.deepEqual(denied.commands(), []);
    denied.unmount();
  }
});

test('server hydration snapshots deny analytics before reading browser preferences', () => {
  const runtime = providerHarness({ stored: accepted, hydrating: true });
  assert.equal(runtime.scripts.length, 0);
  assert.equal(runtime.bannerVisible(), false);
  runtime.hydrate();
  assert.equal(runtime.scripts.length, 1);
  assert.equal(runtime.bannerVisible(), false);
  runtime.unmount();
  const missing = providerHarness({ hydrating: true });
  assert.equal(missing.bannerVisible(), false);
  missing.hydrate();
  assert.equal(missing.bannerVisible(), true);
  assert.equal(missing.scripts.length, 0);
  missing.unmount();
});

test('unavailable browser storage denies initially and an explicit choice applies to this visit', () => {
  const runtime = providerHarness({ unavailableStorage: true });
  assert.equal(runtime.scripts.length, 0);
  runtime.click('Aceitar analytics');
  assert.equal(runtime.scripts.length, 1);
  assert.equal(runtime.storage.size, 0);
  runtime.openPreferences();
  runtime.click('Somente necessários');
  assert.equal(runtime.scripts.length, 0);
  runtime.track('search');
  assert.deepEqual(runtime.commands(), []);
  runtime.unmount();
});
