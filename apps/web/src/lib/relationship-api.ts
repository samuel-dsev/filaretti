'use client';

import type { RelationshipAccepted } from '@filaretti/types';

const messages: Record<string, string> = {
  INVALID_REQUEST: 'Revise os campos obrigatórios e os limites indicados.',
  INVALID_MEDIA:
    'Arquivo inválido. Envie PDF ou imagem JPEG, PNG, WebP ou AVIF dentro dos limites.',
  PAYLOAD_TOO_LARGE: 'Envie até três anexos, com no máximo 15 MiB no total.',
  CONTACT_FILES_LIMIT: 'Envie até três anexos, com no máximo 15 MiB no total.',
  RATE_LIMITED: 'Limite de tentativas atingido. Aguarde antes de tentar novamente.',
  ANTISPAM_FAILED: 'A verificação de segurança expirou ou falhou. Faça uma nova verificação.',
  ANTISPAM_UNAVAILABLE:
    'A verificação de segurança está indisponível. Seus campos foram preservados; tente novamente mais tarde.',
  TURNSTILE_FAILED: 'A verificação de segurança expirou ou falhou. Faça uma nova verificação.',
  INVALID_TOKEN: 'Este link expirou ou já foi utilizado. Solicite novas instruções.',
  INVALID_NEWSLETTER_TOKEN: 'Este link expirou ou já foi utilizado. Solicite novas instruções.',
  INVALID_RELATION:
    'A área selecionada não está disponível. Recarregue a página e selecione uma área publicada.',
  IDEMPOTENCY_CONFLICT:
    'Esta solicitação já foi enviada com outros dados. Reabra o formulário para um novo envio.',
};

export async function relationshipApi(
  path: string,
  body: FormData | object,
): Promise<RelationshipAccepted> {
  if (
    !['contact', 'newsletter/subscribe', 'newsletter/confirm', 'newsletter/unsubscribe'].includes(
      path,
    )
  )
    throw new Error('Ação não disponível.');
  let response: Response;
  try {
    response = await fetch(`/api/relationship/${path}`, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new Error(
      'Não foi possível acessar o serviço. Seus campos foram preservados; tente novamente.',
    );
  }
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => undefined);
    const detail =
      typeof value === 'object' && value !== null && 'error' in value ? value.error : null;
    const code =
      typeof detail === 'object' &&
      detail !== null &&
      'code' in detail &&
      typeof detail.code === 'string'
        ? detail.code
        : '';
    throw new Error(
      messages[code] ?? 'Não foi possível concluir. Revise os campos ou tente novamente.',
    );
  }
  return response.json() as Promise<RelationshipAccepted>;
}
