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

const registrationResponseSchema = z.object({
  status: z.literal("verification_sent"),
  email: z.string(),
});

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  internalNumber: z.string().nullable(),
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

const workspaceListSchema = z.object({
  workspaces: z.array(workspaceSchema),
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

const issueCommentSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const issueActivitySchema = z.object({
  id: z.string(),
  actorId: z.string(),
  verb: z.string(),
  occurredAt: z.string(),
  metadata: z.record(z.string(), z.unknown()),
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
  comments: z.array(issueCommentSchema),
  activities: z.array(issueActivitySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const issueListSchema = z.object({
  issues: z.array(issueSchema),
});

const workspaceJoinRequestSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  requesterUserId: z.string(),
  requesterEmail: z.string(),
  internalNumber: z.string(),
  status: z.literal("pending"),
  requestedAt: z.string(),
});

const workspaceJoinRequestListSchema = z.object({
  requests: z.array(workspaceJoinRequestSchema),
});

const requestWorkspaceAccessResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("pending"),
    request: workspaceJoinRequestSchema,
  }),
  z.object({
    status: z.literal("already_member"),
    workspace: workspaceSchema,
  }),
]);

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
 * JWT-сессия browser-клиента.
 */
export type WtfAuthSession = z.infer<typeof tokenPairSchema>;

/**
 * Снимок issue, полученный из API.
 */
export type WtfIssue = z.infer<typeof issueSchema>;

/**
 * Снимок workspace, полученный из API.
 */
export type WtfWorkspace = z.infer<typeof workspaceSchema>;

/**
 * Заявка доступа в корпоративный workspace.
 */
export type WtfWorkspaceJoinRequest = z.infer<typeof workspaceJoinRequestSchema>;

/**
 * Ответ на запрос входа в корпоративный workspace.
 */
export type WtfWorkspaceAccessRequestResult = z.infer<typeof requestWorkspaceAccessResponseSchema>;

/**
 * Снимок project, полученный из API.
 */
export type WtfProject = z.infer<typeof projectSchema>;

/**
 * Контекст проекта, в котором создаются issue.
 */
export interface WtfProjectContext {
  /** JWT-сессия локального пользователя. */
  readonly authSession: WtfAuthSession;
  /** Access token локального пользователя. */
  readonly accessToken: string;
  /** Refresh token локального пользователя. */
  readonly refreshToken: string;
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
  /** Email зарегистрированного сотрудника. */
  readonly email: string;
  /** Роль в workspace. */
  readonly role: Exclude<WtfWorkspaceRole, "owner">;
}

/**
 * Данные для запроса доступа в корпоративный workspace.
 */
export interface RequestWorkspaceAccessInput {
  /** Внутренний номер корпоративного workspace. */
  readonly internalNumber: string;
}

/**
 * Данные для создания корпоративного workspace.
 */
export interface CreateCorporateWorkspaceInput {
  /** Название workspace. */
  readonly name: string;
  /** Внутренний номер корпоративного workspace. */
  readonly internalNumber: string;
}

/**
 * Данные для добавления комментария к issue.
 */
export interface AddIssueCommentInput {
  /** Текст комментария. */
  readonly body: string;
}

/**
 * Данные для регистрации/входа.
 */
export interface SignInInput {
  /** Рабочий email. */
  readonly email: string;
  /** Пароль учетной записи. */
  readonly password: string;
}

/**
 * Данные для регистрации пользователя.
 */
export interface RegisterInput {
  /** Рабочий email. */
  readonly email: string;
  /** Пароль учетной записи. */
  readonly password: string;
}

/**
 * Данные для повторной отправки письма подтверждения.
 */
export interface ResendVerificationInput {
  /** Email учетной записи. */
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

const bootstrapProject = {
  name: "Tasks",
  key: "TASKS",
};

const requestTimeoutMs = 15_000;

/**
 * Возвращает базовый URL API из public runtime-конфигурации.
 */
export function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredUrl !== undefined && configuredUrl.length > 0) {
    return configuredUrl;
  }

  if (typeof window !== "undefined" && window.location.hostname.length > 0) {
    return `${window.location.protocol}//${formatHostForUrl(window.location.hostname)}:8080`;
  }

  return "http://localhost:8080";
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
   * Регистрирует пользователя и запускает отправку письма подтверждения email.
   */
  public async register(input: RegisterInput): Promise<string> {
    const response = await this.request("/v1/auth/register", {
      method: "POST",
      schema: registrationResponseSchema,
      body: {
        email: input.email,
        password: input.password,
      },
    });

    return response.email;
  }

  /**
   * Повторно отправляет письмо подтверждения email, если учетная запись еще не подтверждена.
   */
  public async resendVerification(input: ResendVerificationInput): Promise<string> {
    const response = await this.request("/v1/auth/resend-verification", {
      method: "POST",
      schema: registrationResponseSchema,
      body: { email: input.email },
    });

    return response.email;
  }

  /**
   * Обновляет browser-сессию по refresh token.
   */
  public async refreshSession(refreshToken: string): Promise<WtfAuthSession> {
    return this.request("/v1/auth/refresh", {
      method: "POST",
      schema: tokenPairSchema,
      body: { refreshToken },
    });
  }

  /**
   * Готовит личный workspace/project и возвращает контекст для работы с issue.
   */
  public async bootstrapProjectContext(input: SignInInput): Promise<WtfProjectContext> {
    const tokenPair = await this.issueAccessToken(input);
    return this.bootstrapProjectContextFromSession(tokenPair);
  }

  /**
   * Готовит личный workspace/project из уже сохраненной JWT-сессии.
   */
  public async bootstrapProjectContextFromSession(
    tokenPair: WtfAuthSession,
  ): Promise<WtfProjectContext> {
    const workspace = await this.getOrCreatePersonalWorkspace(tokenPair);
    return this.bootstrapProjectContextForWorkspace(tokenPair, workspace);
  }

  /**
   * Готовит project внутри выбранного workspace и возвращает контекст.
   */
  public async bootstrapProjectContextForWorkspace(
    tokenPair: WtfAuthSession,
    workspace: WtfWorkspace,
  ): Promise<WtfProjectContext> {
    const project = await this.getOrCreateProject(tokenPair.accessToken, workspace.id);

    return {
      authSession: tokenPair,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      currentUser: tokenPair.user,
      workspace,
      project,
    };
  }

  /**
   * Возвращает workspace, доступные текущему пользователю.
   */
  public async listWorkspaces(context: WtfProjectContext): Promise<ReadonlyArray<WtfWorkspace>> {
    const payload = await this.request("/v1/workspaces", {
      method: "GET",
      token: context.accessToken,
      schema: workspaceListSchema,
    });
    return payload.workspaces;
  }

  /**
   * Запрашивает доступ к корпоративному workspace по внутреннему номеру.
   */
  public async requestWorkspaceAccess(
    context: WtfProjectContext,
    input: RequestWorkspaceAccessInput,
  ): Promise<WtfWorkspaceAccessRequestResult> {
    return this.request("/v1/workspaces/join-requests", {
      method: "POST",
      token: context.accessToken,
      schema: requestWorkspaceAccessResponseSchema,
      body: { internalNumber: input.internalNumber },
    });
  }

  /**
   * Возвращает pending-заявки доступа текущего workspace.
   */
  public async listPendingWorkspaceJoinRequests(
    context: WtfProjectContext,
  ): Promise<ReadonlyArray<WtfWorkspaceJoinRequest>> {
    const payload = await this.request(`/v1/workspaces/${context.workspace.id}/join-requests`, {
      method: "GET",
      token: context.accessToken,
      schema: workspaceJoinRequestListSchema,
    });
    return payload.requests;
  }

  /**
   * Подтверждает pending-заявку доступа.
   */
  public async approveWorkspaceJoinRequest(
    context: WtfProjectContext,
    requestId: string,
  ): Promise<WtfWorkspace> {
    return this.request(
      `/v1/workspaces/${context.workspace.id}/join-requests/${requestId}/approve`,
      {
        method: "POST",
        token: context.accessToken,
        schema: workspaceSchema,
      },
    );
  }

  /**
   * Создает корпоративный workspace, где текущий пользователь становится первым владельцем.
   */
  public async createCorporateWorkspace(
    context: WtfProjectContext,
    input: CreateCorporateWorkspaceInput,
  ): Promise<WtfWorkspace> {
    return this.request("/v1/workspaces", {
      method: "POST",
      token: context.accessToken,
      schema: workspaceSchema,
      body: {
        name: input.name,
        slug: corporateWorkspaceSlug(input.internalNumber),
        internalNumber: input.internalNumber,
      },
    });
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
   * Добавляет сотрудника в текущий workspace. API проверяет роль и подтвержденный email.
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
   * Добавляет комментарий к issue и возвращает обновленный снимок issue.
   */
  public async addIssueComment(
    context: WtfProjectContext,
    issueId: string,
    input: AddIssueCommentInput,
  ): Promise<WtfIssue> {
    return this.request(`/v1/issues/${issueId}/comments`, {
      method: "POST",
      token: context.accessToken,
      schema: issueSchema,
      body: { body: input.body },
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
    return this.request("/v1/auth/login", {
      method: "POST",
      schema: tokenPairSchema,
      body: { email: input.email, password: input.password },
    });
  }

  private async getOrCreatePersonalWorkspace(tokenPair: WtfAuthSession): Promise<WtfWorkspace> {
    const workspace = personalWorkspaceForUser(tokenPair.user);
    try {
      return await this.request(`/v1/workspaces/by-slug/${workspace.slug}`, {
        method: "GET",
        token: tokenPair.accessToken,
        schema: workspaceSchema,
      });
    } catch (error) {
      if (!(error instanceof WtfApiError) || error.status !== 404) {
        throw error;
      }

      return this.request("/v1/workspaces", {
        method: "POST",
        token: tokenPair.accessToken,
        schema: workspaceSchema,
        body: {
          name: workspace.name,
          slug: workspace.slug,
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
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);
    const init: RequestInit = {
      method: options.method,
      signal: controller.signal,
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
    } catch (error) {
      if (isAbortError(error)) {
        throw new WtfApiError(0, "network_timeout", "API request timed out after 15 seconds");
      }

      throw new WtfApiError(
        0,
        "network_error",
        "API is unavailable or the browser blocked the request",
      );
    } finally {
      globalThis.clearTimeout(timeout);
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

function formatHostForUrl(hostname: string): string {
  return hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
}

function personalWorkspaceForUser(user: WtfCurrentUser): {
  readonly name: string;
  readonly slug: string;
} {
  return {
    name: "Personal Tasks",
    slug: `personal-${user.id}`,
  };
}

function corporateWorkspaceSlug(internalNumber: string): string {
  return `corp-${internalNumber.trim().toLowerCase()}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
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
