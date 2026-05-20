import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  DomainError,
  Issue,
  Project,
  Workspace,
  issueId,
  projectKey,
  projectId,
  userId,
  workspaceSlug,
  workspaceId,
  type IssueRepository,
  type ProjectRepository,
  type WorkspaceMemberSnapshot,
  type WorkspaceRepository,
} from "@wtf/core";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { isEmailAllowed, normalizeEmail, userIdForAllowedEmail } from "./auth/allowed-emails.js";
import { JwtTokenService } from "./auth/tokens.js";
import { buildAuthorizeUrl, type OAuthProvider } from "./auth/oauth.js";
import type { ApiConfig } from "./config/env.js";
import { HttpError, statusCodeFromDomainError } from "./errors/http-error.js";
import {
  addCommentSchema,
  addWorkspaceMemberSchema,
  createIssueSchema,
  createProjectSchema,
  createWorkspaceSchema,
  listIssuesQuerySchema,
  parseBody,
  parseQuery,
  refreshRequestSchema,
  tokenRequestSchema,
  updateIssueStatusSchema,
  uuidSchema,
} from "./schemas.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Пользователь, извлеченный из access token. */
    user: {
      readonly userId: string;
      readonly email: string;
    } | null;
  }
}

/**
 * Зависимости HTTP API.
 */
export interface ApiDependencies {
  /** Runtime-конфигурация API. */
  readonly config: ApiConfig;
  /** Репозиторий workspace. */
  readonly workspaceRepository: WorkspaceRepository;
  /** Репозиторий project. */
  readonly projectRepository: ProjectRepository;
  /** Репозиторий issue. */
  readonly issueRepository: IssueRepository;
  /** Источник времени для тестируемых обработчиков. */
  readonly clock?: () => Date;
}

/**
 * Создает Fastify API server без запуска TCP listener.
 */
export async function createApiServer(dependencies: ApiDependencies): Promise<FastifyInstance> {
  const now = dependencies.clock ?? (() => new Date());
  const tokenService = new JwtTokenService({
    accessSecret: dependencies.config.JWT_ACCESS_SECRET,
    refreshSecret: dependencies.config.JWT_REFRESH_SECRET,
    accessTtlSeconds: dependencies.config.ACCESS_TOKEN_TTL_SECONDS,
    refreshTtlSeconds: dependencies.config.REFRESH_TOKEN_TTL_SECONDS,
  });

  const app = Fastify({
    logger: {
      level: dependencies.config.LOG_LEVEL,
    },
  });

  app.decorateRequest("user", null);

  await app.register(cors, {
    allowedHeaders: ["authorization", "content-type"],
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
    origin: true,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "WTF API",
        version: "0.1.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/documentation" });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "request failed");

    if (error instanceof ZodError) {
      return sendError(reply, 400, "validation_error", "ошибка валидации запроса", {
        issues: error.issues,
      });
    }

    if (error instanceof HttpError) {
      return sendError(reply, error.statusCode, error.code, error.message, error.details);
    }

    if (error instanceof DomainError) {
      return sendError(
        reply,
        statusCodeFromDomainError(error),
        error.code,
        error.message,
        error.details,
      );
    }

    if (isFastifyHttpError(error)) {
      return sendError(
        reply,
        error.statusCode,
        typeof error.code === "string" ? error.code : "http_error",
        error.message,
        {},
      );
    }

    return sendError(reply, 500, "internal_error", "внутренняя ошибка сервера", {});
  });

  app.addHook("preHandler", (request): Promise<void> => {
    if (isPublicRoute(request)) {
      return Promise.resolve();
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "требуется Bearer token", "missing_token");
    }

    const payload = tokenService.verifyAccess(authorization.slice("Bearer ".length), now());
    const email = normalizeEmail(payload.email);
    requireAllowedEmail(email, dependencies.config);
    if (payload.sub !== userIdForAllowedEmail(email, dependencies.config.AUTH_ALLOWED_EMAILS)) {
      throw new HttpError(401, "JWT subject не соответствует email", "invalid_token");
    }

    request.user = { userId: payload.sub, email };
    return Promise.resolve();
  });

  app.get(
    "/health",
    { schema: { response: { 200: { type: "object", properties: { status: { const: "ok" } } } } } },
    () => ({
      status: "ok" as const,
    }),
  );

  app.post("/v1/auth/token", async (request, reply) => {
    const input = parseBody(tokenRequestSchema, request.body);
    const email = normalizeEmail(input.email);
    requireAllowedEmail(email, dependencies.config);
    return reply.send(
      tokenService.issuePair(
        { userId: userIdForAllowedEmail(email, dependencies.config.AUTH_ALLOWED_EMAILS), email },
        now(),
      ),
    );
  });

  app.post("/v1/auth/refresh", async (request, reply) => {
    const input = parseBody(refreshRequestSchema, request.body);
    const payload = tokenService.verifyRefresh(input.refreshToken, now());
    const email = normalizeEmail(payload.email);
    requireAllowedEmail(email, dependencies.config);
    if (payload.sub !== userIdForAllowedEmail(email, dependencies.config.AUTH_ALLOWED_EMAILS)) {
      throw new HttpError(401, "JWT subject не соответствует email", "invalid_token");
    }

    return reply.send(tokenService.issuePair({ userId: payload.sub, email }, now()));
  });

  app.get("/v1/oauth/:provider/authorize", async (request, reply) => {
    const params = request.params as { readonly provider: string };
    const provider = parseOAuthProvider(params.provider);
    const url = buildAuthorizeUrl(
      provider,
      {
        googleClientId: dependencies.config.OAUTH_GOOGLE_CLIENT_ID,
        githubClientId: dependencies.config.OAUTH_GITHUB_CLIENT_ID,
        redirectBaseUrl: dependencies.config.OAUTH_REDIRECT_BASE_URL,
      },
      crypto.randomUUID(),
    );
    return reply.send({ url });
  });

  app.post("/v1/workspaces", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const input = parseBody(createWorkspaceSchema, request.body);
    const workspace = Workspace.create({
      name: input.name,
      slug: input.slug,
      ownerUserId: userId(currentUser.userId),
      now: now(),
    });
    await dependencies.workspaceRepository.save(workspace);
    return reply.code(201).send(workspace.toSnapshot());
  });

  app.get("/v1/workspaces/by-slug/:slug", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseWorkspaceSlugParams(request.params);
    const workspace = await dependencies.workspaceRepository.findBySlug(workspaceSlug(params.slug));
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceAccess(workspace, currentUser);
    return reply.send(workspace.toSnapshot());
  });

  app.post("/v1/workspaces/:workspaceId/members", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseWorkspaceParams(request.params);
    const input = parseBody(addWorkspaceMemberSchema, request.body);
    const memberEmail = normalizeEmail(input.email);
    requireAllowedEmail(memberEmail, dependencies.config);

    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceAdmin(workspace, currentUser);
    workspace.addMember(
      userId(userIdForAllowedEmail(memberEmail, dependencies.config.AUTH_ALLOWED_EMAILS)),
      input.role,
      now(),
    );
    await dependencies.workspaceRepository.save(workspace);
    return reply.code(201).send(workspace.toSnapshot());
  });

  app.post("/v1/workspaces/:workspaceId/projects", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseWorkspaceParams(request.params);
    const input = parseBody(createProjectSchema, request.body);
    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceWriteAccess(workspace, currentUser);
    const project = Project.create({
      workspaceId: workspaceId(params.workspaceId),
      name: input.name,
      key: input.key,
      leadUserId: userId(currentUser.userId),
      now: now(),
    });
    await dependencies.projectRepository.save(project);
    return reply.code(201).send(project.toSnapshot());
  });

  app.get("/v1/workspaces/:workspaceId/projects/by-key/:key", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseProjectKeyParams(request.params);
    const project = await dependencies.projectRepository.findByWorkspaceAndKey(
      workspaceId(params.workspaceId),
      projectKey(params.key),
    );
    if (project === null) {
      throw new HttpError(404, "project не найден", "project_not_found");
    }

    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceAccess(workspace, currentUser);
    return reply.send(project.toSnapshot());
  });

  app.post("/v1/workspaces/:workspaceId/projects/:projectId/issues", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseProjectParams(request.params);
    const input = parseBody(createIssueSchema, request.body);
    const project = await dependencies.projectRepository.findById(projectId(params.projectId));
    if (project?.toSnapshot().workspaceId !== params.workspaceId) {
      throw new HttpError(404, "project не найден", "project_not_found");
    }

    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceWriteAccess(workspace, currentUser);
    if (input.assigneeId !== undefined) {
      requireWorkspaceMemberId(workspace, input.assigneeId);
    }

    const issueCount = await dependencies.issueRepository.findByProject(
      projectId(params.projectId),
      200,
    );
    const nextSequence = issueCount.length + 1;
    const issue = Issue.create({
      workspaceId: workspaceId(params.workspaceId),
      projectId: projectId(params.projectId),
      key: `${project.toSnapshot().key}-${nextSequence}`,
      title: input.title,
      reporterId: userId(currentUser.userId),
      now: now(),
      ...(input.description === undefined ? {} : { description: input.description }),
      ...(input.assigneeId === undefined ? {} : { assigneeId: userId(input.assigneeId) }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
    });
    await dependencies.issueRepository.save(issue);
    return reply.code(201).send(issue.toSnapshot());
  });

  app.get("/v1/workspaces/:workspaceId/projects/:projectId/issues", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseProjectParams(request.params);
    const query = parseQuery(listIssuesQuerySchema, request.query);
    const project = await dependencies.projectRepository.findById(projectId(params.projectId));
    if (project?.toSnapshot().workspaceId !== params.workspaceId) {
      throw new HttpError(404, "project не найден", "project_not_found");
    }

    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceAccess(workspace, currentUser);
    const issues = await dependencies.issueRepository.findByProject(
      projectId(params.projectId),
      query.limit,
    );
    return reply.send({ issues: issues.map((issue) => issue.toSnapshot()) });
  });

  app.get("/v1/issues/:issueId", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseIssueParams(request.params);
    const issue = await dependencies.issueRepository.findById(issueId(params.issueId));
    if (issue === null) {
      throw new HttpError(404, "issue не найдена", "issue_not_found");
    }

    await requireIssueWorkspaceAccess(issue, currentUser, dependencies.workspaceRepository);
    return reply.send(issue.toSnapshot());
  });

  app.post("/v1/issues/:issueId/comments", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseIssueParams(request.params);
    const input = parseBody(addCommentSchema, request.body);
    const issue = await dependencies.issueRepository.findById(issueId(params.issueId));
    if (issue === null) {
      throw new HttpError(404, "issue не найдена", "issue_not_found");
    }

    await requireIssueWorkspaceWriteAccess(issue, currentUser, dependencies.workspaceRepository);
    issue.addComment(userId(currentUser.userId), input.body, now());
    await dependencies.issueRepository.save(issue);
    return reply.code(201).send(issue.toSnapshot());
  });

  app.patch("/v1/issues/:issueId/status", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseIssueParams(request.params);
    const input = parseBody(updateIssueStatusSchema, request.body);
    const issue = await dependencies.issueRepository.findById(issueId(params.issueId));
    if (issue === null) {
      throw new HttpError(404, "issue не найдена", "issue_not_found");
    }

    await requireIssueWorkspaceWriteAccess(issue, currentUser, dependencies.workspaceRepository);
    issue.transitionTo(input.status, userId(currentUser.userId), now(), currentUser.email);
    await dependencies.issueRepository.save(issue);
    return reply.send(issue.toSnapshot());
  });

  return app;
}

type AuthenticatedUser = NonNullable<FastifyRequest["user"]>;

function requireAllowedEmail(email: string, config: ApiConfig): void {
  if (!isEmailAllowed(email, config.AUTH_ALLOWED_EMAILS)) {
    throw new HttpError(403, "email не разрешен для регистрации", "email_not_allowed", {
      email,
    });
  }
}

function requireAuthenticatedUser(request: FastifyRequest): AuthenticatedUser {
  if (request.user === null) {
    throw new HttpError(401, "требуется Bearer token", "missing_token");
  }

  return request.user;
}

function requireWorkspaceAccess(
  workspace: Workspace,
  currentUser: AuthenticatedUser,
): WorkspaceMemberSnapshot {
  const member = workspace
    .toSnapshot()
    .members.find((candidate) => candidate.userId === currentUser.userId);
  if (member === undefined) {
    throw new HttpError(403, "нет доступа к workspace", "workspace_access_denied", {
      workspaceId: workspace.toSnapshot().id,
      userId: currentUser.userId,
    });
  }

  return member;
}

function requireWorkspaceWriteAccess(
  workspace: Workspace,
  currentUser: AuthenticatedUser,
): WorkspaceMemberSnapshot {
  const member = requireWorkspaceAccess(workspace, currentUser);
  if (member.role === "viewer") {
    throw new HttpError(403, "недостаточно прав для изменения workspace", "workspace_read_only", {
      workspaceId: workspace.toSnapshot().id,
      userId: currentUser.userId,
    });
  }

  return member;
}

function requireWorkspaceAdmin(
  workspace: Workspace,
  currentUser: AuthenticatedUser,
): WorkspaceMemberSnapshot {
  const member = requireWorkspaceAccess(workspace, currentUser);
  if (member.role !== "owner" && member.role !== "admin") {
    throw new HttpError(403, "требуется роль owner или admin", "workspace_admin_required", {
      workspaceId: workspace.toSnapshot().id,
      userId: currentUser.userId,
    });
  }

  return member;
}

function requireWorkspaceMemberId(workspace: Workspace, candidateUserId: string): void {
  const snapshot = workspace.toSnapshot();
  if (!snapshot.members.some((member) => member.userId === candidateUserId)) {
    throw new HttpError(
      400,
      "исполнитель должен быть участником workspace",
      "assignee_not_member",
      {
        workspaceId: snapshot.id,
        userId: candidateUserId,
      },
    );
  }
}

async function requireIssueWorkspaceAccess(
  issue: Issue,
  currentUser: AuthenticatedUser,
  workspaceRepository: WorkspaceRepository,
): Promise<void> {
  const workspace = await findIssueWorkspace(issue, workspaceRepository);
  requireWorkspaceAccess(workspace, currentUser);
}

async function requireIssueWorkspaceWriteAccess(
  issue: Issue,
  currentUser: AuthenticatedUser,
  workspaceRepository: WorkspaceRepository,
): Promise<void> {
  const workspace = await findIssueWorkspace(issue, workspaceRepository);
  requireWorkspaceWriteAccess(workspace, currentUser);
}

async function findIssueWorkspace(
  issue: Issue,
  workspaceRepository: WorkspaceRepository,
): Promise<Workspace> {
  const workspace = await workspaceRepository.findById(workspaceId(issue.toSnapshot().workspaceId));
  if (workspace === null) {
    throw new HttpError(404, "workspace не найден", "workspace_not_found");
  }

  return workspace;
}

function isPublicRoute(request: FastifyRequest): boolean {
  const path = request.routeOptions.url ?? request.url;
  return (
    path === "/health" ||
    path === "/v1/auth/token" ||
    path === "/v1/auth/refresh" ||
    path === "/v1/oauth/:provider/authorize" ||
    path.startsWith("/documentation")
  );
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details: Readonly<Record<string, unknown>>,
): FastifyReply {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      details,
    },
  });
}

function isFastifyHttpError(error: unknown): error is Error & {
  readonly statusCode: number;
  readonly code?: string;
} {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as Error & { readonly statusCode?: unknown };
  return (
    typeof candidate.statusCode === "number" &&
    candidate.statusCode >= 400 &&
    candidate.statusCode < 500
  );
}

function parseWorkspaceParams(value: unknown): { readonly workspaceId: string } {
  const record = value as Record<string, unknown>;
  return { workspaceId: uuidSchema.parse(record.workspaceId) };
}

function parseWorkspaceSlugParams(value: unknown): { readonly slug: string } {
  const record = value as Record<string, unknown>;
  if (typeof record.slug !== "string") {
    throw new HttpError(400, "workspace slug обязателен", "invalid_workspace_slug");
  }

  return { slug: record.slug };
}

function parseProjectKeyParams(value: unknown): {
  readonly workspaceId: string;
  readonly key: string;
} {
  const record = value as Record<string, unknown>;
  if (typeof record.key !== "string") {
    throw new HttpError(400, "project key обязателен", "invalid_project_key");
  }

  return {
    workspaceId: uuidSchema.parse(record.workspaceId),
    key: record.key,
  };
}

function parseProjectParams(value: unknown): {
  readonly workspaceId: string;
  readonly projectId: string;
} {
  const record = value as Record<string, unknown>;
  return {
    workspaceId: uuidSchema.parse(record.workspaceId),
    projectId: uuidSchema.parse(record.projectId),
  };
}

function parseIssueParams(value: unknown): { readonly issueId: string } {
  const record = value as Record<string, unknown>;
  return { issueId: uuidSchema.parse(record.issueId) };
}

function parseOAuthProvider(value: string): OAuthProvider {
  if (value === "google" || value === "github") {
    return value;
  }

  throw new HttpError(404, "OAuth provider не поддерживается", "oauth_provider_not_found", {
    provider: value,
  });
}
