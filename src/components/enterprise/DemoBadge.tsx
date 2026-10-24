import { FlaskConical } from "lucide-react";
import { cn } from "@/components/ui/cn";

/** Marks sample data in the demo workspace. Consistent label everywhere: never present sample data as real. */
export function DemoBadge({ className, label = "Demo data" }: { className?: string; label?: string }) {
  return (
    <span
      data-testid="demo-badge"
      title="Sample data stored in this browser. Not real people or real usage."
      className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted", className)}
    >
      <FlaskConical className="size-3" aria-hidden /> {label}
    </span>
  );
}
