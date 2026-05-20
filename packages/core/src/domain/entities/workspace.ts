import { conflict, invariantViolation } from "../../shared/domain-error.js";
import { assertMaxLength, assertNonEmptyString } from "../../shared/guard.js";
import { createDomainEvent, type DomainEvent } from "../events/domain-event.js";
import type { UserId, WorkspaceId } from "../value-objects/entity-id.js";
import { newEntityId } from "../value-objects/entity-id.js";
import { workspaceSlug, type WorkspaceSlug } from "../value-objects/workspace-slug.js";

/**
 * Роль пользователя внутри workspace.
 */
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

/**
 * Снимок участника workspace.
 */
export interface WorkspaceMemberSnapshot {
  /** Идентификатор пользователя. */
  readonly userId: UserId;
  /** Роль пользователя. */
  readonly role: WorkspaceRole;
  /** ISO-время добавления в workspace. */
  readonly joinedAt: string;
}

/**
 * Снимок workspace.
 */
export interface WorkspaceSnapshot {
  /** Идентификатор workspace. */
  readonly id: WorkspaceId;
  /** Человекочитаемое имя. */
  readonly name: string;
  /** URL-safe slug. */
  readonly slug: WorkspaceSlug;
  /** Участники workspace. */
  readonly members: ReadonlyArray<WorkspaceMemberSnapshot>;
  /** ISO-время создания. */
  readonly createdAt: string;
  /** ISO-время последнего изменения. */
  readonly updatedAt: string;
}

/**
 * Входные данные для создания workspace.
 */
export interface CreateWorkspaceInput {
  /** Имя workspace. */
  readonly name: string;
  /** Slug workspace. */
  readonly slug: string;
  /** Первый владелец workspace. */
  readonly ownerUserId: UserId;
  /** Текущее время. */
  readonly now: Date;
}

/**
 * Агрегат workspace, отвечающий за членство и роли.
 */
export class Workspace {
  private readonly events: DomainEvent[] = [];

  private constructor(
    private readonly id: WorkspaceId,
    private name: string,
    private readonly slug: WorkspaceSlug,
    private members: WorkspaceMemberSnapshot[],
    private readonly createdAt: string,
    private updatedAt: string,
  ) {}

  /**
   * Создает новый workspace с единственным владельцем.
   */
  public static create(input: CreateWorkspaceInput): Workspace {
    const name = assertMaxLength(
      assertNonEmptyString(input.name, "workspace.name"),
      120,
      "workspace.name",
    );
    const now = input.now.toISOString();
    const workspace = new Workspace(
      newEntityId<"WorkspaceId">(),
      name,
      workspaceSlug(input.slug),
      [{ userId: input.ownerUserId, role: "owner", joinedAt: now }],
      now,
      now,
    );

    workspace.record(
      createDomainEvent({
        type: "workspace.created",
        workspaceId: workspace.id,
        aggregateId: workspace.id,
        occurredAt: input.now,
        payload: { ownerUserId: input.ownerUserId, slug: workspace.slug },
      }),
    );

    return workspace;
  }

  /**
   * Восстанавливает агрегат из persistence-снимка без новых событий.
   */
  public static rehydrate(snapshot: WorkspaceSnapshot): Workspace {
    return new Workspace(
      snapshot.id,
      snapshot.name,
      snapshot.slug,
      [...snapshot.members],
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  /**
   * Добавляет участника в workspace.
   */
  public addMember(userId: UserId, role: Exclude<WorkspaceRole, "owner">, now: Date): void {
    if (this.members.some((member) => member.userId === userId)) {
      throw conflict("пользователь уже состоит в workspace", { userId, workspaceId: this.id });
    }

    this.members = [...this.members, { userId, role, joinedAt: now.toISOString() }];
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "workspace.member_added",
        workspaceId: this.id,
        aggregateId: this.id,
        occurredAt: now,
        payload: { userId, role },
      }),
    );
  }

  /**
   * Меняет роль существующего участника.
   */
  public changeMemberRole(userId: UserId, role: WorkspaceRole, now: Date): void {
    const member = this.members.find((candidate) => candidate.userId === userId);
    if (member === undefined) {
      throw invariantViolation("пользователь не состоит в workspace", {
        userId,
        workspaceId: this.id,
      });
    }

    if (member.role === "owner" && role !== "owner" && this.ownerCount() === 1) {
      throw invariantViolation("workspace должен иметь хотя бы одного владельца", {
        workspaceId: this.id,
      });
    }

    this.members = this.members.map((candidate) =>
      candidate.userId === userId ? { ...candidate, role } : candidate,
    );
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "workspace.member_role_changed",
        workspaceId: this.id,
        aggregateId: this.id,
        occurredAt: now,
        payload: { userId, role },
      }),
    );
  }

  /**
   * Удаляет участника из workspace.
   */
  public removeMember(userId: UserId, now: Date): void {
    const member = this.members.find((candidate) => candidate.userId === userId);
    if (member === undefined) {
      throw invariantViolation("пользователь не состоит в workspace", {
        userId,
        workspaceId: this.id,
      });
    }

    if (member.role === "owner" && this.ownerCount() === 1) {
      throw invariantViolation("нельзя удалить последнего владельца workspace", {
        workspaceId: this.id,
      });
    }

    this.members = this.members.filter((candidate) => candidate.userId !== userId);
    this.touch(now);
    this.record(
      createDomainEvent({
        type: "workspace.member_removed",
        workspaceId: this.id,
        aggregateId: this.id,
        occurredAt: now,
        payload: { userId },
      }),
    );
  }

  /**
   * Возвращает неизменяемый снимок состояния.
   */
  public toSnapshot(): WorkspaceSnapshot {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      members: [...this.members],
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

  private ownerCount(): number {
    return this.members.filter((member) => member.role === "owner").length;
  }

  private touch(now: Date): void {
    this.updatedAt = now.toISOString();
  }

  private record(event: DomainEvent): void {
    this.events.push(event);
  }
}
