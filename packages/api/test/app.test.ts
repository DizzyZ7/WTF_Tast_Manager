import type {
  Issue,
  Project,
  Workspace,
  issueId,
  issueKey,
  projectId,
  projectKey,
  workspaceId,
  workspaceSlug,
  IssueRepository,
  ProjectRepository,
  WorkspaceRepository,
} from "@wtf/core";
import type {
  AuthRepository,
  AuthUserRecord,
  CreateAuthUserInput,
  CreateEmailVerificationTokenInput,
  EmailVerificationTokenRecord,
  WorkspaceAccessRepository,
  WorkspaceJoinRequestRecord,
  CreateWorkspaceJoinRequestInput,
} from "@wtf/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiServer, type ApiDependencies } from "../src/app.js";
import type { ApiConfig } from "../src/config/env.js";
import type { EmailSender, SendEmailVerificationInput } from "../src/email/sender.js";

const now = new Date("2026-05-19T10:00:00.000Z");
const ownerUserId = "00000000-0000-4000-8000-000000000001";

class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly rows = new Map<string, Workspace>();

  public save(workspace: Workspace): Promise<void> {
    this.rows.set(workspace.toSnapshot().id, workspace);
    return Promise.resolve();
  }

  public findById(id: ReturnType<typeof workspaceId>): Promise<Workspace | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  public findBySlug(slug: ReturnType<typeof workspaceSlug>): Promise<Workspace | null> {
    return Promise.resolve(
      [...this.rows.values()].find((workspace) => workspace.toSnapshot().slug === slug) ?? null,
    );
  }

  public findByInternalNumber(internalNumber: string): Promise<Workspace | null> {
    return Promise.resolve(
      [...this.rows.values()].find(
        (workspace) => workspace.toSnapshot().internalNumber === internalNumber,
      ) ?? null,
    );
  }
}

class InMemoryProjectRepository implements ProjectRepository {
  private readonly rows = new Map<string, Project>();

  public save(project: Project): Promise<void> {
    this.rows.set(project.toSnapshot().id, project);
    return Promise.resolve();
  }

  public findById(id: ReturnType<typeof projectId>): Promise<Project | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  public findByWorkspaceAndKey(
    workspace: ReturnType<typeof workspaceId>,
    key: ReturnType<typeof projectKey>,
  ): Promise<Project | null> {
    return Promise.resolve(
      [...this.rows.values()].find((project) => {
        const snapshot = project.toSnapshot();
        return snapshot.workspaceId === workspace && snapshot.key === key;
      }) ?? null,
    );
  }
}

class InMemoryIssueRepository implements IssueRepository {
  private readonly rows = new Map<string, Issue>();

  public save(issue: Issue): Promise<void> {
    this.rows.set(issue.toSnapshot().id, issue);
    return Promise.resolve();
  }

  public findById(id: ReturnType<typeof issueId>): Promise<Issue | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  public findByWorkspaceAndKey(
    workspace: ReturnType<typeof workspaceId>,
    key: ReturnType<typeof issueKey>,
  ): Promise<Issue | null> {
    return Promise.resolve(
      [...this.rows.values()].find((issue) => {
        const snapshot = issue.toSnapshot();
        return snapshot.workspaceId === workspace && snapshot.key === key;
      }) ?? null,
    );
  }

  public countByProject(project: ReturnType<typeof projectId>): Promise<number> {
    return Promise.resolve(
      [...this.rows.values()].filter((issue) => issue.toSnapshot().projectId === project).length,
    );
  }

  public findByProject(
    project: ReturnType<typeof projectId>,
    limit: number,
  ): Promise<ReadonlyArray<Issue>> {
    return Promise.resolve(
      [...this.rows.values()]
        .filter((issue) => issue.toSnapshot().projectId === project)
        .slice(0, Math.max(1, Math.min(limit, 200))),
    );
  }
}

class InMemoryAuthRepository implements AuthRepository {
  private readonly usersById = new Map<string, AuthUserRecord>();
  private readonly userIdsByEmail = new Map<string, string>();
  private readonly tokensByHash = new Map<string, EmailVerificationTokenRecord>();

  public createUser(input: CreateAuthUserInput): Promise<AuthUserRecord> {
    const user = {
      id: input.id,
      email: input.email,
      passwordHash: input.passwordHash,
      emailVerifiedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    } satisfies AuthUserRecord;
    this.usersById.set(user.id, user);
    this.userIdsByEmail.set(user.email, user.id);
    return Promise.resolve(user);
  }

  public findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const id = this.userIdsByEmail.get(email);
    return Promise.resolve(id === undefined ? null : (this.usersById.get(id) ?? null));
  }

  public findUserById(id: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.usersById.get(id) ?? null);
  }

  public updateUserPassword(userId: string, passwordHash: string, updatedAt: Date): Promise<void> {
    const user = this.usersById.get(userId);
    if (user !== undefined) {
      this.usersById.set(userId, { ...user, passwordHash, updatedAt });
    }

    return Promise.resolve();
  }

  public markUserEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
    const user = this.usersById.get(userId);
    if (user !== undefined) {
      this.usersById.set(userId, {
        ...user,
        emailVerifiedAt: verifiedAt,
        updatedAt: verifiedAt,
      });
    }

    return Promise.resolve();
  }

  public createEmailVerificationToken(input: CreateEmailVerificationTokenInput): Promise<void> {
    this.tokensByHash.set(input.tokenHash, {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      consumedAt: null,
      createdAt: input.createdAt,
    });
    return Promise.resolve();
  }

  public findEmailVerificationTokenByHash(
    tokenHash: string,
  ): Promise<EmailVerificationTokenRecord | null> {
    return Promise.resolve(this.tokensByHash.get(tokenHash) ?? null);
  }

  public consumeEmailVerificationToken(tokenId: string, consumedAt: Date): Promise<void> {
    for (const [tokenHash, token] of this.tokensByHash.entries()) {
      if (token.id === tokenId) {
        this.tokensByHash.set(tokenHash, { ...token, consumedAt });
        break;
      }
    }

    return Promise.resolve();
  }
}

class InMemoryEmailSender implements EmailSender {
  public readonly messages: SendEmailVerificationInput[] = [];

  public sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
    this.messages.push(input);
    return Promise.resolve();
  }

  public verificationTokenFor(email: string): string {
    const message = this.messages.findLast((candidate) => candidate.to === email);
    if (message === undefined) {
      throw new Error(`verification email was not sent to ${email}`);
    }

    const token = new URL(message.verificationUrl).searchParams.get("token");
    if (token === null) {
      throw new Error("verification URL does not contain token");
    }

    return token;
  }
}

class InMemoryWorkspaceAccessRepository implements WorkspaceAccessRepository {
  private readonly requestsById = new Map<string, WorkspaceJoinRequestRecord>();

  public createJoinRequest(
    input: CreateWorkspaceJoinRequestInput,
  ): Promise<WorkspaceJoinRequestRecord> {
    const request = {
      id: input.id,
      workspaceId: input.workspaceId,
      requesterUserId: input.requesterUserId,
      requesterEmail: input.requesterEmail,
      internalNumber: input.internalNumber,
      status: "pending",
      decidedByUserId: null,
      requestedAt: input.requestedAt,
      decidedAt: null,
    } satisfies WorkspaceJoinRequestRecord;
    this.requestsById.set(request.id, request);
    return Promise.resolve(request);
  }

  public findJoinRequestById(id: string): Promise<WorkspaceJoinRequestRecord | null> {
    return Promise.resolve(this.requestsById.get(id) ?? null);
  }

  public findPendingJoinRequest(
    workspaceId: string,
    requesterUserId: string,
  ): Promise<WorkspaceJoinRequestRecord | null> {
    return Promise.resolve(
      [...this.requestsById.values()].find(
        (request) =>
          request.workspaceId === workspaceId &&
          request.requesterUserId === requesterUserId &&
          request.status === "pending",
      ) ?? null,
    );
  }

  public listPendingJoinRequests(
    workspaceId: string,
  ): Promise<ReadonlyArray<WorkspaceJoinRequestRecord>> {
    return Promise.resolve(
      [...this.requestsById.values()].filter(
        (request) => request.workspaceId === workspaceId && request.status === "pending",
      ),
    );
  }

  public approveJoinRequest(
    requestId: string,
    decidedByUserId: string,
    decidedAt: Date,
  ): Promise<WorkspaceJoinRequestRecord | null> {
    const request = this.requestsById.get(requestId);
    if (request?.status !== "pending") {
      return Promise.resolve(null);
    }

    const approved = {
      ...request,
      status: "approved",
      decidedByUserId,
      decidedAt,
    } satisfies WorkspaceJoinRequestRecord;
    this.requestsById.set(requestId, approved);
    return Promise.resolve(approved);
  }
}

const config: ApiConfig = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  API_HOST: "127.0.0.1",
  API_PORT: 8080,
  DATABASE_URL: "postgres://wtf:wtf@localhost:5432/wtf",
  JWT_ACCESS_SECRET: "access-secret-access-secret-access-secret",
  JWT_REFRESH_SECRET: "refresh-secret-refresh-secret-refresh",
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: 86_400,
  EMAIL_VERIFICATION_BASE_URL: "http://localhost:8080",
  EMAIL_FROM: "WTF <no-reply@wtf.local>",
  SMTP_HOST: "",
  SMTP_PORT: 587,
  SMTP_SECURE: false,
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  OAUTH_GOOGLE_CLIENT_ID: "",
  OAUTH_GOOGLE_CLIENT_SECRET: "",
  OAUTH_GITHUB_CLIENT_ID: "",
  OAUTH_GITHUB_CLIENT_SECRET: "",
  OAUTH_REDIRECT_BASE_URL: "http://localhost:8080",
};

describe("createApiServer", () => {
  let app: Awaited<ReturnType<typeof createApiServer>>;
  let dependencies: ApiDependencies;
  let authRepository: InMemoryAuthRepository;
  let emailSender: InMemoryEmailSender;
  let workspaceAccessRepository: InMemoryWorkspaceAccessRepository;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    emailSender = new InMemoryEmailSender();
    workspaceAccessRepository = new InMemoryWorkspaceAccessRepository();
    dependencies = {
      config,
      authRepository,
      emailSender,
      workspaceAccessRepository,
      workspaceRepository: new InMemoryWorkspaceRepository(),
      projectRepository: new InMemoryProjectRepository(),
      issueRepository: new InMemoryIssueRepository(),
      clock: () => now,
    };
    app = await createApiServer(dependencies);
  });

  afterEach(async () => {
    await app.close();
  });

  async function registerAndVerify(email: string, password = "password123"): Promise<void> {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password },
    });
    expect(registerResponse.statusCode).toBe(202);

    const verifyResponse = await app.inject({
      method: "GET",
      url: `/v1/auth/verify-email?token=${emailSender.verificationTokenFor(email)}`,
    });
    expect(verifyResponse.statusCode).toBe(200);
  }

  async function login(
    email: string,
    password = "password123",
  ): Promise<{
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly user: { readonly id: string };
  }> {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password },
    });
    expect(response.statusCode).toBe(200);
    return response.json<{
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    }>();
  }

  it("отдает health check без авторизации", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("защищает CRUD routes access token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      payload: { name: "Core", slug: "core", ownerUserId },
    });

    expect(response.statusCode).toBe(401);
  });

  it("возвращает 400 для невалидного JSON body", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{broken-json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(
      "FST_ERR_CTP_INVALID_JSON_BODY",
    );
  });

  it("разрешает CORS preflight для PATCH-переноса задач", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/v1/issues/00000000-0000-4000-8000-000000000001/status",
      headers: {
        "access-control-request-headers": "authorization,content-type",
        "access-control-request-method": "PATCH",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3000");
  });

  it("создает workspace, project, issue и comment через REST API", async () => {
    await registerAndVerify("owner@example.com");
    const tokenPair = await login("owner@example.com");
    const token = tokenPair.accessToken;
    const headers = { authorization: `Bearer ${token}` };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers,
      payload: { name: "Core", slug: "core" },
    });
    expect(workspaceResponse.statusCode).toBe(201);
    const workspace = workspaceResponse.json<{ id: string; members: Array<{ userId: string }> }>();
    expect(workspace.members[0]?.userId).toBe(tokenPair.user.id);

    const workspaceLookupResponse = await app.inject({
      method: "GET",
      url: "/v1/workspaces/by-slug/core",
      headers,
    });
    expect(workspaceLookupResponse.statusCode).toBe(200);
    expect(workspaceLookupResponse.json<{ id: string }>().id).toBe(workspace.id);

    const projectResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/projects`,
      headers,
      payload: { name: "Platform", key: "PF" },
    });
    expect(projectResponse.statusCode).toBe(201);
    const project = projectResponse.json<{ id: string }>();

    const projectLookupResponse = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspace.id}/projects/by-key/PF`,
      headers,
    });
    expect(projectLookupResponse.statusCode).toBe(200);
    expect(projectLookupResponse.json<{ id: string }>().id).toBe(project.id);

    const issueResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/projects/${project.id}/issues`,
      headers,
      payload: { title: "Implement domain", priority: "high" },
    });
    expect(issueResponse.statusCode).toBe(201);
    const issue = issueResponse.json<{ id: string; reporterId: string }>();
    expect(issue.reporterId).toBe(tokenPair.user.id);

    const issuesResponse = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspace.id}/projects/${project.id}/issues`,
      headers,
    });
    expect(issuesResponse.statusCode).toBe(200);
    expect(issuesResponse.json<{ issues: unknown[] }>().issues).toHaveLength(1);

    const commentResponse = await app.inject({
      method: "POST",
      url: `/v1/issues/${issue.id}/comments`,
      headers,
      payload: { body: "First comment" },
    });
    expect(commentResponse.statusCode).toBe(201);
    expect(commentResponse.json<{ comments: unknown[] }>().comments).toHaveLength(1);

    const cancelResponse = await app.inject({
      method: "PATCH",
      url: `/v1/issues/${issue.id}/status`,
      headers,
      payload: { status: "canceled" },
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json<{ status: string }>().status).toBe("canceled");
  });

  it("разрешает перенос задачи только участнику и пишет кто перенес", async () => {
    await registerAndVerify("owner@example.com");
    await registerAndVerify("worker@example.com");
    const ownerToken = (await login("owner@example.com")).accessToken;
    const ownerHeaders = { authorization: `Bearer ${ownerToken}` };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: ownerHeaders,
      payload: { name: "Core", slug: "core" },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const projectResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/projects`,
      headers: ownerHeaders,
      payload: { name: "Platform", key: "PF" },
    });
    const project = projectResponse.json<{ id: string }>();

    const issueResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/projects/${project.id}/issues`,
      headers: ownerHeaders,
      payload: { title: "Implement board move" },
    });
    const issue = issueResponse.json<{ id: string }>();

    const workerTokenPair = await login("worker@example.com");
    const workerToken = workerTokenPair.accessToken;
    const workerHeaders = { authorization: `Bearer ${workerToken}` };

    const deniedMoveResponse = await app.inject({
      method: "PATCH",
      url: `/v1/issues/${issue.id}/status`,
      headers: workerHeaders,
      payload: { status: "todo" },
    });
    expect(deniedMoveResponse.statusCode).toBe(403);

    const addMemberResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/members`,
      headers: ownerHeaders,
      payload: { email: "worker@example.com", role: "member" },
    });
    expect(addMemberResponse.statusCode).toBe(201);

    await app.inject({
      method: "PATCH",
      url: `/v1/issues/${issue.id}/status`,
      headers: ownerHeaders,
      payload: { status: "todo" },
    });
    const movedResponse = await app.inject({
      method: "PATCH",
      url: `/v1/issues/${issue.id}/status`,
      headers: workerHeaders,
      payload: { status: "in_progress" },
    });

    expect(movedResponse.statusCode).toBe(200);
    const movedIssue = movedResponse.json<{
      status: string;
      activities: Array<{ verb: string; actorId: string; metadata: Record<string, unknown> }>;
    }>();
    expect(movedIssue.status).toBe("in_progress");
    const workerMove = movedIssue.activities.find(
      (activity) =>
        activity.actorId === workerTokenPair.user.id &&
        activity.verb === "status_changed" &&
        activity.metadata.to === "in_progress",
    );
    expect(workerMove).toBeDefined();
    expect(workerMove?.metadata).toMatchObject({
      actorEmail: "worker@example.com",
      from: "todo",
      to: "in_progress",
    });
  });

  it("выдает доступ к корпоративному workspace по внутреннему номеру после approval владельца", async () => {
    await registerAndVerify("owner@example.com");
    await registerAndVerify("worker@example.com");
    const ownerToken = (await login("owner@example.com")).accessToken;
    const workerTokenPair = await login("worker@example.com");
    const ownerHeaders = { authorization: `Bearer ${ownerToken}` };
    const workerHeaders = { authorization: `Bearer ${workerTokenPair.accessToken}` };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: ownerHeaders,
      payload: {
        name: "Corporate",
        slug: "corporate",
        internalNumber: "corp-001",
      },
    });
    expect(workspaceResponse.statusCode).toBe(201);
    const workspace = workspaceResponse.json<{ id: string; internalNumber: string }>();
    expect(workspace.internalNumber).toBe("CORP-001");

    const requestResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces/join-requests",
      headers: workerHeaders,
      payload: { internalNumber: "corp-001" },
    });
    expect(requestResponse.statusCode).toBe(202);
    const joinRequest = requestResponse.json<{ request: { id: string; requesterEmail: string } }>()
      .request;
    expect(joinRequest.requesterEmail).toBe("worker@example.com");

    const requestsResponse = await app.inject({
      method: "GET",
      url: `/v1/workspaces/${workspace.id}/join-requests`,
      headers: ownerHeaders,
    });
    expect(requestsResponse.statusCode).toBe(200);
    expect(requestsResponse.json<{ requests: unknown[] }>().requests).toHaveLength(1);

    const approveResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/join-requests/${joinRequest.id}/approve`,
      headers: ownerHeaders,
    });
    expect(approveResponse.statusCode).toBe(200);
    const approvedWorkspace = approveResponse.json<{ members: Array<{ userId: string }> }>();
    expect(
      approvedWorkspace.members.some((member) => member.userId === workerTokenPair.user.id),
    ).toBe(true);

    const reopenResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces/join-requests",
      headers: workerHeaders,
      payload: { internalNumber: "CORP-001" },
    });
    expect(reopenResponse.statusCode).toBe(200);
    expect(reopenResponse.json<{ status: string }>().status).toBe("already_member");
  });

  it("не дает admin подтверждать заявки доступа вместо владельца", async () => {
    await registerAndVerify("owner@example.com");
    await registerAndVerify("worker@example.com");
    await registerAndVerify("reviewer@example.com");
    const ownerToken = (await login("owner@example.com")).accessToken;
    const adminToken = (await login("worker@example.com")).accessToken;
    const reviewerToken = (await login("reviewer@example.com")).accessToken;
    const ownerHeaders = { authorization: `Bearer ${ownerToken}` };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers: ownerHeaders,
      payload: {
        name: "Corporate",
        slug: "corporate",
        internalNumber: "CORP-002",
      },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const addAdminResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/members`,
      headers: ownerHeaders,
      payload: { email: "worker@example.com", role: "admin" },
    });
    expect(addAdminResponse.statusCode).toBe(201);

    const requestResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces/join-requests",
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { internalNumber: "CORP-002" },
    });
    const request = requestResponse.json<{ request: { id: string } }>().request;

    const deniedApproveResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/join-requests/${request.id}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(deniedApproveResponse.statusCode).toBe(403);
    expect(deniedApproveResponse.json<{ error: { code: string } }>().error.code).toBe(
      "workspace_owner_required",
    );

    const deniedDirectAddResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/members`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: "reviewer@example.com", role: "member" },
    });
    expect(deniedDirectAddResponse.statusCode).toBe(403);
    expect(deniedDirectAddResponse.json<{ error: { code: string } }>().error.code).toBe(
      "workspace_owner_required",
    );
  });

  it("создает последовательный issue key за пределами лимита страницы", async () => {
    await registerAndVerify("owner@example.com");
    const token = (await login("owner@example.com")).accessToken;
    const headers = { authorization: `Bearer ${token}` };

    const workspaceResponse = await app.inject({
      method: "POST",
      url: "/v1/workspaces",
      headers,
      payload: { name: "Core", slug: "core" },
    });
    const workspace = workspaceResponse.json<{ id: string }>();

    const projectResponse = await app.inject({
      method: "POST",
      url: `/v1/workspaces/${workspace.id}/projects`,
      headers,
      payload: { name: "Platform", key: "PF" },
    });
    const project = projectResponse.json<{ id: string }>();

    let latestKey = "";
    for (let sequence = 1; sequence <= 202; sequence += 1) {
      const issueResponse = await app.inject({
        method: "POST",
        url: `/v1/workspaces/${workspace.id}/projects/${project.id}/issues`,
        headers,
        payload: { title: `Task ${sequence}` },
      });
      expect(issueResponse.statusCode).toBe(201);
      latestKey = issueResponse.json<{ key: string }>().key;
    }

    expect(latestKey).toBe("PF-202");
  });

  it("разрешает регистрацию любого email с подтверждением письмом", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "New.User@Example.com", password: "password123" },
    });

    expect(registerResponse.statusCode).toBe(202);
    expect(registerResponse.json<{ email: string }>().email).toBe("new.user@example.com");

    const verifyResponse = await app.inject({
      method: "GET",
      url: `/v1/auth/verify-email?token=${emailSender.verificationTokenFor(
        "new.user@example.com",
      )}`,
    });
    expect(verifyResponse.statusCode).toBe(200);

    const tokenPair = await login("new.user@example.com");
    expect(tokenPair.user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("не выдает токен до подтверждения email", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "owner@example.com", password: "password123" },
    });
    expect(registerResponse.statusCode).toBe(202);

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "owner@example.com", password: "password123" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("email_not_verified");
  });

  it("валидирует OAuth provider", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/oauth/gitlab/authorize" });

    expect(response.statusCode).toBe(404);
  });
});
