import { conflict, invariantViolation } from "../../shared/domain-error.js";
import { assertDateRange, assertMaxLength, assertNonEmptyString } from "../../shared/guard.js";
import { createDomainEvent, type DomainEvent } from "../events/domain-event.js";
import type { ProjectId, SprintId, UserId, WorkspaceId } from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";
import { projectKey, type ProjectKey } from "../value-objects/project-key.js";

/**
 * Статус проекта.
 */
export type ProjectStatus = "active" | "archived";

/**
 * Статус спринта.
 */
export type SprintStatus = "planned" | "active" | "closed";

/**
 * Снимок спринта.
 */
export interface SprintSnapshot {
  /** Идентификатор спринта. */
  readonly id: SprintId;
  /** Название спринта. */
  readonly name: string;
  /** Цель спринта. */
  readonly goal: string;
  /** ISO-время начала. */
  readonly startsAt: string;
  /** ISO-время окончания. */
  readonly endsAt: string;
  /** Текущий статус. */
  readonly status: SprintStatus;
}

/**
 * Снимок проекта.
 */
export interface ProjectSnapshot {
  /** Идентификатор проекта. */
  readonly id: ProjectId;
  /** Идентификатор workspace. */
  readonly workspaceId: WorkspaceId;
  /** Короткий ключ проекта. */
  readonly key: ProjectKey;
  /** Название проекта. */
  readonly name: string;
  /** Статус проекта. */
  readonly status: ProjectStatus;
  /** Пользователь, отвечающий за проект. */
  readonly leadUserId: UserId;
  /** Спринты проекта. */
  readonly sprints: ReadonlyArray<SprintSnapshot>;
  /** ISO-время создания. */
  readonly createdAt: string;
  /** ISO-время последнего изменения. */
  readonly updatedAt: string;
}

/**
 * Входные данные для создания проекта.
 */
export interface CreateProjectInput {
  /** Идентификатор workspace. */
  readonly workspaceId: WorkspaceId;
  /** Название проекта. */
  readonly name: string;
  /** Короткий ключ проекта. */
  readonly key: string;
  /** Пользователь, отвечающий за проект. */
  readonly leadUserId: UserId;
  /** Текущее время. */
  readonly now: Date;
}

/**
 * Агрегат проекта, управляющий ключом, статусом и спринтами.
 */
export class Project {
  private readonly events: DomainEvent[] = [];

  private constructor(
    private readonly id: ProjectId,
    private readonly workspaceId: WorkspaceId,
    private readonly key: ProjectKey,
    private name: string,
    private status: ProjectStatus,
    private readonly leadUserId: UserId,
    private sprints: SprintSnapshot[],
    private readonly createdAt: string,
    private updatedAt: string,
  ) {}

  /**
   * Создает новый активный проект.
   */
  public static create(input: CreateProjectInput): Project {
    const name = assertMaxLength(
      assertNonEmptyString(input.name, "project.name"),
      160,
      "project.name",
    );
    const now = input.now.toISOString();
    const project = new Project(
      newEntityId<"ProjectId">(),
      input.workspaceId,
      projectKey(input.key),
      name,
      "active",
      input.leadUserId,
      [],
      now,
      now,
    );

    project.record(
      createDomainEvent({
        type: "project.created",
        workspaceId: project.workspaceId,
        aggregateId: project.id,
        occurredAt: input.now,
        payload: { key: project.key, leadUserId: input.leadUserId },
      }),
    );

    return project;
  }

  /**
   * Восстанавливает агрегат из persistence-снимка без новых событий.
   */
  public static rehydrate(snapshot: ProjectSnapshot): Project {
    return new Project(
      snapshot.id,
      snapshot.workspaceId,
      snapshot.key,
      snapshot.name,
      snapshot.status,
      snapshot.leadUserId,
      [...snapshot.sprints],
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  /**
   * Создает спринт проекта.
   */
  public createSprint(input: {
    readonly name: string;
    readonly goal: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly now: Date;
  }): SprintSnapshot {
    if (this.status === "archived") {
      throw invariantViolation("нельзя создавать спринты в архивном проекте", {
        projectId: this.id,
      });
    }

    const name = assertMaxLength(
      assertNonEmptyString(input.name, "sprint.name"),
      120,
      "sprint.name",
    );
    const goal = assertMaxLength(input.goal.trim(), 500, "sprint.goal");
    assertDateRange(input.startsAt, input.endsAt, "sprint.dateRange");

    if (this.sprints.some((sprint) => sprint.name.toLowerCase() === name.toLowerCase())) {
      throw conflict("спринт с таким названием уже существует в проекте", {
        projectId: this.id,
        name,
      });
    }

    const sprint: SprintSnapshot = {
      id: newEntityId<"SprintId">(),
      name,
      goal,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
      status: "planned",
    };

    this.sprints = [...this.sprints, sprint];
    this.touch(input.now);
    this.record(
      createDomainEvent({
        type: "project.sprint_created",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: input.now,
        payload: { sprintId: sprint.id, name },
      }),
    );

    return sprint;
  }

  /**
   * Архивирует проект.
   */
  public archive(now: Date): void {
    if (this.status === "archived") {
      return;
    }

    this.status = "archived";
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "project.archived",
        workspaceId: this.workspaceId,
        aggregateId: this.id,
        occurredAt: now,
        payload: { projectId: this.id },
      }),
    );
  }

  /**
   * Возвращает неизменяемый снимок состояния.
   */
  public toSnapshot(): ProjectSnapshot {
    return {
      id: this.id,
      workspaceId: this.workspaceId,
      key: this.key,
      name: this.name,
      status: this.status,
      leadUserId: this.leadUserId,
      sprints: [...this.sprints],
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
