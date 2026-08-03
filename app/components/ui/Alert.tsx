import type { ReactNode } from "react";

type AlertTone = "success" | "error" | "warning" | "info";

interface AlertProps {
  tone?: AlertTone;
  children: ReactNode;
  className?: string;
}

const TONES: Record<AlertTone, string> = {
  success: "border-status-success/30 bg-status-success-bg text-status-success",
  error: "border-status-error/30 bg-status-error-bg text-status-error",
  warning: "border-status-caution/30 bg-status-caution-bg text-status-caution",
  info: "border-sky/30 bg-sky-soft text-sky",
};

const ICONS: Record<AlertTone, ReactNode> = {
  success: (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <path d="M12 3 2.8 20h18.4L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 11v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
    </svg>
  ),
};

export function Alert({ tone = "info", children, className = "" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-body ${TONES[tone]} ${className}`}
    >
      <span className="mt-0.5 shrink-0">{ICONS[tone]}</span>
      <span>{children}</span>
    </div>
  );
}
