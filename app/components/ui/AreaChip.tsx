"use client";

interface AreaChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function AreaChip({ label, selected, onToggle }: AreaChipProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected ? "true" : "false"}
      onClick={onToggle}
      className={`min-h-[44px] min-w-[44px] rounded-full border px-4 text-body transition-colors motion-reduce:transition-none ${
        selected
          ? "bg-accent text-accent-on border-accent"
          : "bg-surface-raised text-ink-primary border-border-hairline"
      }`}
    >
      {label}
    </button>
  );
}
