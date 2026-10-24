"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Gift } from "lucide-react";
import { logIn, passwordStrength, signUp, EMAIL_RE } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { redeemReferral, normalizeRef, REFEREE_BONUS } from "@/lib/referral";
import { afterAuth, api } from "@/lib/server-sync";
import { Button } from "@/components/ui";
import { DemoNote } from "./DemoNote";

const inputCls = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent aria-[invalid=true]:border-danger";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const store = useStore;

  useEffect(() => {
    // read ?ref after mount (static page, no prerender-time access)
    const r = normalizeRef(new URLSearchParams(window.location.search).get("ref"));
    if (r) {
      store.getState().setPendingRef(r);
      setRefCode(r); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [store]);

  const strength = passwordStrength(pw);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!EMAIL_RE.test(email.trim())) return setErr({ msg: "Enter a valid email address.", field: "email" });
    setBusy(true);
    try {
      const st = store.getState();
      // Real account first (Postgres). 503 {demo:true} means this deployment has no database:
      // fall through to the local, browser-only demo accounts below.
      const ref = normalizeRef(refCode ?? st.pendingRef);
      const sr = await api<{ user?: { id: string }; referred?: boolean }>(
        signup ? "/api/auth/signup" : "/api/auth/login",
        "POST",
        signup ? { email, password: pw, name, ...(ref ? { ref } : {}) } : { email, password: pw },
      );
      if (sr.status !== 503 || !sr.data.demo) {
        if (!sr.ok) return setErr({ msg: sr.data.error ?? "Something went wrong. Try again.", field: sr.data.field });
        await afterAuth({ importGuest: signup });
        router.push("/");
        return;
      }
      if (signup) {
        const id = st.ensureId();
        const r = await signUp({ id, email, password: pw, name });
        if (!r.ok) return setErr({ msg: r.error, field: r.field });
        const out = store.getState().completeSignup(r.user, ref);
        if (out.referred && ref) await redeemReferral(ref, r.user.id);
      } else {
        const r = await logIn(email, pw);
        if (!r.ok) return setErr({ msg: r.error, field: r.field });
        st.signIn(r.user);
      }
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-1 text-sm text-muted">
        {signup ? "Get +25 bonus credits and a 20% welcome code." : "Log in to pick up where you left off."}
      </p>
      {signup && refCode && (
        <p data-testid="ref-note" className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
          <Gift className="size-4 shrink-0 text-accent-text" aria-hidden />
          Invited with code <b className="font-mono">{refCode}</b>: you get +{REFEREE_BONUS} extra credits.
        </p>
      )}
      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4">
        {signup && (
          <label className="flex flex-col gap-1 text-sm">
            Name (optional)
            <input data-testid="auth-name" className={inputCls} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            data-testid="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputCls}
            value={email}
            aria-invalid={err?.field === "email"}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <span className="relative block">
            <input
              data-testid="auth-password"
              type={show ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              className={`${inputCls} pr-12`}
              value={pw}
              aria-invalid={err?.field === "password"}
              onChange={(e) => setPw(e.target.value)}
            />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((v) => !v)} className="absolute right-0 top-0 flex size-11 items-center justify-center text-muted hover:text-fg">
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        {signup && (
          <div data-testid="pw-strength" aria-live="polite">
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${strength.score >= i ? "bg-accent" : "bg-surface-2"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">{pw ? strength.label : "Use 8+ characters, mixing letters, numbers and symbols."}</p>
          </div>
        )}
        <p data-testid="auth-error" role="alert" className="min-h-5 text-sm text-danger">{err?.msg ?? ""}</p>
        <Button type="submit" size="lg" data-testid="auth-submit" disabled={busy}>
          {busy ? "Working..." : signup ? "Create account" : "Log in"}
        </Button>
      </form>
      <Link href="/" data-testid="auth-guest" className="mt-3 flex min-h-11 items-center justify-center rounded-full border border-line text-sm font-semibold hover:border-accent">
        Continue as guest
      </Link>
      <p className="mt-4 text-center text-sm text-muted">
        {signup ? "Already have an account? " : "New here? "}
        <Link className="text-accent-text hover:underline" href={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link>
      </p>
      <div className="mt-4 text-center"><DemoNote /></div>
    </div>
  );
}
