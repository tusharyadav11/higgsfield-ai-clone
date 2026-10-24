import { FlaskConical } from "lucide-react";

/** Marks sample data (never real records) wherever it is shown. */
export function DemoBadge({ label = "Demo data", className = "" }: { label?: string; className?: string }) {
  return (
    <span
      data-testid="demo-badge"
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-accent-text ${className}`}
    >
      <FlaskConical className="size-3" aria-hidden />
      {label}
    </span>
  );
}
