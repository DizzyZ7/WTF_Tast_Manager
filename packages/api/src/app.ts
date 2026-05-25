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
import type {
  AuthRepository,
  AuthUserRecord,
  EmailVerificationTokenRecord,
  WorkspaceAccessRepository,
  WorkspaceJoinRequestRecord,
} from "@wtf/db";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { normalizeEmail } from "./auth/emails.js";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
} from "./auth/email-verification.js";
import { hashPassword, verifyPassword } from "./auth/passwords.js";
import { JwtTokenService } from "./auth/tokens.js";
import { buildAuthorizeUrl, type OAuthProvider } from "./auth/oauth.js";
import type { ApiConfig } from "./config/env.js";
import type { EmailSender } from "./email/sender.js";
import { HttpError, statusCodeFromDomainError } from "./errors/http-error.js";
import {
  addCommentSchema,
  addWorkspaceMemberSchema,
  createIssueSchema,
  createProjectSchema,
  createWorkspaceSchema,
  loginRequestSchema,
  listIssuesQuerySchema,
  parseBody,
  parseQuery,
  refreshRequestSchema,
  registerRequestSchema,
  requestWorkspaceAccessSchema,
  updateIssueStatusSchema,
  uuidSchema,
  verifyEmailQuerySchema,
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
  /** Репозиторий учеток и email verification tokens. */
  readonly authRepository: AuthRepository;
  /** Отправка email-писем для регистрации. */
  readonly emailSender: EmailSender;
  /** Репозиторий заявок доступа в корпоративные workspace. */
  readonly workspaceAccessRepository: WorkspaceAccessRepository;
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
  if (shouldRegisterDocumentation(dependencies.config)) {
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
  }

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

  app.addHook("preHandler", async (request): Promise<void> => {
    if (isPublicRoute(request)) {
      return;
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new HttpError(401, "требуется Bearer token", "missing_token");
    }

    const payload = tokenService.verifyAccess(authorization.slice("Bearer ".length), now());
    const email = normalizeEmail(payload.email);
    const user = await dependencies.authRepository.findUserById(payload.sub);
    if (user?.email !== email) {
      throw new HttpError(401, "JWT subject не соответствует email", "invalid_token");
    }
    requireVerifiedUser(user);

    request.user = { userId: user.id, email: user.email };
  });

  app.get(
    "/health",
    { schema: { response: { 200: { type: "object", properties: { status: { const: "ok" } } } } } },
    () => ({
      status: "ok" as const,
    }),
  );

  app.post("/v1/auth/register", async (request, reply) => {
    const input = parseBody(registerRequestSchema, request.body);
    const email = normalizeEmail(input.email);
    const currentTime = now();
    const passwordHash = await hashPassword(input.password);
    const existingUser = await dependencies.authRepository.findUserByEmail(email);
    let user: AuthUserRecord;

    if (isVerifiedUser(existingUser)) {
      throw new HttpError(409, "email уже зарегистрирован", "email_already_registered", { email });
    }

    if (existingUser === null) {
      user = await dependencies.authRepository.createUser({
        id: crypto.randomUUID(),
        email,
        passwordHash,
        now: currentTime,
      });
    } else {
      await dependencies.authRepository.updateUserPassword(
        existingUser.id,
        passwordHash,
        currentTime,
      );
      user = {
        ...existingUser,
        passwordHash,
        updatedAt: currentTime,
      };
    }

    const verification = createEmailVerificationToken(
      currentTime,
      dependencies.config.EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
    );
    await dependencies.authRepository.createEmailVerificationToken({
      id: crypto.randomUUID(),
      userId: user.id,
      tokenHash: verification.tokenHash,
      expiresAt: verification.expiresAt,
      createdAt: currentTime,
    });
    await dependencies.emailSender.sendEmailVerification({
      to: user.email,
      verificationUrl: buildEmailVerificationUrl(dependencies.config, verification.token),
      expiresAt: verification.expiresAt,
    });

    return reply.code(202).send({ status: "verification_sent", email: user.email });
  });

  app.get("/v1/auth/verify-email", async (request, reply) => {
    const query = parseQuery(verifyEmailQuerySchema, request.query);
    const currentTime = now();
    const token = await dependencies.authRepository.findEmailVerificationTokenByHash(
      hashEmailVerificationToken(query.token),
    );

    if (!isUsableEmailVerificationToken(token, currentTime)) {
      return sendVerificationHtml(
        reply,
        400,
        "Ссылка подтверждения недействительна",
        "Запросите регистрацию еще раз и откройте новое письмо.",
      );
    }

    const user = await dependencies.authRepository.findUserById(token.userId);
    if (user === null) {
      return sendVerificationHtml(
        reply,
        400,
        "Пользователь не найден",
        "Зарегистрируйтесь заново, чтобы получить новое письмо.",
      );
    }

    await dependencies.authRepository.markUserEmailVerified(user.id, currentTime);
    await dependencies.authRepository.consumeEmailVerificationToken(token.id, currentTime);

    return sendVerificationHtml(
      reply,
      200,
      "Email подтвержден",
      "Теперь можно вернуться в WTF и войти с паролем.",
    );
  });

  app.post("/v1/auth/login", async (request, reply) => issueTokenFromPassword(request, reply));

  app.post("/v1/auth/token", async (request, reply) => issueTokenFromPassword(request, reply));

  async function issueTokenFromPassword(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const input = parseBody(loginRequestSchema, request.body);
    const email = normalizeEmail(input.email);
    const user = await dependencies.authRepository.findUserByEmail(email);
    if (user === null) {
      throw new HttpError(401, "email или пароль неверны", "invalid_credentials");
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, "email или пароль неверны", "invalid_credentials");
    }

    requireVerifiedUser(user);
    return reply.send(tokenService.issuePair({ userId: user.id, email: user.email }, now()));
  }

  app.post("/v1/auth/refresh", async (request, reply) => {
    const input = parseBody(refreshRequestSchema, request.body);
    const payload = tokenService.verifyRefresh(input.refreshToken, now());
    const email = normalizeEmail(payload.email);
    const user = await dependencies.authRepository.findUserById(payload.sub);
    if (user?.email !== email) {
      throw new HttpError(401, "JWT subject не соответствует email", "invalid_token");
    }

    requireVerifiedUser(user);
    return reply.send(tokenService.issuePair({ userId: user.id, email: user.email }, now()));
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
      ...(input.internalNumber === undefined ? {} : { internalNumber: input.internalNumber }),
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

  app.post("/v1/workspaces/join-requests", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const input = parseBody(requestWorkspaceAccessSchema, request.body);
    const workspace = await dependencies.workspaceRepository.findByInternalNumber(
      input.internalNumber,
    );
    if (workspace === null) {
      throw new HttpError(
        404,
        "workspace с таким внутренним номером не найден",
        "workspace_internal_number_not_found",
        { internalNumber: input.internalNumber },
      );
    }

    const snapshot = workspace.toSnapshot();
    if (snapshot.members.some((member) => member.userId === currentUser.userId)) {
      return reply.send({
        status: "already_member",
        workspace: snapshot,
      });
    }

    const existingRequest = await dependencies.workspaceAccessRepository.findPendingJoinRequest(
      snapshot.id,
      currentUser.userId,
    );
    if (existingRequest !== null) {
      return reply.code(202).send({
        status: "pending",
        request: serializeJoinRequest(existingRequest),
      });
    }

    const joinRequest = await dependencies.workspaceAccessRepository.createJoinRequest({
      id: crypto.randomUUID(),
      workspaceId: snapshot.id,
      requesterUserId: currentUser.userId,
      requesterEmail: currentUser.email,
      internalNumber: input.internalNumber,
      requestedAt: now(),
    });

    return reply.code(202).send({
      status: "pending",
      request: serializeJoinRequest(joinRequest),
    });
  });

  app.get("/v1/workspaces/:workspaceId/join-requests", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseWorkspaceParams(request.params);
    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceOwner(workspace, currentUser);
    const requests = await dependencies.workspaceAccessRepository.listPendingJoinRequests(
      params.workspaceId,
    );
    return reply.send({ requests: requests.map(serializeJoinRequest) });
  });

  app.post(
    "/v1/workspaces/:workspaceId/join-requests/:requestId/approve",
    async (request, reply) => {
      const currentUser = requireAuthenticatedUser(request);
      const params = parseWorkspaceJoinRequestParams(request.params);
      const workspace = await dependencies.workspaceRepository.findById(
        workspaceId(params.workspaceId),
      );
      if (workspace === null) {
        throw new HttpError(404, "workspace не найден", "workspace_not_found");
      }

      requireWorkspaceOwner(workspace, currentUser);
      const joinRequest = await dependencies.workspaceAccessRepository.findJoinRequestById(
        params.requestId,
      );
      if (joinRequest?.workspaceId !== params.workspaceId) {
        throw new HttpError(404, "заявка доступа не найдена", "join_request_not_found");
      }

      if (joinRequest.status !== "pending") {
        throw new HttpError(409, "заявка уже обработана", "join_request_already_decided");
      }

      const requester = await dependencies.authRepository.findUserById(joinRequest.requesterUserId);
      if (!isVerifiedUser(requester)) {
        throw new HttpError(
          400,
          "пользователь должен подтвердить email",
          "join_request_user_not_verified",
          { requesterUserId: joinRequest.requesterUserId },
        );
      }

      const snapshot = workspace.toSnapshot();
      if (!snapshot.members.some((member) => member.userId === joinRequest.requesterUserId)) {
        workspace.addMember(userId(joinRequest.requesterUserId), "member", now());
        await dependencies.workspaceRepository.save(workspace);
      }
      const approvedRequest = await dependencies.workspaceAccessRepository.approveJoinRequest(
        joinRequest.id,
        currentUser.userId,
        now(),
      );
      if (approvedRequest === null) {
        throw new HttpError(409, "заявка уже обработана", "join_request_already_decided");
      }

      return reply.send(workspace.toSnapshot());
    },
  );

  app.post("/v1/workspaces/:workspaceId/members", async (request, reply) => {
    const currentUser = requireAuthenticatedUser(request);
    const params = parseWorkspaceParams(request.params);
    const input = parseBody(addWorkspaceMemberSchema, request.body);
    const memberEmail = normalizeEmail(input.email);

    const workspace = await dependencies.workspaceRepository.findById(
      workspaceId(params.workspaceId),
    );
    if (workspace === null) {
      throw new HttpError(404, "workspace не найден", "workspace_not_found");
    }

    requireWorkspaceMemberManagementAccess(workspace, currentUser);
    const memberUser = await dependencies.authRepository.findUserByEmail(memberEmail);
    if (!isVerifiedUser(memberUser)) {
      throw new HttpError(
        400,
        "участник должен зарегистрироваться и подтвердить email",
        "member_email_not_verified",
        { email: memberEmail },
      );
    }

    workspace.addMember(userId(memberUser.id), input.role, now());
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

    const nextSequence =
      (await dependencies.issueRepository.countByProject(projectId(params.projectId))) + 1;
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

function shouldRegisterDocumentation(config: ApiConfig): boolean {
  return config.NODE_ENV !== "test";
}

function requireVerifiedUser(user: AuthUserRecord): void {
  if (user.emailVerifiedAt === null) {
    throw new HttpError(403, "email не подтвержден", "email_not_verified", {
      email: user.email,
    });
  }
}

function isVerifiedUser(
  user: AuthUserRecord | null,
): user is AuthUserRecord & { readonly emailVerifiedAt: Date } {
  return user?.emailVerifiedAt instanceof Date;
}

function isUsableEmailVerificationToken(
  token: EmailVerificationTokenRecord | null,
  now: Date,
): token is EmailVerificationTokenRecord {
  return token?.consumedAt === null && token.expiresAt > now;
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

function requireWorkspaceMemberManagementAccess(
  workspace: Workspace,
  currentUser: AuthenticatedUser,
): WorkspaceMemberSnapshot {
  if (workspace.toSnapshot().internalNumber !== null) {
    return requireWorkspaceOwner(workspace, currentUser);
  }

  return requireWorkspaceAdmin(workspace, currentUser);
}

function requireWorkspaceOwner(
  workspace: Workspace,
  currentUser: AuthenticatedUser,
): WorkspaceMemberSnapshot {
  const member = requireWorkspaceAccess(workspace, currentUser);
  if (member.role !== "owner") {
    throw new HttpError(403, "требуется роль owner", "workspace_owner_required", {
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
    path === "/v1/auth/register" ||
    path === "/v1/auth/login" ||
    path === "/v1/auth/token" ||
    path === "/v1/auth/refresh" ||
    path === "/v1/auth/verify-email" ||
    path === "/v1/oauth/:provider/authorize" ||
    path.startsWith("/documentation")
  );
}

function serializeJoinRequest(request: WorkspaceJoinRequestRecord): {
  readonly id: string;
  readonly workspaceId: string;
  readonly requesterUserId: string;
  readonly requesterEmail: string;
  readonly internalNumber: string;
  readonly status: string;
  readonly requestedAt: string;
} {
  return {
    id: request.id,
    workspaceId: request.workspaceId,
    requesterUserId: request.requesterUserId,
    requesterEmail: request.requesterEmail,
    internalNumber: request.internalNumber,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
  };
}

function buildEmailVerificationUrl(config: ApiConfig, token: string): string {
  const base = config.EMAIL_VERIFICATION_BASE_URL.endsWith("/")
    ? config.EMAIL_VERIFICATION_BASE_URL.slice(0, -1)
    : config.EMAIL_VERIFICATION_BASE_URL;
  const url = new URL(`${base}/v1/auth/verify-email`);
  url.searchParams.set("token", token);
  return url.toString();
}

function sendVerificationHtml(
  reply: FastifyReply,
  statusCode: number,
  title: string,
  message: string,
): FastifyReply {
  return reply
    .code(statusCode)
    .type("text/html; charset=utf-8")
    .send(renderVerificationResultHtml(title, message));
}

function renderVerificationResultHtml(title: string, message: string): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;">
      <section style="max-width:420px;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:24px;">
        <h1 style="margin:0 0 10px;font-size:20px;line-height:28px;">${escapeHtml(title)}</h1>
        <p style="margin:0;font-size:14px;line-height:22px;color:#52525b;">${escapeHtml(message)}</p>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function parseWorkspaceJoinRequestParams(value: unknown): {
  readonly workspaceId: string;
  readonly requestId: string;
} {
  const record = value as Record<string, unknown>;
  return {
    workspaceId: uuidSchema.parse(record.workspaceId),
    requestId: uuidSchema.parse(record.requestId),
  };
}

function parseOAuthProvider(value: string): OAuthProvider {
  if (value === "google" || value === "github") {
    return value;
  }

  throw new HttpError(404, "OAuth provider не поддерживается", "oauth_provider_not_found", {
    provider: value,
  });
}
