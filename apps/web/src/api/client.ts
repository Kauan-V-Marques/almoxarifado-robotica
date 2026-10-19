import type { ApiError, User } from '@almox/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: ApiError['details'],
  ) {
    super(message);
  }
}

interface Session {
  accessToken: string;
  user: User;
}

// O access token fica só na memória (nunca em localStorage, onde um script malicioso leria).
// Ao recarregar a página, a sessão volta pelo cookie httpOnly de refresh.
let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;
let onSessionChange: (user: User | null) => void = () => {};

export function setSessionListener(listener: (user: User | null) => void) {
  onSessionChange = listener;
}

export function startSession(session: Session) {
  accessToken = session.accessToken;
  onSessionChange(session.user);
}

export function clearSession() {
  accessToken = null;
  onSessionChange(null);
}

/** Pede um novo access token. Chamadas simultâneas compartilham a mesma requisição. */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) return null;
      const session = (await response.json()) as Session;
      startSession(session);
      return session;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });

  // Token expirado: renova uma vez e repete a chamada, sem o usuário perceber
  if (response.status === 401 && retry && !path.startsWith('/api/auth/')) {
    if (await refreshSession()) return api<T>(path, init, false);
    clearSession();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: 'Erro inesperado.' }))) as ApiError;
    throw new ApiRequestError(response.status, body.error, body.details);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
