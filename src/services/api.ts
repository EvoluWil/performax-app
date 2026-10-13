import { Query, QueryString } from 'nestjs-prisma-querybuilder-interface';

import {
  clearTokens,
  getTokens,
  persistTokens,
  SessionTokens,
} from '@/services/token-bridge';

const REFRESH_MARGIN_MS = 60_000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function apiBaseUrl() {
  return process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Query;
  searchParams?: Record<string, string>;
  signal?: AbortSignal;
  auth?: boolean;
};

let refreshInFlight: Promise<void> | null = null;

function messageFromBody(body: unknown, fallback: string) {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  return fallback;
}

async function parseBody(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const tokens = getTokens();
      const base = apiBaseUrl();
      if (!tokens || !base) {
        await clearTokens();
        throw new ApiError('Sessão expirada', 401);
      }

      const response = await fetch(`${base}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken, persistent: true }),
      });
      const body = await parseBody(response);
      if (!response.ok) {
        await clearTokens();
        throw new ApiError(messageFromBody(body, 'Sessão expirada'), response.status);
      }

      const session = (body as { session?: SessionTokens } | undefined)?.session;
      if (!session?.accessToken || !session.refreshToken) {
        await clearTokens();
        throw new ApiError('Sessão expirada', 401);
      }

      await persistTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        accessTokenExpires:
          session.accessTokenExpires == null ? null : Number(session.accessTokenExpires),
      });
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function ensureFreshToken() {
  const tokens = getTokens();
  if (!tokens || tokens.accessTokenExpires == null) return;
  if (tokens.accessTokenExpires - Date.now() > REFRESH_MARGIN_MS) return;
  await refreshSession();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = apiBaseUrl();
  if (!base) {
    throw new ApiError('O endereço da API não está configurado.', 0);
  }

  const useAuth = options.auth !== false;
  if (useAuth) await ensureFreshToken();

  const response = await send(base, path, options, useAuth);
  if (response.status === 401 && useAuth) {
    await refreshSession();
    const retried = await send(base, path, options, true);
    return readResponse<T>(retried);
  }

  return readResponse<T>(response);
}

async function send(base: string, path: string, options: RequestOptions, useAuth: boolean) {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  if (options.query) {
    const serialized = QueryString(options.query);
    const extra = new URLSearchParams(serialized);
    extra.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (useAuth) {
    const token = getTokens()?.accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url.toString(), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(messageFromBody(body, 'Não foi possível concluir agora.'), response.status);
  }
  return body as T;
}
