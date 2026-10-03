import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ApiEnvironment } from '@filaretti/config';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { validatePreloginCsrf } from './cookies';
import { AUTH_ENVIRONMENT, type AuthenticatedRequest } from './types';

const rolesKey = 'filaretti:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(rolesKey, roles);

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.auth.authenticate(request);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      await this.auth.validateSessionMutation(request, request.user);
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(rolesKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException({ code: 'FORBIDDEN' });
    return true;
  }
}

@Injectable()
export class PreloginMutationGuard implements CanActivate {
  constructor(@Inject(AUTH_ENVIRONMENT) private readonly environment: ApiEnvironment) {}

  canActivate(context: ExecutionContext): boolean {
    validatePreloginCsrf(context.switchToHttp().getRequest<Request>(), this.environment);
    return true;
  }
}
