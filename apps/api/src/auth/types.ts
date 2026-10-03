import type { ApiEnvironment } from '@filaretti/config';
import type { UserRole } from '@prisma/client';
import type { Request } from 'express';

export const AUTH_ENVIRONMENT = Symbol('AUTH_ENVIRONMENT');
export const RECOVERY_DELIVERY = Symbol('RECOVERY_DELIVERY');

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId: string;
}

export interface AuthenticatedRequest extends Request {
  user: SessionUser;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: SafeUser;
}

export interface PasswordRecoveryDelivery {
  deliver(input: { email: string; token: string; expiresAt: Date }): Promise<void>;
}

export interface AuthModuleOptions {
  environment: ApiEnvironment;
  recoveryDelivery?: PasswordRecoveryDelivery;
}
