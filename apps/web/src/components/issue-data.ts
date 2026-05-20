import type { WtfIssue } from "../lib/wtf-api";

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
  /** Последний пользователь, который перенес задачу между столбцами. */
  readonly movedBy: string | null;
  /** ISO-время последнего переноса между столбцами. */
  readonly movedAt: string | null;
  /** Пользователь, закрывший задачу в финальном статусе. */
  readonly closedBy: string | null;
  /** ISO-время закрытия задачи. */
  readonly closedAt: string | null;
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
  const statusActivities = issue.activities
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
    movedBy: lastMove === null ? null : activityActor(lastMove),
    movedAt: lastMove?.occurredAt ?? null,
    closedBy: closeActivity === null ? null : activityActor(closeActivity),
    closedAt: closeActivity?.occurredAt ?? null,
  };
}

function activityActor(activity: WtfIssue["activities"][number]): string {
  return typeof activity.metadata.actorEmail === "string"
    ? activity.metadata.actorEmail
    : activity.actorId;
}
