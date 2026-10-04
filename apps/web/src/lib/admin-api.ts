'use client';

import type { AuthenticationResponse, CsrfResponse, PaginatedResponse } from '@filaretti/types';

let csrfToken = '';
let refreshRequest: Promise<AuthenticationResponse> | undefined;

export class AdminApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const messages: Record<string, string> = {
  INVALID_TOKEN: 'Este link expirou ou já foi utilizado. Solicite um novo link.',
  VERSION_CONFLICT:
    'Este registro foi alterado por outra pessoa. Seu texto foi preservado. Recarregue o registro antes de reaplicar as alterações.',
  RESOURCE_IN_USE: 'Este registro está em uso e não pode ser excluído.',
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente para continuar.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  CONTENT_FORBIDDEN: 'Você não tem permissão para editar este conteúdo.',
  INVALID_REQUEST: 'Revise os campos e os limites indicados antes de salvar.',
  INVALID_PUBLICATION:
    'O conteúdo precisa de texto, autor e vínculos ativos para ser publicado. Revise também a data do agendamento.',
  INVALID_RELATION: 'Selecione apenas registros e mídias editoriais ativos.',
  INVALID_CONTENT: 'O texto contém formatação ou um link não permitido.',
  CONFLICT: 'Já existe um registro com estes dados. Revise o e-mail ou o slug.',
  RATE_LIMITED: 'Limite de tentativas atingido. Aguarde antes de tentar novamente.',
  REDIRECT_LOOP: 'Este redirecionamento cria um ciclo. Escolha outro destino.',
  INVALID_MEDIA: 'Arquivo inválido. Envie uma imagem aceita de até 5 MB ou PDF de até 10 MB.',
  PAYLOAD_TOO_LARGE:
    'O arquivo excede o tamanho permitido. Use uma imagem de até 5 MB ou PDF de até 10 MB.',
};

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!path.startsWith('auth/') && !path.startsWith('admin/'))
    throw new AdminApiError('INVALID_REQUEST', 400, messages.INVALID_REQUEST!);
  const method = init.method ?? 'GET';
  const mutation = method !== 'GET' && method !== 'HEAD';
  if (mutation && !csrfToken) await obtainCsrf();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (mutation) headers.set('X-CSRF-Token', csrfToken);
  let response: Response;
  try {
    response = await fetch(`/api/cms/${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new AdminApiError(
      'UNAVAILABLE',
      503,
      'Não foi possível acessar o serviço. Seus campos foram preservados; tente novamente.',
    );
  }
  if (
    response.status === 401 &&
    retry &&
    (!path.startsWith('auth/') || path === 'auth/logout' || path === 'auth/password')
  ) {
    await refreshSession();
    return request<T>(path, init, false);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    const detail =
      typeof body === 'object' && body !== null && 'error' in body ? body.error : undefined;
    const code =
      typeof detail === 'object' &&
      detail !== null &&
      'code' in detail &&
      typeof detail.code === 'string'
        ? detail.code
        : 'UNAVAILABLE';
    throw new AdminApiError(
      code,
      response.status,
      messages[code] ?? 'Não foi possível concluir a ação. Revise os campos ou tente novamente.',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function obtainCsrf() {
  const data = await request<CsrfResponse>('auth/csrf', {}, false);
  csrfToken = data.csrfToken;
}

export async function login(email: string, password: string) {
  await obtainCsrf();
  const data = await request<AuthenticationResponse>(
    'auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
  csrfToken = data.csrfToken;
  return data.user;
}

export function refreshSession() {
  refreshRequest ??= request<AuthenticationResponse>('auth/refresh', { method: 'POST' }, false)
    .then((data) => {
      csrfToken = data.csrfToken;
      return data;
    })
    .finally(() => {
      refreshRequest = undefined;
    });
  return refreshRequest;
}

export async function logout() {
  await request('auth/logout', { method: 'POST' });
  csrfToken = '';
}

export const adminApi = request;

/** Relationship pickers load every page, including catalogs larger than fifty items. */
export async function adminOptions<T>(path: string): Promise<T[]> {
  if (!path.startsWith('admin/'))
    throw new AdminApiError('INVALID_REQUEST', 400, messages.INVALID_REQUEST!);
  return allOptions<T>((page) => request<PaginatedResponse<T>>(`${path}?page=${page}&limit=50`));
}

type PublicOptionPath =
  'professionals' | 'practice-areas' | 'taxonomies/categories' | 'taxonomies/tags';
const publicOptionPaths: readonly string[] = [
  'professionals',
  'practice-areas',
  'taxonomies/categories',
  'taxonomies/tags',
];

/** Authors select only active public relationships; session cookies never accompany these reads. */
export async function publicOptions<T>(path: PublicOptionPath): Promise<T[]> {
  if (!publicOptionPaths.includes(path))
    throw new AdminApiError('INVALID_REQUEST', 400, messages.INVALID_REQUEST!);
  return allOptions<T>(async (page) => {
    let response: Response;
    try {
      response = await fetch(`/api/v1/${path}?page=${page}&limit=50`, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch {
      throw new AdminApiError(
        'UNAVAILABLE',
        503,
        'Não foi possível carregar os relacionamentos. Tente novamente.',
      );
    }
    if (!response.ok)
      throw new AdminApiError(
        'UNAVAILABLE',
        response.status,
        'Não foi possível carregar os relacionamentos. Tente novamente.',
      );
    return response.json() as Promise<PaginatedResponse<T>>;
  });
}

async function allOptions<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const records: T[] = [];
  let page = 1;
  let pages = 1;
  do {
    const result = await fetchPage(page);
    records.push(...result.data);
    pages = result.meta.pages;
    page += 1;
  } while (page <= pages);
  return records;
}
