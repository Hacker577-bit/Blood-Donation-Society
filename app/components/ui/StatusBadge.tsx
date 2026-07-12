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
      className={`inline-flex items-center rounded-full px-3 py-1 text-body font-semibold ${STATUS_CLASSES[status]}`}
    >
      {children}
    </span>
  );
}
