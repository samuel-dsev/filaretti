import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import type { Request } from 'express';
import { resolveClientIp } from '../src/common/client-ip';
import { AttachmentScanner } from '../src/relationship/attachment-scanner';
import { testEnvironment } from './helpers';

const environment = testEnvironment({ BFF_CLIENT_IP_SECRET: 'ab'.repeat(32) });
function assertion(
  ip = '198.51.100.17',
  timestamp = Date.now().toString(),
  path = '/api/v1/public/contact',
) {
  const signature = createHmac('sha256', Buffer.from(environment.BFF_CLIENT_IP_SECRET!, 'hex'))
    .update(`${timestamp}\nPOST\n${path}\n${ip}`)
    .digest('hex');
  return {
    method: 'POST',
    originalUrl: path,
    headers: {
      'x-filaretti-client-ip': ip,
      'x-filaretti-client-timestamp': timestamp,
      'x-filaretti-client-signature': signature,
    },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

describe('trusted BFF client IP', () => {
  test('ignores spoofed generic proxy headers and accepts distinct signed visitors', () => {
    const direct = {
      method: 'POST',
      originalUrl: '/api/v1/public/contact',
      headers: { 'x-forwarded-for': '198.51.100.7', 'x-real-ip': '198.51.100.9' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as Request;
    expect(resolveClientIp(direct, environment)).toBe('127.0.0.1');
    expect(resolveClientIp(assertion(), environment)).toBe('198.51.100.17');
    expect(resolveClientIp(assertion('2001:db8::4'), environment)).toBe('2001:db8::4');
  });

  test('binds the assertion to method, API pathname, visitor and freshness', () => {
    const mutated = assertion();
    mutated.headers['x-filaretti-client-ip'] = '198.51.100.18';
    expect(() => resolveClientIp(mutated, environment)).toThrow();
    const otherPath = assertion();
    otherPath.originalUrl = '/api/v1/auth/login';
    expect(() => resolveClientIp(otherPath, environment)).toThrow();
    const method = assertion();
    method.method = 'GET';
    expect(() => resolveClientIp(method, environment)).toThrow();
    expect(() =>
      resolveClientIp(assertion('198.51.100.17', String(Date.now() - 61000)), environment),
    ).toThrow();
    expect(() =>
      resolveClientIp(assertion('198.51.100.17', String(Date.now() + 61000)), environment),
    ).toThrow();
    expect(() => resolveClientIp(assertion('198.51.100.17, 198.51.100.18'), environment)).toThrow();
  });

  test('rejects missing assertions outside development and partial/malformed assertions always', () => {
    const absent = assertion();
    absent.headers = {};
    expect(() => resolveClientIp(absent, { ...environment, APP_ENV: 'staging' })).toThrow();
    const partial = assertion();
    delete partial.headers['x-filaretti-client-signature'];
    expect(() => resolveClientIp(partial, environment)).toThrow();
    const array = assertion();
    array.headers['x-filaretti-client-ip'] = ['198.51.100.17', '198.51.100.18'];
    expect(() => resolveClientIp(array, environment)).toThrow();
  });
});

const servers: Server[] = [];
afterAll(async () => {
  await Promise.all(
    servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function daemon(reply: string | null, split = false) {
  const server = createServer((socket) => {
    let received = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      if (received.length < 14 || received.readUInt32BE(received.length - 4) !== 0) return;
      if (reply === null) return;
      if (split) {
        socket.write(reply.slice(0, 4));
        setTimeout(() => socket.end(reply.slice(4)), 5);
      } else socket.end(reply);
    });
    socket.on('error', () => undefined);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test daemon port');
  return new AttachmentScanner(
    testEnvironment({
      CONTACT_SCANNER_DRIVER: 'clamav',
      CLAMAV_HOST: '127.0.0.1',
      CLAMAV_PORT: address.port,
      CLAMAV_TIMEOUT_MS: 100,
    }),
  );
}

describe('ClamD adapter protocol, simulated daemon only', () => {
  test('accepts a complete clean record, including fragmented responses', async () => {
    const scanner = await daemon('stream: OK\0', true);
    expect(await scanner.scan(Buffer.from('fictitious bytes'))).toBe('CLEAN');
  });
  test('returns infected without exposing signature names or file bytes', async () => {
    const scanner = await daemon('stream: Eicar-Signature FOUND\0');
    expect(await scanner.scan(Buffer.from('fictitious bytes'))).toBe('INFECTED');
  });
  test('never marks malformed, truncated, oversized or error replies as clean', async () => {
    for (const reply of [
      'stream: OK',
      'arbitrary: OK\0',
      'stream: size limit ERROR\0',
      'a'.repeat(4097),
    ]) {
      const scanner = await daemon(reply);
      expect(await scanner.scan(Buffer.from('fictitious bytes'))).toBe('UNAVAILABLE');
    }
  });
  test('bounds a silent peer and returns unavailable when disabled or deadline exhausted', async () => {
    const scanner = await daemon(null);
    const start = Date.now();
    expect(await scanner.scan(Buffer.from('fictitious bytes'))).toBe('UNAVAILABLE');
    expect(Date.now() - start).toBeLessThan(1000);
    expect(await scanner.scan(Buffer.from('fictitious bytes'), Date.now() - 1)).toBe('UNAVAILABLE');
    expect(await new AttachmentScanner(environment).scan(Buffer.from('fictitious bytes'))).toBe(
      'UNAVAILABLE',
    );
  });
});
