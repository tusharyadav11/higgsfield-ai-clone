"use client";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui";
import { DEMO_WINDOWS, LIMITS, USE_CASES, isFreeMail, validateQuote, type Kind, type QuoteErrors } from "@/lib/enterprise/quote";
import { formatNum, type CalcState, type Estimate } from "@/lib/enterprise/pricing";
import { ConfigList } from "./QuoteSummary";

const inputCls = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-base text-fg outline-none placeholder:text-muted/70 focus:border-accent aria-[invalid=true]:border-danger sm:text-sm";

type Values = { name: string; email: string; company: string; teamSize: string; credits: string; useCaseKind: string; useCaseOther: string; message: string; window: string; timezone: string; website: string };
type Done = { reference: string; stored: boolean; kind: Kind };

const FIELD_ORDER: (keyof QuoteErrors)[] = ["name", "email", "company", "teamSize", "expectedCredits", "useCase", "useCaseOther", "window", "message"];
const FIELD_LABEL: Record<string, string> = { name: "Full name", email: "Work email", company: "Company", teamSize: "Team size", expectedCredits: "Expected monthly credits", useCase: "Use case", useCaseOther: "Use case details", window: "Preferred time window", message: "Message" };

const fid = (p: string, k: string) => `${p}-f-${k}`;
function Field({ p, errs, k, ek, label, hint, req, children }: { p: string; errs: QuoteErrors; k: string; ek?: keyof QuoteErrors; label: string; hint?: ReactNode; req?: boolean; children: (a: Record<string, unknown>) => ReactNode }) {
  const e = errs[ek ?? (k as keyof QuoteErrors)];
  const id = fid(p, k);
  const desc = [hint ? `${id}-hint` : "", e ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label} {req ? <span aria-hidden className="text-muted">*</span> : <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": !!e, "aria-describedby": desc, "aria-required": req || undefined })}
      {hint && !e && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {e && <p id={`${id}-err`} data-testid={`${p}-err-${k}`} className="flex items-start gap-1 text-xs text-danger"><AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />{e}</p>}
    </div>
  );
}

/**
 * One form for both "request a quote" (kind="quote") and "book a demo" (kind="demo"); both post to /api/quote.
 * Team size and credits are prefilled from the calculator until the person edits them.
 */
export function RequestForm({ kind, est, calc, onClose }: { kind: Kind; est: Estimate; calc: CalcState; onClose?: () => void }) {
  const p = kind === "demo" ? "demo" : "quote";
  const [v, setV] = useState<Values>(() => ({
    name: "", email: "", company: "", teamSize: String(est.seats), credits: String(est.expectedCredits), useCaseKind: "", useCaseOther: "", message: "", window: "",
    timezone: kind === "demo" ? (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { return ""; } })() : "", website: "",
  }));
  const [touched, setTouched] = useState({ teamSize: false, credits: false });
  // prefill from the calculator until edited (adjusting state during render, no effect needed)
  const [seen, setSeen] = useState({ s: est.seats, c: est.expectedCredits });
  if (seen.s !== est.seats || seen.c !== est.expectedCredits) {
    setSeen({ s: est.seats, c: est.expectedCredits });
    setV((x) => ({ ...x, teamSize: touched.teamSize ? x.teamSize : String(est.seats), credits: touched.credits ? x.credits : String(est.expectedCredits) }));
  }
  const [errs, setErrs] = useState<QuoteErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    if (k === "teamSize") setTouched((t) => ({ ...t, teamSize: true }));
    if (k === "credits") setTouched((t) => ({ ...t, credits: true }));
    const ek: keyof QuoteErrors | undefined = ({ credits: "expectedCredits", useCaseKind: "useCase" } as Record<string, keyof QuoteErrors>)[k] ?? (k as keyof QuoteErrors);
    if (errs[ek]) setErrs((x) => ({ ...x, [ek]: undefined }));
  };

  const payload = () => ({
    kind, name: v.name, email: v.email, company: v.company, teamSize: v.teamSize.trim(), expectedCredits: v.credits.trim(), useCaseKind: v.useCaseKind, useCaseOther: v.useCaseOther,
    message: v.message, billingCycle: calc.billing, config: { addons: calc.addons }, window: v.window, timezone: v.timezone, website: v.website,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const res0 = validateQuote(payload());
    const er: QuoteErrors = res0.ok ? {} : res0.errors;
    // the client-side form requires a use case for quotes
    if (kind === "quote" && !v.useCaseKind && !er.useCase) er.useCase = "Choose the use case that fits best.";
    setErrs(er);
    setFail(null);
    if (Object.keys(er).length) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setDone({ reference: j.reference, stored: j.stored === true, kind });
      else if (res.status === 400 && j.errors) {
        setErrs(j.errors);
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else if (res.status === 429) setFail(`Too many requests from this network. Please wait ${Math.ceil((j.retryAfter ?? 60) / 60)} minute(s) and try again.`);
      else setFail(typeof j.error === "string" ? j.error : "Something went wrong.");
    } catch {
      setFail("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div data-testid={`${p}-success`} data-stored={done.stored} role="status" className="rounded-2xl border border-accent bg-surface-2/60 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-lg font-semibold">
          {done.stored ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Info className="size-5 text-warn" aria-hidden />}
          {done.stored ? (done.kind === "demo" ? "Demo request saved" : "Quote request saved") : "Demo mode: this was not stored"}
        </p>
        <p className="mt-2 text-sm text-muted">
          Reference <span data-testid={`${p}-reference`} className="font-mono text-fg">{done.reference}</span>.{" "}
          {done.stored
            ? "We saved your request and configuration on the server. This demo does not send email and no calendar is connected, so nobody is notified automatically; a person would follow up from the saved request."
            : "No database is connected to this deployment, so your request was not saved, emailed or forwarded anywhere. The reference exists only for this session."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setDone(null); setV((s) => ({ ...s, message: "" })); }}>Send another</Button>
          {onClose && <Button variant="ghost" onClick={onClose}>Close</Button>}
        </div>
      </div>
    );

  const errList = FIELD_ORDER.filter((k) => errs[k]);
  const mailHint = v.email && /@/.test(v.email) && isFreeMail(v.email) ? "A work email helps us route your request. Personal addresses are accepted." : "We use it only to reply to this request.";
  const tid = (n: string) => `${p}-${n}`;

  return (
    <form onSubmit={submit} noValidate aria-label={kind === "demo" ? "Book a demo" : "Request a quote"} className="grid gap-4 sm:grid-cols-2" data-testid={`${p}-form`}>
      {errList.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" data-testid={tid("error-summary")} className="rounded-xl border border-danger-line bg-danger-bg p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent sm:col-span-2">
          <p className="font-semibold text-danger">Please fix {errList.length === 1 ? "1 field" : `${errList.length} fields`} before sending.</p>
          <ul className="mt-1 list-disc pl-5">
            {errList.map((k) => (
              <li key={k}>
                <a href={`#${fid(p, k === "expectedCredits" ? "credits" : k === "useCase" ? "useCaseKind" : k)}`} onClick={(ev) => { ev.preventDefault(); document.getElementById(fid(p, k === "expectedCredits" ? "credits" : k === "useCase" ? "useCaseKind" : k))?.focus(); }} className="underline">
                  {FIELD_LABEL[k]}: {errs[k]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field p={p} errs={errs} k="name" label="Full name" req>{(a) => <input {...a} data-testid={tid("name")} autoComplete="name" className={inputCls} value={v.name} onChange={set("name")} maxLength={LIMITS.name} />}</Field>
      <Field p={p} errs={errs} k="email" label="Work email" req hint={mailHint}>{(a) => <input {...a} data-testid={tid("email")} type="email" autoComplete="email" inputMode="email" className={inputCls} value={v.email} onChange={set("email")} maxLength={LIMITS.email} />}</Field>
      <Field p={p} errs={errs} k="company" label="Company or organisation" req>{(a) => <input {...a} data-testid={tid("company")} autoComplete="organization" className={inputCls} value={v.company} onChange={set("company")} maxLength={LIMITS.company} />}</Field>
      <Field p={p} errs={errs} k="teamSize" label="Team size (seats)" req={kind === "quote"} hint="Prefilled from the calculator; edit if needed.">{(a) => <input {...a} data-testid={tid("teamSize")} inputMode="numeric" className={inputCls} value={v.teamSize} onChange={set("teamSize")} />}</Field>
      {kind === "quote" ? (
        <>
          <Field p={p} errs={errs} k="credits" ek="expectedCredits" label="Expected monthly credits" hint="Prefilled from the calculator; edit if needed.">{(a) => <input {...a} data-testid={tid("credits")} inputMode="numeric" className={inputCls} value={v.credits} onChange={set("credits")} />}</Field>
          <Field p={p} errs={errs} k="useCaseKind" ek="useCase" label="Intended use case" req>
            {(a) => (
              <select {...a} data-testid={tid("useCase")} className={inputCls} value={v.useCaseKind} onChange={set("useCaseKind")}>
                <option value="">Choose one</option>
                {USE_CASES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            )}
          </Field>
          {v.useCaseKind === "other" && (
            <div className="sm:col-span-2">
              <Field p={p} errs={errs} k="useCaseOther" label="Tell us what you plan to build" req>{(a) => <input {...a} data-testid={tid("useCaseOther")} className={inputCls} value={v.useCaseOther} onChange={set("useCaseOther")} maxLength={LIMITS.other} />}</Field>
            </div>
          )}
        </>
      ) : (
        <>
          <Field p={p} errs={errs} k="window" label="Preferred time window" req hint="No calendar is connected: this is a preference, not a booking.">
            {(a) => (
              <select {...a} data-testid={tid("window")} className={inputCls} value={v.window} onChange={set("window")}>
                <option value="">Choose one</option>
                {DEMO_WINDOWS.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            )}
          </Field>
          <Field p={p} errs={errs} k="timezone" label="Time zone">{(a) => <input {...a} data-testid={tid("timezone")} className={inputCls} value={v.timezone} onChange={set("timezone")} maxLength={LIMITS.tz} placeholder="e.g. Europe/London" />}</Field>
        </>
      )}
      <div className="sm:col-span-2">
        <Field p={p} errs={errs} k="message" label="Message">
          {(a) => <textarea {...a} data-testid={tid("message")} rows={4} maxLength={LIMITS.message} className={`${inputCls} py-2`} value={v.message} onChange={set("message")} />}
        </Field>
        <p className="mt-1 text-right text-xs tabular-nums text-muted" data-testid={tid("counter")} aria-live="off">{formatNum(v.message.length)} / {formatNum(LIMITS.message)}</p>
      </div>
      {/* honeypot: hidden from people and assistive tech; bots fill it */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" name="website" data-testid={tid("website")} value={v.website} onChange={set("website")} /></label>
      </div>
      <div className="rounded-xl border border-line bg-surface-2/60 p-4 sm:col-span-2" data-testid={tid("config")}>
        <p className="mb-2 text-sm font-semibold">Your configuration <span className="font-normal text-muted">(sent with this request, indicative)</span></p>
        <ConfigList est={est} calc={calc} compact />
      </div>
      {fail && (
        <p role="alert" data-testid={tid("fail")} className="flex items-start gap-2 text-sm text-danger sm:col-span-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{fail}</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" data-testid={tid("submit")} disabled={busy} aria-busy={busy}>
          {busy ? "Sending..." : fail ? "Try again" : kind === "demo" ? "Send demo request" : "Request a quote"}
        </Button>
        {onClose && <Button variant="ghost" onClick={onClose}>Cancel</Button>}
        <p className="text-xs text-muted">
          {kind === "demo" ? "No calendar is connected; a person would reply to you. " : ""}This demo does not send email. If a database is connected the request is saved; otherwise it is not stored.
        </p>
      </div>
    </form>
  );
}
