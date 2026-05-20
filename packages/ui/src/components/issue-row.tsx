import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./badge.js";

/**
 * Props строки issue для плотных рабочих списков.
 */
export interface IssueRowProps {
  /** Ключ задачи, например `PF-1`. */
  readonly issueKey: string;
  /** Название задачи. */
  readonly title: string;
  /** Статус задачи. */
  readonly status: string;
  /** Приоритет задачи. */
  readonly priority: "low" | "medium" | "high" | "urgent";
}

const priorityTone: Record<IssueRowProps["priority"], BadgeTone> = {
  low: "neutral",
  medium: "blue",
  high: "amber",
  urgent: "red",
};

/**
 * Строка issue для board/list views.
 */
export function IssueRow({ issueKey, title, status, priority }: IssueRowProps): ReactNode {
  return (
    <div className="grid min-h-12 grid-cols-[88px_1fr_112px_88px] items-center gap-3 border-b border-zinc-200 px-3 text-sm">
      <span className="font-mono text-xs text-zinc-500">{issueKey}</span>
      <span className="truncate font-medium text-zinc-950">{title}</span>
      <Badge>{status}</Badge>
      <Badge tone={priorityTone[priority]}>{priority}</Badge>
    </div>
  );
}
