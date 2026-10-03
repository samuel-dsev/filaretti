export type AdministrativeRole = 'ADMIN' | 'EDITOR' | 'AUTHOR';

/** Allowlist for administrative responses; no password, tokens, IP or internal flags. */
export interface AdministrativeUser {
  id: string;
  email: string;
  name: string;
  role: AdministrativeRole;
  isActive: boolean;
}

/** Authentication credentials are delivered exclusively as HttpOnly cookies. */
export interface AuthenticationResponse {
  user: AdministrativeUser;
  csrfToken: string;
}

export interface CsrfResponse {
  csrfToken: string;
}

export interface PasswordRecoveryResponse {
  message: string;
}
