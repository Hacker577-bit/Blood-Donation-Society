import type { ReactNode } from "react";

interface BloodGroupBadgeProps {
  group: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<BloodGroupBadgeProps["size"]>, string> = {
  sm: "size-8 rounded-lg text-meta",
  md: "size-11 rounded-xl text-body-large",
  lg: "size-14 rounded-2xl text-heading",
};

/**
 * Square "blood group card" pill — the universal visual shorthand for blood
 * type. Always brand-red so it reads instantly as a blood-related element.
 */
export function BloodGroupBadge({
  group,
  size = "md",
  className = "",
}: BloodGroupBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center bg-accent font-bold tracking-tight text-accent-on shadow-glow ${SIZES[size]} ${className}`}
    >
      {group}
    </span>
  );
}

export function BloodDrop({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 2.6c2.4 3.2 7 8.6 7 13.1A7 7 0 0 1 5 15.7C5 11.2 9.6 5.8 12 2.6Z" />
    </svg>
  );
}

export function BloodGroupBadgeWithLabel({
  group,
  label,
}: {
  group: string;
  label: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <BloodGroupBadge group={group} size="sm" />
      <span className="text-body font-semibold text-ink-primary">{label}</span>
    </span>
  );
}
