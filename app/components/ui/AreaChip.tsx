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
      className={`min-h-[44px] min-w-[44px] rounded-full border px-4 text-body font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
        selected
          ? "bg-accent text-accent-on border-accent shadow-glow"
          : "bg-surface-raised text-ink-primary border-border-hairline hover:border-accent hover:text-accent"
      }`}
    >
      {label}
    </button>
  );
}
