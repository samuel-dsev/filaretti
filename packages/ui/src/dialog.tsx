'use client';

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

let scrollLocks = 0;
let previousOverflow = '';

function lockScroll() {
  if (scrollLocks === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  return () => {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.style.overflow = previousOverflow;
  };
}

function getFocusableElements(dialog: HTMLDialogElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]',
    ),
  ).filter(
    (element) =>
      element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'),
  );
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
}

type ModalSurfaceProps = DialogProps & { side?: 'left' | 'right'; drawer?: boolean };

function ModalSurface({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  className,
  drawer = false,
  side = 'right',
}: ModalSurfaceProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const labelId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    const unlockScroll = lockScroll();
    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = initialFocusRef?.current;
      const first =
        preferred && dialog.contains(preferred) ? preferred : getFocusableElements(dialog)[0];
      (first ?? dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (dialog.open) dialog.close();
      unlockScroll();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open, initialFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const elements = getFocusableElements(event.currentTarget);
    const first = elements[0];
    const last = elements.at(-1);
    if (!first || !last) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === event.currentTarget)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || document.activeElement === event.currentTarget)
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={[
        'f-dialog',
        drawer ? 'f-dialog--drawer' : 'f-dialog--modal',
        drawer ? `f-dialog--${side}` : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-labelledby={`${labelId}-title`}
      aria-describedby={description ? `${labelId}-description` : undefined}
      aria-modal="true"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="f-dialog__header">
        <div>
          <h2 className="f-dialog__title" id={`${labelId}-title`}>
            {title}
          </h2>
          {description ? (
            <p className="f-dialog__description" id={`${labelId}-description`}>
              {description}
            </p>
          ) : null}
        </div>
        <button className="f-icon-button" type="button" onClick={onClose} aria-label="Fechar">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="f-dialog__body">{children}</div>
      {footer ? <div className="f-dialog__footer">{footer}</div> : null}
    </dialog>
  );
}

export function Dialog(props: DialogProps) {
  return <ModalSurface {...props} />;
}

export type DrawerProps = DialogProps & { side?: 'left' | 'right' };

export function Drawer(props: DrawerProps) {
  return <ModalSurface {...props} drawer />;
}
