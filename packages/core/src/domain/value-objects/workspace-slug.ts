import { invalidArgument } from "../../shared/domain-error.js";

/**
 * URL-safe slug workspace.
 */
export type WorkspaceSlug = string & { readonly __brand: "WorkspaceSlug" };

const workspaceSlugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * Создает slug workspace с нормализацией регистра.
 */
export function workspaceSlug(value: string): WorkspaceSlug {
  const normalized = value.trim().toLowerCase();
  if (!workspaceSlugPattern.test(normalized)) {
    throw invalidArgument("workspace slug должен содержать 2-63 символа a-z, 0-9 или '-'", {
      value,
    });
  }

  return normalized as WorkspaceSlug;
}
