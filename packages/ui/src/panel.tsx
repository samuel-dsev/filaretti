import type { ComponentPropsWithoutRef } from 'react';

export type PanelProps = ComponentPropsWithoutRef<'section'>;

export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <section
      className={['filaretti-panel', 'f-panel', className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </section>
  );
}
