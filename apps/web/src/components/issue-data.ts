import type { WtfIssue } from "../lib/wtf-api";

/**
 * Комментарий issue для web-представления.
 */
export interface WebIssueComment {
  /** Идентификатор комментария. */
  readonly id: string;
  /** Автор комментария. */
  readonly authorId: string;
  /** Текст комментария. */
  readonly body: string;
  /** ISO-время создания. */
  readonly createdAt: string;
  /** ISO-время обновления. */
  readonly updatedAt: string;
}

/**
 * Событие activity log для web-представления.
 */
export interface WebIssueActivity {
  /** Идентификатор события. */
  readonly id: string;
  /** Автор события. */
  readonly actorId: string;
  /** Глагол события. */
  readonly verb: string;
  /** ISO-время события. */
  readonly occurredAt: string;
  /** Дополнительные данные события. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Issue, отображаемая в web-приложении.
 */
export interface WebIssue {
  /** Идентификатор issue. */
  readonly id: string;
  /** Ключ задачи. */
  readonly key: string;
  /** Название задачи. */
  readonly title: string;
  /** Описание задачи. */
  readonly description: string;
  /** Статус задачи. */
  readonly status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";
  /** Приоритет задачи. */
  readonly priority: "low" | "medium" | "high" | "urgent";
  /** Автор задачи. */
  readonly reporterId: string;
  /** Назначенный исполнитель или `null`. */
  readonly assigneeId: string | null;
  /** Комментарии issue. */
  readonly comments: ReadonlyArray<WebIssueComment>;
  /** Activity log issue. */
  readonly activities: ReadonlyArray<WebIssueActivity>;
  /** Последний пользователь, который перенес задачу между столбцами. */
  readonly movedBy: string | null;
  /** ISO-время последнего переноса между столбцами. */
  readonly movedAt: string | null;
  /** Пользователь, закрывший задачу в финальном статусе. */
  readonly closedBy: string | null;
  /** ISO-время закрытия задачи. */
  readonly closedAt: string | null;
  /** ISO-время создания задачи. */
  readonly createdAt: string;
  /** ISO-время последнего изменения задачи. */
  readonly updatedAt: string;
}

const priorityWeight: Record<WebIssue["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Сортирует issue по приоритету и ключу.
 */
export function sortIssuesByPriority(issues: ReadonlyArray<WebIssue>): WebIssue[] {
  return [...issues].sort((left, right) => {
    const byPriority = priorityWeight[right.priority] - priorityWeight[left.priority];
    if (byPriority !== 0) {
      return byPriority;
    }

    return left.key.localeCompare(right.key);
  });
}

/**
 * Преобразует API-снимок issue в модель web-представления.
 */
export function toWebIssue(issue: WtfIssue): WebIssue {
  const activities = issue.activities
    .map((activity) => ({
      id: activity.id,
      actorId: activity.actorId,
      verb: activity.verb,
      occurredAt: activity.occurredAt,
      metadata: activity.metadata,
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const statusActivities = activities
    .filter((activity) => activity.verb === "status_changed")
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const lastMove = statusActivities[0] ?? null;
  const closeActivity =
    statusActivities.find((activity) => {
      const to = activity.metadata.to;

      return to === "done" || to === "canceled";
    }) ?? null;

  return {
    id: issue.id,
    key: issue.key,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    reporterId: issue.reporterId,
    assigneeId: issue.assigneeId,
    comments: issue.comments
      .map((comment) => ({
        id: comment.id,
        authorId: comment.authorId,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    activities,
    movedBy: lastMove === null ? null : activityActor(lastMove),
    movedAt: lastMove?.occurredAt ?? null,
    closedBy: closeActivity === null ? null : activityActor(closeActivity),
    closedAt: closeActivity?.occurredAt ?? null,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function activityActor(activity: WebIssueActivity): string {
  return typeof activity.metadata.actorEmail === "string"
    ? activity.metadata.actorEmail
    : activity.actorId;
}
