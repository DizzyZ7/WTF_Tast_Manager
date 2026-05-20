import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../utils/cn.js";

/**
 * Вариант визуального оформления кнопки.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Props кнопки WTF.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Визуальный вариант. */
  readonly variant?: ButtonVariant;
  /** Иконка слева от текста. */
  readonly leadingIcon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-zinc-950 bg-zinc-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_1px_rgba(0,0,0,0.10)] hover:border-zinc-800 hover:bg-zinc-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_3px_rgba(0,0,0,0.14)]",
  secondary:
    "border-zinc-300 bg-white text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.80),0_1px_1px_rgba(0,0,0,0.04)] hover:border-zinc-400 hover:bg-zinc-50 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_1px_3px_rgba(0,0,0,0.08)]",
  ghost:
    "border-transparent bg-transparent text-zinc-700 hover:border-zinc-300 hover:bg-white hover:shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
  danger:
    "border-red-600 bg-red-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_1px_rgba(0,0,0,0.10)] hover:border-red-700 hover:bg-red-700 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_1px_3px_rgba(0,0,0,0.14)]",
};

/**
 * Базовая кнопка дизайн-системы.
 */
export function Button({
  children,
  className,
  leadingIcon,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps): ReactNode {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-100 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 active:translate-y-px active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      type={type}
      {...props}
    >
      {leadingIcon}
      {children}
    </button>
  );
}
