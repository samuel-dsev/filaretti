import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';

export function localRelationshipMocks(environment: ApiEnvironment): boolean {
  return (
    environment.APP_ENV === 'development' &&
    environment.MOCK_INTEGRATIONS &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(environment.WEB_PUBLIC_URL).hostname)
  );
}

@Injectable()
export class TurnstileService {
  constructor(@Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  async verify(token: string, action: 'contact' | 'newsletter', ip: string): Promise<void> {
    if (!this.environment.TURNSTILE_ENABLED) {
      if (localRelationshipMocks(this.environment) && token === `local-development-${action}`)
        return;
      throw new ServiceUnavailableException({ code: 'ANTISPAM_UNAVAILABLE' });
    }
    let result: unknown;
    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.environment.TURNSTILE_SECRET_KEY!,
          response: token,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Provider unavailable');
      result = await response.json();
    } catch {
      throw new ServiceUnavailableException({ code: 'ANTISPAM_UNAVAILABLE' });
    }
    if (!result || typeof result !== 'object')
      throw new ServiceUnavailableException({ code: 'ANTISPAM_UNAVAILABLE' });
    const verified = result as Record<string, unknown>;
    const hostname =
      this.environment.TURNSTILE_EXPECTED_HOSTNAME ??
      new URL(this.environment.WEB_PUBLIC_URL).hostname;
    if (verified.success !== true || verified.hostname !== hostname || verified.action !== action)
      throw new BadRequestException({ code: 'ANTISPAM_FAILED' });
  }
}
