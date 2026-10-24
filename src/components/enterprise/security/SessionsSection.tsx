"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Laptop, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { LocalTime, useMounted } from "../shared/LocalTime";
import { errCls, linkCls } from "../shared/ui";
import { api } from "@/lib/server-sync";
import { useStore } from "@/lib/store";
import { recordActing } from "@/lib/enterprise/audit";

type S = { id: string; label: string; createdAt: string; expiresAt: string; current: boolean };

export function SessionsSection() {
  const mounted = useMounted();
  const server = useStore((s) => !!s.user?.server);
  const [list, setList] = useState<S[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<S | "all" | null>(null);

  const load = useCallback(async () => {
    setErr("");
    const r = await api<{ sessions?: S[] }>("/api/me/sessions");
    if (r.ok) setList(r.data.sessions ?? []);
    else {
      setList([]);
      setErr(r.status === 401 ? "Your session is no longer valid. Sign in again." : r.data.error ?? "Could not load sessions.");
    }
  }, []);

  useEffect(() => {
    if (!mounted || !server) return;
    let live = true;
    void api<{ sessions?: S[] }>("/api/me/sessions").then((r) => {
      if (!live) return;
      if (r.ok) setList(r.data.sessions ?? []);
      else {
        setList([]);
        setErr(r.status === 401 ? "Your session is no longer valid. Sign in again." : r.data.error ?? "Could not load sessions.");
      }
    });
    return () => {
      live = false;
    };
  }, [mounted, server]);

  const others = (list ?? []).filter((s) => !s.current);

  const revoke = async () => {
    if (!target) return;
    setBusy(true);
    const t = target;
    const r = t === "all" ? await api<{ revoked?: number }>("/api/me/sessions", "DELETE") : await api(`/api/me/sessions/${t.id}`, "DELETE");
    setBusy(false);
    setTarget(null);
    if (r.ok) {
      recordActing({ action: t === "all" ? "session.others_revoked" : "session.revoked", target: t === "all" ? "All other sessions" : t.label });
      showToast(t === "all" ? "Signed out all other sessions." : `Revoked ${t.label}.`);
      void load();
    } else showToast(r.data.error ?? "Could not revoke the session.");
  };

  return (
    <Section id="sessions" title="Your sign-in sessions" pills={<StatusPill status={server ? "active" : "not-configured"} label={server ? "Active (real)" : "Sign in required"} />} description="Real data from the sessions table for your account. Revoking a session signs that device out immediately.">
      {!mounted ? (
        <div className="h-16 animate-pulse rounded-xl bg-surface-2" />
      ) : !server ? (
        <div data-testid="sessions-guest" className="rounded-xl border border-dashed border-line p-5 text-sm">
          <p className="font-medium">Sign in to manage real sessions</p>
          <p className="mt-1 text-muted">Guests and browser-only demo accounts have no server-side sessions. Accounts backed by the database list every device you are signed in on.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/login" className={`${linkCls} inline-flex min-h-11 items-center`}>Log in</Link>
            <Link href="/signup" className={`${linkCls} inline-flex min-h-11 items-center`}>Create an account</Link>
          </div>
        </div>
      ) : list === null ? (
        <div className="h-24 animate-pulse rounded-xl bg-surface-2" aria-busy="true" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}><RefreshCw className="size-4" aria-hidden /> Refresh</Button>
            <Button variant="secondary" data-testid="signout-others" disabled={!others.length} onClick={() => setTarget("all")}>
              <LogOut className="size-4" aria-hidden /> Sign out other sessions
            </Button>
            {!others.length && <span className="self-center text-xs text-muted">No other sessions to sign out.</span>}
          </div>
          {err && <p role="alert" className={errCls}>{err}</p>}
          <ul data-testid="session-list" className="divide-y divide-line rounded-xl border border-line">
            {list.map((s) => (
              <li key={s.id} data-testid="session-row" data-current={s.current} className="flex flex-wrap items-center gap-3 p-3">
                <Laptop className="size-5 shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {s.label}
                    {s.current && <span data-testid="current-badge" className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-fg">This session</span>}
                  </p>
                  <p className="text-xs text-muted">Signed in <LocalTime iso={s.createdAt} /> · expires <LocalTime iso={s.expiresAt} /></p>
                </div>
                {s.current ? (
                  <span className="text-xs text-muted">Use Log out to end this one.</span>
                ) : (
                  <Button variant="secondary" data-testid="revoke-session" aria-label={`Revoke ${s.label}`} onClick={() => setTarget(s)}>Revoke</Button>
                )}
              </li>
            ))}
            {list.length === 0 && !err && <li className="p-4 text-sm text-muted">No active sessions found.</li>}
          </ul>
        </>
      )}
      <ConfirmDialog
        open={!!target}
        title={target === "all" ? "Sign out all other sessions?" : "Revoke this session?"}
        confirmLabel={busy ? "Working…" : target === "all" ? "Sign out others" : "Revoke session"}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
      >
        <p>{target === "all" ? `This signs out ${others.length} other device${others.length === 1 ? "" : "s"}. This browser stays signed in.` : "That device is signed out immediately and must log in again."} The change is real and cannot be undone.</p>
      </ConfirmDialog>
    </Section>
  );
}
