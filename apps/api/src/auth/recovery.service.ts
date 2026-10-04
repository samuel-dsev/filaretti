import { randomBytes } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import { PrismaService } from '../database/prisma.service';
import { tokenHash } from './cookies';
import { hashPassword } from './password';
import { AUTH_ENVIRONMENT, RECOVERY_DELIVERY, type PasswordRecoveryDelivery } from './types';
import { queueEmail } from '../relationship/email-outbox';

/** Explicit no-op delivery for callers that disable recovery mail. */
export class DeferredRecoveryDelivery implements PasswordRecoveryDelivery {
  async deliver(): Promise<void> {
    // Never log or return the raw token. There is no outbound email in F2.
  }
}

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment,
    @Inject(RECOVERY_DELIVERY) private readonly delivery: PasswordRecoveryDelivery | null,
  ) {}

  async request(email: string): Promise<void> {
    const mockDelivery =
      this.environment.APP_ENV === 'development' && this.environment.MOCK_INTEGRATIONS;
    const configuredDelivery =
      this.environment.RESEND_ENABLED &&
      this.environment.RESEND_API_KEY &&
      this.environment.RESEND_FROM_EMAIL &&
      this.environment.MAIL_ENCRYPTION_KEY;
    // Disabled delivery gives the same response for every address.
    if (!this.delivery && !mockDelivery && !configuredDelivery) return;
    const user = await this.prisma.user.findUnique({ where: { email } });
    const token = randomBytes(32).toString('hex');
    if (!user || !user.isActive) return;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`);
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      const reset = await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: tokenHash(this.environment, token), expiresAt },
      });
      if (!this.delivery)
        await queueEmail(
          tx,
          this.environment,
          {
            kind: 'recovery',
            recipient: user.email,
            token,
            expiresAt: expiresAt.toISOString(),
          },
          `recovery:${reset.id}`,
        );
    });
    // Delivery errors must not let callers distinguish registered addresses.
    try {
      await this.delivery?.deliver({ email: user.email, token, expiresAt });
    } catch {
      // Future adapter owns retries/outbox and sanitised operational reporting.
    }
  }

  async reset(token: string, newPassword: string): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
    const found = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: tokenHash(this.environment, token) },
    });
    if (!found) throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
    const passwordHash = await hashPassword(newPassword);
    const accepted = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${found.userId}::uuid FOR UPDATE`,
      );
      const current = await tx.passwordResetToken.findUniqueOrThrow({
        where: { id: found.id },
        include: { user: true },
      });
      if (current.usedAt || current.expiresAt <= new Date() || !current.user.isActive) return false;
      const now = new Date();
      await tx.user.update({
        where: { id: current.userId },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId: current.userId, usedAt: null },
        data: { usedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId: current.userId }, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.auditEvent.create({
        data: {
          actorId: current.userId,
          action: 'auth.password_reset',
          resource: 'user',
          resourceId: current.userId,
        },
      });
      return true;
    });
    if (!accepted) throw new UnauthorizedException({ code: 'INVALID_TOKEN' });
  }
}
