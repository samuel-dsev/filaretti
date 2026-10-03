import type { LoggerService } from '@nestjs/common';

export class SanitizedLogger implements LoggerService {
  constructor(private readonly output: (line: string) => void = (line) => console.log(line)) {}

  event(event: string, fields: { requestId?: string; statusCode?: number } = {}) {
    this.output(JSON.stringify({ event, ...fields }));
  }
  // Framework payloads may contain request bodies, connection strings or exceptions.
  log() {
    this.event('framework.info');
  }
  error() {
    this.event('framework.error');
  }
  warn() {
    this.event('framework.warn');
  }
  debug() {
    this.event('framework.debug');
  }
  verbose() {
    this.event('framework.verbose');
  }
  fatal() {
    this.event('framework.fatal');
  }
}
