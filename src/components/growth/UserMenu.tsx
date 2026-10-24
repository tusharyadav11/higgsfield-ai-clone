"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Coins, Gift, LogOut, Settings } from "lucide-react";
import { useStore } from "@/lib/store";
import { logout } from "@/lib/server-sync";
import { useJobs } from "@/lib/jobs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useMounted } from "./hooks";

export function UserMenu() {
  const mounted = useMounted();
  const user = useStore((s) => s.user);
  const credits = useStore((s) => s.credits);
  const library = useStore((s) => s.library.length);
  const running = useJobs((s) => s.jobs.filter((j) => j.status === "running").length);
  const [ask, setAsk] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  if (!mounted) return <div className="size-11" aria-hidden />;
  if (!user)
    return (
      <Link href="/login" data-testid="signin-btn" className="flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-semibold hover:border-accent">
        Sign in
      </Link>
    );
  const item = "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm hover:bg-surface-2";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="user-menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent font-bold uppercase text-accent-fg">{user.name.charAt(0) || "?"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href="/pricing" onClick={() => setOpen(false)} className={item}><Coins className="size-4 text-accent-text" />{credits} credits</Link>
          <Link role="menuitem" href="/referrals" onClick={() => setOpen(false)} className={item}><Gift className="size-4" />Referrals</Link>
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className={item}><Settings className="size-4" />Settings</Link>
          <button role="menuitem" type="button" data-testid="logout-btn" onClick={() => { setOpen(false); setAsk(true); }} className={`${item} w-full`}><LogOut className="size-4" />Log out</button>
        </div>
      )}
      <ConfirmDialog
        open={ask}
        title="Log out?"
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        onCancel={() => setAsk(false)}
        onConfirm={() => { setAsk(false); void logout(); }}
      >
        {running > 0 && <p><b className="text-fg">{running} generation{running === 1 ? " is" : "s are"} still running.</b> Logging out now may lose {running === 1 ? "its" : "their"} result.</p>}
        {user.server ? (
          <p>Your account, {credits} credits and {library} saved generation{library === 1 ? "" : "s"} stay safe on our server. Log in again to get them back. This device&apos;s local copy is cleared.</p>
        ) : (
          <p>This is a demo account stored only in this browser. Signing out keeps your {library} saved generation{library === 1 ? "" : "s"} and {credits} credits on this device, but you&apos;ll browse as a guest until you sign in again.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
