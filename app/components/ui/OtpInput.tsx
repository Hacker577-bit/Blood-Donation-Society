"use client";

import { useRef } from "react";

const DIGIT_COUNT = 6;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: DIGIT_COUNT }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index: number, rawInput: string) {
    const digit = rawInput.replace(/\D/g, "").slice(-1);
    setDigit(index, digit);
    if (digit && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, DIGIT_COUNT);
    if (pasted.length === 0) {
      return;
    }
    e.preventDefault();
    onChange(pasted.padEnd(DIGIT_COUNT, "").slice(0, DIGIT_COUNT).trimEnd());
    const focusIndex = Math.min(pasted.length, DIGIT_COUNT - 1);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Code digit ${index + 1} of ${DIGIT_COUNT}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="h-12 w-12 rounded-sm border border-border-hairline bg-surface-raised text-center text-heading text-ink-primary focus:border-accent focus:outline-none disabled:text-ink-disabled"
        />
      ))}
    </div>
  );
}
