import type { ComponentPropsWithRef, ReactNode } from 'react';

export type InputProps = ComponentPropsWithRef<'input'> & { invalid?: boolean };

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={['f-field-control', className].filter(Boolean).join(' ')}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
    />
  );
}

export type TextareaProps = ComponentPropsWithRef<'textarea'> & { invalid?: boolean };

export function Textarea({ invalid, className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      rows={rows}
      className={['f-field-control', 'f-field-control--textarea', className]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
    />
  );
}

export type SelectProps = ComponentPropsWithRef<'select'> & { invalid?: boolean };

export function Select({ invalid, className, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={['f-field-control', 'f-field-control--select', className]
        .filter(Boolean)
        .join(' ')}
      aria-invalid={invalid || props['aria-invalid'] || undefined}
    >
      {children}
    </select>
  );
}

export interface FormFieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: boolean;
}

export interface FormFieldProps {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: (props: FormFieldControlProps) => ReactNode;
}

export function FormField({
  id,
  label,
  help,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const hasHelp = help !== undefined && help !== null && help !== '';
  const hasError = error !== undefined && error !== null && error !== '';
  const describedBy = [hasHelp ? `${id}-help` : null, hasError ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['f-form-field', className].filter(Boolean).join(' ')}>
      <label className="f-form-field__label" htmlFor={id}>
        {label}
        {required ? <span className="f-form-field__required"> (obrigatório)</span> : null}
      </label>
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': hasError || undefined,
        required,
      })}
      {hasHelp ? (
        <p className="f-form-field__help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {hasError ? (
        <p className="f-form-field__error" id={`${id}-error`} role="alert">
          <span className="f-form-field__error-label">Erro: </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
