import type { ComponentPropsWithRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['f-button', `f-button--${variant}`, `f-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="f-button__spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export type LinkButtonProps = Omit<ComponentPropsWithRef<'a'>, 'href'> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
};

export function LinkButton({
  variant = 'primary',
  size = 'md',
  disabled = false,
  href,
  className,
  children,
  onClick,
  tabIndex,
  ...props
}: LinkButtonProps) {
  return (
    <a
      {...props}
      href={disabled ? undefined : href}
      role={disabled ? 'link' : props.role}
      className={['f-button', `f-button--${variant}`, `f-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      // No href and no callback make disabled links inert without JavaScript.
      // Enabled static links can render on the server; client callers retain their handlers.
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </a>
  );
}
