import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

import * as core from '../src/lib/public-content-core.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/lib/public-content.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
const exports = {};
new Function('require', 'exports', compiled.outputText)(
  (specifier) => (specifier === './public-content-core' ? core : require(specifier)),
  exports,
);
const { PublicContent } = exports;
const paragraph = (...nodes) => ({ type: 'paragraph', content: nodes });
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const document = (...nodes) => ({ type: 'doc', content: nodes });

test('content renderer escapes text and removes executable links without hiding readable content', () => {
  const payload = document(
    paragraph(
      text('<script>alert(1)</script>'),
      text('Unsafe link', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
      text('Safe link', [{ type: 'link', attrs: { href: 'https://example.test' } }]),
    ),
  );
  const html = renderToStaticMarkup(PublicContent({ document: payload }));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.ok(html.includes('Unsafe link'));
  assert.ok(html.includes('href="https://example.test"'));
});

test('URL policy rejects credentials, controls, protocol-relative paths and unsafe media', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,a',
    '//example.test',
    '/\\example.test',
    'https://user:secret@example.test',
    'https://example.test\n',
    '/%2f%2fevil.test',
  ])
    assert.equal(core.safePublicUrl(url), null);
  for (const url of [
    '/o-escritorio',
    'https://example.test',
    'mailto:teste@example.test',
    'tel:+550000000000',
  ])
    assert.equal(core.safePublicUrl(url), url);
  assert.equal(core.safeMediaUrl('mailto:teste@example.test'), null);
});

test('schema limits protect the renderer against unsupported nodes and deep payloads', () => {
  assert.equal(
    core.parsePublicDocument(document({ type: 'image', attrs: { src: 'javascript:alert(1)' } })),
    null,
  );
  assert.equal(
    core.parsePublicDocument(
      document({ type: 'heading', attrs: { level: 1 }, content: [text('Invalid heading')] }),
    ),
    null,
  );
  let deep = paragraph(text('deep'));
  for (let index = 0; index < 30; index += 1) deep = { type: 'blockquote', content: [deep] };
  assert.equal(core.parsePublicDocument(document(deep)), null);
  assert.equal(core.parsePublicDocument(document(paragraph(text('x'.repeat(50001))))), null);
  assert.equal(PublicContent({ document: document({ type: 'script', text: 'alert(1)' }) }), null);
});

test('institutional renderer preserves semantic headings, lists, marks and breaks', () => {
  const payload = document(
    { type: 'heading', attrs: { level: 2 }, content: [text('Heading')] },
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [
        {
          type: 'listItem',
          content: [
            paragraph(
              text('Item', [{ type: 'bold' }, { type: 'italic' }]),
              { type: 'hardBreak' },
              text('Next'),
            ),
          ],
        },
      ],
    },
    { type: 'blockquote', content: [paragraph(text('Quote'))] },
  );
  const html = renderToStaticMarkup(PublicContent({ document: payload }));
  assert.ok(html.includes('<h2>Heading</h2>'));
  assert.ok(html.includes('<ol start="3">'));
  assert.ok(html.includes('<em><strong>Item</strong></em>'));
  assert.ok(html.includes('<br/>'));
  assert.ok(html.includes('<blockquote>'));
});

test('plain text projection preserves adjacent marked fragments and separates blocks', () => {
  const payload = document(
    paragraph(text('Con'), text('sulta', [{ type: 'bold' }]), text(' institucional')),
    paragraph(text('Segunda linha')),
  );
  assert.equal(core.contentText(payload), 'Consulta institucional Segunda linha');
  assert.equal(core.contentText(payload, 8), 'Consulta');
  assert.equal(core.contentText(undefined), '');
});

test('editorial outline matches focusable H2 IDs with repeated, empty and Unicode headings', () => {
  const heading = (level, ...nodes) => ({ type: 'heading', attrs: { level }, content: nodes });
  const payload = document(
    heading(2, text('Ação '), text('jurídica', [{ type: 'bold' }])),
    heading(3, text('Subtítulo fora do sumário')),
    { type: 'blockquote', content: [heading(2, text('Ação jurídica'))] },
    heading(2, text('日本語')),
    heading(2),
  );
  const outline = core.getContentOutline(payload, 'leitura');
  assert.equal(outline.length, 4);
  assert.equal(new Set(outline.map((item) => item.id)).size, 4);
  assert.equal(outline[0].text, 'Ação jurídica');
  assert.equal(outline[3].text, 'Seção 4');
  const html = renderToStaticMarkup(PublicContent({ document: payload, headingPrefix: 'leitura' }));
  for (const entry of outline) assert.ok(html.includes(`id="${entry.id}" tabindex="-1"`));
  assert.equal(core.getContentOutline(payload, '" onclick="evil')[0].id, outline[0].id);
});

test('unsupported embeds and executable URL variations cannot generate active HTML', () => {
  for (const type of ['script', 'iframe', 'embed', 'html', 'image'])
    assert.equal(PublicContent({ document: document({ type, content: [] }) }), null);
  for (const href of [
    'JAVASCRIPT:alert(1)',
    'vbscript:evil',
    'data:text/html,<script>x</script>',
    'java\nscript:evil',
    '//evil.test',
    '/%2f%2fevil.test',
  ]) {
    const payload = document(paragraph(text('Texto legível', [{ type: 'link', attrs: { href } }])));
    const html = renderToStaticMarkup(PublicContent({ document: payload }));
    assert.ok(html.includes('Texto legível'));
    assert.equal(html.includes('<a'), false);
  }
});
