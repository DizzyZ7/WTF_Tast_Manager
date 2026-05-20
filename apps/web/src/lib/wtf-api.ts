import { z } from "zod";

const issueStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
]);
const issuePrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const tokenPairSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number(),
});

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  members: z.array(
    z.object({
      userId: z.string(),
      role: z.enum(["owner", "admin", "member", "viewer"]),
      joinedAt: z.string(),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  key: z.string(),
  name: z.string(),
  status: z.string(),
  leadUserId: z.string(),
  sprints: z.array(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const issueSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  status: issueStatusSchema,
  priority: issuePrioritySchema,
  reporterId: z.string(),
  assigneeId: z.string().nullable(),
  sprintId: z.string().nullable(),
  subtasks: z.array(z.unknown()),
  relations: z.array(z.unknown()),
  comments: z.array(z.unknown()),
  activities: z.array(
    z.object({
      id: z.string(),
      actorId: z.string(),
      verb: z.string(),
      occurredAt: z.string(),
      metadata: z.record(z.string(), z.unknown()),
    }),
  ),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const issueListSchema = z.object({
  issues: z.array(issueSchema),
});

const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
  }),
});

/**
 * Приоритет issue, поддерживаемый публичным API.
 */
export type WtfIssuePriority = z.infer<typeof issuePrioritySchema>;

/**
 * Статус issue, поддерживаемый публичным API.
 */
export type WtfIssueStatus = z.infer<typeof issueStatusSchema>;

/**
 * Роль участника workspace.
 */
export type WtfWorkspaceRole = z.infer<typeof workspaceSchema>["members"][number]["role"];

/**
 * Пользователь текущей browser-сессии.
 */
export type WtfCurrentUser = z.infer<typeof tokenPairSchema>["user"];

/**
 * Снимок issue, полученный из API.
 */
export type WtfIssue = z.infer<typeof issueSchema>;

/**
 * Снимок workspace, полученный из API.
 */
export type WtfWorkspace = z.infer<typeof workspaceSchema>;

/**
 * Снимок project, полученный из API.
 */
export type WtfProject = z.infer<typeof projectSchema>;

/**
 * Контекст проекта, в котором создаются issue.
 */
export interface WtfProjectContext {
  /** Access token локального пользователя. */
  readonly accessToken: string;
  /** Пользователь текущей сессии. */
  readonly currentUser: WtfCurrentUser;
  /** Workspace для текущей рабочей поверхности. */
  readonly workspace: WtfWorkspace;
  /** Project для текущей рабочей поверхности. */
  readonly project: WtfProject;
}

/**
 * Данные для создания issue через API.
 */
export interface CreateIssueInput {
  /** Заголовок issue. */
  readonly title: string;
  /** Описание issue. */
  readonly description?: string;
  /** Приоритет issue. */
  readonly priority: WtfIssuePriority;
}

/**
 * Данные для добавления участника workspace.
 */
export interface AddWorkspaceMemberInput {
  /** Email сотрудника из allow-list API. */
  readonly email: string;
  /** Роль в workspace. */
  readonly role: Exclude<WtfWorkspaceRole, "owner">;
}

/**
 * Данные для регистрации/входа.
 */
export interface SignInInput {
  /** Рабочий email из allow-list API. */
  readonly email: string;
}

/**
 * Ошибка HTTP API с кодом и статусом.
 */
export class WtfApiError extends Error {
  /**
   * Создает ошибку API.
   */
  public constructor(
    /** HTTP status code. */
    public readonly status: number,
    /** Машиночитаемый код ошибки. */
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WtfApiError";
  }
}

const bootstrapWorkspace = {
  name: "Demo Workspace",
  slug: "demo-workspace",
};

const bootstrapProject = {
  name: "WTF Demo",
  key: "WTF",
};

/**
 * Возвращает базовый URL API из public runtime-конфигурации.
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
}

/**
 * Создает клиент WTF API для browser runtime.
 */
export function createWtfApiClient(baseUrl = getApiBaseUrl()): WtfApiClient {
  return new WtfApiClient(baseUrl);
}

/**
 * Минимальный browser client для REST API WTF.
 */
export class WtfApiClient {
  /**
   * Создает клиент с базовым URL API.
   */
  public constructor(private readonly baseUrl: string) {}

  /**
   * Готовит demo workspace/project и возвращает контекст для работы с issue.
   */
  public async bootstrapProjectContext(input: SignInInput): Promise<WtfProjectContext> {
    const tokenPair = await this.issueAccessToken(input);
    const workspace = await this.getOrCreateWorkspace(tokenPair.accessToken);
    const project = await this.getOrCreateProject(tokenPair.accessToken, workspace.id);

    return { accessToken: tokenPair.accessToken, currentUser: tokenPair.user, workspace, project };
  }

  /**
   * Возвращает issue проекта.
   */
  public async listIssues(context: WtfProjectContext): Promise<ReadonlyArray<WtfIssue>> {
    const payload = await this.request(
      `/v1/workspaces/${context.workspace.id}/projects/${context.project.id}/issues?limit=100`,
      {
        method: "GET",
        token: context.accessToken,
        schema: issueListSchema,
      },
    );

    return payload.issues;
  }

  /**
   * Создает новую issue в текущем проекте.
   */
  public async createIssue(context: WtfProjectContext, input: CreateIssueInput): Promise<WtfIssue> {
    return this.request(
      `/v1/workspaces/${context.workspace.id}/projects/${context.project.id}/issues`,
      {
        method: "POST",
        token: context.accessToken,
        schema: issueSchema,
        body: {
          title: input.title,
          description: input.description,
          priority: input.priority,
        },
      },
    );
  }

  /**
   * Добавляет сотрудника в текущий workspace. API проверяет owner/admin и allow-list email.
   */
  public async addWorkspaceMember(
    context: WtfProjectContext,
    input: AddWorkspaceMemberInput,
  ): Promise<WtfWorkspace> {
    return this.request(`/v1/workspaces/${context.workspace.id}/members`, {
      method: "POST",
      token: context.accessToken,
      schema: workspaceSchema,
      body: {
        email: input.email,
        role: input.role,
      },
    });
  }

  /**
   * Переводит issue в новый статус. Исполнитель берется API из JWT.
   */
  public async moveIssue(
    context: WtfProjectContext,
    issueId: string,
    status: WtfIssueStatus,
  ): Promise<WtfIssue> {
    return this.request(`/v1/issues/${issueId}/status`, {
      method: "PATCH",
      token: context.accessToken,
      schema: issueSchema,
      body: { status },
    });
  }

  private async issueAccessToken(input: SignInInput): Promise<z.infer<typeof tokenPairSchema>> {
    return this.request("/v1/auth/token", {
      method: "POST",
      schema: tokenPairSchema,
      body: { email: input.email },
    });
  }

  private async getOrCreateWorkspace(accessToken: string): Promise<WtfWorkspace> {
    try {
      return await this.request(`/v1/workspaces/by-slug/${bootstrapWorkspace.slug}`, {
        method: "GET",
        token: accessToken,
        schema: workspaceSchema,
      });
    } catch (error) {
      if (!(error instanceof WtfApiError) || error.status !== 404) {
        throw error;
      }

      return this.request("/v1/workspaces", {
        method: "POST",
        token: accessToken,
        schema: workspaceSchema,
        body: {
          name: bootstrapWorkspace.name,
          slug: bootstrapWorkspace.slug,
        },
      });
    }
  }

  private async getOrCreateProject(accessToken: string, workspaceId: string): Promise<WtfProject> {
    try {
      return await this.request(
        `/v1/workspaces/${workspaceId}/projects/by-key/${bootstrapProject.key}`,
        {
          method: "GET",
          token: accessToken,
          schema: projectSchema,
        },
      );
    } catch (error) {
      if (!(error instanceof WtfApiError) || error.status !== 404) {
        throw error;
      }

      return this.request(`/v1/workspaces/${workspaceId}/projects`, {
        method: "POST",
        token: accessToken,
        schema: projectSchema,
        body: {
          name: bootstrapProject.name,
          key: bootstrapProject.key,
        },
      });
    }
  }

  private async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
    const init: RequestInit = {
      method: options.method,
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, init);
    } catch {
      throw new WtfApiError(
        0,
        "network_error",
        "API is unavailable or the browser blocked the request",
      );
    }

    const payload: unknown = await readJson(response);
    if (!response.ok) {
      const parsed = errorResponseSchema.safeParse(payload);
      if (parsed.success) {
        throw new WtfApiError(response.status, parsed.data.error.code, parsed.data.error.message);
      }

      throw new WtfApiError(response.status, "http_error", "API request failed");
    }

    return options.schema.parse(payload);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

interface RequestOptions<T> {
  /** HTTP method. */
  readonly method: "GET" | "POST" | "PATCH";
  /** Bearer token. */
  readonly token?: string;
  /** JSON body. */
  readonly body?: Readonly<Record<string, unknown>>;
  /** Zod-схема ответа. */
  readonly schema: z.ZodType<T>;
}
