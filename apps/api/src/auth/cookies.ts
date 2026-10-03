import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ApiEnvironment } from '@filaretti/config';
import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import type { SessionTokens } from './types';

export const AUTH_COOKIES = {
  access: 'filaretti_access',
  refresh: 'filaretti_refresh',
  csrf: 'filaretti_csrf',
} as const;

export function readCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.cookie;
  if (!raw || raw.length > 16384) return undefined;
  const matches = raw
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  try {
    return decodeURIComponent(matches[0]!.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

export function constantEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function tokenHash(environment: ApiEnvironment, token: string): string {
  return createHmac('sha256', environment.REFRESH_TOKEN_SECRET).update(token).digest('hex');
}

export function validateOrigin(request: Request, environment: ApiEnvironment): void {
  const origin = request.headers.origin;
  if (origin !== new URL(environment.WEB_PUBLIC_URL).origin) {
    throw new ForbiddenException({ code: 'ORIGIN_FORBIDDEN' });
  }
  const fetchSite = request.headers['sec-fetch-site'];
  if (fetchSite === 'cross-site') throw new ForbiddenException({ code: 'ORIGIN_FORBIDDEN' });
}

function csrfSignature(environment: ApiEnvironment, value: string): string {
  return createHmac('sha256', environment.REFRESH_TOKEN_SECRET)
    .update(`prelogin-csrf:${value}`)
    .digest('hex');
}

export function createPreloginCsrf(environment: ApiEnvironment): string {
  const value = `${randomBytes(32).toString('hex')}.${Date.now()}`;
  return `${value}.${csrfSignature(environment, value)}`;
}

export function validatePreloginCsrf(request: Request, environment: ApiEnvironment): void {
  validateOrigin(request, environment);
  const cookie = readCookie(request, AUTH_COOKIES.csrf);
  const header = request.headers['x-csrf-token'];
  if (!cookie || typeof header !== 'string' || !constantEqual(cookie, header)) {
    throw new ForbiddenException({ code: 'CSRF_INVALID' });
  }
  const parts = cookie.split('.');
  const timestamp = Number(parts[1]);
  if (
    parts.length !== 3 ||
    !/^[a-f0-9]{64}$/.test(parts[0] ?? '') ||
    !Number.isFinite(timestamp) ||
    timestamp > Date.now() ||
    Date.now() - timestamp > 3600000 ||
    !constantEqual(parts[2] ?? '', csrfSignature(environment, `${parts[0]}.${parts[1]}`))
  ) {
    throw new ForbiddenException({ code: 'CSRF_INVALID' });
  }
}

function cookieOptions(environment: ApiEnvironment): CookieOptions {
  return {
    httpOnly: true,
    secure: environment.COOKIE_SECURE,
    sameSite: environment.COOKIE_SAME_SITE,
    path: '/api/v1',
  };
}

export function writeCsrfCookie(
  response: Response,
  environment: ApiEnvironment,
  csrfToken: string,
): void {
  response.cookie(AUTH_COOKIES.csrf, csrfToken, {
    ...cookieOptions(environment),
    maxAge: environment.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function writeSessionCookies(
  response: Response,
  environment: ApiEnvironment,
  tokens: SessionTokens,
): void {
  response.cookie(AUTH_COOKIES.access, tokens.accessToken, {
    ...cookieOptions(environment),
    maxAge: environment.JWT_ACCESS_TTL_SECONDS * 1000,
  });
  response.cookie(AUTH_COOKIES.refresh, tokens.refreshToken, {
    ...cookieOptions(environment),
    maxAge: environment.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
  writeCsrfCookie(response, environment, tokens.csrfToken);
}

export function clearSessionCookies(response: Response, environment: ApiEnvironment): void {
  for (const name of Object.values(AUTH_COOKIES))
    response.clearCookie(name, cookieOptions(environment));
}
