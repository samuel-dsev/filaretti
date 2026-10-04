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

@Injectable()
export class RelationshipPublicGuard implements CanActivate {
  constructor(
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
    private readonly limiter: RelationshipRateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.environment.RELATIONSHIP_ENABLED) throw new NotFoundException();
    const request = context.switchToHttp().getRequest<Request>();
    if (
      request.headers.origin !== new URL(this.environment.WEB_PUBLIC_URL).origin ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new ForbiddenException({ code: 'ORIGIN_REJECTED' });
    const contact = request.path.endsWith('/contact');
    await this.limiter.consume(
      contact ? 'contact-ip' : 'newsletter-ip',
      request.ip ?? 'unknown',
      contact ? 10 : 30,
    );
    return true;
  }
}
