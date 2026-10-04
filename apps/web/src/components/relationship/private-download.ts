'use client';

import { refreshSession } from '@/lib/admin-api';

/** Private bytes remain on the authenticated BFF; no persistent URL is displayed or stored. */
export async function privateDownload(path: string, filename: string) {
  if (
    !/^\/api\/cms\/admin\/(?:contact-downloads\/[a-f0-9]{64}|subscribers\/export(?:\?[^#]*)?)$/u.test(
      path,
    )
  )
    throw new Error('Download indisponível.');
  const options: RequestInit = {
    credentials: 'same-origin',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  };
  let response = await fetch(path, options);
  if (response.status === 401) {
    await refreshSession();
    response = await fetch(path, options);
  }
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => null);
    const detail =
      typeof value === 'object' && value !== null && 'error' in value ? value.error : null;
    const code =
      typeof detail === 'object' && detail !== null && 'code' in detail ? detail.code : null;
    if (code === 'EXPORT_LIMIT_EXCEEDED')
      throw new Error(
        'A exportação permite até 10.000 registros. Reduza os resultados usando os filtros.',
      );
    if (code === 'ATTACHMENT_QUARANTINED')
      throw new Error('O arquivo aguarda verificação e ainda não pode ser baixado.');
    throw new Error(
      response.status === 403
        ? 'Seu perfil não pode acessar este arquivo.'
        : 'O download não está disponível. Reabra a solicitação e tente novamente.',
    );
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
