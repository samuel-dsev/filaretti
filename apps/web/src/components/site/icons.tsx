export function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
      {diagonal ? <path d="M6 18 18 6M6 6h12v12" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M4.1 16.5 3 21l4.6-1.2a9 9 0 1 0-3.5-3.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        fill="currentColor"
        d="M9.1 7.2c-.4-.1-.8 0-1.1.3-.5.5-.8 1.2-.7 2 .3 2.8 3.6 6.1 6.4 6.8.9.2 1.8 0 2.4-.6.3-.3.5-.8.5-1.2 0-.2-.1-.3-.3-.4l-2-1c-.2-.1-.4-.1-.5.1l-.8.9c-.1.1-.3.2-.5.1-1.4-.6-2.4-1.6-3.1-2.8-.1-.2-.1-.4 0-.5l.6-.8c.1-.2.2-.4.1-.6L9.5 7.6c-.1-.3-.2-.4-.4-.4Z"
      />
    </svg>
  );
}
