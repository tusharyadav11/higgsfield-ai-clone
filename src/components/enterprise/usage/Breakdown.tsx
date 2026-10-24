"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { Group } from "@/lib/enterprise/demo-data";
import { DemoBadge } from "../DemoBadge";

type Row = Group & { label: string; former?: boolean };
type Key = "label" | "credits" | "count";
const nf = (n: number) => n.toLocaleString("en");

export function Breakdown({ title, testid, rows, total, unitLabel }: { title: string; testid: string; rows: Row[]; total: number; unitLabel: string }) {
  const [key, setKey] = useState<Key>("credits");
  const [dir, setDir] = useState<1 | -1>(-1);
  const sorted = useMemo(() => {
    const s = [...rows].sort((a, b) => (key === "label" ? a.label.localeCompare(b.label) : a[key] - b[key] || a.label.localeCompare(b.label)) * dir);
    return s;
  }, [rows, key, dir]);
  const max = Math.max(1, ...rows.map((r) => r.credits));
  const th = (k: Key, label: string, right?: boolean) => (
    <th scope="col" aria-sort={key === k ? (dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 font-medium", right && "text-right")}>
      <button type="button" onClick={() => (key === k ? setDir((d) => (d === 1 ? -1 : 1)) : (setKey(k), setDir(k === "label" ? 1 : -1)))} className={cn("inline-flex min-h-8 items-center gap-1 hover:text-fg", key === k && "text-fg")}>
        {label}{key === k && (dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
      </button>
    </th>
  );
  return (
    <Card data-testid={testid} className="flex min-w-0 flex-col gap-3">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{title} <DemoBadge /></h3>
      {!rows.length ? (
        <p className="py-6 text-center text-sm text-muted">No consumption in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm tabular-nums">
            <caption className="sr-only">{title}, credits consumed in the selected period (demo data)</caption>
            <thead className="text-xs text-muted"><tr>{th("label", unitLabel)}{th("credits", "Credits", true)}{th("count", "Runs", true)}</tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} data-testid={`${testid}-row`} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 font-medium">
                      <span className="break-words">{r.label}</span>
                      {r.former && <span className="rounded-full border border-line px-1.5 py-px text-[10px] font-normal text-muted">Former member</span>}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div className="h-full rounded-full bg-accent motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${(r.credits / max) * 100}%` }} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{nf(r.credits)} <span className="text-xs text-muted">({total ? Math.round((r.credits / total) * 100) : 0}%)</span></td>
                  <td className="px-3 py-2 text-right text-muted">{nf(r.count)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-line text-xs text-muted"><th scope="row" className="px-3 py-2 text-left font-medium">Total</th><td className="px-3 py-2 text-right">{nf(total)}</td><td /></tr></tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}
