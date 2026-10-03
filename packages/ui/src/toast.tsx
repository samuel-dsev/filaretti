'use client';

export interface ToastProps {
  title: string;
  description?: string;
  variant?: 'info' | 'success' | 'error';
  onDismiss: () => void;
  className?: string;
}

export function Toast({ title, description, variant = 'info', onDismiss, className }: ToastProps) {
  return (
    <div className={['f-toast', `f-toast--${variant}`, className].filter(Boolean).join(' ')}>
      <span className="f-toast__symbol" aria-hidden="true">
        {variant === 'success' ? '✓' : variant === 'error' ? '!' : 'i'}
      </span>
      <div role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true">
        <p className="f-toast__title">{title}</p>
        {description ? <p className="f-toast__description">{description}</p> : null}
      </div>
      <button
        className="f-icon-button"
        type="button"
        onClick={onDismiss}
        aria-label="Dispensar aviso"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
