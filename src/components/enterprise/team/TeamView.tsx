"use client";
import { useMemo, useState } from "react";
import { Crown, Lock, PauseCircle, PlayCircle, RotateCcw, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button, Card, ConfirmDialog, Skeleton, showToast } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useNow } from "@/components/growth/hooks";
import { assignableRoles, can, canManage, canRemove, needsRoleConfirm, RANK, ROLES, ROLE_LABEL, type Role } from "@/lib/enterprise/roles";
import { seatsUsed, useTeam, type Member, type MemberStatus } from "@/lib/enterprise/team-store";
import { DemoBadge } from "../DemoBadge";
import { Avatar, RoleBadge, StatusBadge, ago, dateOf } from "./atoms";
import { InviteForm, INVITE_NOTE } from "./InviteForm";
import { PermissionsDialog } from "./PermissionsDialog";
import { SeatMeter } from "./SeatMeter";
import { useMedia, useSmartDebounce, useTeamReady } from "./hooks";

type SortKey = "name" | "role" | "status" | "active" | "joined";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "Name (A–Z)" },
  { id: "role", label: "Role" },
  { id: "status", label: "Status" },
  { id: "active", label: "Last active" },
  { id: "joined", label: "Joined" },
];
const STATUS_RANK: Record<MemberStatus, number> = { active: 0, pending: 1, suspended: 2 };
const t = (iso: string | null) => (iso ? Date.parse(iso) : 0);

function sortMembers(list: Member[], key: SortKey) {
  const c: Record<SortKey, (a: Member, b: Member) => number> = {
    name: (a, b) => a.name.localeCompare(b.name),
    role: (a, b) => RANK[b.role] - RANK[a.role] || a.name.localeCompare(b.name),
    status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
    active: (a, b) => t(b.lastActive) - t(a.lastActive) || a.name.localeCompare(b.name),
    joined: (a, b) => t(a.joined ?? a.invitedAt) - t(b.joined ?? b.invitedAt),
  };
  return [...list].sort(c[key]);
}

type Pending =
  | { kind: "role"; id: string; role: Role }
  | { kind: "remove"; ids: string[] }
  | { kind: "revoke"; id: string }
  | { kind: "transfer" };

export function TeamView() {
  const ready = useTeamReady();
  if (!ready) return <TeamSkeleton />;
  return <Loaded />;
}

function TeamSkeleton() {
  return (
    <div aria-busy data-testid="team-loading" className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      <Skeleton className="h-12" />
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
    </div>
  );
}

function Loaded() {
  const { members, seats, actingAs, setActingAs, setRole, setStatus, remove, restore, resend, transfer, reset } = useTeam();
  const now = useNow(60_000);
  const wide = useMedia("(min-width: 768px)");
  const [query, setQuery] = useState("");
  const q = useSmartDebounce(query, members.length).trim().toLowerCase();
  const [fRole, setFRole] = useState<"all" | Role>("all");
  const [fStatus, setFStatus] = useState<"all" | MemberStatus>("all");
  const [sort, setSort] = useState<SortKey>("role");
  const [sel, setSel] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [perms, setPerms] = useState(false);

  const shown = useMemo(() => {
    const f = members.filter(
      (m) => (fRole === "all" || m.role === fRole) && (fStatus === "all" || m.status === fStatus) && (!q || m.name.toLowerCase().includes(q) || m.email.includes(q)),
    );
    return sortMembers(f, sort);
  }, [members, q, fRole, fStatus, sort]);

  const byId = (id: string) => members.find((m) => m.id === id);
  const used = seatsUsed(members);
  const pendingCount = members.filter((m) => m.status === "pending").length;
  const removableShown = shown.filter((m) => canRemove(actingAs, m.role));
  const selected = sel.filter((id) => byId(id));
  const candidates = members.filter((m) => m.status === "active" && m.role !== "owner");

  const doRemove = (ids: string[]) => {
    const before = useTeam.getState().members;
    const at = ids.map((id) => before.findIndex((m) => m.id === id));
    const gone = remove(ids);
    setSel([]);
    const label = gone.length === 1 ? gone[0].name : `${gone.length} people`;
    showToast(`${label} removed from this demo workspace.`, { undo: () => restore(gone, at) });
  };

  const confirm = () => {
    const p = pending;
    setPending(null);
    if (!p) return;
    if (p.kind === "role") {
      const m = byId(p.id);
      setRole(p.id, p.role);
      if (m) showToast(`${m.name} is now ${ROLE_LABEL[p.role]}.`);
    } else if (p.kind === "remove") doRemove(p.ids);
    else if (p.kind === "revoke") doRemove([p.id]);
    else if (p.kind === "transfer" && transferTo) {
      const m = byId(transferTo);
      transfer(transferTo);
      if (m) showToast(`Ownership transferred to ${m.name}. You are now acting as Admin.`);
    }
  };

  const changeRole = (m: Member, role: Role) => {
    if (role === m.role) return;
    if (needsRoleConfirm(m.role, role)) setPending({ kind: "role", id: m.id, role });
    else {
      setRole(m.id, role);
      showToast(`${m.name} is now ${ROLE_LABEL[role]}.`);
    }
  };

  const nowSafe = now || 0;
  const rowProps = { actingAs, now: nowSafe, sel, setSel, changeRole, setPending, setStatus, resend: (m: Member) => (resend(m.id, Date.now()), showToast(`Invitation for ${m.email} re-recorded. ${INVITE_NOTE}.`)) };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight">Team <DemoBadge /></h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Sample people stored in this browser to show how team management works. No real accounts, no emails.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-dashed border-line bg-surface px-3 py-1 text-xs text-muted">
            <span>Acting as <DemoBadge label="Demo control" className="ml-1" /></span>
            <select data-testid="acting-as" value={actingAs} onChange={(e) => setActingAs(e.target.value as Role)} className="min-h-9 rounded-full border border-line bg-bg px-2 text-sm text-fg focus:border-accent focus:outline-none">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </label>
          <Button variant="secondary" data-testid="open-permissions" onClick={() => setPerms(true)}><ShieldCheck className="size-4" aria-hidden /> Permissions</Button>
          {can(actingAs, "transfer_ownership") && (
            <Button variant="secondary" data-testid="transfer-ownership" disabled={!candidates.length} onClick={() => (setTransferTo(candidates[0]?.id ?? ""), setPending({ kind: "transfer" }))}><Crown className="size-4" aria-hidden /> Transfer ownership</Button>
          )}
          <Button variant="ghost" data-testid="reset-demo" onClick={() => (reset(Date.now()), setSel([]), showToast("Demo workspace reset to its sample data."))}><RotateCcw className="size-4" aria-hidden /> <span className="max-sm:sr-only">Reset demo</span></Button>
        </div>
      </header>

      {actingAs !== "owner" && (
        <p data-testid="acting-note" className="rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs text-muted">
          You are previewing the <b className="text-fg">{ROLE_LABEL[actingAs]}</b> role. {actingAs === "admin" ? "Admins can manage Editors and Viewers only." : "Team controls are read-only."}
        </p>
      )}

      <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SeatMeter used={used} total={seats} pending={pendingCount} />
        <InviteForm actingAs={actingAs} />
      </div>

      <section aria-label="Members" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input data-testid="member-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" aria-label="Search members by name or email" className="min-h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm focus:border-accent focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Select testid="filter-role" label="Filter by role" value={fRole} onChange={(v) => setFRole(v as "all" | Role)} options={[["all", "All roles"], ...ROLES.map((r) => [r, ROLE_LABEL[r]] as [string, string])]} />
            <Select testid="filter-status" label="Filter by status" value={fStatus} onChange={(v) => setFStatus(v as "all" | MemberStatus)} options={[["all", "All statuses"], ["active", "Active"], ["pending", "Pending"], ["suspended", "Suspended"]]} />
            <Select testid="member-sort" label="Sort members" value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS.map((s) => [s.id, s.label])} />
          </div>
        </div>

        {selected.length > 0 && (
          <div role="region" aria-label="Bulk actions" data-testid="bulk-bar" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
            <span><b>{selected.length}</b> selected</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSel([])}>Clear</Button>
              <Button variant="secondary" data-testid="bulk-remove" onClick={() => setPending({ kind: "remove", ids: selected })}><Trash2 className="size-4" aria-hidden /> Remove</Button>
            </div>
          </div>
        )}

        <p className="sr-only" aria-live="polite">{shown.length} of {members.length} members shown</p>

        {!shown.length ? (
          <Card data-testid="team-empty" className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted" aria-hidden />
            <p className="font-semibold">{members.length ? "No members match" : "No members yet"}</p>
            <p className="max-w-sm text-sm text-muted">{members.length ? "Try a different search or clear the filters." : "Invite people above to start building the demo team."}</p>
            {members.length > 0 && <Button variant="secondary" onClick={() => (setQuery(""), setFRole("all"), setFStatus("all"))}>Clear filters</Button>}
          </Card>
        ) : wide ? (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface/90">
            <table data-testid="member-table" className="w-full text-left text-sm">
              <caption className="sr-only">Workspace members (demo data)</caption>
              <thead className="bg-surface-2/70 text-xs text-muted">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2.5">
                    {removableShown.length > 0 && (
                      <input type="checkbox" aria-label="Select all removable members" className="size-4 accent-[var(--accent)]" checked={removableShown.every((m) => sel.includes(m.id))} onChange={(e) => setSel(e.target.checked ? removableShown.map((m) => m.id) : [])} />
                    )}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Member</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Last active</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Joined</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>{shown.map((m) => <Row key={m.id} m={m} table {...rowProps} />)}</tbody>
            </table>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">{shown.map((m) => <Row key={m.id} m={m} {...rowProps} />)}</ul>
        )}
      </section>

      <PermissionsDialog open={perms} onClose={() => setPerms(false)} />

      <ConfirmDialog
        open={!!pending}
        title={dialogTitle(pending, byId)}
        confirmLabel={dialogConfirm(pending)}
        cancelLabel={pending?.kind === "revoke" ? "Keep invitation" : "Cancel"}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <DialogBody pending={pending} byId={byId} candidates={candidates} transferTo={transferTo} setTransferTo={setTransferTo} />
      </ConfirmDialog>
    </div>
  );
}

function dialogTitle(p: Pending | null, byId: (id: string) => Member | undefined) {
  if (!p) return "";
  if (p.kind === "role") return `Change ${byId(p.id)?.name ?? "member"} to ${ROLE_LABEL[p.role]}?`;
  if (p.kind === "remove") return p.ids.length === 1 ? `Remove ${byId(p.ids[0])?.name ?? "member"}?` : `Remove ${p.ids.length} people?`;
  if (p.kind === "revoke") return `Revoke the invitation for ${byId(p.id)?.email ?? "this address"}?`;
  return "Transfer ownership?";
}
function dialogConfirm(p: Pending | null) {
  if (!p) return "Confirm";
  if (p.kind === "role") return `Make ${ROLE_LABEL[p.role]}`;
  if (p.kind === "remove") return p.ids.length === 1 ? "Remove member" : `Remove ${p.ids.length} people`;
  if (p.kind === "revoke") return "Revoke invitation";
  return "Transfer ownership";
}

function DialogBody({ pending: p, byId, candidates, transferTo, setTransferTo }: { pending: Pending | null; byId: (id: string) => Member | undefined; candidates: Member[]; transferTo: string; setTransferTo: (v: string) => void }) {
  if (!p) return null;
  if (p.kind === "role") {
    const m = byId(p.id);
    return <p>{m ? `${m.name} goes from ${ROLE_LABEL[m.role]} to ${ROLE_LABEL[p.role]}.` : ""} {p.role === "admin" ? "Admins can invite, remove and manage Editors and Viewers." : "They will lose permissions that come with their current role."} This changes sample data stored in this browser only.</p>;
  }
  if (p.kind === "remove")
    return (
      <>
        <p>This removes {p.ids.length === 1 ? (byId(p.ids[0])?.name ?? "the member") : `${p.ids.length} people`} and frees {p.ids.length === 1 ? "a seat" : "their seats"} in the demo workspace.</p>
        <p>It is sample data stored in this browser, nobody real is affected. Their past credit usage stays in the history, labelled “Former member”. You can undo for 5 seconds after removing.</p>
      </>
    );
  if (p.kind === "revoke") return <p>The pending invitation is deleted and its seat is freed. No email was ever sent, because this is a demo workspace. This only changes sample data in this browser.</p>;
  return (
    <>
      <p>The new Owner gets full control including billing. You become an Admin. There is always exactly one Owner. Demo data in this browser only.</p>
      <label className="flex flex-col gap-1 text-fg">
        <span className="text-xs text-muted">New owner</span>
        <select data-testid="transfer-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm">
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} ({ROLE_LABEL[c.role]})</option>)}
        </select>
      </label>
    </>
  );
}

function Select({ testid, label, value, onChange, options }: { testid: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select data-testid={testid} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-11 min-w-0 rounded-xl border border-line bg-surface px-2 text-sm focus:border-accent focus:outline-none sm:px-3">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

type RowProps = {
  m: Member;
  table?: boolean;
  actingAs: Role;
  now: number;
  sel: string[];
  setSel: (f: (s: string[]) => string[]) => void;
  changeRole: (m: Member, r: Role) => void;
  setPending: (p: Pending) => void;
  setStatus: (id: string, s: MemberStatus) => void;
  resend: (m: Member) => void;
};

function Row({ m, table, actingAs, now, sel, setSel, changeRole, setPending, setStatus, resend }: RowProps) {
  const options = assignableRoles(actingAs, m.role);
  const editable = options.length > 0 && m.status !== "pending";
  const removable = canRemove(actingAs, m.role);
  const checked = sel.includes(m.id);
  const isPending = m.status === "pending";

  const role = editable ? (
    <select
      data-testid={`role-select-${m.id}`}
      aria-label={`Role for ${m.name}`}
      value={m.role}
      onChange={(e) => changeRole(m, e.target.value as Role)}
      className="min-h-11 rounded-lg border border-line bg-bg px-2 text-sm focus:border-accent focus:outline-none"
    >
      {[m.role, ...options].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  ) : (
    <span className="inline-flex items-center gap-1.5" title={m.role === "owner" ? "The Owner can't be removed or demoted. Transfer ownership instead." : "Your demo role can't change this role"}>
      <RoleBadge role={m.role} />
      {m.role === "owner" || !canManage(actingAs, m.role) ? <Lock className="size-3 text-muted" aria-hidden /> : null}
    </span>
  );

  const actions = isPending ? (
    <div data-testid="invite-row-pending" className="flex flex-wrap justify-end gap-1.5">
      {can(actingAs, "invite") ? (
        <>
          <Button variant="secondary" data-testid={`invite-resend-${m.id}`} onClick={() => resend(m)} className="min-h-11">Resend</Button>
          <Button variant="ghost" data-testid={`invite-revoke-${m.id}`} onClick={() => setPending({ kind: "revoke", id: m.id })} className="min-h-11 text-danger hover:text-danger">Revoke</Button>
        </>
      ) : <span className="text-xs text-muted">Invitation pending</span>}
    </div>
  ) : (
    <div className="flex justify-end gap-1.5">
      {can(actingAs, "remove") && m.role !== "owner" && canManage(actingAs, m.role) && (
        <Button variant="ghost" size="icon" data-testid={`member-status-${m.id}`} aria-label={m.status === "suspended" ? `Reactivate ${m.name}` : `Suspend ${m.name}`} onClick={() => { setStatus(m.id, m.status === "suspended" ? "active" : "suspended"); showToast(`${m.name} ${m.status === "suspended" ? "reactivated" : "suspended"} (demo).`); }}>
          {m.status === "suspended" ? <PlayCircle className="size-5" aria-hidden /> : <PauseCircle className="size-5" aria-hidden />}
        </Button>
      )}
      {removable && (
        <Button variant="ghost" size="icon" data-testid={`member-remove-${m.id}`} aria-label={`Remove ${m.name}`} onClick={() => setPending({ kind: "remove", ids: [m.id] })} className="hover:text-danger">
          <Trash2 className="size-5" aria-hidden />
        </Button>
      )}
    </div>
  );

  const check = removable ? (
    <input type="checkbox" data-testid={`member-check-${m.id}`} aria-label={`Select ${m.name}`} checked={checked} onChange={(e) => setSel((s) => (e.target.checked ? [...s, m.id] : s.filter((x) => x !== m.id)))} className="size-4 accent-[var(--accent)]" />
  ) : null;

  const who = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={m.name} email={m.email} />
      <div className="min-w-0">
        <p className="truncate font-medium">{m.name}</p>
        <p className="truncate text-xs text-muted">{m.email}</p>
      </div>
    </div>
  );
  const active = isPending ? "Invited " + ago(m.invitedAt, now) : m.lastActive ? ago(m.lastActive, now) : "Never";

  if (table)
    return (
      <tr data-testid="member-row" data-status={m.status} data-member-id={m.id} className={cn("border-t border-line transition-colors hover:bg-surface-2/50", checked && "bg-accent/5")}>
        <td className="px-3 py-2">{check}</td>
        <td className="max-w-[16rem] px-3 py-2">{who}</td>
        <td className="px-3 py-2">{role}</td>
        <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
        <td className="whitespace-nowrap px-3 py-2 text-muted">{active}</td>
        <td className="whitespace-nowrap px-3 py-2 text-muted">{dateOf(m.joined)}</td>
        <td className="px-3 py-2">{actions}</td>
      </tr>
    );
  return (
    <li data-testid="member-row" data-status={m.status} data-member-id={m.id} className={cn("rounded-2xl border border-line bg-surface/90 p-3", checked && "border-accent/50")}>
      <div className="flex items-start gap-3">
        {check && <span className="grid size-11 shrink-0 place-items-center">{check}</span>}
        <div className="min-w-0 flex-1">{who}</div>
        <StatusBadge status={m.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <div><dt className="text-muted">Last active</dt><dd>{active}</dd></div>
        <div><dt className="text-muted">Joined</dt><dd>{dateOf(m.joined)}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">{role}{actions}</div>
    </li>
  );
}
