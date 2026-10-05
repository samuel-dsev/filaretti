import { Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { createConnection } from 'node:net';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';

export type ScanVerdict = 'CLEAN' | 'INFECTED' | 'UNAVAILABLE';

/** ClamD INSTREAM sends bytes over a private socket; no filename or bytes reach logs. */
@Injectable()
export class AttachmentScanner {
  constructor(@Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  scan(
    bytes: Buffer,
    deadline = Date.now() + this.environment.CLAMAV_TIMEOUT_MS,
  ): Promise<ScanVerdict> {
    const timeout = Math.min(this.environment.CLAMAV_TIMEOUT_MS, deadline - Date.now());
    if (
      this.environment.CONTACT_SCANNER_DRIVER !== 'clamav' ||
      !this.environment.CLAMAV_HOST ||
      timeout <= 0 ||
      bytes.length > 10 * 1024 * 1024
    )
      return Promise.resolve('UNAVAILABLE');
    return new Promise((resolve) => {
      const socket = createConnection({
        host: this.environment.CLAMAV_HOST!,
        port: this.environment.CLAMAV_PORT,
      });
      let settled = false;
      let response = Buffer.alloc(0);
      const finish = (verdict: ScanVerdict) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve(verdict);
      };
      // Absolute timeout also bounds peers sending a continuous trickle of bytes.
      const timer = setTimeout(() => finish('UNAVAILABLE'), timeout);
      socket.on('error', () => finish('UNAVAILABLE'));
      socket.on('end', () => finish('UNAVAILABLE'));
      socket.on('close', () => finish('UNAVAILABLE'));
      socket.on('data', (chunk: Buffer) => {
        if (response.length + chunk.length > 4096) return finish('UNAVAILABLE');
        response = Buffer.concat([response, chunk]);
        const end = response.indexOf(0);
        if (end < 0) return;
        const result = response.subarray(0, end).toString('utf8');
        finish(
          result === 'stream: OK'
            ? 'CLEAN'
            : /^stream: [^\r\n\x00]+ FOUND$/u.test(result)
              ? 'INFECTED'
              : 'UNAVAILABLE',
        );
      });
      socket.once('connect', () => {
        socket.write(Buffer.from('zINSTREAM\0'));
        for (let offset = 0; offset < bytes.length; offset += 65536) {
          const chunk = bytes.subarray(offset, offset + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
}
