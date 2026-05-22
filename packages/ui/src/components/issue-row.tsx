import type { ReactNode } from "react";
import { cn } from "../utils/cn.js";
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
  /** Отображаемое название приоритета. */
  readonly priorityLabel?: string;
  /** Выбрана ли строка в родительском списке. */
  readonly isSelected?: boolean;
  /** Дополнительные CSS-классы. */
  readonly className?: string;
  /** Обработчик выбора строки. */
  readonly onClick?: () => void;
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
export function IssueRow({
  className,
  isSelected = false,
  issueKey,
  onClick,
  priority,
  priorityLabel,
  status,
  title,
}: IssueRowProps): ReactNode {
  const rowClassName = cn(
    "grid min-h-12 grid-cols-[88px_1fr_112px_88px] items-center gap-3 border-b border-zinc-200 px-3 text-sm transition-colors",
    onClick === undefined ? "" : "w-full text-left hover:bg-zinc-50",
    isSelected ? "bg-blue-50/70" : "",
    className,
  );
  const content = (
    <>
      <span className="font-mono text-xs text-zinc-500">{issueKey}</span>
      <span className="truncate font-medium text-zinc-950">{title}</span>
      <Badge>{status}</Badge>
      <Badge tone={priorityTone[priority]}>{priorityLabel ?? priority}</Badge>
    </>
  );

  if (onClick !== undefined) {
    return (
      <button className={rowClassName} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <div className={rowClassName}>{content}</div>;
}
