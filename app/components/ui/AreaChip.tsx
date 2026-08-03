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
      className={`min-h-[44px] min-w-[44px] rounded-full border px-4 text-body font-medium transition-all duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring active:scale-[0.96] ${
        selected
          ? "border-accent bg-accent text-accent-on shadow-glow"
          : "border-border-hairline bg-surface-raised text-ink-primary shadow-card hover:-translate-y-0.5 hover:border-accent/60 hover:text-accent"
      }`}
    >
      {label}
    </button>
  );
}
