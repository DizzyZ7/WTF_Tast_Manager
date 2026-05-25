/**
 * Нормализует email для поиска учетной записи и выпуска токенов.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
