"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ACCENTS, ACCENT_SWATCH, applyAccent, type Accent } from "@/lib/theme";
import { useStore, type Notifs } from "@/lib/store";
import { clearAuthData } from "@/lib/auth";
import { useServerInfo } from "@/lib/server-info";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button, Card } from "@/components/ui";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { PopupSettings } from "@/components/engage";
import { useMounted } from "./hooks";

const NOTIFS: [keyof Notifs, string][] = [
  ["product", "Product updates"],
  ["tips", "Prompt tips and inspiration"],
  ["referrals", "Referral activity"],
];

export function SettingsView() {
  const router = useRouter();
  const mounted = useMounted();
  const s = useStore();
  const serverDb = useServerInfo((x) => x.db);
  const [accent, setAccent] = useState<Accent | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!mounted) return <div className="h-64 animate-pulse rounded-2xl bg-surface" aria-busy />;
  const current = accent ?? (document.documentElement.dataset.accent as Accent) ?? "lime";

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), credits: s.credits, library: s.library }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kinetic-library.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function wipe() {
    s.resetLocal();
    clearAuthData();
    router.push("/");
  }
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Card>
        <h2 className="font-semibold">Profile</h2>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Display name
          <input data-testid="settings-name" value={s.name} maxLength={40} onChange={(e) => { s.setName(e.target.value); setSaved(true); }} placeholder="Guest" className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-fg outline-none focus:border-accent" />
        </label>
        <p className="mt-2 text-sm text-muted">{s.user ? `Signed in as ${s.user.email}` : "You are using Kinetic as a guest."} {saved && <span className="text-accent-text">Saved.</span>}</p>
        <p className="mt-1 text-xs text-muted">{s.user?.server ? "Your account, credits and library are stored on our server." : serverDb ? "Guest data lives in this browser. Sign up to save it to your account." : "Demo mode: accounts are stored in your browser."}</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Theme</h2>
        <p className="mt-1 text-xs text-muted">Light, dark, or follow your device.</p>
        <ThemeToggle id="settings-theme" className="mt-2" />
      </Card>
      <Card>
        <h2 className="font-semibold">Accent</h2>
        <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Accent colour">
          {ACCENTS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={current === n} aria-label={`${n} accent`} data-testid={`settings-accent-${n}`} onClick={() => { setAccent(n); applyAccent(n); }} className="flex size-11 items-center justify-center">
              <span className={`flex size-7 items-center justify-center rounded-full ${current === n ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""}`} style={{ background: ACCENT_SWATCH[n] }}>
                {current === n && <Check className="size-4 text-black" strokeWidth={3} />}
              </span>
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Notifications</h2>
        <p className="text-xs text-muted">Preferences are saved locally. Demo only: nothing is emailed.</p>
        <ul className="mt-2">
          {NOTIFS.map(([k, label]) => (
            <li key={k} className="flex min-h-11 items-center justify-between gap-3 text-sm">
              <span>{label}</span>
              <button type="button" role="switch" aria-checked={s.notifs[k]} aria-label={label} data-testid={`notif-${k}`} onClick={() => s.setNotif(k, !s.notifs[k])} className="grid h-11 w-12 shrink-0 place-items-center">
                <span aria-hidden className={`relative block h-7 w-12 rounded-full border border-line ${s.notifs[k] ? "bg-accent" : "bg-surface-2"}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-fg transition-all ${s.notifs[k] ? "left-6" : "left-0.5"}`} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        <PopupSettings />
      </Card>
      <Card>
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">{s.user?.server ? "Saved to your account" : "Everything lives in this browser"}: {s.library.length} saved generation(s), {s.credits} credits.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" data-testid="export-data" onClick={exportData}>Export library (JSON)</Button>
          {s.user?.server ? null : (
            <Button variant="ghost" data-testid="delete-data" onClick={() => setConfirm(true)}>Delete my local data</Button>
          )}
        </div>
      <ConfirmDialog
        open={confirm}
        title="Delete all your data on this device?"
        confirmLabel="Delete everything"
        cancelLabel="Keep my data"
        onConfirm={() => { setConfirm(false); wipe(); }}
        onCancel={() => setConfirm(false)}
      >
        <p>This permanently removes the following from this browser:</p>
        <ul className="list-disc pl-5">
          <li>{s.library.length} saved generation{s.library.length === 1 ? "" : "s"} in your library</li>
          <li>{s.credits} credits (your balance on this device) and your daily streak</li>
          <li>Your preferences (name, notifications) and any demo accounts stored here</li>
        </ul>
        <p>{serverDb ? "Anything saved to a server account is not affected: signing in again brings it back." : "Nothing is stored on a server in demo mode, so there is no copy to restore."} This can&apos;t be undone.</p>
      </ConfirmDialog>
      </Card>
    </div>
  );
}
