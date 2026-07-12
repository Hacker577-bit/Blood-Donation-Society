"use client";

import type { InputHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  optional?: boolean;
  error?: string;
}

export function InputField({
  label,
  optional = false,
  error,
  id,
  className = "",
  ...rest
}: InputFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-ink-primary">
        {label}
        {optional && <span className="text-ink-secondary"> (Optional)</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={errorId}
        className={`min-h-[48px] rounded-sm border border-border-hairline bg-surface-raised px-3 text-body text-ink-primary focus:border-accent focus:outline-none ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="text-meta text-status-error">
          {error}
        </p>
      )}
    </div>
  );
}
