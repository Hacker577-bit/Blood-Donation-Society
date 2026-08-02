import type { ReactNode } from "react";

interface StatusBadgeProps {
  status: "eligible" | "cooldown";
  children: ReactNode;
}

const STATUS_CLASSES: Record<StatusBadgeProps["status"], string> = {
  eligible: "bg-status-success-bg text-status-success",
  cooldown: "bg-status-caution-bg text-status-caution",
};

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-body font-semibold ${STATUS_CLASSES[status]}`}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
