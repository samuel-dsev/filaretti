import type { TipTapDocument, TipTapMark, TipTapNode } from '@filaretti/types';
import { Fragment, type ReactNode } from 'react';

import { getContentOutline, parsePublicDocument, safePublicUrl } from './public-content-core';

export { contentText, safePublicUrl, safeMediaUrl } from './public-content-core';

export interface PublicContentProps {
  document: TipTapDocument;
  className?: string;
  headingPrefix?: string;
}

function renderMark(children: ReactNode, mark: TipTapMark, key: number): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong key={key}>{children}</strong>;
    case 'italic':
      return <em key={key}>{children}</em>;
    case 'underline':
      return <u key={key}>{children}</u>;
    case 'strike':
      return <s key={key}>{children}</s>;
    case 'code':
      return <code key={key}>{children}</code>;
    case 'link': {
      const href = safePublicUrl(mark.attrs?.href);
      return href ? (
        <a key={key} href={href}>
          {children}
        </a>
      ) : (
        children
      );
    }
  }
}

function renderNode(node: TipTapNode, key: number, headingIds: Iterator<string>): ReactNode {
  const headingId =
    node.type === 'heading' && node.attrs?.level === 2
      ? (headingIds.next().value as string | undefined)
      : undefined;
  const children = node.content?.map((child, index) => renderNode(child, index, headingIds));
  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>;
    case 'text':
      return (
        <Fragment key={key}>
          {(node.marks ?? []).reduce<ReactNode>(
            (value, mark, index) => renderMark(value, mark, index),
            node.text ?? '',
          )}
        </Fragment>
      );
    case 'paragraph':
      return <p key={key}>{children}</p>;
    case 'heading':
      if (node.attrs?.level === 3) return <h3 key={key}>{children}</h3>;
      if (node.attrs?.level === 4) return <h4 key={key}>{children}</h4>;
      return (
        <h2 key={key} id={headingId} tabIndex={headingId ? -1 : undefined}>
          {children}
        </h2>
      );
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={node.attrs?.start}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      );
  }
}

export function PublicContent({ document, className, headingPrefix }: PublicContentProps) {
  const parsed = parsePublicDocument(document);
  if (!parsed) return null;
  const headingIds = (headingPrefix ? getContentOutline(parsed, headingPrefix) : [])
    .map((entry) => entry.id)
    .values();
  return (
    <div className={['public-content', className].filter(Boolean).join(' ')}>
      {parsed.content.map((node, index) => renderNode(node, index, headingIds))}
    </div>
  );
}
