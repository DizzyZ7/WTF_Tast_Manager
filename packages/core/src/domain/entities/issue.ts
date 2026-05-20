import { conflict, invariantViolation } from "../../shared/domain-error.js";
import { assertMaxLength, assertNonEmptyString } from "../../shared/guard.js";
import { createActivity, type ActivitySnapshot } from "./activity.js";
import { createComment, type CommentSnapshot } from "./comment.js";
import { createDomainEvent, type DomainEvent } from "../events/domain-event.js";
import type {
  IssueId,
  ProjectId,
  RelationId,
  SprintId,
  UserId,
  WorkspaceId,
} from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";
import { issueKey, type IssueKey } from "../value-objects/project-key.js";
import { optionalRichTextPlain, type RichTextPlain } from "../value-objects/rich-text.js";

/**
 * Статус задачи.
 */
export type IssueStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "canceled";

/**
 * Приоритет задачи.
 */
export type IssuePriority = "low" | "medium" | "high" | "urgent";

/**
 * Тип связи между задачами.
 */
export type IssueRelationType = "blocks" | "blocked_by" | "duplicates" | "relates_to";

/**
 * Снимок подзадачи.
 */
export interface SubtaskSnapshot {
  /** Локальный идентификатор подзадачи. */
  readonly id: IssueId;
  /** Название подзадачи. */
  readonly title: string;
  /** Признак завершения. */
  readonly done: boolean;
  /** ISO-время создания. */
  readonly createdAt: string;
}

/**
 * Снимок связи issue с другой issue.
 */
export interface IssueRelationSnapshot {
  /** Идентификатор связи. */
  readonly id: RelationId;
  /** Тип связи. */
  readonly type: IssueRelationType;
  /** Целевая issue. */
  readonly targetIssueId: IssueId;
  /** ISO-время создания связи. */
  readonly createdAt: string;
}

/**
 * Снимок issue.
 */
export interface IssueSnapshot {
  /** Идентификатор issue. */
  readonly id: IssueId;
  /** Идентификатор workspace. */
  readonly workspaceId: WorkspaceId;
  /** Идентификатор проекта. */
  readonly projectId: ProjectId;
  /** Человеко-читаемый ключ задачи. */
  readonly key: IssueKey;
  /** Название задачи. */
  readonly title: string;
  /** Описание задачи. */
  readonly description: RichTextPlain;
  /** Статус задачи. */
  readonly status: IssueStatus;
  /** Приоритет задачи. */
  readonly priority: IssuePriority;
  /** Автор задачи. */
  readonly reporterId: UserId;
  /** Назначенный исполнитель или `null`. */
  readonly assigneeId: UserId | null;
  /** Спринт или `null`. */
  readonly sprintId: SprintId | null;
  /** Подзадачи. */
  readonly subtasks: ReadonlyArray<SubtaskSnapshot>;
  /** Связи с другими задачами. */
  readonly relations: ReadonlyArray<IssueRelationSnapshot>;
  /** Комментарии. */
  readonly comments: ReadonlyArray<CommentSnapshot>;
  /** Журнал активности. */
  readonly activities: ReadonlyArray<ActivitySnapshot>;
  /** ISO-время создания. */
  readonly createdAt: string;
  /** ISO-время последнего изменения. */
  readonly updatedAt: string;
}

/**
 * Входные данные для создания issue.
 */
export interface CreateIssueInput {
  /** Идентификатор workspace. */
  readonly workspaceId: WorkspaceId;
  /** Идентификатор проекта. */
  readonly projectId: ProjectId;
  /** Человеко-читаемый ключ issue. */
  readonly key: string;
  /** Название задачи. */
  readonly title: string;
  /** Описание задачи. */
  readonly description?: string;
  /** Автор задачи. */
  readonly reporterId: UserId;
  /** Назначенный исполнитель. */
  readonly assigneeId?: UserId;
  /** Приоритет задачи. */
  readonly priority?: IssuePriority;
  /** Текущее время. */
  readonly now: Date;
}

const allowedTransitions: Record<IssueStatus, readonly IssueStatus[]> = {
  backlog: ["todo", "in_progress", "in_review", "done", "canceled"],
  todo: ["backlog", "in_progress", "in_review", "done", "canceled"],
  in_progress: ["backlog", "todo", "in_review", "done", "canceled"],
  in_review: ["backlog", "todo", "in_progress", "done", "canceled"],
  done: ["backlog", "todo", "in_progress", "in_review", "canceled"],
  canceled: ["backlog", "todo", "in_progress", "in_review", "done"],
};

/**
 * Агрегат issue, управляющий жизненным циклом задачи.
 */
export class Issue {
  private readonly events: DomainEvent[] = [];

  private constructor(
    private readonly id: IssueId,
    private readonly workspaceId: WorkspaceId,
    private readonly projectId: ProjectId,
    private readonly key: IssueKey,
    private title: string,
    private description: RichTextPlain,
    private status: IssueStatus,
    private priority: IssuePriority,
    private readonly reporterId: UserId,
    private assigneeId: UserId | null,
    private sprintId: SprintId | null,
    private subtasks: SubtaskSnapshot[],
    private relations: IssueRelationSnapshot[],
    private comments: CommentSnapshot[],
    private activities: ActivitySnapshot[],
    private readonly createdAt: string,
    private updatedAt: string,
  ) {}

  /**
   * Создает новую issue в backlog.
   */
  public static create(input: CreateIssueInput): Issue {
    const title = assertMaxLength(
      assertNonEmptyString(input.title, "issue.title"),
      240,
      "issue.title",
    );
    const now = input.now.toISOString();
    const issue = new Issue(
      newEntityId<"IssueId">(),
      input.workspaceId,
      input.projectId,
      issueKey(input.key),
      title,
      optionalRichTextPlain(input.description ?? ""),
      "backlog",
      input.priority ?? "medium",
      input.reporterId,
      input.assigneeId ?? null,
      null,
      [],
      [],
      [],
      [
        createActivity({
          actorId: input.reporterId,
          verb: "created",
          occurredAt: input.now,
          metadata: { title },
        }),
      ],
      now,
      now,
    );

    issue.record(
      createDomainEvent({
        type: "issue.created",
        workspaceId: issue.workspaceId,
        aggregateId: issue.id,
        occurredAt: input.now,
        payload: { projectId: input.projectId, key: issue.key, reporterId: input.reporterId },
      }),
    );

    return issue;
  }

  /**
   * Восстанавливает агрегат из persistence-снимка без новых событий.
   */
  public static rehydrate(snapshot: IssueSnapshot): Issue {
    return new Issue(
      snapshot.id,
      snapshot.workspaceId,
      snapshot.projectId,
      snapshot.key,
      snapshot.title,
      snapshot.description,
      snapshot.status,
      snapshot.priority,
      snapshot.reporterId,
      snapshot.assigneeId,
      snapshot.sprintId,
      [...snapshot.subtasks],
      [...snapshot.relations],
      [...snapshot.comments],
      [...snapshot.activities],
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  /**
   * Переводит issue в новый статус.
   */
  public transitionTo(status: IssueStatus, actorId: UserId, now: Date, actorEmail?: string): void {
    if (status === this.status) {
      return;
    }

    if (!allowedTransitions[this.status].includes(status)) {
      throw invariantViolation("недопустимый переход статуса issue", {
        issueId: this.id,
        from: this.status,
        to: status,
      });
    }

    if (status === "done" && this.subtasks.some((subtask) => !subtask.done)) {
      throw invariantViolation("нельзя завершить issue с незавершенными подзадачами", {
        issueId: this.id,
      });
    }

    const previousStatus = this.status;
    this.status = status;
    this.activities = [
      ...this.activities,
      createActivity({
        actorId,
        verb: "status_changed",
        occurredAt: now,
        metadata: {
          from: previousStatus,
          to: status,
          ...(actorEmail === undefined ? {} : { actorEmail }),
        },
      }),
    ];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "issue.status_changed",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: {
          from: previousStatus,
          to: status,
          actorId,
          ...(actorEmail === undefined ? {} : { actorEmail }),
        },
      }),
    );
  }

  /**
   * Назначает исполнителя.
   */
  public assignTo(assigneeId: UserId, actorId: UserId, now: Date): void {
    this.assigneeId = assigneeId;
    this.activities = [
      ...this.activities,
      createActivity({
        actorId,
        verb: "assigned",
        occurredAt: now,
        metadata: { assigneeId },
      }),
    ];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "issue.assigned",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: { assigneeId, actorId },
      }),
    );
  }

  /**
   * Добавляет комментарий к issue.
   */
  public addComment(authorId: UserId, body: string, now: Date): CommentSnapshot {
    if (this.status === "canceled") {
      throw conflict("нельзя комментировать отмененную issue", { issueId: this.id });
    }

    const comment = createComment({ authorId, body, now });
    this.comments = [...this.comments, comment];
    this.activities = [
      ...this.activities,
      createActivity({
        actorId: authorId,
        verb: "commented",
        occurredAt: now,
        metadata: { commentId: comment.id },
      }),
    ];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "issue.comment_added",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: { commentId: comment.id, authorId },
      }),
    );

    return comment;
  }

  /**
   * Добавляет локальную подзадачу.
   */
  public addSubtask(title: string, actorId: UserId, now: Date): SubtaskSnapshot {
    const normalizedTitle = assertMaxLength(
      assertNonEmptyString(title, "subtask.title"),
      240,
      "subtask.title",
    );

    const subtask: SubtaskSnapshot = {
      id: newEntityId<"IssueId">(),
      title: normalizedTitle,
      done: false,
      createdAt: now.toISOString(),
    };

    this.subtasks = [...this.subtasks, subtask];
    this.activities = [
      ...this.activities,
      createActivity({
        actorId,
        verb: "subtask_added",
        occurredAt: now,
        metadata: { subtaskId: subtask.id, title: normalizedTitle },
      }),
    ];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "issue.subtask_added",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: { subtaskId: subtask.id, actorId },
      }),
    );

    return subtask;
  }

  /**
   * Отмечает подзадачу завершенной или открытой.
   */
  public setSubtaskDone(subtaskId: IssueId, done: boolean, now: Date): void {
    const subtask = this.subtasks.find((candidate) => candidate.id === subtaskId);
    if (subtask === undefined) {
      throw invariantViolation("подзадача не найдена", { issueId: this.id, subtaskId });
    }

    this.subtasks = this.subtasks.map((candidate) =>
      candidate.id === subtaskId ? { ...candidate, done } : candidate,
    );
    this.touch(now);
  }

  /**
   * Добавляет связь с другой issue.
   */
  public relateTo(
    type: IssueRelationType,
    targetIssueId: IssueId,
    actorId: UserId,
    now: Date,
  ): void {
    if (targetIssueId === this.id) {
      throw invariantViolation("issue не может ссылаться сама на себя", { issueId: this.id });
    }

    if (
      this.relations.some(
        (relation) => relation.type === type && relation.targetIssueId === targetIssueId,
      )
    ) {
      throw conflict("такая связь issue уже существует", { issueId: this.id, targetIssueId, type });
    }

    const relation: IssueRelationSnapshot = {
      id: newEntityId<"RelationId">(),
      type,
      targetIssueId,
      createdAt: now.toISOString(),
    };

    this.relations = [...this.relations, relation];
    this.activities = [
      ...this.activities,
      createActivity({
        actorId,
        verb: "relation_added",
        occurredAt: now,
        metadata: { relationId: relation.id, type, targetIssueId },
      }),
    ];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "issue.relation_added",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: { relationId: relation.id, type, targetIssueId, actorId },
      }),
    );
  }

  /**
   * Возвращает неизменяемый снимок состояния.
   */
  public toSnapshot(): IssueSnapshot {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      projectId: this.projectId,
      key: this.key,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      reporterId: this.reporterId,
      assigneeId: this.assigneeId,
      sprintId: this.sprintId,
      subtasks: [...this.subtasks],
      relations: [...this.relations],
      comments: [...this.comments],
      activities: [...this.activities],
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Забирает и очищает накопленные доменные события.
   */
  public pullDomainEvents(): ReadonlyArray<DomainEvent> {
    const pulled = [...this.events];
    this.events.length = 0;
    return pulled;
  }

  private touch(now: Date): void {
    this.updatedAt = now.toISOString();
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}
