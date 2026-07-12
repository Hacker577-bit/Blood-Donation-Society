"use client";

import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  loading = false,
  loadingText = "Sending…",
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading ? "true" : "false"}
      className={`flex w-full min-h-[48px] items-center justify-center gap-2 rounded-md bg-accent text-accent-on text-body font-semibold hover:bg-accent-hover disabled:bg-ink-disabled disabled:hover:bg-ink-disabled transition-colors motion-reduce:transition-none ${className}`}
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
      {loading ? loadingText : children}
    </button>
  );
}
