import type { DomainError } from "@wtf/core";

/**
 * Ошибка HTTP-слоя с кодом ответа.
 */
export class HttpError extends Error {
  public override readonly name = "HttpError";

  /**
   * Создает HTTP-ошибку.
   */
  public constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
  }
}

/**
 * Преобразует доменную ошибку в HTTP-статус.
 */
export function statusCodeFromDomainError(error: DomainError): number {
  switch (error.code) {
    case "invalid_argument":
      return 400;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "invariant_violation":
      return 422;
  }
}
