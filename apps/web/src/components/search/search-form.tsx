import { Button, Input } from '@filaretti/ui';
import type { PublicSearchQuery } from '@filaretti/types';
import styles from './search.module.css';

export function SearchForm({ query }: { query: PublicSearchQuery }) {
  return (
    <form action="/busca" method="get" className={styles.form} data-analytics-event="search">
      <div className={styles.field}>
        <label htmlFor="search-query">Palavra ou assunto</label>
        <Input
          id="search-query"
          name="q"
          type="search"
          defaultValue={query.q}
          required
          minLength={2}
          maxLength={120}
          autoComplete="off"
          aria-describedby="search-help"
        />
      </div>
      <div className={`${styles.field} ${styles.kind}`}>
        <label htmlFor="search-kind">Pesquisar em</label>
        <select id="search-kind" name="kind" defaultValue={query.kind ?? 'all'}>
          <option value="all">Todo o site</option>
          <option value="article">Conteúdos</option>
          <option value="area">Áreas de atuação</option>
          <option value="professional">Profissionais</option>
        </select>
      </div>
      <Button type="submit">Buscar</Button>
    </form>
  );
}
