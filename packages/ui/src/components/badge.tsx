import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn.js";

/**
 * Цветовой тон badge.
 */
export type BadgeTone = "neutral" | "blue" | "green" | "red" | "amber";

/**
 * Props badge.
 */
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Цветовой тон. */
  readonly tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-800",
};

/**
 * Компактный статусный badge.
 */
export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps): ReactNode {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded px-2 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
