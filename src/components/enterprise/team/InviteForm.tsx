"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { Button, Card, showToast } from "@/components/ui";
import { assignableRoles, can, ROLE_LABEL, type Role } from "@/lib/enterprise/roles";
import { MAX_INVITES, planInvite, useTeam } from "@/lib/enterprise/team-store";

export const INVITE_NOTE = "Invitation recorded in this demo workspace — no email is sent";

export function InviteForm({ actingAs }: { actingAs: Role }) {
  const id = useId();
  const members = useTeam((s) => s.members);
  const seats = useTeam((s) => s.seats);
  const invite = useTeam((s) => s.invite);
  const [raw, setRaw] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!can(actingAs, "invite")) {
    return (
      <Card data-testid="invite-readonly" className="flex items-start gap-3 text-sm text-muted">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p><b className="text-fg">Read-only as {ROLE_LABEL[actingAs]}.</b> Only Owners and Admins can invite people. Switch “Acting as” to try it.</p>
      </Card>
    );
  }
  const roles = assignableRoles(actingAs, "viewer");
  const effective = roles.includes(role) ? role : roles[0];

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const plan = planInvite(useTeam.getState().members, useTeam.getState().seats, raw);
    if (plan.error) return setError(plan.error);
    setError(null);
    setBusy(true);
    timer.current = setTimeout(() => {
      invite(plan.emails, effective, Date.now());
      setRaw("");
      setBusy(false);
      showToast(`${plan.emails.length} invitation${plan.emails.length === 1 ? "" : "s"} added as ${ROLE_LABEL[effective]}. ${INVITE_NOTE}.`);
    }, 450);
  };

  return (
    <Card className="flex flex-col gap-3">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div>
          <label htmlFor={`${id}-e`} className="text-sm font-semibold">Invite people</label>
          <p id={`${id}-h`} className="text-xs text-muted">Paste up to {MAX_INVITES} emails, separated by commas, spaces or new lines.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <textarea
            id={`${id}-e`}
            data-testid="invite-email"
            rows={1}
            value={raw}
            disabled={busy}
            placeholder="name@company.com, name2@company.com"
            aria-invalid={!!error}
            aria-describedby={`${id}-h ${error ? `${id}-err` : ""}`}
            onChange={(e) => (setRaw(e.target.value), error && setError(null))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-line bg-bg px-3 py-2.5 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none aria-[invalid=true]:border-danger-line"
          />
          <select
            data-testid="invite-role"
            aria-label="Role for invited people"
            value={effective}
            disabled={busy}
            onChange={(e) => setRole(e.target.value as Role)}
            className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm focus:border-accent focus:outline-none sm:w-36"
          >
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <Button type="submit" data-testid="invite-submit" disabled={busy} aria-busy={busy} className="sm:w-32">
            {busy ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Send className="size-4" aria-hidden />}
            {busy ? "Inviting…" : "Invite"}
          </Button>
        </div>
        {error && <p id={`${id}-err`} role="alert" data-testid="invite-error" className="text-sm text-danger">{error}</p>}
        <p className="text-xs text-muted">{INVITE_NOTE}. Pending invitations use a seat ({members.length}/{seats} in use).</p>
      </form>
    </Card>
  );
}
