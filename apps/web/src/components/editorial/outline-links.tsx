'use client';

export function OutlineLinks({ entries }: { entries: { id: string; text: string }[] }) {
  return (
    <nav className="editorial-outline" aria-labelledby="sumario-heading">
      <p className="site-eyebrow">Nesta publicação</p>
      <h2 id="sumario-heading">Sumário</h2>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={() => document.getElementById(entry.id)?.focus({ preventScroll: true })}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
