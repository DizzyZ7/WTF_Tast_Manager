"use client";

import { Badge, Button, IssueRow, cn } from "@wtf/ui";
import {
  Activity,
  AlertCircle,
  Columns3,
  Languages,
  ListFilter,
  Loader2,
  LogOut,
  Plus,
  Radio,
  Sun,
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
import { calculateFlowInsights } from "./flow-insights";
import { FlowRadar } from "./flow-radar";
import { IssueInspector } from "./issue-inspector";
import { sortIssuesByPriority, toWebIssue, type WebIssue } from "./issue-data";
import {
  copyByLocale,
  demoEmail,
  statusLabel,
  type WorkspaceCopy,
  type WorkspaceLocale,
  type WorkspaceTheme,
} from "./workspace-i18n";

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
  /** Выбранная issue для inspector panel. */
  readonly selectedIssueId: string | null;
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
  /** Выбирает issue для inspector panel. */
  readonly setSelectedIssueId: (issueId: string | null) => void;
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
const localeStorageKey = "wtf.ui.locale";
const themeStorageKey = "wtf.ui.theme";

const columnStatuses: ReadonlyArray<WebIssue["status"]> = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
];

const priorityOptions: ReadonlyArray<WtfIssuePriority> = ["low", "medium", "high", "urgent"];

const useWorkspaceStore = create<WorkspaceState>((set) => ({
  issues: [],
  context: null,
  selectedView: "list",
  selectedIssueId: null,
  status: "loading",
  errorMessage: null,
  isComposerOpen: false,
  isCreating: false,
  setSelectedView: (view) => {
    set({ selectedView: view });
  },
  setSelectedIssueId: (issueId) => {
    set({ selectedIssueId: issueId });
  },
  setAuthRequired: (message) => {
    set({
      context: null,
      issues: [],
      selectedIssueId: null,
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
    set((state) => ({
      context,
      issues,
      selectedIssueId: issues.some((issue) => issue.id === state.selectedIssueId)
        ? state.selectedIssueId
        : (issues[0]?.id ?? null),
      status: "ready",
      errorMessage: null,
    }));
  },
  setLoadFailed: (message) => {
    set({ status: "failed", errorMessage: message });
  },
  setErrorMessage: (message) => {
    set({ errorMessage: message });
  },
  addIssue: (issue) => {
    set((state) => ({
      issues: [issue, ...state.issues],
      selectedIssueId: issue.id,
      errorMessage: null,
    }));
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

function initialLocale(): WorkspaceLocale {
  return "ru";
}

function initialTheme(): WorkspaceTheme {
  return "light";
}

/**
 * Основная рабочая поверхность workspace.
 */
export function WorkspaceShell(): ReactNode {
  const api = useMemo(() => createWtfApiClient(), []);
  const issues = useWorkspaceStore((state) => state.issues);
  const context = useWorkspaceStore((state) => state.context);
  const selectedView = useWorkspaceStore((state) => state.selectedView);
  const selectedIssueId = useWorkspaceStore((state) => state.selectedIssueId);
  const status = useWorkspaceStore((state) => state.status);
  const errorMessage = useWorkspaceStore((state) => state.errorMessage);
  const isComposerOpen = useWorkspaceStore((state) => state.isComposerOpen);
  const isCreating = useWorkspaceStore((state) => state.isCreating);
  const setSelectedView = useWorkspaceStore((state) => state.setSelectedView);
  const setSelectedIssueId = useWorkspaceStore((state) => state.setSelectedIssueId);
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
  const flowInsights = useMemo(() => calculateFlowInsights(issues), [issues]);
  const selectedIssue =
    issues.find((candidate) => candidate.id === selectedIssueId) ?? sortedIssues[0] ?? null;
  const [draft, setDraft] = useState<IssueDraft>(emptyDraft);
  const [signInEmail, setSignInEmail] = useState("");
  const [isSigningIn, setSigningIn] = useState(false);
  const [movingIssueId, setMovingIssueId] = useState<string | null>(null);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<Exclude<WtfWorkspaceRole, "owner">>("member");
  const [isAddingMember, setAddingMember] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isAddingComment, setAddingComment] = useState(false);
  const [locale, setLocale] = useState<WorkspaceLocale>(initialLocale);
  const [theme, setTheme] = useState<WorkspaceTheme>(initialTheme);
  const copy = copyByLocale[locale];

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(localeStorageKey);
    if (storedLocale === "en" || storedLocale === "ru") {
      setLocale(storedLocale);
    }

    const storedTheme = window.localStorage.getItem(themeStorageKey);
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      return;
    }

    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(localeStorageKey, locale);
  }, [locale]);

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
      setErrorMessage(copy.signIn.emailRequired);
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
      setErrorMessage(copy.issues.contextNotReady);
      return;
    }
    if (!canWrite) {
      setErrorMessage(copy.issues.readOnly);
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
      setErrorMessage(copy.issues.contextNotReady);
      return;
    }

    const email = memberEmail.trim();
    if (email.length === 0) {
      setErrorMessage(copy.members.emailRequired);
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
      setErrorMessage(copy.issues.contextNotReady);
      return;
    }
    if (!canWrite) {
      setErrorMessage(copy.issues.readOnly);
      return;
    }

    const title = draft.title.trim();
    const description = draft.description.trim();
    if (title.length < 3) {
      setErrorMessage(copy.issues.titleTooShort);
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

  async function submitComment(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (context === null || selectedIssue === null) {
      setErrorMessage(copy.inspector.issueContextNotReady);
      return;
    }
    if (!canWrite) {
      setErrorMessage(copy.issues.readOnly);
      return;
    }

    const body = commentDraft.trim();
    if (body.length === 0) {
      setErrorMessage(copy.inspector.commentRequired);
      return;
    }

    setAddingComment(true);
    try {
      const issue = await api.addIssueComment(context, selectedIssue.id, { body });
      updateIssue(toWebIssue(issue));
      setSelectedIssueId(issue.id);
      setCommentDraft("");
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setAddingComment(false);
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

  function toggleLocale(): void {
    setLocale((current) => (current === "ru" ? "en" : "ru"));
  }

  function toggleTheme(): void {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const connectionTone = status === "failed" ? "red" : status === "loading" ? "amber" : "green";
  const connectionText =
    status === "failed"
      ? copy.connection.offline
      : status === "loading"
        ? copy.connection.syncing
        : status === "auth_required"
          ? copy.connection.signIn
          : copy.connection.synced;
  const currentWorkspaceMember =
    context?.workspace.members.find((member) => member.userId === context.currentUser.id) ?? null;
  const canManageMembers =
    currentWorkspaceMember?.role === "owner" || currentWorkspaceMember?.role === "admin";
  const canWrite = currentWorkspaceMember !== null && currentWorkspaceMember.role !== "viewer";

  if (status === "auth_required") {
    return (
      <SignInScreen
        copy={copy}
        email={signInEmail}
        errorMessage={errorMessage}
        isSigningIn={isSigningIn}
        onEmailChange={(event) => setSignInEmail(event.target.value)}
        onLocaleToggle={toggleLocale}
        onSubmit={(event) => void submitSignIn(event)}
        onThemeToggle={toggleTheme}
        onUseDemoEmail={() => setSignInEmail(demoEmail)}
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
            <h1 className="text-sm font-semibold leading-5">{copy.appName}</h1>
            <p className="text-xs text-zinc-500">
              {context === null ? copy.coreWorkspace : context.workspace.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SettingsControls copy={copy} onLocaleToggle={toggleLocale} onThemeToggle={toggleTheme} />
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
            aria-label={copy.header.signOut}
            className="size-9 px-0"
            leadingIcon={<LogOut className="size-4" />}
            onClick={signOut}
            title={copy.header.signOut}
            variant="ghost"
          />
          <Button
            disabled={status !== "ready" || !canWrite}
            leadingIcon={<Plus className="size-4" />}
            onClick={() => setComposerOpen(true)}
          >
            {copy.header.issue}
          </Button>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 md:grid-cols-[220px_1fr] xl:grid-cols-[220px_minmax(0,1fr)_380px]">
        <aside className="border-r border-zinc-200 bg-white p-3">
          <nav className="flex gap-1 md:block md:space-y-1">
            <button
              className="flex h-9 items-center gap-2 rounded px-2 text-left text-sm font-medium text-zinc-950 md:w-full"
              type="button"
            >
              <Activity className="size-4" />
              {copy.nav.issues}
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded px-2 text-left text-sm text-zinc-600 md:w-full"
              type="button"
            >
              <Columns3 className="size-4" />
              {copy.nav.sprints}
            </button>
          </nav>
          {canManageMembers ? (
            <MemberForm
              copy={copy}
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
          <FlowRadar
            copy={copy}
            focusIssue={
              flowInsights.focusIssueId === null
                ? null
                : (issues.find((issue) => issue.id === flowInsights.focusIssueId) ?? null)
            }
            insights={flowInsights}
            onSelectFocusIssue={(issueId) => setSelectedIssueId(issueId)}
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{copy.issues.title}</h2>
              <p className="text-sm text-zinc-500">
                {status === "loading" ? copy.issues.loading : copy.issues.count(issues.length)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                leadingIcon={<ListFilter className="size-4" />}
                variant={selectedView === "list" ? "secondary" : "ghost"}
                onClick={() => setSelectedView("list")}
              >
                {copy.issues.list}
              </Button>
              <Button
                leadingIcon={<Columns3 className="size-4" />}
                variant={selectedView === "board" ? "secondary" : "ghost"}
                onClick={() => setSelectedView("board")}
              >
                {copy.issues.board}
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
                  {copy.issues.retry}
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "loading" && issues.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-md border border-zinc-200 bg-white text-sm text-zinc-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              {copy.issues.loading}
            </div>
          ) : selectedView === "list" ? (
            <IssueList
              canCreate={canWrite}
              copy={copy}
              issues={sortedIssues}
              onCreate={() => setComposerOpen(true)}
              onSelectIssue={setSelectedIssueId}
              selectedIssueId={selectedIssue?.id ?? null}
            />
          ) : (
            <IssueBoard
              canMove={canWrite}
              copy={copy}
              issues={issues}
              movingIssueId={movingIssueId}
              onMoveIssue={(issueId, nextStatus) => void moveIssue(issueId, nextStatus)}
              onSelectIssue={setSelectedIssueId}
              selectedIssueId={selectedIssue?.id ?? null}
            />
          )}
        </section>

        <IssueInspector
          canWrite={canWrite}
          commentDraft={commentDraft}
          copy={copy}
          currentUserId={context?.currentUser.id ?? null}
          currentUserLabel={context?.currentUser.email ?? null}
          isAddingComment={isAddingComment}
          issue={selectedIssue}
          locale={locale}
          movingIssueId={movingIssueId}
          onCommentChange={(event) => setCommentDraft(event.target.value)}
          onMoveIssue={(issueId, nextStatus) => void moveIssue(issueId, nextStatus)}
          onSubmitComment={(event) => void submitComment(event)}
        />
      </div>

      {isComposerOpen ? (
        <IssueComposer
          copy={copy}
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

function SettingsControls({
  copy,
  onLocaleToggle,
  onThemeToggle,
}: {
  readonly copy: WorkspaceCopy;
  readonly onLocaleToggle: () => void;
  readonly onThemeToggle: () => void;
}): ReactNode {
  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label={copy.controls.themeToggle}
        className="size-9 px-0"
        leadingIcon={<Sun className="size-4" />}
        onClick={onThemeToggle}
        title={copy.controls.themeToggle}
        variant="ghost"
      />
      <Button
        aria-label={copy.controls.switchLanguage}
        className="h-9 px-2"
        leadingIcon={<Languages className="size-4" />}
        onClick={onLocaleToggle}
        title={copy.controls.switchLanguage}
        variant="ghost"
      >
        {copy.controls.languageLabel}
      </Button>
    </div>
  );
}

function SignInScreen({
  copy,
  email,
  errorMessage,
  isSigningIn,
  onLocaleToggle,
  onEmailChange,
  onSubmit,
  onThemeToggle,
  onUseDemoEmail,
}: {
  readonly copy: WorkspaceCopy;
  readonly email: string;
  readonly errorMessage: string | null;
  readonly isSigningIn: boolean;
  readonly onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onLocaleToggle: () => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly onThemeToggle: () => void;
  readonly onUseDemoEmail: () => void;
}): ReactNode {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 text-zinc-950">
      <form
        className="w-full max-w-sm rounded-md border border-zinc-200 bg-white shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div>
            <h1 className="text-sm font-semibold">{copy.appName}</h1>
            <p className="text-xs text-zinc-500">{copy.signIn.subtitle}</p>
          </div>
          <SettingsControls
            copy={copy}
            onLocaleToggle={onLocaleToggle}
            onThemeToggle={onThemeToggle}
          />
        </div>
        <div className="space-y-3 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              {copy.signIn.emailLabel}
            </span>
            <input
              autoFocus
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
              name="email"
              onChange={onEmailChange}
              placeholder={demoEmail}
              required
              type="email"
              value={email}
            />
          </label>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <div className="text-xs font-semibold uppercase text-zinc-500">
              {copy.signIn.demoHint}
            </div>
            <button
              className="mt-1 font-mono text-sm font-medium text-zinc-950 underline-offset-4 hover:underline"
              onClick={onUseDemoEmail}
              type="button"
            >
              {copy.signIn.useDemo}
            </button>
          </div>
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
            {copy.signIn.submit}
          </Button>
        </div>
      </form>
    </main>
  );
}

function MemberForm({
  copy,
  email,
  isAdding,
  onEmailChange,
  onRoleChange,
  onSubmit,
  role,
}: {
  readonly copy: WorkspaceCopy;
  readonly email: string;
  readonly isAdding: boolean;
  readonly onEmailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  readonly onRoleChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  readonly role: Exclude<WtfWorkspaceRole, "owner">;
}): ReactNode {
  return (
    <form className="mt-4 border-t border-zinc-200 pt-4" onSubmit={onSubmit}>
      <div className="mb-2 text-xs font-semibold uppercase text-zinc-500">{copy.members.title}</div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">
          {copy.members.emailLabel}
        </span>
        <input
          className="h-9 w-full rounded-md border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-950"
          onChange={onEmailChange}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-medium text-zinc-600">
          {copy.members.roleLabel}
        </span>
        <select
          className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-950"
          onChange={onRoleChange}
          value={role}
        >
          <option value="member">{copy.roleLabels.member}</option>
          <option value="admin">{copy.roleLabels.admin}</option>
          <option value="viewer">{copy.roleLabels.viewer}</option>
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
        {copy.members.add}
      </Button>
    </form>
  );
}

function IssueList({
  canCreate,
  copy,
  issues,
  onCreate,
  onSelectIssue,
  selectedIssueId,
}: {
  readonly canCreate: boolean;
  readonly copy: WorkspaceCopy;
  readonly issues: ReadonlyArray<WebIssue>;
  readonly onCreate: () => void;
  readonly onSelectIssue: (issueId: string) => void;
  readonly selectedIssueId: string | null;
}): ReactNode {
  if (issues.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white text-sm text-zinc-500">
        <span>{copy.issues.empty}</span>
        <Button disabled={!canCreate} leadingIcon={<Plus className="size-4" />} onClick={onCreate}>
          {copy.header.issue}
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      {issues.map((issue) => (
        <IssueRow
          issueKey={issue.key}
          isSelected={issue.id === selectedIssueId}
          key={issue.id}
          onClick={() => onSelectIssue(issue.id)}
          priority={issue.priority}
          priorityLabel={copy.priorityLabels[issue.priority]}
          status={statusLabel(issue.status, copy)}
          title={issue.title}
        />
      ))}
    </div>
  );
}

function IssueBoard({
  canMove,
  copy,
  issues,
  movingIssueId,
  onMoveIssue,
  onSelectIssue,
  selectedIssueId,
}: {
  readonly canMove: boolean;
  readonly copy: WorkspaceCopy;
  readonly issues: ReadonlyArray<WebIssue>;
  readonly movingIssueId: string | null;
  readonly onMoveIssue: (issueId: string, status: WtfIssueStatus) => void;
  readonly onSelectIssue: (issueId: string) => void;
  readonly selectedIssueId: string | null;
}): ReactNode {
  function handleDragStart(event: DragEvent<HTMLDivElement>, issueId: string): void {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", issueId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: WtfIssueStatus): void {
    event.preventDefault();
    if (!canMove) {
      return;
    }

    const issueId = event.dataTransfer.getData("text/plain");
    if (issueId.length > 0) {
      onMoveIssue(issueId, status);
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[1120px] grid-cols-6 gap-3">
        {columnStatuses.map((status) => {
          const columnIssues = issues.filter((issue) => issue.status === status);

          return (
            <div
              className="min-h-80 rounded-md border border-zinc-200 bg-white"
              key={status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, status)}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-sm font-medium">
                <span>{statusLabel(status, copy)}</span>
                <Badge>{columnIssues.length}</Badge>
              </div>
              <div className="space-y-2 p-2">
                {columnIssues.map((issue) => (
                  <div
                    className={cn(
                      "cursor-pointer rounded border bg-white p-2 shadow-sm transition-colors",
                      canMove ? "active:cursor-grabbing" : "",
                      selectedIssueId === issue.id
                        ? "border-blue-300 bg-blue-50/50"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
                    )}
                    draggable={canMove && movingIssueId !== issue.id}
                    key={issue.id}
                    onDragStart={(event) => handleDragStart(event, issue.id)}
                    onClick={() => onSelectIssue(issue.id)}
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
                        <div className="truncate">{copy.issues.movedBy(issue.movedBy)}</div>
                      )}
                      {issue.closedBy === null ? null : (
                        <div className="truncate">{copy.issues.closedBy(issue.closedBy)}</div>
                      )}
                      <select
                        className="mt-1 h-8 w-full rounded border border-zinc-300 bg-white px-2 text-xs outline-none focus:border-zinc-950"
                        disabled={!canMove || movingIssueId === issue.id}
                        onChange={(event) => {
                          event.stopPropagation();
                          onMoveIssue(issue.id, event.target.value as WtfIssueStatus);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        value={issue.status}
                      >
                        {columnStatuses.map((targetStatus) => (
                          <option key={targetStatus} value={targetStatus}>
                            {statusLabel(targetStatus, copy)}
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
  copy,
  draft,
  isCreating,
  onClose,
  onDraftChange,
  onPriorityChange,
  onSubmit,
}: {
  readonly copy: WorkspaceCopy;
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
          <h2 className="text-sm font-semibold">{copy.issues.newIssue}</h2>
          <Button
            aria-label={copy.issues.cancel}
            className="size-8 px-0"
            leadingIcon={<X className="size-4" />}
            onClick={onClose}
            title={copy.issues.cancel}
            variant="ghost"
          />
        </div>
        <div className="space-y-4 p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              {copy.issues.titleLabel}
            </span>
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
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              {copy.issues.descriptionLabel}
            </span>
            <textarea
              className="min-h-28 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950"
              maxLength={50_000}
              name="description"
              onChange={onDraftChange}
              value={draft.description}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              {copy.issues.priorityLabel}
            </span>
            <select
              className="h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950"
              onChange={onPriorityChange}
              value={draft.priority}
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {copy.priorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">
          <Button disabled={isCreating} onClick={onClose} variant="secondary">
            {copy.issues.cancel}
          </Button>
          <Button
            disabled={isCreating}
            leadingIcon={
              isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />
            }
            type="submit"
          >
            {copy.issues.create}
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
