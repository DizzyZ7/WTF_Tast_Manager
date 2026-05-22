import type { WebIssue } from "./issue-data";

/**
 * Сводный статус риска потока.
 */
export type FlowRiskTone = "green" | "amber" | "red";

/**
 * Ключ главной рекомендации по потоку.
 */
export type FlowRecommendationKey =
  | "urgent"
  | "review_constraint"
  | "stale_work"
  | "wip_limit"
  | "no_recent_closures"
  | "balanced";

/**
 * Ключ причины выбора focus issue.
 */
export type FlowFocusReasonKey = "urgent_open" | "stale" | "review" | "highest_risk";

/**
 * Снимок одной колонки workflow.
 */
export interface FlowLaneInsight {
  /** Технический статус issue. */
  readonly status: WebIssue["status"];
  /** Человекочитаемое название колонки. */
  readonly label: string;
  /** Количество задач в колонке. */
  readonly count: number;
  /** Доля колонки от всех issue в процентах. */
  readonly share: number;
}

/**
 * Продуктовые сигналы по текущему потоку задач.
 */
export interface FlowInsights {
  /** Всего issue. */
  readonly total: number;
  /** Открытые issue, включая backlog. */
  readonly open: number;
  /** Активная незакрытая работа без backlog. */
  readonly workInFlight: number;
  /** Комфортный WIP-лимит для текущего размера проекта. */
  readonly wipLimit: number;
  /** Давление на WIP-лимит в процентах. */
  readonly wipPressure: number;
  /** Issue, закрытые за последние 7 дней. */
  readonly closedLast7Days: number;
  /** Открытые issue без движения дольше трех дней. */
  readonly staleCount: number;
  /** Открытые urgent issue. */
  readonly urgentOpenCount: number;
  /** Issue в review. */
  readonly reviewCount: number;
  /** Всего комментариев по issue. */
  readonly commentCount: number;
  /** Среднее количество комментариев на issue. */
  readonly averageCommentsPerIssue: number;
  /** Риск текущего потока. */
  readonly riskTone: FlowRiskTone;
  /** Главная рекомендация для команды. */
  readonly recommendation: string;
  /** Ключ главной рекомендации для локализации. */
  readonly recommendationKey: FlowRecommendationKey;
  /** Issue, на которой лучше сфокусироваться следующей. */
  readonly focusIssueId: string | null;
  /** Причина выбора focus issue. */
  readonly focusReason: string | null;
  /** Ключ причины выбора focus issue для локализации. */
  readonly focusReasonKey: FlowFocusReasonKey | null;
  /** Разрез по колонкам workflow. */
  readonly lanes: ReadonlyArray<FlowLaneInsight>;
}

const laneLabels: Record<WebIssue["status"], string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In progress",
  in_review: "Review",
  done: "Done",
  canceled: "Canceled",
};

const laneOrder: ReadonlyArray<WebIssue["status"]> = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "canceled",
];

const priorityRisk: Record<WebIssue["priority"], number> = {
  low: 1,
  medium: 2,
  high: 4,
  urgent: 6,
};

const closedStatuses = new Set<WebIssue["status"]>(["done", "canceled"]);
const activeStatuses = new Set<WebIssue["status"]>(["todo", "in_progress", "in_review"]);

/**
 * Считает операционные сигналы потока без обращения к API или React state.
 */
export function calculateFlowInsights(
  issues: ReadonlyArray<WebIssue>,
  now: Date = new Date(),
): FlowInsights {
  const total = issues.length;
  const openIssues = issues.filter((issue) => !closedStatuses.has(issue.status));
  const activeIssues = issues.filter((issue) => activeStatuses.has(issue.status));
  const closedLast7Days = issues.filter((issue) => {
    if (issue.closedAt === null) {
      return false;
    }

    return daysBetween(issue.closedAt, now) <= 7;
  }).length;
  const staleIssues = openIssues.filter((issue) => daysSinceLastSignal(issue, now) >= 3);
  const urgentOpenCount = openIssues.filter((issue) => issue.priority === "urgent").length;
  const reviewCount = issues.filter((issue) => issue.status === "in_review").length;
  const commentCount = issues.reduce((sum, issue) => sum + issue.comments.length, 0);
  const averageCommentsPerIssue = total === 0 ? 0 : roundOne(commentCount / total);
  const wipLimit = Math.max(3, Math.ceil(Math.max(total, 1) * 0.35));
  const wipPressure =
    activeIssues.length === 0 ? 0 : Math.round((activeIssues.length / wipLimit) * 100);
  const riskTone = resolveRiskTone({
    staleCount: staleIssues.length,
    urgentOpenCount,
    reviewCount,
    wipPressure,
  });
  const recommendationKey = buildRecommendationKey({
    closedLast7Days,
    open: openIssues.length,
    reviewCount,
    staleCount: staleIssues.length,
    urgentOpenCount,
    workInFlight: activeIssues.length,
    wipLimit,
  });

  return {
    total,
    open: openIssues.length,
    workInFlight: activeIssues.length,
    wipLimit,
    wipPressure,
    closedLast7Days,
    staleCount: staleIssues.length,
    urgentOpenCount,
    reviewCount,
    commentCount,
    averageCommentsPerIssue,
    riskTone,
    recommendation: recommendationText[recommendationKey],
    recommendationKey,
    ...findFocusIssue(openIssues, now),
    lanes: laneOrder.map((status) => {
      const count = issues.filter((issue) => issue.status === status).length;

      return {
        status,
        label: laneLabels[status],
        count,
        share: total === 0 ? 0 : Math.round((count / total) * 100),
      };
    }),
  };
}

function resolveRiskTone({
  reviewCount,
  staleCount,
  urgentOpenCount,
  wipPressure,
}: {
  readonly reviewCount: number;
  readonly staleCount: number;
  readonly urgentOpenCount: number;
  readonly wipPressure: number;
}): FlowRiskTone {
  if (urgentOpenCount >= 2 || staleCount >= 3 || reviewCount >= 4 || wipPressure >= 150) {
    return "red";
  }

  if (urgentOpenCount >= 1 || staleCount >= 1 || reviewCount >= 2 || wipPressure >= 100) {
    return "amber";
  }

  return "green";
}

const recommendationText: Record<FlowRecommendationKey, string> = {
  urgent: "Pull urgent work into the active lane before adding new backlog.",
  review_constraint: "Review is the constraint. Clear review before starting more implementation.",
  stale_work: "Refresh stale open work and decide whether it moves, waits, or closes.",
  wip_limit: "WIP is above the comfort limit. Finish active work before creating more.",
  no_recent_closures:
    "No recent closures. Pick one active issue and drive it to a terminal status.",
  balanced: "Flow is balanced. Keep the queue small and protect the current review lane.",
};

function buildRecommendationKey({
  closedLast7Days,
  open,
  reviewCount,
  staleCount,
  urgentOpenCount,
  workInFlight,
  wipLimit,
}: {
  readonly closedLast7Days: number;
  readonly open: number;
  readonly reviewCount: number;
  readonly staleCount: number;
  readonly urgentOpenCount: number;
  readonly workInFlight: number;
  readonly wipLimit: number;
}): FlowRecommendationKey {
  if (urgentOpenCount > 0) {
    return "urgent";
  }

  if (reviewCount >= 2) {
    return "review_constraint";
  }

  if (staleCount > 0) {
    return "stale_work";
  }

  if (workInFlight > wipLimit) {
    return "wip_limit";
  }

  if (closedLast7Days === 0 && open > 0) {
    return "no_recent_closures";
  }

  return "balanced";
}

function findFocusIssue(
  openIssues: ReadonlyArray<WebIssue>,
  now: Date,
): Pick<FlowInsights, "focusIssueId" | "focusReason" | "focusReasonKey"> {
  const [issue] = [...openIssues].sort(
    (left, right) => issueRisk(right, now) - issueRisk(left, now),
  );
  if (issue === undefined) {
    return { focusIssueId: null, focusReason: null, focusReasonKey: null };
  }

  if (issue.priority === "urgent") {
    return {
      focusIssueId: issue.id,
      focusReason: "urgent priority is still open",
      focusReasonKey: "urgent_open",
    };
  }

  if (daysSinceLastSignal(issue, now) >= 3) {
    return {
      focusIssueId: issue.id,
      focusReason: "no movement for 3+ days",
      focusReasonKey: "stale",
    };
  }

  if (issue.status === "in_review") {
    return {
      focusIssueId: issue.id,
      focusReason: "review work is closest to release",
      focusReasonKey: "review",
    };
  }

  return {
    focusIssueId: issue.id,
    focusReason: "highest current flow risk",
    focusReasonKey: "highest_risk",
  };
}

function issueRisk(issue: WebIssue, now: Date): number {
  const laneRisk =
    issue.status === "in_review"
      ? 6
      : issue.status === "in_progress"
        ? 5
        : issue.status === "todo"
          ? 3
          : 1;

  return (
    priorityRisk[issue.priority] * 10 + laneRisk + Math.min(daysSinceLastSignal(issue, now), 10)
  );
}

function daysSinceLastSignal(issue: WebIssue, now: Date): number {
  return daysBetween(issue.movedAt ?? issue.updatedAt, now);
}

function daysBetween(isoDate: string, now: Date): number {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) {
    return 0;
  }

  const diff = now.getTime() - time;
  return Math.max(0, Math.floor(diff / 86_400_000));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
