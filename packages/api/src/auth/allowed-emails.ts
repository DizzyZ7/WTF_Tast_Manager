import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Нормализует email для проверок доступа и стабильной генерации userId.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Проверяет, разрешен ли email для регистрации/входа.
 */
export function isEmailAllowed(email: string, allowedEmails: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return parseAllowedEmailEntries(allowedEmails).has(normalizedEmail);
}

/**
 * Возвращает детерминированный UUID пользователя по email.
 *
 * Это делает userId серверным фактом: клиент больше не может подставить чужой id
 * при выпуске токена или записи действий в журнал.
 */
export function userIdFromEmail(email: string): string {
  const digest = createHash("sha256").update(normalizeEmail(email)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  const versionByte = bytes[6];
  const variantByte = bytes[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("sha256 digest is unexpectedly short");
  }

  bytes[6] = (versionByte & 0x0f) | 0x40;
  bytes[8] = (variantByte & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

/**
 * Возвращает userId из allow-list entry `email=userId` или стабильный id по email.
 */
export function userIdForAllowedEmail(email: string, allowedEmails: string): string {
  const normalizedEmail = normalizeEmail(email);
  const configuredUserId = parseAllowedEmailEntries(allowedEmails).get(normalizedEmail);
  return configuredUserId ?? userIdFromEmail(normalizedEmail);
}

function parseAllowedEmailEntries(allowedEmails: string): ReadonlyMap<string, string | null> {
  const entries = new Map<string, string | null>();
  for (const rawEntry of allowedEmails.split(",")) {
    const entry = rawEntry.trim();
    if (entry.length === 0) {
      continue;
    }

    const [rawEmail, rawUserId] = entry.split("=");
    if (rawEmail === undefined) {
      continue;
    }

    const email = normalizeEmail(rawEmail);
    if (email.length === 0) {
      continue;
    }

    const configuredUserId = rawUserId?.trim();
    entries.set(email, configuredUserId?.length === 0 ? null : (configuredUserId ?? null));
  }

  return entries;
}
