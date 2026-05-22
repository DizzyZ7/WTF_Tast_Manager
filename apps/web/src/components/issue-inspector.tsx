import { Badge, Button, type BadgeTone } from "@wtf/ui";
import { Loader2, MessageSquare } from "lucide-react";
import type { ChangeEvent, ReactNode, SyntheticEvent } from "react";
import type { WtfIssueStatus } from "../lib/wtf-api";
import type { WebIssue } from "./issue-data";
import { statusLabel, type WorkspaceCopy, type WorkspaceLocale } from "./workspace-i18n";

/**
 * Props панели подробностей issue.
 */
export interface IssueInspectorProps {
  /** Может ли текущий пользователь изменять задачи. */
  readonly canWrite: boolean;
  /** Draft нового комментария. */
  readonly commentDraft: string;
  /** Словарь текущей локали. */
  readonly copy: WorkspaceCopy;
  /** Идентификатор текущего пользователя. */
  readonly currentUserId: string | null;
  /** Текущая локаль для форматирования дат. */
  readonly locale: WorkspaceLocale;
  /** Отображаемое имя текущего пользователя. */
  readonly currentUserLabel: string | null;
  /** Выполняется ли отправка комментария. */
  readonly isAddingComment: boolean;
  /** Выбранная issue. */
  readonly issue: WebIssue | null;
  /** Issue, которая сейчас меняет статус. */
  readonly movingIssueId: string | null;
  /** Меняет draft комментария. */
  readonly onCommentChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  /** Меняет статус issue. */
  readonly onMoveIssue: (issueId: string, status: WtfIssueStatus) => void;
  /** Отправляет комментарий. */
  readonly onSubmitComment: (event: SyntheticEvent<HTMLFormElement>) => void;
}

const statusOptions: ReadonlyArray<{ readonly status: WtfIssueStatus; readonly label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "Review" },
  { status: "done", label: "Done" },
  { status: "canceled", label: "Canceled" },
];

/**
 * Правая панель с контекстом, комментариями и activity log выбранной issue.
 */
export function IssueInspector({
  canWrite,
  commentDraft,
  copy,
  currentUserId,
  currentUserLabel,
  isAddingComment,
  issue,
  locale,
  movingIssueId,
  onCommentChange,
  onMoveIssue,
  onSubmitComment,
}: IssueInspectorProps): ReactNode {
  return (
    <aside className="border-t border-zinc-200 bg-white p-4 xl:border-l xl:border-t-0">
      {issue === null ? (
        <div className="sticky top-20 flex h-64 items-center justify-center rounded-md border border-dashed border-zinc-300 text-sm text-zinc-500">
          {copy.inspector.none}
        </div>
      ) : (
        <div className="sticky top-20 space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-zinc-500">{issue.key}</span>
              <Badge tone={priorityBadgeTone(issue.priority)}>
                {copy.priorityLabels[issue.priority]}
              </Badge>
            </div>
            <h2 className="text-base font-semibold leading-6 text-zinc-950">{issue.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{statusLabel(issue.status, copy)}</Badge>
              <Badge tone={issue.closedAt === null ? "blue" : "green"}>
                {issue.closedAt === null ? copy.inspector.open : copy.inspector.closed}
              </Badge>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase text-zinc-500">
              {copy.inspector.movement}
            </div>
            <div className="space-y-3 p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  {copy.inspector.status}
                </span>
                <select
                  className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-950 disabled:opacity-60"
                  disabled={!canWrite || movingIssueId === issue.id}
                  onChange={(event) => onMoveIssue(issue.id, event.target.value as WtfIssueStatus)}
                  value={issue.status}
                >
                  {statusOptions.map((target) => (
                    <option key={target.status} value={target.status}>
                      {statusLabel(target.status, copy)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
                <InfoTile
                  label={copy.inspector.created}
                  value={formatRelativeTime(issue.createdAt, locale, copy)}
                />
                <InfoTile
                  label={copy.inspector.updated}
                  value={formatRelativeTime(issue.updatedAt, locale, copy)}
                />
                <InfoTile
                  label={copy.inspector.moved}
                  value={formatNullableTime(issue.movedAt, locale, copy)}
                />
                <InfoTile
                  label={copy.inspector.closedAt}
                  value={formatNullableTime(issue.closedAt, locale, copy)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-zinc-200">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase text-zinc-500">
              {copy.inspector.description}
            </div>
            <div className="max-h-40 overflow-auto whitespace-pre-wrap px-3 py-2 text-sm leading-6 text-zinc-700">
              {issue.description.length === 0 ? copy.inspector.noDescription : issue.description}
            </div>
          </div>

          <div className="rounded-md border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
              <div className="text-xs font-semibold uppercase text-zinc-500">
                {copy.inspector.comments}
              </div>
              <Badge>{issue.comments.length}</Badge>
            </div>
            <div className="max-h-56 space-y-3 overflow-auto p-3">
              {issue.comments.length === 0 ? (
                <div className="text-sm text-zinc-500">{copy.inspector.noComments}</div>
              ) : (
                issue.comments.map((comment) => (
                  <div className="rounded border border-zinc-200 bg-zinc-50 p-2" key={comment.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
                      <span className="truncate">
                        {formatActor(comment.authorId, currentUserId, currentUserLabel, copy)}
                      </span>
                      <span className="shrink-0">
                        {formatRelativeTime(comment.createdAt, locale, copy)}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-5 text-zinc-800">
                      {comment.body}
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="border-t border-zinc-200 p-3" onSubmit={onSubmitComment}>
              <textarea
                className="min-h-20 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-950 disabled:opacity-60"
                disabled={!canWrite || isAddingComment}
                maxLength={50_000}
                onChange={onCommentChange}
                placeholder={copy.inspector.writeComment}
                value={commentDraft}
              />
              <Button
                className="mt-2 w-full"
                disabled={!canWrite || isAddingComment || commentDraft.trim().length === 0}
                leadingIcon={
                  isAddingComment ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MessageSquare className="size-4" />
                  )
                }
                type="submit"
                variant="secondary"
              >
                {copy.inspector.comment}
              </Button>
            </form>
          </div>

          <div className="rounded-md border border-zinc-200">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase text-zinc-500">
              {copy.inspector.activity}
            </div>
            <div className="max-h-52 overflow-auto p-3">
              {issue.activities.slice(0, 8).map((activity) => (
                <div className="flex gap-2 pb-3 last:pb-0" key={activity.id}>
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-zinc-300" />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-700">
                      {formatActivity(activity, currentUserId, currentUserLabel, copy)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatRelativeTime(activity.occurredAt, locale, copy)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function InfoTile({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1">
      <div className="font-medium text-zinc-600">{label}</div>
      <div className="truncate text-zinc-500">{value}</div>
    </div>
  );
}

function priorityBadgeTone(priority: WebIssue["priority"]): BadgeTone {
  switch (priority) {
    case "urgent":
      return "red";
    case "high":
      return "amber";
    case "medium":
      return "blue";
    case "low":
      return "neutral";
  }
}

function formatNullableTime(
  isoDate: string | null,
  locale: WorkspaceLocale,
  copy: WorkspaceCopy,
): string {
  return isoDate === null ? copy.inspector.never : formatRelativeTime(isoDate, locale, copy);
}

function formatRelativeTime(isoDate: string, locale: WorkspaceLocale, copy: WorkspaceCopy): string {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) {
    return copy.inspector.unknown;
  }

  const diffMs = time - Date.now();
  const absMs = Math.abs(diffMs);
  const units: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const formatter = new Intl.RelativeTimeFormat(locale === "ru" ? "ru" : "en", {
    numeric: "auto",
  });
  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs) {
      return formatter.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return locale === "ru" ? "только что" : "just now";
}

function formatActor(
  actorId: string,
  currentUserId: string | null,
  currentUserLabel: string | null,
  copy: WorkspaceCopy,
): string {
  if (currentUserId !== null && actorId === currentUserId) {
    return currentUserLabel ?? copy.inspector.you;
  }

  return shortId(actorId);
}

function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8);
}

function formatActivity(
  activity: WebIssue["activities"][number],
  currentUserId: string | null,
  currentUserLabel: string | null,
  copy: WorkspaceCopy,
): string {
  const actor = formatActor(activity.actorId, currentUserId, currentUserLabel, copy);
  if (activity.verb === "status_changed") {
    const from =
      typeof activity.metadata.from === "string" ? statusLabel(activity.metadata.from, copy) : "";
    const to =
      typeof activity.metadata.to === "string" ? statusLabel(activity.metadata.to, copy) : "";

    return copy.inspector.activities.moved(actor, from, to);
  }

  if (activity.verb === "created") {
    return copy.inspector.activities.created(actor);
  }

  if (activity.verb === "commented") {
    return copy.inspector.activities.commented(actor);
  }

  if (activity.verb === "assigned") {
    return copy.inspector.activities.assigned(actor);
  }

  if (activity.verb === "subtask_added") {
    return copy.inspector.activities.subtaskAdded(actor);
  }

  if (activity.verb === "relation_added") {
    return copy.inspector.activities.relationAdded(actor);
  }

  return copy.inspector.activities.fallback(actor, activity.verb);
}
