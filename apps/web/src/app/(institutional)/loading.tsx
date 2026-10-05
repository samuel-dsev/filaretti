import { Skeleton } from '@filaretti/ui';

export default function Loading() {
  return (
    <section
      className="f-container foundation institution-loading"
      aria-busy="true"
      aria-label="Carregando página"
    >
      <Skeleton label="Carregando informações" />
      <Skeleton />
      <Skeleton />
    </section>
  );
}
