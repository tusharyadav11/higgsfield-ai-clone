"use client";
import { useState, type FormEvent } from "react";
import { EMAIL_RE } from "@/lib/auth";
import { Button } from "@/components/ui";

const inputCls = "min-h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg outline-none focus:border-accent aria-[invalid=true]:border-red-500";

export function QuoteForm({ seats }: { seats: number }) {
  const [v, setV] = useState({ name: "", email: "", company: "", useCase: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (v.name.trim().length < 2) er.name = "Enter your name.";
    if (!EMAIL_RE.test(v.email.trim())) er.email = "Enter a valid work email.";
    if (!v.company.trim()) er.company = "Enter your company.";
    if (v.useCase.trim().length < 10) er.useCase = "Tell us a bit more (10+ characters).";
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    setFail(false);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, size: seats }),
      });
      const j = await res.json();
      if (res.ok) setRef(j.reference);
      else {
        if (j.errors) setErrs(j.errors);
        else setFail(true);
      }
    } catch {
      setFail(true);
    } finally {
      setBusy(false);
    }
  }

  if (ref)
    return (
      <div data-testid="quote-success" role="status" className="rounded-2xl border border-accent p-5">
        <p className="font-semibold">Request received</p>
        <p className="mt-1 text-sm text-muted">Reference <span className="font-mono text-fg">{ref}</span>. This is a demo: the request was logged on the server, not sent to a sales team. Email us directly if it is urgent.</p>
      </div>
    );

  const body = encodeURIComponent(`Name: ${v.name}\nCompany: ${v.company}\nSeats: ${seats}\nUse case: ${v.useCase}`);
  const field = (k: keyof typeof v, label: string, type = "text") => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input data-testid={`quote-${k}`} type={type} className={inputCls} value={v[k]} aria-invalid={!!errs[k]} onChange={set(k)} />
      {errs[k] && <span role="alert" className="text-xs text-red-400">{errs[k]}</span>}
    </label>
  );
  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      {field("name", "Name")}
      {field("email", "Work email", "email")}
      {field("company", "Company")}
      <label className="flex flex-col gap-1 text-sm">
        Team size
        <input readOnly value={`${seats}${seats >= 500 ? "+" : ""} seats`} className={inputCls} aria-label="Team size" />
      </label>
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        Use case
        <textarea data-testid="quote-useCase" rows={3} className={`${inputCls} py-2`} value={v.useCase} aria-invalid={!!errs.useCase} onChange={set("useCase")} />
        {errs.useCase && <span role="alert" className="text-xs text-red-400">{errs.useCase}</span>}
      </label>
      {fail && (
        <p role="alert" className="text-sm text-red-400 sm:col-span-2">
          Could not send. Email{" "}
          <a className="underline" href={`mailto:enterprise@kinetic.example?subject=${encodeURIComponent("Enterprise quote")}&body=${body}`}>enterprise@kinetic.example</a> instead.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="lg" data-testid="quote-submit" disabled={busy}>{busy ? "Sending..." : "Request a quote"}</Button>
        <a className="text-sm text-muted underline" href={`mailto:enterprise@kinetic.example?subject=${encodeURIComponent("Enterprise quote")}&body=${body}`}>or email us</a>
      </div>
    </form>
  );
}
