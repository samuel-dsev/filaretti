import { BadRequestException } from '@nestjs/common';
import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';
import type { PageSection, TipTapDocument, TipTapNode } from '@filaretti/types';

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
function only(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
export function safeUrl(value: unknown, internalOnly = false): value is string {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value))
    return false;
  if (value.startsWith('/') && !value.startsWith('//')) return !value.includes('%');
  if (internalOnly) return false;
  try {
    const url = new URL(value);
    return ['https:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isTipTapDocument(value: unknown): value is TipTapDocument {
  let count = 0;
  let textLength = 0;
  function node(input: unknown, depth: number, parent?: string): boolean {
    if (
      !object(input) ||
      !only(input, ['type', 'attrs', 'content', 'text', 'marks']) ||
      depth > 24 ||
      ++count > 2000
    )
      return false;
    const type = input.type;
    if (typeof type !== 'string') return false;
    if (parent === undefined ? type !== 'doc' : type === 'doc') return false;
    if (parent === 'doc' && !blockTypes.has(type)) return false;
    if (parent === 'paragraph' || parent === 'heading' || parent === 'codeBlock') {
      if (!inlineTypes.has(type) || (parent === 'codeBlock' && type !== 'text')) return false;
    }
    if (parent === 'bulletList' || parent === 'orderedList') {
      if (type !== 'listItem') return false;
    }
    if ((parent === 'listItem' || parent === 'blockquote') && !blockTypes.has(type)) return false;
    if (!blockTypes.has(type) && !inlineTypes.has(type) && !['doc', 'listItem'].includes(type))
      return false;
    if (type === 'text') {
      if (
        typeof input.text !== 'string' ||
        input.text.length === 0 ||
        input.content !== undefined ||
        input.attrs !== undefined
      )
        return false;
      textLength += input.text.length;
      if (textLength > 50000 || input.text.includes('\u0000')) return false;
      if (input.marks !== undefined) {
        if (!Array.isArray(input.marks) || input.marks.length > 6) return false;
        const seen = new Set<string>();
        for (const mark of input.marks) {
          if (
            !object(mark) ||
            !only(mark, ['type', 'attrs']) ||
            typeof mark.type !== 'string' ||
            !markTypes.has(mark.type) ||
            seen.has(mark.type)
          )
            return false;
          seen.add(mark.type);
          if (mark.type === 'link') {
            if (!object(mark.attrs) || !only(mark.attrs, ['href']) || !safeUrl(mark.attrs.href))
              return false;
          } else if (mark.attrs !== undefined) return false;
        }
      }
      return true;
    }
    if (input.text !== undefined || input.marks !== undefined) return false;
    if (input.attrs !== undefined) {
      if (!object(input.attrs)) return false;
      if (type === 'heading') {
        if (
          !only(input.attrs, ['level']) ||
          ![2, 3, 4].includes(Number(input.attrs.level)) ||
          typeof input.attrs.level !== 'number'
        )
          return false;
      } else if (type === 'orderedList') {
        if (
          !only(input.attrs, ['start']) ||
          !Number.isInteger(input.attrs.start) ||
          Number(input.attrs.start) < 1 ||
          Number(input.attrs.start) > 10000
        )
          return false;
      } else if (type === 'codeBlock') {
        if (
          !only(input.attrs, ['language']) ||
          typeof input.attrs.language !== 'string' ||
          !/^[a-z0-9-]{1,30}$/u.test(input.attrs.language)
        )
          return false;
      } else return false;
    } else if (type === 'heading') return false;
    if (type === 'hardBreak' || type === 'horizontalRule') return input.content === undefined;
    if (!Array.isArray(input.content)) return false;
    return input.content.every((child) => node(child, depth + 1, type));
  }
  return node(value, 0);
}

export function isPageSections(value: unknown): value is PageSection[] {
  if (!Array.isArray(value) || value.length > 30) return false;
  const keys = new Set<string>();
  return value.every((section: unknown) => {
    if (
      !object(section) ||
      !only(section, ['key', 'heading', 'body']) ||
      typeof section.key !== 'string' ||
      !/^[a-z0-9-]{1,64}$/u.test(section.key) ||
      keys.has(section.key)
    )
      return false;
    keys.add(section.key);
    return (
      (section.heading === undefined ||
        (typeof section.heading === 'string' && section.heading.length <= 200)) &&
      isTipTapDocument(section.body)
    );
  });
}

@ValidatorConstraint({ name: 'tipTapDocument' })
export class TipTapConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return isTipTapDocument(value);
  }
  defaultMessage() {
    return 'Conteúdo editorial fora do schema permitido.';
  }
}
@ValidatorConstraint({ name: 'pageSections' })
export class PageSectionsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return isPageSections(value);
  }
}
@ValidatorConstraint({ name: 'safeUrl' })
export class SafeUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return safeUrl(value);
  }
}
@ValidatorConstraint({ name: 'internalPath' })
export class InternalPathConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return (
      safeUrl(value, true) &&
      !value.includes('?') &&
      !value.includes('#') &&
      !value.split('/').some((part) => part === '.' || part === '..')
    );
  }
}
export function publicContent(value: unknown): TipTapDocument {
  if (!isTipTapDocument(value)) throw new BadRequestException({ code: 'INVALID_CONTENT' });
  return value;
}
export function publicSections(value: unknown): PageSection[] {
  if (!isPageSections(value)) throw new BadRequestException({ code: 'INVALID_CONTENT' });
  return value;
}
export function plainText(document: TipTapNode): string {
  return document.text ?? (document.content ?? []).map(plainText).join(' ');
}
