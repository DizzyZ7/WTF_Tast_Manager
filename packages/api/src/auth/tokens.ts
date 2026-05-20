import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { HttpError } from "../errors/http-error.js";

/**
 * Тип JWT, выпускаемый API.
 */
export type JwtTokenKind = "access" | "refresh";

/**
 * Payload токена WTF.
 */
export interface WtfJwtPayload {
  /** Subject пользователя. */
  readonly sub: string;
  /** Email пользователя. */
  readonly email: string;
  /** Тип токена. */
  readonly tokenKind: JwtTokenKind;
  /** Время выпуска в Unix seconds. */
  readonly iat: number;
  /** Время истечения в Unix seconds. */
  readonly exp: number;
  /** Уникальный идентификатор токена. */
  readonly jti: string;
}

/**
 * Пара access/refresh токенов.
 */
export interface TokenPair {
  /** Пользователь, для которого выпущена пара токенов. */
  readonly user: {
    /** Стабильный серверный идентификатор пользователя. */
    readonly id: string;
    /** Нормализованный email пользователя. */
    readonly email: string;
  };
  /** Access token для Authorization header. */
  readonly accessToken: string;
  /** Refresh token для выпуска новой пары. */
  readonly refreshToken: string;
  /** Тип токена по RFC 6750. */
  readonly tokenType: "Bearer";
  /** TTL access token в секундах. */
  readonly expiresIn: number;
}

/**
 * Параметры выпуска JWT.
 */
export interface TokenIssuerConfig {
  /** Секрет access token. */
  readonly accessSecret: string;
  /** Секрет refresh token. */
  readonly refreshSecret: string;
  /** TTL access token. */
  readonly accessTtlSeconds: number;
  /** TTL refresh token. */
  readonly refreshTtlSeconds: number;
}

/**
 * Выпускает и проверяет HS256 JWT без хранения секретов в коде.
 */
export class JwtTokenService {
  /**
   * Создает сервис токенов.
   */
  public constructor(private readonly config: TokenIssuerConfig) {}

  /**
   * Выпускает access/refresh пару для пользователя.
   */
  public issuePair(
    user: { readonly userId: string; readonly email: string },
    now: Date,
  ): TokenPair {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const accessToken = this.sign({
      sub: user.userId,
      email: user.email,
      tokenKind: "access",
      iat: issuedAt,
      exp: issuedAt + this.config.accessTtlSeconds,
      jti: randomUUID(),
    });
    const refreshToken = this.sign({
      sub: user.userId,
      email: user.email,
      tokenKind: "refresh",
      iat: issuedAt,
      exp: issuedAt + this.config.refreshTtlSeconds,
      jti: randomUUID(),
    });

    return {
      user: {
        id: user.userId,
        email: user.email,
      },
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: this.config.accessTtlSeconds,
    };
  }

  /**
   * Проверяет access token и возвращает payload.
   */
  public verifyAccess(token: string, now: Date): WtfJwtPayload {
    const payload = this.verify(token, this.config.accessSecret, now);
    if (payload.tokenKind !== "access") {
      throw new HttpError(401, "ожидался access token", "invalid_token");
    }

    return payload;
  }

  /**
   * Проверяет refresh token и возвращает payload.
   */
  public verifyRefresh(token: string, now: Date): WtfJwtPayload {
    const payload = this.verify(token, this.config.refreshSecret, now);
    if (payload.tokenKind !== "refresh") {
      throw new HttpError(401, "ожидался refresh token", "invalid_token");
    }

    return payload;
  }

  private sign(payload: WtfJwtPayload): string {
    const secret =
      payload.tokenKind === "access" ? this.config.accessSecret : this.config.refreshSecret;
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private verify(token: string, secret: string, now: Date): WtfJwtPayload {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new HttpError(401, "неверный формат JWT", "invalid_token");
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (
      encodedHeader === undefined ||
      encodedPayload === undefined ||
      encodedSignature === undefined
    ) {
      throw new HttpError(401, "неверный формат JWT", "invalid_token");
    }

    const expected = sign(`${encodedHeader}.${encodedPayload}`, secret);
    if (!safeEqual(encodedSignature, expected)) {
      throw new HttpError(401, "неверная подпись JWT", "invalid_token");
    }

    const parsed = parsePayload(encodedPayload);
    if (parsed.exp <= Math.floor(now.getTime() / 1000)) {
      throw new HttpError(401, "JWT истек", "token_expired");
    }

    return parsed;
  }
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function parsePayload(encodedPayload: string): WtfJwtPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new HttpError(401, "JWT payload не является JSON", "invalid_token");
  }

  if (!isPayload(parsed)) {
    throw new HttpError(401, "JWT payload не соответствует контракту", "invalid_token");
  }

  return parsed;
}

function isPayload(value: unknown): value is WtfJwtPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === "string" &&
    typeof record.email === "string" &&
    (record.tokenKind === "access" || record.tokenKind === "refresh") &&
    typeof record.iat === "number" &&
    typeof record.exp === "number" &&
    typeof record.jti === "string"
  );
}
