import { and, eq } from "drizzle-orm";
import type { WtfDatabase } from "../connection.js";
import { workspaceJoinRequests } from "../schema/index.js";

/**
 * Статус заявки на доступ в workspace.
 */
export type WorkspaceJoinRequestStatus = "pending" | "approved";

/**
 * Строка заявки на доступ в корпоративный workspace.
 */
export interface WorkspaceJoinRequestRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly requesterUserId: string;
  readonly requesterEmail: string;
  readonly internalNumber: string;
  readonly status: WorkspaceJoinRequestStatus;
  readonly decidedByUserId: string | null;
  readonly requestedAt: Date;
  readonly decidedAt: Date | null;
}

/**
 * Данные для создания заявки доступа.
 */
export interface CreateWorkspaceJoinRequestInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly requesterUserId: string;
  readonly requesterEmail: string;
  readonly internalNumber: string;
  readonly requestedAt: Date;
}

/**
 * Контракт хранения заявок доступа к workspace.
 */
export interface WorkspaceAccessRepository {
  readonly createJoinRequest: (
    input: CreateWorkspaceJoinRequestInput,
  ) => Promise<WorkspaceJoinRequestRecord>;
  readonly findJoinRequestById: (id: string) => Promise<WorkspaceJoinRequestRecord | null>;
  readonly findPendingJoinRequest: (
    workspaceId: string,
    requesterUserId: string,
  ) => Promise<WorkspaceJoinRequestRecord | null>;
  readonly listPendingJoinRequests: (
    workspaceId: string,
  ) => Promise<ReadonlyArray<WorkspaceJoinRequestRecord>>;
  readonly approveJoinRequest: (
    requestId: string,
    decidedByUserId: string,
    decidedAt: Date,
  ) => Promise<WorkspaceJoinRequestRecord | null>;
}

/**
 * PostgreSQL-реализация заявок доступа.
 */
export class PgWorkspaceAccessRepository implements WorkspaceAccessRepository {
  /**
   * Создает репозиторий с готовым Drizzle database client.
   */
  public constructor(private readonly db: WtfDatabase) {}

  /**
   * Создает pending-заявку.
   */
  public async createJoinRequest(
    input: CreateWorkspaceJoinRequestInput,
  ): Promise<WorkspaceJoinRequestRecord> {
    const [row] = await this.db
      .insert(workspaceJoinRequests)
      .values({
        id: input.id,
        workspaceId: input.workspaceId,
        requesterUserId: input.requesterUserId,
        requesterEmail: input.requesterEmail,
        internalNumber: input.internalNumber,
        status: "pending",
        decidedByUserId: null,
        requestedAt: input.requestedAt,
        decidedAt: null,
      })
      .returning();

    if (row === undefined) {
      throw new Error("failed to create workspace join request");
    }

    return row;
  }

  /**
   * Ищет заявку по id.
   */
  public async findJoinRequestById(id: string): Promise<WorkspaceJoinRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(workspaceJoinRequests)
      .where(eq(workspaceJoinRequests.id, id))
      .limit(1);
    return row ?? null;
  }

  /**
   * Ищет pending-заявку пользователя в workspace.
   */
  public async findPendingJoinRequest(
    workspaceId: string,
    requesterUserId: string,
  ): Promise<WorkspaceJoinRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(workspaceJoinRequests)
      .where(
        and(
          eq(workspaceJoinRequests.workspaceId, workspaceId),
          eq(workspaceJoinRequests.requesterUserId, requesterUserId),
          eq(workspaceJoinRequests.status, "pending"),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Возвращает pending-заявки workspace.
   */
  public async listPendingJoinRequests(
    workspaceId: string,
  ): Promise<ReadonlyArray<WorkspaceJoinRequestRecord>> {
    return this.db
      .select()
      .from(workspaceJoinRequests)
      .where(
        and(
          eq(workspaceJoinRequests.workspaceId, workspaceId),
          eq(workspaceJoinRequests.status, "pending"),
        ),
      );
  }

  /**
   * Подтверждает заявку.
   */
  public async approveJoinRequest(
    requestId: string,
    decidedByUserId: string,
    decidedAt: Date,
  ): Promise<WorkspaceJoinRequestRecord | null> {
    const [row] = await this.db
      .update(workspaceJoinRequests)
      .set({
        status: "approved",
        decidedByUserId,
        decidedAt,
      })
      .where(
        and(eq(workspaceJoinRequests.id, requestId), eq(workspaceJoinRequests.status, "pending")),
      )
      .returning();

    return row ?? null;
  }
}
