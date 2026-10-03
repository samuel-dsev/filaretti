import type { TipTapDocument, TipTapMark, TipTapNode } from '@filaretti/types';

const blockTypes = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'blockquote',
  'horizontalRule',
  'codeBlock',
]);
const inlineTypes = new Set(['text', 'hardBreak']);
const markTypes = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Public links use the same protocol policy as the API, checked again before rendering. */
export function safePublicUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value))
    return null;
  if (value.startsWith('/') && !value.startsWith('//')) return value.includes('%') ? null : value;
  try {
    const url = new URL(value);
    if (!['https:', 'mailto:', 'tel:'].includes(url.protocol) || url.username || url.password)
      return null;
    return value;
  } catch {
    return null;
  }
}

export function safeMediaUrl(value: unknown): string | null {
  const safe = safePublicUrl(value);
  return safe && (safe.startsWith('/') || new URL(safe).protocol === 'https:') ? safe : null;
}

/** Build a bounded, allowlisted document. Unsafe links lose their mark and retain readable text. */
export function parsePublicDocument(value: unknown): TipTapDocument | null {
  let count = 0;
  let textLength = 0;

  function parseNode(input: unknown, depth: number, parent?: string): TipTapNode | null {
    if (!object(input) || depth > 24 || ++count > 2000 || typeof input.type !== 'string')
      return null;
    const type = input.type;
    if (parent === undefined ? type !== 'doc' : type === 'doc') return null;
    if (parent === 'doc' && !blockTypes.has(type)) return null;
    if (['paragraph', 'heading', 'codeBlock'].includes(parent ?? '')) {
      if (!inlineTypes.has(type) || (parent === 'codeBlock' && type !== 'text')) return null;
    }
    if ((parent === 'bulletList' || parent === 'orderedList') && type !== 'listItem') return null;
    if ((parent === 'listItem' || parent === 'blockquote') && !blockTypes.has(type)) return null;
    if (type === 'text') {
      if (typeof input.text !== 'string' || !input.text || input.text.includes('\u0000'))
        return null;
      textLength += input.text.length;
      if (textLength > 50000 || input.content !== undefined) return null;
      const textNode: TipTapNode = { type: 'text', text: input.text };
      if (input.marks !== undefined) {
        if (!Array.isArray(input.marks) || input.marks.length > 6) return null;
        const marks: TipTapMark[] = [];
        const seen = new Set<string>();
        for (const mark of input.marks) {
          if (
            !object(mark) ||
            typeof mark.type !== 'string' ||
            !markTypes.has(mark.type) ||
            seen.has(mark.type)
          )
            return null;
          seen.add(mark.type);
          if (mark.type === 'link') {
            const href = object(mark.attrs) ? safePublicUrl(mark.attrs.href) : null;
            if (href) marks.push({ type: 'link', attrs: { href } });
          } else {
            marks.push({ type: mark.type as Exclude<TipTapMark['type'], 'link'> });
          }
        }
        if (marks.length) textNode.marks = marks;
      }
      return textNode;
    }
    if (type === 'hardBreak' || type === 'horizontalRule') {
      return input.content === undefined ? { type } : null;
    }
    if (!blockTypes.has(type) && type !== 'doc' && type !== 'listItem') return null;
    if (!Array.isArray(input.content)) return null;
    const content: TipTapNode[] = [];
    for (const child of input.content) {
      const parsed = parseNode(child, depth + 1, type);
      if (!parsed) return null;
      content.push(parsed);
    }
    const node: TipTapNode = { type: type as TipTapNode['type'], content };
    if (type === 'heading') {
      if (
        !object(input.attrs) ||
        ![2, 3, 4].includes(Number(input.attrs.level)) ||
        typeof input.attrs.level !== 'number'
      )
        return null;
      node.attrs = { level: input.attrs.level };
    } else if (type === 'orderedList' && input.attrs !== undefined) {
      if (
        !object(input.attrs) ||
        !Number.isInteger(input.attrs.start) ||
        Number(input.attrs.start) < 1 ||
        Number(input.attrs.start) > 10000
      )
        return null;
      node.attrs = { start: Number(input.attrs.start) };
    } else if (type === 'codeBlock' && input.attrs !== undefined) {
      if (
        !object(input.attrs) ||
        typeof input.attrs.language !== 'string' ||
        !/^[a-z0-9-]{1,30}$/u.test(input.attrs.language)
      )
        return null;
      node.attrs = { language: input.attrs.language };
    }
    return node;
  }

  const document = parseNode(value, 0);
  return document?.type === 'doc' && document.content
    ? { type: 'doc', content: document.content }
    : null;
}

export function contentText(
  document: TipTapDocument | null | undefined,
  maxLength?: number,
): string {
  const parsed = parsePublicDocument(document);
  if (!parsed) return '';
  function text(node: TipTapNode): string {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    const separator = ['paragraph', 'heading', 'codeBlock'].includes(node.type) ? '' : '\n';
    return (node.content ?? []).map(text).join(separator);
  }
  const value = text(parsed).replace(/\s+/gu, ' ').trim();
  if (maxLength === undefined || !Number.isFinite(maxLength)) return value;
  return value.slice(0, Math.max(0, Math.floor(maxLength))).trimEnd();
}
