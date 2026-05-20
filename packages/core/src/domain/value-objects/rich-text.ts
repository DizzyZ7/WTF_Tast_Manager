import { assertMaxLength, assertNonEmptyString } from "../../shared/guard.js";

/**
 * Plain-text представление rich text документа.
 */
export type RichTextPlain = string & { readonly __brand: "RichTextPlain" };

/**
 * Создает plain-text представление rich text с ограничением размера.
 */
export function richTextPlain(value: string): RichTextPlain {
  return assertMaxLength(
    assertNonEmptyString(value, "richText"),
    50_000,
    "richText",
  ) as RichTextPlain;
}

/**
 * Создает необязательное plain-text описание.
 */
export function optionalRichTextPlain(value: string): RichTextPlain {
  const normalized = value.trim();
  return assertMaxLength(normalized, 50_000, "richText") as RichTextPlain;
}
