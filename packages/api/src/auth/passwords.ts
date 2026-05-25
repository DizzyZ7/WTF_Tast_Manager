import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: PasswordScryptOptions,
) => Promise<Buffer>;

const keyLength = 64;
const scryptOptions = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} satisfies PasswordScryptOptions;

interface PasswordScryptOptions {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly maxmem: number;
}

/**
 * Хеширует пароль пользователя через scrypt с уникальной salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, keyLength, scryptOptions);
  const params = `N=${scryptOptions.N},r=${scryptOptions.r},p=${scryptOptions.p}`;
  return `scrypt$v=1$${params}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

/**
 * Проверяет пароль против сохраненного scrypt hash.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(passwordHash);
  if (parsed === null) {
    return false;
  }

  const derivedKey = await scrypt(password, parsed.salt, parsed.expected.length, parsed.options);
  if (derivedKey.length !== parsed.expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, parsed.expected);
}

function parsePasswordHash(passwordHash: string): {
  readonly salt: Buffer;
  readonly expected: Buffer;
  readonly options: PasswordScryptOptions;
} | null {
  const parts = passwordHash.split("$");
  const algorithm = parts[0];
  const version = parts[1];
  const rawParams = parts[2];
  const rawSalt = parts[3];
  const rawExpected = parts[4];
  if (
    algorithm !== "scrypt" ||
    version !== "v=1" ||
    rawParams === undefined ||
    rawSalt === undefined ||
    rawExpected === undefined
  ) {
    return null;
  }

  const options = parseScryptOptions(rawParams);
  if (options === null) {
    return null;
  }

  return {
    salt: Buffer.from(rawSalt, "base64url"),
    expected: Buffer.from(rawExpected, "base64url"),
    options,
  };
}

function parseScryptOptions(rawParams: string): PasswordScryptOptions | null {
  const params = new Map<string, number>();
  for (const pair of rawParams.split(",")) {
    const [key, rawValue] = pair.split("=");
    if (key === undefined || rawValue === undefined) {
      return null;
    }

    const value = Number.parseInt(rawValue, 10);
    if (!Number.isSafeInteger(value) || value <= 0) {
      return null;
    }

    params.set(key, value);
  }

  const N = params.get("N");
  const r = params.get("r");
  const p = params.get("p");
  if (N === undefined || r === undefined || p === undefined) {
    return null;
  }

  return { N, r, p, maxmem: scryptOptions.maxmem };
}
