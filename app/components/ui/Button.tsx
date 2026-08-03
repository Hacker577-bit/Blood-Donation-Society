"use client";

import { useCallback, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  children: ReactNode;
}

const BASE =
  "relative overflow-hidden inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 text-button transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:scale-[0.98]";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-on shadow-glow hover:bg-accent-hover disabled:bg-ink-disabled disabled:shadow-none disabled:hover:bg-ink-disabled",
  secondary:
    "bg-accent-soft text-accent hover:bg-accent/15 disabled:bg-ink-disabled disabled:text-accent-on disabled:hover:bg-ink-disabled",
  outline:
    "border border-border-hairline bg-surface-raised text-ink-primary shadow-card hover:border-accent/50 hover:text-accent disabled:border-ink-disabled disabled:text-ink-disabled disabled:shadow-none",
  ghost:
    "bg-transparent text-ink-secondary hover:bg-surface-overlay hover:text-ink-primary disabled:text-ink-disabled disabled:hover:bg-transparent",
  danger:
    "bg-status-error text-white shadow-card hover:brightness-95 disabled:bg-ink-disabled disabled:shadow-none disabled:hover:brightness-100",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText = "Sending…",
  icon,
  disabled,
  children,
  className = "",
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const span = document.createElement("span");
      span.className = "ripple-ink";
      span.style.width = span.style.height = `${size}px`;
      span.style.left = `${e.clientX - rect.left - size / 2}px`;
      span.style.top = `${e.clientY - rect.top - size / 2}px`;
      e.currentTarget.appendChild(span);
      window.setTimeout(() => span.remove(), 600);
      onClick?.(e);
    },
    [disabled, loading, onClick],
  );

  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading ? "true" : "false"}
      onClick={handleClick}
      className={`${BASE} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          data-testid="button-spinner"
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {icon && !loading ? icon : null}
      {loading ? loadingText : children}
    </button>
  );
}
