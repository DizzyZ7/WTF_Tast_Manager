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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApiServer, type ApiDependencies } from "../src/app.js";
import type { ApiConfig } from "../src/config/env.js";

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

  public findByProject(project: ReturnType<typeof projectId>): Promise<ReadonlyArray<Issue>> {
    return Promise.resolve(
      [...this.rows.values()].filter((issue) => issue.toSnapshot().projectId === project),
    );
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
  AUTH_ALLOWED_EMAILS:
    "owner@example.com,worker@example.com,legacy@example.com=00000000-0000-4000-8000-000000000099",
  ACCESS_TOKEN_TTL_SECONDS: 900,
  REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
  OAUTH_GOOGLE_CLIENT_ID: "",
  OAUTH_GOOGLE_CLIENT_SECRET: "",
  OAUTH_GITHUB_CLIENT_ID: "",
  OAUTH_GITHUB_CLIENT_SECRET: "",
  OAUTH_REDIRECT_BASE_URL: "http://localhost:8080",
};

describe("createApiServer", () => {
  let app: Awaited<ReturnType<typeof createApiServer>>;
  let dependencies: ApiDependencies;

  beforeEach(async () => {
    dependencies = {
      config,
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
      url: "/v1/auth/token",
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
    const tokenResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      payload: { email: "owner@example.com" },
    });
    const tokenPair = tokenResponse.json<{ accessToken: string; user: { id: string } }>();
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
    const ownerTokenResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      payload: { email: "owner@example.com" },
    });
    const ownerToken = ownerTokenResponse.json<{ accessToken: string }>().accessToken;
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

    const workerTokenResponse = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      payload: { email: "worker@example.com" },
    });
    const workerTokenPair = workerTokenResponse.json<{
      accessToken: string;
      user: { id: string };
    }>();
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

  it("запрещает выпуск токена для email вне allow-list", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      payload: { email: "intruder@example.com" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: { code: string } }>().error.code).toBe("email_not_allowed");
  });

  it("поддерживает явный userId в allow-list для существующих учеток", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/token",
      payload: { email: "legacy@example.com" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ user: { id: string } }>().user.id).toBe(
      "00000000-0000-4000-8000-000000000099",
    );
  });

  it("валидирует OAuth provider", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/oauth/gitlab/authorize" });

    expect(response.statusCode).toBe(404);
  });
});
