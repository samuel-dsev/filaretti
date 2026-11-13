'use client';

import { useState } from 'react';
import { Button } from '@filaretti/ui';

export function OfficeMap({ query }: { query: string }) {
  const [visible, setVisible] = useState(false);
  const src = `https://www.google.com/maps?${new URLSearchParams({ q: query, output: 'embed' })}`;
  return (
    <div className="institution-office-map">
      {visible ? (
        <iframe
          title="Localização do escritório no Google Maps"
          src={src}
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setVisible(true)}>
          Carregar mapa
        </Button>
      )}
    </div>
  );
}
