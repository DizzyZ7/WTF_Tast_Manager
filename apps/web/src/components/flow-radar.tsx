import { Badge, Button, cn, type BadgeTone } from "@wtf/ui";
import { BarChart3, CheckCircle2, Clock3, Gauge, MessageSquare, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { FlowInsights } from "./flow-insights";
import type { WebIssue } from "./issue-data";
import { statusLabel, type WorkspaceCopy } from "./workspace-i18n";

/**
 * Props радара потока задач.
 */
export interface FlowRadarProps {
  /** Issue, выбранная расчетной моделью как следующий фокус. */
  readonly focusIssue: WebIssue | null;
  /** Словарь текущей локали. */
  readonly copy: WorkspaceCopy;
  /** Расчетные сигналы потока. */
  readonly insights: FlowInsights;
  /** Выбирает focus issue в основном shell. */
  readonly onSelectFocusIssue: (issueId: string) => void;
}

/**
 * Операционная панель здоровья потока.
 */
export function FlowRadar({
  copy,
  focusIssue,
  insights,
  onSelectFocusIssue,
}: FlowRadarProps): ReactNode {
  const riskTone = flowRiskBadgeTone(insights.riskTone);
  const focusIssueId = insights.focusIssueId;

  return (
    <section className="mb-5 overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded bg-zinc-950 text-white">
            <Gauge className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{copy.flow.title}</h2>
              <Badge tone={riskTone}>{copy.flow.risk[insights.riskTone]}</Badge>
            </div>
            <p className="truncate text-sm text-zinc-500">
              {copy.flow.recommendations[insights.recommendationKey]}
            </p>
          </div>
        </div>
        {focusIssueId === null ? null : (
          <Button
            leadingIcon={<Target className="size-4" />}
            onClick={() => onSelectFocusIssue(focusIssueId)}
            variant="secondary"
          >
            {copy.flow.focus}
          </Button>
        )}
      </div>
      <div className="grid gap-px bg-zinc-200 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCell
          detail={copy.flow.metrics.pressure(insights.wipPressure)}
          icon={<BarChart3 className="size-4" />}
          label={copy.flow.metrics.wip}
          value={`${insights.workInFlight}/${insights.wipLimit}`}
        />
        <MetricCell
          detail={copy.flow.metrics.open(insights.open)}
          icon={<CheckCircle2 className="size-4" />}
          label={copy.flow.metrics.closed7d}
          value={String(insights.closedLast7Days)}
        />
        <MetricCell
          detail={copy.flow.metrics.staleDetail}
          icon={<Clock3 className="size-4" />}
          label={copy.flow.metrics.stale}
          value={String(insights.staleCount)}
        />
        <MetricCell
          detail={copy.flow.metrics.perIssue(insights.averageCommentsPerIssue)}
          icon={<MessageSquare className="size-4" />}
          label={copy.flow.metrics.comments}
          value={String(insights.commentCount)}
        />
      </div>
      <div className="grid gap-4 px-4 py-3 lg:grid-cols-[1fr_220px]">
        <div className="space-y-2">
          {insights.lanes.map((lane) => (
            <div className="grid grid-cols-[96px_1fr_40px] items-center gap-3" key={lane.status}>
              <span className="text-xs font-medium text-zinc-600">
                {statusLabel(lane.status, copy)}
              </span>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn("h-full rounded-full", laneBarColor(lane.status))}
                  style={{ width: `${lane.share}%` }}
                />
              </div>
              <span className="text-right text-xs tabular-nums text-zinc-500">{lane.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
          <div className="text-xs font-semibold uppercase text-zinc-500">{copy.flow.nextFocus}</div>
          <div className="mt-1 text-sm font-medium text-zinc-950">
            {focusIssue === null ? copy.flow.noOpenIssues : focusIssue.key}
          </div>
          {insights.focusReasonKey === null ? null : (
            <div className="mt-1 text-xs leading-5 text-zinc-500">
              {copy.flow.focusReasons[insights.focusReasonKey]}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MetricCell({
  detail,
  icon,
  label,
  value,
}: {
  readonly detail: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
}): ReactNode {
  return (
    <div className="bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{detail}</div>
    </div>
  );
}

function flowRiskBadgeTone(riskTone: FlowInsights["riskTone"]): BadgeTone {
  if (riskTone === "red") {
    return "red";
  }

  if (riskTone === "amber") {
    return "amber";
  }

  return "green";
}

function laneBarColor(status: WebIssue["status"]): string {
  switch (status) {
    case "backlog":
      return "bg-zinc-400";
    case "todo":
      return "bg-blue-500";
    case "in_progress":
      return "bg-amber-500";
    case "in_review":
      return "bg-violet-500";
    case "done":
      return "bg-emerald-500";
    case "canceled":
      return "bg-red-400";
  }
}
