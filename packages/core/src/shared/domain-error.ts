/**
 * Машиночитаемый код доменной ошибки.
 */
export type DomainErrorCode =
  | "invalid_argument"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "invariant_violation";

/**
 * Ошибка, возникающая при нарушении доменных правил WTF.
 */
export class DomainError extends Error {
  public override readonly name = "DomainError";

  /**
   * Создает доменную ошибку с безопасными для логирования деталями.
   */
  public constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

/**
 * Создает ошибку валидации входного значения.
 */
export function invalidArgument(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError("invalid_argument", message, details);
}

/**
 * Создает ошибку нарушения инварианта агрегата.
 */
export function invariantViolation(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError("invariant_violation", message, details);
}

/**
 * Создает ошибку конфликта состояния.
 */
export function conflict(
  message: string,
  details: Readonly<Record<string, unknown>> = {},
): DomainError {
  return new DomainError("conflict", message, details);
}
