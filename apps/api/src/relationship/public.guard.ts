import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import type { Request } from 'express';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';
import { RelationshipRateLimiter } from './rate-limit.service';
import { resolveClientIp } from '../common/client-ip';

@Injectable()
export class RelationshipPublicGuard implements CanActivate {
  constructor(
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
    private readonly limiter: RelationshipRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const contact = request.path.endsWith('/contact');
    const enabled = contact
      ? this.environment.RELATIONSHIP_ENABLED
      : (this.environment.NEWSLETTER_ENABLED ?? this.environment.RELATIONSHIP_ENABLED);
    if (!enabled) throw new NotFoundException();
    if (
      request.headers.origin !== new URL(this.environment.WEB_PUBLIC_URL).origin ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ForbiddenException({ code: 'ORIGIN_REJECTED' });
    await this.limiter.consume(
      contact ? 'contact-ip' : 'newsletter-ip',
      resolveClientIp(request, this.environment),
      contact ? 10 : 30,
    );
    return true;
  }
}
