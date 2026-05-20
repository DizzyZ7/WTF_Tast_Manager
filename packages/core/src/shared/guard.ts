import { invalidArgument } from "./domain-error.js";

/**
 * Проверяет, что строка не пустая после trim.
 */
export function assertNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw invalidArgument(`${fieldName} не может быть пустым`, { fieldName });
  }

  return normalized;
}

/**
 * Проверяет максимальную длину строки.
 */
export function assertMaxLength(value: string, maxLength: number, fieldName: string): string {
  if (value.length > maxLength) {
    throw invalidArgument(`${fieldName} превышает максимальную длину`, {
      fieldName,
      maxLength,
      actualLength: value.length,
    });
  }

  return value;
}

/**
 * Проверяет, что дата начала строго раньше даты окончания.
 */
export function assertDateRange(start: Date, end: Date, fieldName: string): void {
  if (start.getTime() >= end.getTime()) {
    throw invalidArgument(`${fieldName} должен иметь начало раньше окончания`, {
      fieldName,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
}

/**
 * Возвращает ISO-строку для даты, не раскрывая изменяемый объект Date наружу.
 */
export function toIsoString(date: Date): string {
  return date.toISOString();
}
