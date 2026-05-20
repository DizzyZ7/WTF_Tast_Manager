/**
 * Склеивает CSS className значения, отбрасывая пустые элементы.
 */
export function cn(...values: ReadonlyArray<string | false | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}
