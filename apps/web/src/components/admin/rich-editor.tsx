'use client';

import { useEffect, useId, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import type { TipTapDocument, TipTapMark, TipTapNode } from '@filaretti/types';
import { Button, Input } from '@filaretti/ui';
import { safePublicUrl } from '@/lib/public-content-core';

// TipTap emits default attrs such as target/rel/class and null language. The API
// accepts only this explicit editorial schema, independent of DOM attributes.
function editorialNode(input: JSONContent): TipTapNode {
  const node: TipTapNode = { type: input.type as TipTapNode['type'] };
  if (typeof input.text === 'string') node.text = input.text;
  if (input.content) node.content = input.content.map(editorialNode);
  if (input.type === 'heading') node.attrs = { level: Number(input.attrs?.level ?? 2) };
  if (input.type === 'orderedList') node.attrs = { start: Number(input.attrs?.start ?? 1) };
  if (input.type === 'codeBlock' && typeof input.attrs?.language === 'string')
    node.attrs = { language: input.attrs.language };
  if (input.marks)
    node.marks = input.marks.flatMap((mark): TipTapMark[] => {
      if (mark.type === 'link') {
        const href = safePublicUrl(mark.attrs?.href);
        return href ? [{ type: 'link', attrs: { href } }] : [];
      }
      return ['bold', 'italic', 'underline', 'strike', 'code'].includes(mark.type ?? '')
        ? [{ type: mark.type as TipTapMark['type'] }]
        : [];
    });
  return node;
}

export function RichEditor({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: TipTapDocument;
  onChange: (value: TipTapDocument) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ['https', 'mailto', 'tel'],
        },
        trailingNode: false,
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        'aria-describedby': `${id}-help`,
        class: 'cms-prose-editor',
      },
    },
    onUpdate: ({ editor: current }) => {
      if (disabled) return;
      const document = editorialNode(current.getJSON());
      onChange({ type: 'doc', content: document.content ?? [] });
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    const current = editorialNode(editor.getJSON());
    if (JSON.stringify(current) !== JSON.stringify(value))
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);
  const controls = editor
    ? [
        {
          label: 'Negrito',
          active: editor.isActive('bold'),
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: 'Itálico',
          active: editor.isActive('italic'),
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: 'Sublinhado',
          active: editor.isActive('underline'),
          run: () => editor.chain().focus().toggleUnderline().run(),
        },
        {
          label: 'Título H2',
          active: editor.isActive('heading', { level: 2 }),
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: 'Título H3',
          active: editor.isActive('heading', { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: 'Lista',
          active: editor.isActive('bulletList'),
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: 'Lista numerada',
          active: editor.isActive('orderedList'),
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          label: 'Citação',
          active: editor.isActive('blockquote'),
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          label: 'Código',
          active: editor.isActive('codeBlock'),
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
      ]
    : [];
  return (
    <div className="cms-rich-field">
      <p className="f-form-field__label">{label}</p>
      <div className="cms-editor" aria-busy={!editor}>
        <div
          className="cms-editor-toolbar"
          role="group"
          aria-label={`Formatação de ${label.toLowerCase()}`}
        >
          {controls.map((control) => (
            <Button
              key={control.label}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={control.active}
              disabled={disabled}
              onClick={control.run}
            >
              {control.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !editor}
            onClick={() => {
              setLink((editor?.getAttributes('link').href as string) ?? '');
              setLinkOpen(!linkOpen);
            }}
          >
            Link
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            Desfazer
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            Refazer
          </Button>
        </div>
        {linkOpen ? (
          <div className="cms-link-edit">
            <label htmlFor={`${id}-link`}>Endereço do link</label>
            <Input
              id={`${id}-link`}
              value={link}
              disabled={disabled}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://…"
            />
            <Button
              type="button"
              size="sm"
              disabled={disabled || !editor}
              onClick={() => {
                const href = safePublicUrl(link);
                if (!href) {
                  setLinkError(
                    'Informe um endereço HTTPS, e-mail, telefone ou caminho interno permitido.',
                  );
                  return;
                }
                editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
                setLinkError('');
                setLinkOpen(false);
              }}
            >
              Aplicar link
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || !editor}
              onClick={() => {
                editor?.chain().focus().unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Remover link
            </Button>
            {linkError ? (
              <p role="alert" className="cms-error">
                {linkError}
              </p>
            ) : null}
          </div>
        ) : null}
        <EditorContent editor={editor} />
      </div>
      <p id={`${id}-help`} className="f-form-field__help">
        Use H2 e H3 para organizar o texto. Imagens e PDFs são selecionados nos campos de mídia.
      </p>
    </div>
  );
}
