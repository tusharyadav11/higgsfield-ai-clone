import { AlertTriangle, Armchair } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { seatLevel } from "@/lib/enterprise/team-store";
import { DemoBadge } from "../DemoBadge";

const R = 30, C = 2 * Math.PI * R;

export function SeatMeter({ used, total, pending }: { used: number; total: number; pending: number }) {
  const level = seatLevel(used, total);
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = level === "full" ? "var(--danger)" : level === "warn" ? "var(--warn)" : "var(--accent-text)";
  return (
    <Card data-testid="team-seat-meter" data-level={level} className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" role="img" aria-label={`${used} of ${total} seats used`}>
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--line)" strokeWidth="7" />
          <circle cx="36" cy="36" r={R} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1), stroke .3s" }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><Armchair className="size-4" aria-hidden /> Seats <DemoBadge /></p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums"><span data-testid="seat-used">{used}</span> <span className="text-muted">/ <span data-testid="seat-total">{total}</span></span></p>
        <p className="text-xs text-muted">{pending > 0 ? `${pending} pending invitation${pending === 1 ? "" : "s"} hold a seat.` : "Pending invitations hold a seat."}</p>
        {level !== "ok" && (
          <p role="status" data-testid="seat-warning" className={`mt-1.5 flex items-start gap-1.5 text-xs font-medium ${level === "full" ? "text-danger" : "text-warn"}`}>
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{level === "full" ? "All seats are in use. " : "Almost out of seats. "}<Link href="/enterprise/workspace/billing" className="underline underline-offset-2">Add seats in Billing</Link></span>
          </p>
        )}
      </div>
    </Card>
  );
}
