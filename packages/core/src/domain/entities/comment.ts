import type { CommentId, UserId } from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";
import { richTextPlain, type RichTextPlain } from "../value-objects/rich-text.js";

/**
 * Снимок комментария к issue.
 */
export interface CommentSnapshot {
  /** Идентификатор комментария. */
  readonly id: CommentId;
  /** Автор комментария. */
  readonly authorId: UserId;
  /** Текст комментария. */
  readonly body: RichTextPlain;
  /** ISO-время создания. */
  readonly createdAt: string;
  /** ISO-время последнего изменения. */
  readonly updatedAt: string;
}

/**
 * Создает комментарий к issue.
 */
export function createComment(input: {
  readonly authorId: UserId;
  readonly body: string;
  readonly now: Date;
}): CommentSnapshot {
  return {
    id: newEntityId<"CommentId">(),
    authorId: input.authorId,
    body: richTextPlain(input.body),
    createdAt: input.now.toISOString(),
    updatedAt: input.now.toISOString(),
  };
}
