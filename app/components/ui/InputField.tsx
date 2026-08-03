"use client";

import { useState, type InputHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  optional?: boolean;
  error?: string;
  hint?: string;
}

/**
 * Input with an animated floating label. The label stays a real <label htmlFor>
 * so screen readers and getByLabelText keep working; it visually floats above
 * the field on focus or when the field has a value.
 */
export function InputField({
  label,
  optional = false,
  error,
  hint,
  id,
  className = "",
  ...rest
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          id={id}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId ?? hintId}
          placeholder=" "
          className={`peer w-full min-h-[56px] rounded-lg border bg-surface-raised px-3.5 pb-1 pt-5 text-body text-ink-primary shadow-card transition-colors duration-200 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-focus-ring placeholder:text-transparent ${className} ${
            error
              ? "border-status-error/60"
              : focused
                ? "border-accent"
                : "border-border-hairline"
          }`}
          {...rest}
        />
        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-body text-ink-secondary transition-all duration-200 motion-reduce:transition-none peer-focus:top-2.5 peer-focus:text-label peer-focus:font-semibold peer-focus:text-accent peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:text-label peer-[:not(:placeholder-shown)]:font-semibold ${
            error ? "peer-focus:text-status-error text-status-error" : ""
          }`}
        >
          {label}
          {optional && <span className="text-ink-secondary"> (Optional)</span>}
        </label>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-meta text-status-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-meta text-ink-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
