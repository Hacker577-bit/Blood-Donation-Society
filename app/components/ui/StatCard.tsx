import type { ReactNode } from "react";
import { Card } from "./Card";

interface StatCardProps {
  icon: ReactNode;
  value: string;
  label: string;
  tone?: "brand" | "success" | "info" | "warning";
}

const TONES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  brand: "bg-accent-soft text-accent",
  success: "bg-status-success-bg text-status-success",
  info: "bg-sky-soft text-sky",
  warning: "bg-status-caution-bg text-status-caution",
};

export function StatCard({ icon, value, label, tone = "brand" }: StatCardProps) {
  return (
    <Card hover padding="md" className="flex flex-col gap-3">
      <span
        className={`flex size-11 items-center justify-center rounded-xl ${TONES[tone]}`}
      >
        {icon}
      </span>
      <span className="text-heading font-bold text-ink-primary">{value}</span>
      <span className="text-meta text-ink-secondary">{label}</span>
    </Card>
  );
}
