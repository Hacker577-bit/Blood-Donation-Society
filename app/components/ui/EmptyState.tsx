import type { ReactNode } from "react";
import { Card } from "./Card";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        {icon}
      </span>
      <h2 className="text-heading text-ink-primary">{title}</h2>
      <p className="max-w-md text-body text-ink-secondary">{body}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Card>
  );
}
