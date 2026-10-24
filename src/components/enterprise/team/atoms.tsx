import { hash } from "@/lib/enterprise/demo-data";
import { ROLE_LABEL, type Role } from "@/lib/enterprise/roles";
import type { MemberStatus } from "@/lib/enterprise/team-store";
import { cn } from "@/components/ui/cn";

export const initialsOf = (name: string, email: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const src = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? email).slice(0, 2);
  return src.toUpperCase();
};

/** Deterministic two-stop gradient from the identity string. Dark enough for white text (AA). */
export function Avatar({ name, email, size = 40 }: { name: string; email: string; size?: number }) {
  const h = hash(email.toLowerCase());
  const a = h % 360, b = (a + 40 + (h >> 9) % 60) % 360;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-inner"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${a} 58% 34%), hsl(${b} 62% 26%))` }}
    >
      {initialsOf(name, email)}
    </span>
  );
}

const ROLE_STYLE: Record<Role, string> = {
  owner: "border-accent/50 bg-accent/10 text-accent-text",
  admin: "border-line bg-surface-2 text-fg",
  editor: "border-line bg-surface text-muted",
  viewer: "border-line bg-surface text-muted",
};
export function RoleBadge({ role }: { role: Role }) {
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", ROLE_STYLE[role])}>{ROLE_LABEL[role]}</span>;
}

const STATUS_STYLE: Record<MemberStatus, { cls: string; label: string }> = {
  active: { cls: "text-success", label: "Active" },
  pending: { cls: "text-warn", label: "Pending" },
  suspended: { cls: "text-danger", label: "Suspended" },
};
export function StatusBadge({ status }: { status: MemberStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", s.cls)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden /> {s.label}
    </span>
  );
}

/** Relative time (needs `now` from after mount). */
export function ago(iso: string | null, now: number): string {
  if (!iso) return "Never";
  const d = now - Date.parse(iso);
  if (!Number.isFinite(d)) return "Never";
  const m = Math.floor(d / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 60) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
export const dateOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—");
