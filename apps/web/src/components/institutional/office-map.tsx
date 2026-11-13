export function OfficeMap({ query }: { query: string }) {
  const params = new URLSearchParams({ origin: 'mfe', pb: `!1m2!2m1!1s${query}` });
  const src = `https://www.google.com/maps/embed?${params}`;
  return (
    <div className="institution-office-map">
      <iframe
        title="Localização do escritório no Google Maps"
        src={src}
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  );
}
