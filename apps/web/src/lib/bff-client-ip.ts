import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

// The ingress must overwrite this single-value header and block direct origin access.
// Ordinary X-Forwarded-For is never used as proof of a visitor's address.
export function signVisitorHeaders(request: Request, method: string, pathname: string): Headers {
  const result = new Headers();
  const secret = process.env.BFF_CLIENT_IP_SECRET;
  const header = process.env.WEB_CLIENT_IP_HEADER;
  const trusted = process.env.WEB_TRUSTED_PROXY_CONFIRMED === 'true';
  if (!secret || !header || !trusted) {
    if (process.env.APP_ENV !== 'development') throw new Error('TRUSTED_INGRESS_REQUIRED');
    return result;
  }
  if (!/^[a-f0-9]{64}$/u.test(secret) || !['x-real-ip', 'cf-connecting-ip'].includes(header))
    throw new Error('INVALID_INGRESS_CONFIGURATION');
  const ip = request.headers.get(header)?.trim() ?? '';
  if (!isIP(ip)) throw new Error('INVALID_VISITOR_ADDRESS');
  const timestamp = String(Date.now());
  const payload = `${timestamp}\n${method.toUpperCase()}\n${pathname}\n${ip}`;
  result.set('x-filaretti-client-ip', ip);
  result.set('x-filaretti-client-timestamp', timestamp);
  result.set(
    'x-filaretti-client-signature',
    createHmac('sha256', Buffer.from(secret, 'hex')).update(payload).digest('hex'),
  );
  return result;
}
