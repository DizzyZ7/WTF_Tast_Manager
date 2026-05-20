"use client";

import { Badge, Button, IssueRow } from "@wtf/ui";
import {
  Activity,
  AlertCircle,
  Columns3,
  ListFilter,
  Loader2,
  LogOut,
  Plus,
  Radio,
  X,
} from "lucide-react";
import type { ChangeEvent, DragEvent, ReactNode, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import {
  WtfApiError,
  createWtfApiClient,
  type WtfIssuePriority,
  type WtfIssueStatus,
  type WtfProjectContext,
  type WtfWorkspace,
  type WtfWorkspaceRole,
} from "../lib/wtf-api";
import { sortIssuesByPriority, toWebIssue, type WebIssue } from "./issue-data";

/**
 * Состояние загрузки workspace.
 */
type WorkspaceStatus = "auth_required" | "loading" | "ready" | "failed";

/**
 * Draft формы создания issue.
 */
interface IssueDraft {
  /** Название issue. */
  readonly title: string;
  /** Описание issue. */
  readonly description: string;
  /** Приоритет issue. */
  readonly priority: WtfIssuePriority;
}

/**
 * Состояние рабочей поверхности workspace.
 */
interface WorkspaceState {
  /** Issue текущего проекта. */
  readonly issues: ReadonlyArray<WebIssue>;
  /** API-контекст текущего проекта. */
  readonly context: WtfProjectContext | null;
  /** Текущий вид списка. */
  readonly selectedView: "list" | "board";
  /** Состояние загрузки. */
  readonly status: WorkspaceStatus;
  /** Текст ошибки для пользователя. */
  readonly errorMessage: string | null;
  /** Открыта ли форма создания issue. */
  readonly isComposerOpen: boolean;
  /** Выполняется ли создание issue. */
  readonly isCreating: boolean;
  /** Меняет текущий вид. */
  readonly setSelectedView: (view: "list" | "board") => void;
  /** Требует вход по email. */
  readonly setAuthRequired: (message?: string) => void;
  /** Переводит экран в состояние загрузки. */
  readonly setLoading: () => void;
  /** Записывает загруженный проект и issue. */
  readonly setReady: (context: WtfProjectContext, issues: ReadonlyArray<WebIssue>) => void;
  /** Записывает ошибку первичной загрузки. */
  readonly setLoadFailed: (message: string) => void;
  /** Записывает пользовательскую ошибку. */
  readonly setErrorMessage: (message: string | null) => void;
  /** Добавляет issue в локальное представление. */
  readonly addIssue: (issue: WebIssue) => void;
  /** Обновляет issue после серверного изменения. */
  readonly updateIssue: (issue: WebIssue) => void;
  /** Обновляет workspace после изменения участников. */
  readonly updateWorkspace: (workspace: WtfWorkspace) => void;
  /** Открывает или закрывает форму создания. */
  readonly setComposerOpen: (open: boolean) => void;
  /** Меняет состояние создания issue. */
  readonly setCreating: (creating: boolean) => void;
}

const emptyDraft: IssueDraft = {
  title: "",
  description: "",
  priority: "medium",
};

const authEmailStorageKey = "wtf.auth.email";

const columns: ReadonlyArray<{ readonly status: WebIssue["status"]; readonly label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "Review" },
  { status: "done", label: "Done" },
  { status: "canceled", label: "Canceled" },
];

const priorityOptions: ReadonlyArray<WtfIssuePriority> = ["low", "medium", "high", "urgent"];

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  issues: [],
  context: null,
  selectedView: "list",
  status: "loading",
  errorMessage: null,
  isComposerOpen: false,
  isCreating: false,
  setSelectedView: (view) => {
    set({ selectedView: view });
  },
  setAuthRequired: (message) => {
    set({
      context: null,
      issues: [],
      status: "auth_required",
      errorMessage: message ?? null,
      isComposerOpen: false,
      isCreating: false,
    });
  },
  setLoading: () => {
    set({ status: "loading", errorMessage: null });
  },
  setReady: (context, issues) => {
    set({ context, issues, status: "ready", errorMessage: null });
  },
  setLoadFailed: (message) => {
    set({ status: "failed", errorMessage: message });
  },
  setErrorMessage: (message) => {
    set({ errorMessage: message });
  },
  addIssue: (issue) => {
    set((state) => ({ issues: [issue, ...state.issues], errorMessage: null }));
  },
  updateIssue: (issue) => {
    set((state) => ({
      issues: state.issues.map((candidate) => (candidate.id === issue.id ? issue : candidate)),
      errorMessage: null,
    }));
  },
  updateWorkspace: (workspace) => {
    set((state) => ({
      context: state.context === null ? null : { ...state.context, workspace },
      errorMessage: null,
    }));
  },
  setComposerOpen: (open) => {
    set({ isComposerOpen: open, ...(open ? { errorMessage: null } : {}) });
  },
  setCreating: (creating) => {
    set({ isCreating: creating });
  },
}));

/**
 * Основная рабочая поверхность workspace.
 */
export function WorkspaceShell(): ReactNode {
  const api = useMemo(() => createWtfApiClient(), []);
  const issues = useWorkspaceStore((state) => state.issues);
  const context = useWorkspaceStore((state) => state.context);
  const selectedView = useWorkspaceStore((state) => state.selectedView);
  const status = useWorkspaceStore((state) => state.status);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const isComposerOpen = useWorkspaceStore((state) => state.isComposerOpen);
  const isCreating = useWorkspaceStore((state) => state.isCreating);
  const setSelectedView = useWorkspaceStore((state) => state.setSelectedView);
  const setAuthRequired = useWorkspaceStore((state) => state.setAuthRequired);
  const setLoading = useWorkspaceStore((state) => state.setLoading);
  const setReady = useWorkspaceStore((state) => state.setReady);
  const setLoadFailed = useWorkspaceStore((state) => state.setLoadFailed);
  const setErrorMessage = useWorkspaceStore((state) => state.setErrorMessage);
  const addIssue = useWorkspaceStore((state) => state.addIssue);
  const updateIssue = useWorkspaceStore((state) => state.updateIssue);
  const updateWorkspace = useWorkspaceStore((state) => state.updateWorkspace);
  const setComposerOpen = useWorkspaceStore((state) => state.setComposerOpen);
  const setCreating = useWorkspaceStore((state) => state.setCreating);
  const sortedIssues = useMemo(() => sortIssuesByPriority(issues), [issues]);
  const [draft, setDraft] = useState<IssueDraft>(emptyDraft);
  const [signInEmail, setSignInEmail] = useState("");
  const [isSigningIn, setSigningIn] = useState(false);
  const [movingIssueId, setMovingIssueId] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<WtfWorkspaceRole, "owner">>("member");
  const [isAddingMember, setAddingMember] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadWorkspace(): Promise<void> {
      const storedEmail = window.localStorage.getItem(authEmailStorageKey);
      if (storedEmail === null) {
        setAuthRequired();
        return;
      }

      setSignInEmail(storedEmail);
      await loadWorkspaceForEmail(storedEmail, mounted);
    }

    void loadWorkspace();

    return () => {
      mounted = false;
    };
  }, [api, setAuthRequired, setLoadFailed, setLoading, setReady]);

  async function reloadWorkspace(): Promise<void> {
    const email =
      context?.currentUser.email ??
      window.localStorage.getItem(authEmailStorageKey) ??
      signInEmail.trim();
    if (email.length === 0) {
      setAuthRequired();
      return;
    }

    await loadWorkspaceForEmail(email, true);
  }

  async function loadWorkspaceForEmail(email: string, mounted: boolean): Promise<void> {
    setLoading();

    try {
      const nextContext = await api.bootstrapProjectContext({ email });
      const loadedIssues = await api.listIssues(nextContext);
      window.localStorage.setItem(authEmailStorageKey, nextContext.currentUser.email);
      if (mounted) {
        setReady(nextContext, loadedIssues.map(toWebIssue));
        setSignInEmail(nextContext.currentUser.email);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }

      if (error instanceof WtfApiError && (error.status === 401 || error.status === 403)) {
        window.localStorage.removeItem(authEmailStorageKey);
        setAuthRequired(error.message);
        return;
      }

      setLoadFailed(messageFromError(error));
    }
  }

  async function submitSignIn(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const email = signInEmail.trim();
    if (email.length === 0) {
      setErrorMessage("Work email is required");
      return;
    }

    setSigningIn(true);
    try {
      await loadWorkspaceForEmail(email, true);
    } finally {
      setSigningIn(false);
    }
  }

  function signOut(): void {
    window.localStorage.removeItem(authEmailStorageKey);
    setSignInEmail("");
    setAuthRequired();
  }

  async function moveIssue(issueId: string, status: WtfIssueStatus): Promise<void> {
    if (context === null) {
      setErrorMessage("Project context is not ready");
      return;
    }

    const issue = issues.find((candidate) => candidate.id === issueId);
    if (issue === undefined || issue.status === status) {
      return;
    }

    setMovingIssueId(issueId);
    try {
      const updated = await api.moveIssue(context, issueId, status);
      updateIssue(toWebIssue(updated));
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setMovingIssueId(null);
    }
  }

  async function submitMember(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (context === null) {
      setErrorMessage("Project context is not ready");
      return;
    }

    const email = memberEmail.trim();
    if (email.length === 0) {
      setErrorMessage("Member email is required");
      return;
    }

    setAddingMember(true);
    try {
      const workspace = await api.addWorkspaceMember(context, { email, role: memberRole });
      updateWorkspace(workspace);
      setMemberEmail("");
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setAddingMember(false);
    }
  }

  async function submitIssue(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (context === null) {
      setErrorMessage("Project context is not ready");
      return;
    }

    const title = draft.title.trim();
    const description = draft.description.trim();
    if (title.length < 3) {
      setErrorMessage("Issue title must contain at least 3 characters");
      return;
    }

    setCreating(true);
    try {
      const issue = await api.createIssue(context, {
        title,
        priority: draft.priority,
        ...(description.length === 0 ? {} : { description }),
      });
      addIssue(toWebIssue(issue));
      setDraft(emptyDraft);
      setComposerOpen(false);
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setCreating(false);
    }
  }

  function updateDraft(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function updatePriority(event: ChangeEvent<HTMLSelectElement>): void {
    const priority = priorityOptions.find((option) => option === event.target.value) ?? "medium";
    setDraft((current) => ({ ...current, priority }));
  }

  const connectionTone = status === "failed" ? "red" : status === "loading" ? "amber" : "green";
  const connectionText =
    status === "failed"
      ? "offline"
      : status === "loading"
        ? "syncing"
        : status === "auth_required"
          ? "sign in"
          : "synced";
  const currentWorkspaceMember =
    context?.workspace.members.find((member) => member.userId === context.currentUser.id) ?? null;
  const canManageMembers =
    currentWorkspaceMember?.role === "owner" || currentWorkspaceMember?.role === "admin";

  if (status === "auth_required") {
    return (
      <SignInScreen
        email={signInEmail}
        errorMessage={errorMessage}
        isSigningIn={isSigningIn}
        onEmailChange={(event) => setSignInEmail(event.target.value)}
        onSubmit={(event) => void submitSignIn(event)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded bg-zinc-950 text-sm font-semibold text-white">
            W
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-5">WTF</h1>
            <p className="text-xs text-zinc-500">
              {context === null ? "Core Workspace" : context.workspace.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {context === null ? null : (
            <span className="hidden max-w-52 truncate text-xs text-zinc-500 sm:inline">
              {context.currentUser.email}
            </span>
          )}
          <Badge tone={connectionTone}>
            <Radio className="mr-1 size-3" />
            {connectionText}
          </Badge>
          <Button
            aria-label="Sign out"
            className="size-9 px-0"
            leadingIcon={<LogOut className="size-4" />}
            onClick={signOut}
            title="Sign out"
            variant="ghost"
          />
          <Button
            disabled={status !== "ready"}
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setComposerOpen(true)}
          >
            Issue
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="border-r border-zinc-200 bg-white p-3">
          <nav className="flex gap-1 md:block md:space-y-1">
            <button
              className="flex h-9 items-center gap-2 rounded px-2 text-left text-sm font-medium text-zinc-950 md:w-full"
              type="button"
            >
              <Activity className="size-4" />
              Issues
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded px-2 text-left text-sm text-zinc-600 md:w-full"
              type="button"
            >
              <Columns3 className="size-4" />
              Sprints
            </button>
          </nav>
          {canManageMembers ? (
            <MemberForm
              email={memberEmail}
              isAdding={isAddingMember}
              onEmailChange={(event) => setMemberEmail(event.target.value)}
              onRoleChange={(event) =>
                setMemberRole(event.target.value as Exclude<WtfWorkspaceRole, "owner">)
              }
              onSubmit={(event) => void submitMember(event)}
              role={memberRole}
            />
          ) : null}
        </aside>

        <section className="min-w-0 p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Issues</h2>
              <p className="text-sm text-zinc-500">
                {status === "loading" ? "Loading work items" : `${issues.length} work items`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                leadingIcon={<ListFilter className="size-4" />}
                variant={selectedView === "list" ? "secondary" : "ghost"}
                onClick={() => setSelectedView("list")}
              >
                List
              </Button>
              <Button
                leadingIcon={<Columns3 className="size-4" />}
                variant={selectedView === "board" ? "secondary" : "ghost"}
                onClick={() => setSelectedView("board")}
              >
                Board
              </Button>
            </div>
          </div>

          {errorMessage !== null ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <div className="flex min-w-0 items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span className="truncate">{errorMessage}</span>
              </div>
              {status === "failed" ? (
                <Button variant="secondary" onClick={() => void reloadWorkspace()}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "loading" && issues.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-md border border-zinc-200 bg-white text-sm text-zinc-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading
            </div>
          ) : selectedView === "list" ? (
            <IssueList issues={sortedIssues} onCreate={() => setComposerOpen(true)} />
          ) : (
            <IssueBoard
              issues={issues}
              movingIssueId={movingIssueId}
              onMoveIssue={(issueId, nextStatus) => void moveIssue(issueId, nextStatus)}
            />
          )}
        </section>
      </div>

      {isComposerOpen ? (
        <IssueComposer
          draft={draft}
          isCreating={isCreating}
          onClose={() => {
            setDraft(emptyDraft);
            setComposerOpen(false);
          }}
          onDraftChange={updateDraft}
          onPriorityChange={updatePriority}
          onSubmit={(event) => void submitIssue(event)}
        />
      ) : null}
    </main>
  );
}

function SignInScreen({
  email,
  errorMessage,
  isSigningIn,
  onEmailChange,
  onSubmit,
}: {
  readonly email: string;
  readonly errorMessage: string | null;
  readonly isSigningIn: boolean;
  readonly onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}): ReactNode {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-950">
      <form
        className="w-full max-w-sm rounded-md border border-zinc-200 bg-white shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="border-b border-zinc-200 px-4 py-3">
          <h1 className="text-sm font-semibold">WTF</h1>
          <p className="text-xs text-zinc-500">Sign in with an allowed work email</p>
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Email</span>
            <input
              autoFocus
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
              name="email"
              onChange={onEmailChange}
              required
              type="email"
              value={email}
            />
          </label>
          {errorMessage === null ? null : (
            <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-4 py-3">
          <Button
            disabled={isSigningIn}
            leadingIcon={
              isSigningIn ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Radio className="size-4" />
              )
            }
            type="submit"
          >
            Sign in
          </Button>
        </div>
      </form>
    </main>
  );
}

function MemberForm({
  email,
  isAdding,
  onEmailChange,
  onRoleChange,
  onSubmit,
  role,
}: {
  readonly email: string;
  readonly isAdding: boolean;
  readonly onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRoleChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly role: Exclude<WtfWorkspaceRole, "owner">;
}): ReactNode {
  return (
    <form className="mt-4 border-t border-zinc-200 pt-4" onSubmit={onSubmit}>
      <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">Members</div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">Email</span>
        <input
          className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-950"
          onChange={onEmailChange}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">Role</span>
        <select
          className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-950"
          onChange={onRoleChange}
          value={role}
        >
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="viewer">viewer</option>
        </select>
      </label>
      <Button
        className="mt-2 w-full"
        disabled={isAdding}
        leadingIcon={
          isAdding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />
        }
        type="submit"
        variant="secondary"
      >
        Add
      </Button>
    </form>
  );
}

function IssueList({
  issues,
  onCreate,
}: {
  readonly issues: ReadonlyArray<WebIssue>;
  readonly onCreate: () => void;
}): ReactNode {
  if (issues.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white text-sm text-zinc-500">
        <span>No issues yet</span>
        <Button leadingIcon={<Plus className="size-4" />} onClick={onCreate}>
          Issue
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      {issues.map((issue) => (
        <IssueRow
          issueKey={issue.key}
          key={issue.id}
          priority={issue.priority}
          status={issue.status}
          title={issue.title}
        />
      ))}
    </div>
  );
}

function IssueBoard({
  issues,
  movingIssueId,
  onMoveIssue,
}: {
  readonly issues: ReadonlyArray<WebIssue>;
  readonly movingIssueId: string | null;
  readonly onMoveIssue: (issueId: string, status: WtfIssueStatus) => void;
}): ReactNode {
  function handleDragStart(event: DragEvent<HTMLDivElement>, issueId: string): void {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", issueId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: WtfIssueStatus): void {
    event.preventDefault();
    const issueId = event.dataTransfer.getData("text/plain");
    if (issueId.length > 0) {
      onMoveIssue(issueId, status);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1120px] grid-cols-6 gap-3">
        {columns.map((column) => {
          const columnIssues = issues.filter((issue) => issue.status === column.status);

          return (
            <div
              className="min-h-80 rounded-md border border-zinc-200 bg-white"
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.status)}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-sm font-medium">
                <span>{column.label}</span>
                <Badge>{columnIssues.length}</Badge>
              </div>
              <div className="space-y-2 p-2">
                {columnIssues.map((issue) => (
                  <div
                    className="cursor-grab rounded border border-zinc-200 bg-white p-2 shadow-sm active:cursor-grabbing"
                    draggable={movingIssueId !== issue.id}
                    key={issue.id}
                    onDragStart={(event) => handleDragStart(event, issue.id)}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-zinc-500">{issue.key}</span>
                      {movingIssueId === issue.id ? (
                        <Loader2 className="size-3 animate-spin text-zinc-500" />
                      ) : null}
                    </div>
                    <div className="text-sm font-medium leading-5">{issue.title}</div>
                    {issue.description.length > 0 ? (
                      <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {issue.description}
                      </div>
                    ) : null}
                    <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-[11px] leading-4 text-zinc-500">
                      {issue.movedBy === null ? null : (
                        <div className="truncate">Moved by {issue.movedBy}</div>
                      )}
                      {issue.closedBy === null ? null : (
                        <div className="truncate">Closed by {issue.closedBy}</div>
                      )}
                      <select
                        className="mt-1 h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-zinc-950"
                        disabled={movingIssueId === issue.id}
                        onChange={(event) =>
                          onMoveIssue(issue.id, event.target.value as WtfIssueStatus)
                        }
                        value={issue.status}
                      >
                        {columns.map((target) => (
                          <option key={target.status} value={target.status}>
                            {target.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssueComposer({
  draft,
  isCreating,
  onClose,
  onDraftChange,
  onPriorityChange,
  onSubmit,
}: {
  readonly draft: IssueDraft;
  readonly isCreating: boolean;
  readonly onClose: () => void;
  readonly onDraftChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  readonly onPriorityChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}): ReactNode {
  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/30 px-4 py-10">
      <form className="mx-auto w-full max-w-xl rounded-md bg-white shadow-xl" onSubmit={onSubmit}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold">New issue</h2>
          <Button
            aria-label="Close"
            className="size-8 px-0"
            leadingIcon={<X className="size-4" />}
            onClick={onClose}
            title="Close"
            variant="ghost"
          />
        </div>
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Title</span>
            <input
              autoFocus
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
              maxLength={240}
              minLength={3}
              name="title"
              onChange={onDraftChange}
              required
              value={draft.title}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Description</span>
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
              maxLength={50_000}
              name="description"
              onChange={onDraftChange}
              value={draft.description}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">Priority</span>
            <select
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
              onChange={onPriorityChange}
              value={draft.priority}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <Button disabled={isCreating} onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={isCreating}
            leadingIcon={
              isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />
            }
            type="submit"
          >
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected application error";
}
