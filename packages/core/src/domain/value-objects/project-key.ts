import { invalidArgument } from "../../shared/domain-error.js";

/**
 * Короткий ключ проекта, используемый в issue key.
 */
export type ProjectKey = string & { readonly __brand: "ProjectKey" };

/**
 * Человеко-читаемый ключ задачи.
 */
export type IssueKey = string & { readonly __brand: "IssueKey" };

const projectKeyPattern = /^[A-Z][A-Z0-9]{1,9}$/;
const issueKeyPattern = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

/**
 * Создает ключ проекта.
 */
export function projectKey(value: string): ProjectKey {
  const normalized = value.trim().toUpperCase();
  if (!projectKeyPattern.test(normalized)) {
    throw invalidArgument("project key должен содержать 2-10 символов A-Z или 0-9", { value });
  }

  return normalized as ProjectKey;
}

/**
 * Создает ключ issue из ключа проекта и последовательного номера.
 */
export function issueKeyFromSequence(key: ProjectKey, sequence: number): IssueKey {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw invalidArgument("номер issue должен быть положительным целым числом", { sequence });
  }

  return `${key}-${sequence}` as IssueKey;
}

/**
 * Проверяет внешний issue key.
 */
export function issueKey(value: string): IssueKey {
  const normalized = value.trim().toUpperCase();
  if (!issueKeyPattern.test(normalized)) {
    throw invalidArgument("issue key должен иметь формат PROJECT-1", { value });
  }

  return normalized as IssueKey;
}
