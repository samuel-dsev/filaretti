import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { DOMAIN_ENVIRONMENT } from '../domain/shared';

export function relationshipHash(environment: ApiEnvironment, value: string): string {
  return createHmac('sha256', environment.PREVIEW_SECRET).update(value).digest('hex');
}

@Injectable()
export class RelationshipRateLimiter {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DOMAIN_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  async consume(
    action: string,
    identity: string,
    limit: number,
    windowMs = 15 * 60 * 1000,
  ): Promise<void> {
    const key = `relationship:${action}:${relationshipHash(this.environment, identity)}`;
    const allowed = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.$executeRaw(
        Prisma.sql`INSERT INTO login_rate_limits (key, count, window_start) VALUES (${key}, 0, ${now}) ON CONFLICT (key) DO NOTHING`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT key FROM login_rate_limits WHERE key = ${key} FOR UPDATE`,
      );
      const row = await tx.loginRateLimit.findUniqueOrThrow({ where: { key } });
      if (row.blockedUntil && row.blockedUntil > now) return false;
      const reset = now.getTime() - row.windowStart.getTime() >= windowMs;
      const count = reset ? 1 : row.count + 1;
      const blocked = count > limit;
      await tx.loginRateLimit.update({
        where: { key },
        data: {
          count,
          windowStart: reset ? now : row.windowStart,
          blockedUntil: blocked ? new Date(now.getTime() + windowMs) : null,
        },
      });
      return !blocked;
    });
    if (!allowed) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
  }
}
