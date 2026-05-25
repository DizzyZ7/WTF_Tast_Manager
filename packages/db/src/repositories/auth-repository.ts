import { eq } from "drizzle-orm";
import type { WtfDatabase } from "../connection.js";
import { emailVerificationTokens, users } from "../schema/index.js";

/**
 * Строка пользователя, нужная API для аутентификации.
 */
export interface AuthUserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly emailVerifiedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Данные для создания пользователя.
 */
export interface CreateAuthUserInput {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly now: Date;
}

/**
 * Строка токена подтверждения email.
 */
export interface EmailVerificationTokenRecord {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

/**
 * Данные для создания токена подтверждения email.
 */
export interface CreateEmailVerificationTokenInput {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/**
 * Контракт хранения учеток и токенов подтверждения email.
 */
export interface AuthRepository {
  readonly createUser: (input: CreateAuthUserInput) => Promise<AuthUserRecord>;
  readonly findUserByEmail: (email: string) => Promise<AuthUserRecord | null>;
  readonly findUserById: (id: string) => Promise<AuthUserRecord | null>;
  readonly updateUserPassword: (
    userId: string,
    passwordHash: string,
    updatedAt: Date,
  ) => Promise<void>;
  readonly markUserEmailVerified: (userId: string, verifiedAt: Date) => Promise<void>;
  readonly createEmailVerificationToken: (
    input: CreateEmailVerificationTokenInput,
  ) => Promise<void>;
  readonly findEmailVerificationTokenByHash: (
    tokenHash: string,
  ) => Promise<EmailVerificationTokenRecord | null>;
  readonly consumeEmailVerificationToken: (tokenId: string, consumedAt: Date) => Promise<void>;
}

/**
 * PostgreSQL-реализация auth repository.
 */
export class PgAuthRepository implements AuthRepository {
  /**
   * Создает репозиторий с готовым Drizzle database client.
   */
  public constructor(private readonly db: WtfDatabase) {}

  /**
   * Создает пользователя.
   */
  public async createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: input.id,
        email: input.email,
        passwordHash: input.passwordHash,
        emailVerifiedAt: null,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning();

    if (row === undefined) {
      throw new Error("failed to create auth user");
    }

    return row;
  }

  /**
   * Ищет пользователя по email.
   */
  public async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  /**
   * Ищет пользователя по id.
   */
  public async findUserById(id: string): Promise<AuthUserRecord | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  /**
   * Обновляет пароль неподтвержденного пользователя при повторной регистрации.
   */
  public async updateUserPassword(
    userId: string,
    passwordHash: string,
    updatedAt: Date,
  ): Promise<void> {
    await this.db.update(users).set({ passwordHash, updatedAt }).where(eq(users.id, userId));
  }

  /**
   * Помечает email пользователя подтвержденным.
   */
  public async markUserEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
    await this.db
      .update(users)
      .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
      .where(eq(users.id, userId));
  }

  /**
   * Создает одноразовый токен подтверждения email.
   */
  public async createEmailVerificationToken(
    input: CreateEmailVerificationTokenInput,
  ): Promise<void> {
    await this.db.insert(emailVerificationTokens).values({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: input.createdAt,
    });
  }

  /**
   * Ищет токен подтверждения email по hash.
   */
  public async findEmailVerificationTokenByHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenRecord | null> {
    const [row] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  /**
   * Помечает токен подтверждения использованным.
   */
  public async consumeEmailVerificationToken(tokenId: string, consumedAt: Date): Promise<void> {
    await this.db
      .update(emailVerificationTokens)
      .set({ consumedAt })
      .where(eq(emailVerificationTokens.id, tokenId));
  }
}
