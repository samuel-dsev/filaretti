import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import type { Request } from 'express';

const headerNames = [
  'x-filaretti-client-ip',
  'x-filaretti-client-timestamp',
  'x-filaretti-client-signature',
] as const;

/** A signed BFF assertion, never Express's arbitrary forwarded headers. */
export function resolveClientIp(request: Request, environment: ApiEnvironment): string {
  const [ip, timestamp, signature] = headerNames.map((name) => request.headers[name]);
  const asserted = headerNames.some((name) => request.headers[name] !== undefined);
  if (!asserted) {
    if (environment.APP_ENV !== 'development')
      throw new ServiceUnavailableException({ code: 'CLIENT_IP_UNAVAILABLE' });
    return request.socket.remoteAddress ?? 'unknown';
  }
  if (
    !environment.BFF_CLIENT_IP_SECRET ||
    typeof ip !== 'string' ||
    !isIP(ip) ||
    typeof timestamp !== 'string' ||
    !/^\d{13}$/u.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 60000 ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(signature)
  )
    throw new ForbiddenException({ code: 'CLIENT_IP_REJECTED' });
  const pathname = request.originalUrl.split('?')[0]!;
  const expected = createHmac('sha256', Buffer.from(environment.BFF_CLIENT_IP_SECRET, 'hex'))
    .update(`${timestamp}\n${request.method.toUpperCase()}\n${pathname}\n${ip}`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex')))
    throw new ForbiddenException({ code: 'CLIENT_IP_REJECTED' });
  return ip;
}
