"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, Clapperboard, Compass, Flame, Gift, Share2, Sparkles, Trophy, UserPlus, Wand2, Wallet } from "lucide-react";
import { MODELS } from "@/lib/models";
import { SIGNUP_BONUS, useStore } from "@/lib/store";
import { claimServer } from "@/lib/server-sync";
import { codeFor, REFEREE_BONUS, REFERRER_BONUS, shareLink } from "@/lib/referral";
import { dayKey, type PopupId } from "@/lib/engage/rules";
import { openGuide } from "@/lib/guide/bus";
import type { Post } from "@/lib/seed";
import { ctaPrimary, ctaSecondary, PopupCard } from "./PopupCard";

export type PopupProps = { id: PopupId; trending: Post[]; onClose: () => void; onMute: () => void; onPause: () => void };

const remixHref = (p: Pick<Post, "id" | "prompt" | "model">) => `/create?${new URLSearchParams({ remix: p.id, prompt: p.prompt, model: p.model })}`;

function useInviteLink() {
  const code = useStore((s) => s.referralCode);
  const userId = useStore((s) => s.userId);
  return () => {
    const id = useStore.getState().ensureId();
    const c = code ?? codeFor(userId ?? id);
    return shareLink(window.location.origin, c);
  };
}

/** Native share sheet where available, otherwise copy the link. Returns a human status line. */
async function shareOrCopy(url: string, text: string): Promise<string> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: "Kinetic", text, url });
      return "Shared. Thank you!";
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "Link copied.";
  } catch {
    return `Copy this link: ${url}`;
  }
}

const P = ({ children }: { children: ReactNode }) => <p className="leading-relaxed">{children}</p>;
const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap gap-2">{children}</div>;
const Msg = ({ children }: { children: ReactNode }) => (
  <p data-testid="popup-msg" role="status" className="text-xs font-medium text-accent-text">
    {children}
  </p>
);

export function Popup(p: PopupProps) {
  const { id, onClose } = p;
  const shell = { id, onClose, onMute: p.onMute, onPause: p.onPause };
  const [msg, setMsg] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [today] = useState(() => dayKey(Date.now()));
  const inviteLink = useInviteLink();
  const credits = useStore((s) => s.credits);
  const lastClaim = useStore((s) => s.lastClaim);
  const streak = useStore((s) => s.streak);
  const claimDaily = useStore((s) => s.claimDaily);
  const serverUser = useStore((s) => !!s.user?.server);
  const unclaimed = lastClaim !== today;

  const claim = async () => {
    if (claiming) return;
    setClaiming(true);
    const r = serverUser ? await claimServer() : claimDaily();
    setClaiming(false);
    setMsg(r.ok ? `+${r.gained} credits added.` : "Already claimed today.");
  };
  const share = async (text: string) => setMsg(await shareOrCopy(inviteLink(), text));

  switch (id) {
    case "first-creation": {
      const last = useStore.getState().library[0];
      const video = `/create?${new URLSearchParams({ ...(last ? { prompt: last.prompt } : {}), model: "kling-fast" })}`;
      return (
        <PopupCard {...shell} modal confetti title="Your first creation!" icon={<Trophy className="size-5" aria-hidden />}>
          <P>Nice. It is saved in your Library. Share Kinetic with a friend, or keep going.</P>
          <Row>
            <Link href={video} data-testid="popup-cta-first-creation" data-autofocus onClick={onClose} className={ctaPrimary}>
              <Clapperboard className="size-4" aria-hidden /> Make a video from it
            </Link>
            <Link href="/explore" data-testid="popup-cta-first-creation-2" onClick={onClose} className={ctaSecondary}>
              <Wand2 className="size-4" aria-hidden /> Remix a trending prompt
            </Link>
            <button type="button" data-testid="popup-share" onClick={() => share("I just made my first creation on Kinetic.")} className={ctaSecondary}>
              <Share2 className="size-4" aria-hidden /> Share
            </button>
          </Row>
          {msg && <Msg>{msg}</Msg>}
        </PopupCard>
      );
    }
    case "credit-low": {
      const cheap = [...MODELS].sort((a, b) => a.credits - b.credits).slice(0, 3);
      return (
        <PopupCard {...shell} title={`You have ${credits} credit${credits === 1 ? "" : "s"} left`} icon={<Wallet className="size-5" aria-hidden />}>
          <P>The cheapest models go a long way:</P>
          <ul className="space-y-1">
            {cheap.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5">
                <span className="text-fg">{m.name}</span>
                <span className="tabular-nums">{m.credits} credits</span>
              </li>
            ))}
          </ul>
          <Row>
            {unclaimed && (
              <button type="button" data-testid="popup-cta-credit-low" onClick={claim} disabled={claiming} className={ctaPrimary}>
                <Gift className="size-4" aria-hidden /> Claim daily credits
              </button>
            )}
            <Link href="/referrals" data-testid={unclaimed ? "popup-cta-credit-low-2" : "popup-cta-credit-low"} onClick={onClose} className={unclaimed ? ctaSecondary : ctaPrimary}>
              <UserPlus className="size-4" aria-hidden /> Invite a friend (+{REFERRER_BONUS})
            </Link>
          </Row>
          {msg && <Msg>{msg}</Msg>}
        </PopupCard>
      );
    }
    case "streak-risk":
      return (
        <PopupCard {...shell} title={`Keep your ${streak}-day streak`} icon={<Flame className="size-5" aria-hidden />}>
          <P>You have not claimed today. One tap keeps the streak going.</P>
          <Row>
            {unclaimed ? (
              <button type="button" data-testid="popup-cta-streak-risk" onClick={claim} disabled={claiming} className={ctaPrimary}>
                <Gift className="size-4" aria-hidden /> Claim today&apos;s credits
              </button>
            ) : (
              <button type="button" data-testid="popup-cta-streak-risk" onClick={onClose} className={ctaSecondary}>
                Done
              </button>
            )}
          </Row>
          {msg && <Msg>{msg} Streak kept.</Msg>}
        </PopupCard>
      );
    case "remix-milestone":
      return (
        <PopupCard {...shell} title="You're getting the hang of this" icon={<Sparkles className="size-5" aria-hidden />}>
          <P>Want to go further? Take the 30-second tour, or let Claude create for you through MCP.</P>
          <Row>
            <button
              type="button"
              data-testid="popup-cta-remix-milestone"
              onClick={() => {
                onClose();
                setTimeout(() => openGuide("tour"), 0);
              }}
              className={ctaPrimary}
            >
              <Compass className="size-4" aria-hidden /> Take the tour
            </button>
            <Link href="/connect" data-testid="popup-cta-remix-milestone-2" onClick={onClose} className={ctaSecondary}>
              Connect to Claude
            </Link>
          </Row>
        </PopupCard>
      );
    case "idle-create":
      return (
        <PopupCard {...shell} title="Stuck? Try a spark" icon={<Wand2 className="size-5" aria-hidden />}>
          <P>A blank prompt is the hardest part. Let us pick one, or borrow from what is trending.</P>
          <Row>
            <button
              type="button"
              data-testid="popup-cta-idle-create"
              onClick={() => {
                document.querySelector<HTMLElement>('[data-testid="surprise-btn"]')?.click();
                onClose();
              }}
              className={ctaPrimary}
            >
              <Sparkles className="size-4" aria-hidden /> Surprise me
            </button>
            <Link href="/explore" data-testid="popup-cta-idle-create-2" onClick={onClose} className={ctaSecondary}>
              Pick a trending prompt
            </Link>
          </Row>
        </PopupCard>
      );
    case "welcome-back":
      return (
        <PopupCard {...shell} title="Welcome back" icon={<Bell className="size-5" aria-hidden />}>
          <P>Here is what is trending right now. Tap one to remix its prompt.</P>
          <ul className="space-y-1.5">
            {p.trending.slice(0, 3).map((t, i) => (
              <li key={t.id}>
                <Link
                  href={remixHref(t)}
                  data-testid={i === 0 ? "popup-cta-welcome-back" : `popup-cta-welcome-back-${i + 1}`}
                  onClick={onClose}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface-2 p-1.5 pr-3 hover:border-accent"
                >
                  <span aria-hidden className="size-9 shrink-0 rounded-lg bg-surface bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(t.poster)})` }} />
                  <span className="min-w-0 flex-1 truncate text-fg">{t.title}</span>
                  <span className="shrink-0 text-xs">{t.remixes.toLocaleString("en-US")} remixes</span>
                </Link>
              </li>
            ))}
          </ul>
        </PopupCard>
      );
    case "share-nudge":
      return (
        <PopupCard {...shell} title="Enjoying Kinetic? Share it" icon={<Share2 className="size-5" aria-hidden />}>
          <P>
            When a friend joins with your link you get +{REFERRER_BONUS} credits and they get +{REFEREE_BONUS}.
          </P>
          <Row>
            <button type="button" data-testid="popup-cta-share-nudge" onClick={() => share("Make images and video with Kinetic. Join with my link.")} className={ctaPrimary}>
              <Share2 className="size-4" aria-hidden /> Copy invite link
            </button>
            <Link href="/referrals" data-testid="popup-cta-share-nudge-2" onClick={onClose} className={ctaSecondary}>
              See rewards
            </Link>
          </Row>
          {msg && <Msg>{msg}</Msg>}
        </PopupCard>
      );
    case "guest-nudge":
      return (
        <PopupCard {...shell} title="Keep your creations safe" icon={<UserPlus className="size-5" aria-hidden />}>
          <P>
            You are browsing as a guest, so your work lives only in this browser. A free account saves it across devices and keeps what you have made. New accounts get a +{SIGNUP_BONUS} welcome bonus.
          </P>
          <Row>
            <Link href="/signup" data-testid="popup-cta-guest-nudge" onClick={onClose} className={ctaPrimary}>
              Create a free account
            </Link>
          </Row>
        </PopupCard>
      );
  }
}
