import { createHash, randomBytes } from "node:crypto";

/**
 * Одноразовый token для подтверждения email.
 */
export interface EmailVerificationToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

/**
 * Создает raw token для письма и hash для хранения в БД.
 */
export function createEmailVerificationToken(
  now: Date,
  ttlSeconds: number,
): EmailVerificationToken {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  };
}

/**
 * Хеширует raw token подтверждения email.
 */
export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
