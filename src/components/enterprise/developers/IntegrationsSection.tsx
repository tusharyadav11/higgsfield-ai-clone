"use client";
import { useState } from "react";
import Link from "next/link";
import { Plug, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { Modal } from "../shared/Modal";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { errCls, fieldCls, hintCls, labelCls, textareaCls } from "../shared/ui";
import { INTEGRATIONS, NOTE_MAX, useInterest, validateInterest, type Integration } from "@/lib/enterprise/integrations";
import { recordActing } from "@/lib/enterprise/audit";

export function IntegrationsSection() {
  const interests = useInterest((s) => s.interests);
  const add = useInterest((s) => s.add);
  const [target, setTarget] = useState<Integration | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [errs, setErrs] = useState<{ note?: string; email?: string }>({});
  const asked = new Set(interests.map((i) => i.integration));

  const close = () => { setTarget(null); setNote(""); setEmail(""); setErrs({}); };

  return (
    <Section id="integrations" title="Integrations" description="Only the MCP integrations work today. Everything else is not built yet; requesting one records your interest in this browser only (no email is sent).">
      <ul data-testid="integration-grid" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
        {INTEGRATIONS.map((i) => (
          <li key={i.id} data-testid={`integration-${i.id}`} className="flex min-w-0 flex-col rounded-xl border border-line p-3">
            <div className="flex items-start gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent-text">{i.href ? <Plug className="size-4" aria-hidden /> : <Puzzle className="size-4" aria-hidden />}</span>
              <h3 className="min-w-0 flex-1 break-words font-semibold leading-snug">{i.name}</h3>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted">{i.blurb}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill status={i.status} label={i.statusLabel} />
              {i.href ? (
                <Link href={i.href} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:border-accent">{i.cta}</Link>
              ) : asked.has(i.id) ? (
                <span data-testid="interest-recorded" className="text-xs text-muted">Interest recorded locally</span>
              ) : (
                <Button variant="secondary" data-testid="request-integration" aria-label={`Request ${i.name} integration`} onClick={() => setTarget(i)}>Request this integration</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Modal
        open={!!target}
        onClose={close}
        title={`Request ${target?.name ?? ""} integration`}
        description="Saved in this browser only. Nothing is emailed or sent to a server."
        testId="interest-dialog"
        footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" form="interest-form" data-testid="interest-submit">Save my interest</Button></>}
      >
        <form
          id="interest-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            const v = validateInterest(note, email);
            setErrs(v);
            if (v.note || v.email) return;
            add({ integration: target.id, note: note.trim(), email: email.trim(), at: new Date().toISOString() });
            recordActing({ action: "integration.interest_recorded", target: target.name, detail: "local only" });
            showToast(`Interest in ${target.name} saved locally.`);
            close();
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="int-note" className={labelCls}>What would you use it for? <span className="font-normal text-muted">(optional)</span></label>
            <textarea id="int-note" data-autofocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={textareaCls} />
            <p className={hintCls}>{note.trim().length}/{NOTE_MAX}</p>
            {errs.note && <p role="alert" className={errCls}>{errs.note}</p>}
          </div>
          <div>
            <label htmlFor="int-email" className={labelCls}>Contact email <span className="font-normal text-muted">(optional)</span></label>
            <input id="int-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
            {errs.email && <p role="alert" className={errCls}>{errs.email}</p>}
          </div>
        </form>
      </Modal>
    </Section>
  );
}
