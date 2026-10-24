import type { ReactNode } from "react";
import { Check, CircleDashed, Clock, Plug, FlaskConical } from "lucide-react";

/**
 * One consistent vocabulary for what is real and what is not in the demo workspace.
 * "active" is reserved for capabilities that genuinely work end to end.
 */
export type PillStatus = "active" | "demo" | "needs-integration" | "not-configured" | "planned" | "not-available" | "not-enabled";

const META: Record<PillStatus, { label: string; cls: string; icon: ReactNode }> = {
  active: { label: "Active", cls: "text-success", icon: <Check className="size-3" aria-hidden /> },
  demo: { label: "Demo data", cls: "text-accent-text", icon: <FlaskConical className="size-3" aria-hidden /> },
  "needs-integration": { label: "Needs integration", cls: "text-warn", icon: <Plug className="size-3" aria-hidden /> },
  "not-configured": { label: "Not configured", cls: "text-muted", icon: <CircleDashed className="size-3" aria-hidden /> },
  planned: { label: "Planned", cls: "text-muted", icon: <Clock className="size-3" aria-hidden /> },
  "not-available": { label: "Not available yet", cls: "text-muted", icon: <CircleDashed className="size-3" aria-hidden /> },
  "not-enabled": { label: "Not enabled", cls: "text-muted", icon: <CircleDashed className="size-3" aria-hidden /> },
};

export function StatusPill({ status, label, className = "" }: { status: PillStatus; label?: string; className?: string }) {
  const m = META[status];
  return (
    <span
      data-testid="status-pill"
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium ${m.cls} ${className}`}
    >
      {m.icon}
      {label ?? m.label}
    </span>
  );
}
