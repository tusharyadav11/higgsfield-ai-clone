"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Copy, Share2, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { useServerInfo } from "@/lib/server-info";
import { codeFor, fetchRedemptions, REFERRER_BONUS, REFEREE_BONUS, REWARD_TIERS } from "@/lib/referral";
import { Button, Card } from "@/components/ui";
import { api, hydrate } from "@/lib/server-sync";
import { useMounted } from "./hooks";

export function ReferralsView() {
  const mounted = useMounted();
  const userId = useStore((s) => s.userId);
  const user = useStore((s) => s.user);
  const serverDb = useServerInfo((s) => s.db);
  const serverCode = useStore((s) => s.referralCode);
  const server = !!user?.server;
  const ensureId = useStore((s) => s.ensureId);
  const invited = useStore((s) => s.invited);
  const claimed = useStore((s) => s.rewardsClaimed);
  const addInvited = useStore((s) => s.addInvited);
  const claimReward = useStore((s) => s.claimReward);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    ensureId();
  }, [ensureId]);

  const code = server ? (serverCode ?? "") : userId ? codeFor(userId) : "";
  useEffect(() => {
    if (!code || server) return; // server users: the DB is the ledger, hydrate() delivers invitees and credits
    let live = true;
    fetchRedemptions(code).then((rs) => {
      if (!live || !rs.length) return;
      const gained = addInvited(rs.map((r) => ({ id: r.referee, at: r.at })));
      if (gained) setMsg(`+${gained} credits: someone used your code.`);
    });
    return () => {
      live = false;
    };
  }, [code, server, addInvited]);

  // refresh stats when the page opens (a friend may have joined since the last load)
  useEffect(() => {
    if (server) void hydrate();
  }, [server]);

  if (!mounted || (!code && serverDb !== true)) return <div className="h-64 animate-pulse rounded-2xl bg-surface" aria-busy />;
  if (serverDb === true && !server)
    return (
      <Card>
        <h2 className="text-lg font-semibold">Create an account to get your referral code</h2>
        <p data-testid="ref-signup-cta" className="mt-1 text-sm text-muted">
          Friends get +{REFEREE_BONUS} credits at signup and you get +{REFERRER_BONUS} credits the moment they join, saved straight to your account.
        </p>
        <div className="mt-4 flex gap-2">
          <Link href="/signup" className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg">Sign up</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center rounded-full border border-line px-6 text-sm font-semibold">Log in</Link>
        </div>
      </Card>
    );
  if (!code) return <div className="h-64 animate-pulse rounded-2xl bg-surface" aria-busy />;
  const link = `${location.origin}/signup?ref=${code}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const n = invited.length;
  const next = REWARD_TIERS.find((t) => n < t.invites);
  const top = REWARD_TIERS[REWARD_TIERS.length - 1].invites;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <p className="text-sm text-muted">Your referral code</p>
        <p data-testid="ref-code" className="mt-1 font-mono text-3xl font-bold tracking-widest text-accent">{code}</p>
        <p className="mt-2 text-sm text-muted">
          Friends get +{REFEREE_BONUS} credits at signup. You get +{REFERRER_BONUS} credits each time your code is redeemed.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input readOnly aria-label="Share link" data-testid="ref-link" value={link} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
          <Button
            data-testid="ref-copy"
            variant="secondary"
            onClick={() => {
              navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }, () => {});
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
          </Button>
          {canShare && (
            <Button data-testid="ref-share" onClick={() => navigator.share({ title: "Kinetic", text: `Try Kinetic, use my code ${code}`, url: link }).catch(() => {})}>
              <Share2 className="size-4" /> Share
            </Button>
          )}
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm text-accent">{msg}</p>
        <p className="text-xs text-muted">
          {server
            ? "Credits land in your account the moment a friend signs up with your link."
            : "Demo ledger: no database is configured, so redemptions are recorded in this browser only."}
        </p>
      </Card>

      <section aria-labelledby="rw">
        <h2 id="rw" className="mb-1 text-lg font-semibold">Rewards</h2>
        <p className="mb-3 text-sm text-muted">
          {n} invited{next ? `, ${next.invites - n} more to unlock ${next.badge}` : ", all badges unlocked"}.
        </p>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={top} aria-valuenow={Math.min(n, top)}>
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, (n / top) * 100)}%` }} />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REWARD_TIERS.map((t) => {
            const done = claimed.includes(t.invites);
            const ready = n >= t.invites && !done;
            return (
              <li key={t.invites} data-testid={`reward-${t.invites}`} className="rounded-2xl border border-line bg-surface p-4">
                <Trophy className={`size-5 ${n >= t.invites ? "text-accent" : "text-muted"}`} aria-hidden />
                <p className="mt-2 font-semibold">{t.badge}</p>
                <p className="text-sm text-muted">{t.invites} invite{t.invites > 1 ? "s" : ""} · +{t.credits} credits</p>
                <Button
                  size="md"
                  variant={ready ? "primary" : "secondary"}
                  disabled={!ready}
                  className="mt-3 w-full"
                  onClick={() => {
                    if (!server) return void claimReward(t.invites);
                    void api("/api/me/rewards", "POST", { invites: t.invites }).then(() => hydrate());
                  }}
                >
                  {done ? "Claimed" : ready ? "Claim" : "Locked"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="inv">
        <h2 id="inv" className="mb-3 text-lg font-semibold">Invited</h2>
        {n === 0 ? (
          <div data-testid="invited-empty" className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            No one has used your code yet. Share your link, or <Link href="/signup" className="text-accent hover:underline">try the signup flow</Link> yourself with another browser profile.
          </div>
        ) : (
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {invited.map((i, idx) => (
              <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-6 text-muted">#{idx + 1}</span>
                <span className="flex-1 truncate">Creator {i.id.slice(0, 4)}</span>
                <span className="text-muted">{new Date(i.at).toLocaleDateString()}</span>
                <span className="font-semibold text-accent">+{REFERRER_BONUS}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
