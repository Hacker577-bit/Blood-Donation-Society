import type { ReactNode } from "react";

type Tone = "neutral" | "brand" | "success" | "warning" | "error" | "info";

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-overlay text-ink-secondary",
  brand: "bg-accent-soft text-accent",
  success: "bg-status-success-bg text-status-success",
  warning: "bg-status-caution-bg text-status-caution",
  error: "bg-status-error-bg text-status-error",
  info: "bg-sky-soft text-sky",
};

export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-meta font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
