import { argon2id, hash, verify } from 'argon2';

export const passwordHashOptions = {
  type: argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, passwordHashOptions);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
