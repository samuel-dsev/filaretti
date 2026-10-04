import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import type { ApiEnvironment } from '@filaretti/config';
import type { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import {
  AUTH_COOKIES,
  constantEqual,
  createPreloginCsrf,
  readCookie,
  tokenHash,
  validateOrigin,
} from './cookies';
import { hashPassword, verifyPassword } from './password';
import { AUTH_ENVIRONMENT, type SafeUser, type SessionTokens, type SessionUser } from './types';
import type { CreateUserDto, UserListDto } from './dto';

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;
const jwtIssuer = 'filaretti-api';
const jwtAudience = 'filaretti-admin';

function publicUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
  };
}

@Injectable()
export class AuthService {
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment,
  ) {}

  /** Persistent, serialized counters shared by every API instance; identifiers are HMACs. */
  async consumeAttempt(scope: string, ip: string, email = ''): Promise<void> {
    const now = new Date();
    const windowMs = 15 * 60 * 1000;
    const counters = [
      { key: `${scope}:ip:${tokenHash(this.environment, ip)}`, limit: 20 },
      ...(email ? [{ key: `${scope}:email:${tokenHash(this.environment, email)}`, limit: 5 }] : []),
    ].sort((left, right) => left.key.localeCompare(right.key));
    const allowed = await this.prisma.$transaction(async (tx) => {
      let allAllowed = true;
      for (const counter of counters) {
        // PostgreSQL handles concurrent first use before the counter is row-locked.
        await tx.$executeRaw(
          Prisma.sql`INSERT INTO login_rate_limits (key, count, window_start) VALUES (${counter.key}, 0, ${now}) ON CONFLICT (key) DO NOTHING`,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT key FROM login_rate_limits WHERE key = ${counter.key} FOR UPDATE`,
        );
        const stored = await tx.loginRateLimit.findUniqueOrThrow({ where: { key: counter.key } });
        if (stored.blockedUntil && stored.blockedUntil > now) {
          allAllowed = false;
          continue;
        }
        const count =
          now.getTime() - stored.windowStart.getTime() >= windowMs ? 1 : stored.count + 1;
        const windowStart = count === 1 ? now : stored.windowStart;
        const blocked = count > counter.limit;
        await tx.loginRateLimit.update({
          where: { key: counter.key },
          data: {
            count,
            windowStart,
            blockedUntil: blocked ? new Date(now.getTime() + windowMs) : null,
          },
        });
        if (blocked) allAllowed = false;
      }
      return allAllowed;
    });
    if (!allowed) throw new HttpException({ code: 'RATE_LIMITED' }, 429);
  }

  async login(email: string, password: string, ip: string): Promise<SessionTokens> {
    await this.consumeAttempt('login', ip, email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(user?.passwordHash ?? (await this.dummyHash), password);
    if (!user || !user.isActive || !valid)
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    const sessionId = randomUUID();
    const refreshToken = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.environment.REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${user.id}::uuid FOR UPDATE`);
      const currentUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!currentUser.isActive || currentUser.passwordHash !== user.passwordHash) {
        throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
      }
      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          csrfHash: tokenHash(this.environment, csrfToken),
          expiresAt,
          ipHash: tokenHash(this.environment, ip),
          refreshTokens: {
            create: { tokenHash: tokenHash(this.environment, refreshToken), expiresAt },
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: 'auth.login',
          resource: 'session',
          resourceId: sessionId,
        },
      });
    });
    return {
      accessToken: await this.signAccess(user.id, sessionId),
      refreshToken,
      csrfToken,
      user: publicUser(user),
    };
  }

  private signAccess(userId: string, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' },
      {
        secret: this.environment.JWT_SECRET,
        algorithm: 'HS256',
        issuer: jwtIssuer,
        audience: jwtAudience,
        expiresIn: this.environment.JWT_ACCESS_TTL_SECONDS,
      },
    );
  }

  async authenticate(request: Request): Promise<SessionUser> {
    const accessToken = readCookie(request, AUTH_COOKIES.access);
    if (!accessToken) throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync<Record<string, unknown>>(accessToken, {
        secret: this.environment.JWT_SECRET,
        algorithms: ['HS256'],
        issuer: jwtIssuer,
        audience: jwtAudience,
      });
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      payload.type !== 'access'
    ) {
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    const session = await this.prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    }
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };
  }

  async validateSessionMutation(request: Request, user: SessionUser): Promise<void> {
    validateOrigin(request, this.environment);
    const session = await this.prisma.session.findUnique({ where: { id: user.sessionId } });
    if (!session || session.revokedAt || session.expiresAt <= new Date())
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    this.validateCsrf(request, session.csrfHash);
  }

  private validateCsrf(request: Request, expectedHash: string): void {
    const header = request.headers['x-csrf-token'];
    const cookie = readCookie(request, AUTH_COOKIES.csrf);
    if (
      typeof header !== 'string' ||
      !cookie ||
      !constantEqual(header, cookie) ||
      !constantEqual(tokenHash(this.environment, header), expectedHash)
    ) {
      throw new ForbiddenException({ code: 'CSRF_INVALID' });
    }
  }

  async csrf(request: Request): Promise<string> {
    if (request.headers.origin) validateOrigin(request, this.environment);
    if (request.headers['sec-fetch-site'] === 'cross-site')
      throw new ForbiddenException({ code: 'ORIGIN_FORBIDDEN' });
    const csrfToken = readCookie(request, AUTH_COOKIES.csrf);
    const refreshToken = readCookie(request, AUTH_COOKIES.refresh);
    if (csrfToken && refreshToken && /^[a-f0-9]{64}$/.test(refreshToken)) {
      const token = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: tokenHash(this.environment, refreshToken) },
        include: { session: { include: { user: true } } },
      });
      if (
        token &&
        !token.consumedAt &&
        !token.revokedAt &&
        token.expiresAt > new Date() &&
        !token.session.revokedAt &&
        token.session.expiresAt > new Date() &&
        token.session.user.isActive &&
        constantEqual(tokenHash(this.environment, csrfToken), token.session.csrfHash)
      )
        return csrfToken;
    }
    return createPreloginCsrf(this.environment);
  }

  async refresh(request: Request): Promise<SessionTokens> {
    validateOrigin(request, this.environment);
    const raw = readCookie(request, AUTH_COOKIES.refresh);
    if (!raw || !/^[a-f0-9]{64}$/.test(raw))
      throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    const hash = tokenHash(this.environment, raw);
    const initial = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!initial) throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM sessions WHERE id = ${initial.sessionId}::uuid FOR UPDATE`,
      );
      const token = await tx.refreshToken.findUniqueOrThrow({
        where: { id: initial.id },
        include: { session: { include: { user: true } } },
      });
      this.validateCsrf(request, token.session.csrfHash);
      if (token.consumedAt) {
        const revokedAt = new Date();
        await tx.session.update({ where: { id: token.sessionId }, data: { revokedAt } });
        await tx.refreshToken.updateMany({
          where: { sessionId: token.sessionId, revokedAt: null },
          data: { revokedAt },
        });
        await tx.auditEvent.create({
          data: {
            actorId: token.session.userId,
            action: 'auth.refresh_reused',
            resource: 'session',
            resourceId: token.sessionId,
          },
        });
        return { reused: true } as const;
      }
      if (
        token.revokedAt ||
        token.expiresAt <= new Date() ||
        token.session.revokedAt ||
        token.session.expiresAt <= new Date() ||
        !token.session.user.isActive
      )
        return { invalid: true } as const;
      const refreshToken = randomBytes(32).toString('hex');
      await tx.refreshToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
      await tx.refreshToken.create({
        data: {
          sessionId: token.sessionId,
          tokenHash: tokenHash(this.environment, refreshToken),
          expiresAt: token.session.expiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: token.session.userId,
          action: 'auth.refresh',
          resource: 'session',
          resourceId: token.sessionId,
        },
      });
      return { user: token.session.user, sessionId: token.sessionId, refreshToken };
    });
    if ('reused' in result) throw new UnauthorizedException({ code: 'REFRESH_REUSED' });
    if ('invalid' in result) throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    return {
      accessToken: await this.signAccess(result.user.id, result.sessionId),
      refreshToken: result.refreshToken,
      csrfToken: readCookie(request, AUTH_COOKIES.csrf)!,
      user: publicUser(result.user),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const revokedAt = new Date();
      await tx.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt },
      });
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (session)
        await tx.auditEvent.create({
          data: {
            actorId: session.userId,
            action: 'auth.logout',
            resource: 'session',
            resourceId: sessionId,
          },
        });
    });
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: safeUserSelect,
    });
    if (!user || !user.isActive) throw new UnauthorizedException({ code: 'INVALID_SESSION' });
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(existing.passwordHash, currentPassword)))
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      // Optimistic hash predicate prevents concurrent changes from overwriting a newer password.
      const changed = await tx.user.updateMany({
        where: { id: userId, passwordHash: existing.passwordHash, isActive: true },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      if (changed.count !== 1) throw new ConflictException('Usuário alterado; tente novamente.');
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          actorId: userId,
          action: 'auth.password_changed',
          resource: 'user',
          resourceId: userId,
        },
      });
    });
  }

  async createUser(input: CreateUserDto, actorId: string): Promise<SafeUser> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            role: input.role,
            passwordHash,
            isMock: this.environment.MOCK_CONTENT,
          },
          select: safeUserSelect,
        });
        await tx.auditEvent.create({
          data: { actorId, action: 'user.created', resource: 'user', resourceId: user.id },
        });
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Usuário já cadastrado.');
      throw error;
    }
  }

  async deactivateUser(userId: string, actorId: string): Promise<SafeUser> {
    if (userId === actorId)
      throw new ConflictException('Não é possível desativar a própria conta.');
    return this.prisma.$transaction(async (tx) => {
      // Serialize administrator changes so two requests cannot disable one another.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(641502)`);
      const actor = await tx.user.findUnique({ where: { id: actorId } });
      if (!actor?.isActive || actor.role !== 'ADMIN')
        throw new ForbiddenException({ code: 'FORBIDDEN' });
      const existing = await tx.user.findUnique({ where: { id: userId } });
      if (!existing) throw new NotFoundException('Usuário não encontrado.');
      if (
        existing.role === 'ADMIN' &&
        existing.isActive &&
        (await tx.user.count({ where: { role: 'ADMIN', isActive: true } })) <= 1
      ) {
        throw new ConflictException({ code: 'LAST_ADMIN' });
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: safeUserSelect,
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { session: { userId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: { actorId, action: 'user.deactivated', resource: 'user', resourceId: userId },
      });
      return user;
    });
  }

  async listUsers(query: UserListDto) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        select: safeUserSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count(),
    ]);
    return {
      data,
      meta: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) },
    };
  }
}
