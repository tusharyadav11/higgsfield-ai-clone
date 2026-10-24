"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Palette } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { errCls, fieldCls, hintCls, labelCls, linkCls } from "../shared/ui";
import { useStoreReady } from "@/lib/enterprise/persist";
import { recordActing } from "@/lib/enterprise/audit";
import { ACTIONS, ROLES, ROLE_BLURB, ROLE_LABEL, can, isRole } from "@/lib/enterprise/roles";
import { DEFAULT_ORG, DEFAULT_ROLES, RETENTION, SECURITY_CHECKLIST, TIMEZONES, logoInitial, slugify, useSecurity, validateOrg, type OrgErrors, type OrgProfile, type RetentionId } from "@/lib/enterprise/security";
import { canApprove } from "@/lib/enterprise/projects-store";
import { AuditSection } from "./AuditSection";
import { DomainSection } from "./DomainSection";
import { SessionsSection } from "./SessionsSection";
import { SsoSection } from "./SsoSection";

const NAV = [
  ["org", "Organization"],
  ["workspace", "Workspace"],
  ["rbac", "Access"],
  ["sso", "SSO"],
  ["audit", "Audit log"],
  ["sessions", "Sessions"],
  ["domains", "Domains"],
  ["status", "Checklist"],
] as const;

export function SecurityView() {
  const ready = useStoreReady(useSecurity);
  const [active, setActive] = useState<string>("org");

  useEffect(() => {
    if (!ready) return;
    const els = NAV.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActive(vis.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ready]);

  if (!ready) return <div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-surface-2" />;

  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6">
      <nav aria-label="Security sections" className="sticky top-[7.1rem] z-10 -mx-3 mb-4 border-b border-line bg-bg/85 px-3 backdrop-blur-xl sm:-mx-5 sm:px-5 lg:top-32 lg:mx-0 lg:mb-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <ul data-testid="security-nav" className="scrollbar-none flex gap-1 overflow-x-auto py-1.5 lg:flex-col lg:overflow-visible">
          {NAV.map(([id, label]) => (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                aria-current={active === id ? "location" : undefined}
                onClick={() => setActive(id)}
                className={`flex min-h-11 items-center rounded-full px-4 text-sm lg:rounded-xl ${active === id ? "bg-surface-2 font-semibold text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 space-y-5">
        <OrgSection />
        <WorkspaceSection />
        <RbacSection />
        <SsoSection />
        <AuditSection />
        <SessionsSection />
        <DomainSection />
        <StatusSection />
      </div>
    </div>
  );
}

/* ---------------- organization profile ---------------- */

function OrgSection() {
  const saved = useSecurity((s) => s.org);
  const setOrg = useSecurity((s) => s.setOrg);
  const [f, setF] = useState<OrgProfile>(saved);
  const [slugTouched, setSlugTouched] = useState(saved.slug !== slugify(saved.name) && saved.slug !== DEFAULT_ORG.slug);
  const [errors, setErrors] = useState<OrgErrors>({});
  const [done, setDone] = useState(false);

  const set = <K extends keyof OrgProfile>(k: K, v: OrgProfile[K]) => {
    setDone(false);
    setF((p) => ({ ...p, [k]: v, ...(k === "name" && !slugTouched ? { slug: slugify(String(v)) } : {}) }));
  };
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);

  return (
    <Section id="org" title="Organization profile" pills={<StatusPill status="demo" label="Saved locally" />} description="Your organization's identity inside this demo workspace. Saved in this browser only.">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const errs = validateOrg(f);
          setErrors(errs);
          if (Object.keys(errs).length) return;
          setOrg(f);
          recordActing({ action: "org.profile_updated", target: f.name.trim(), detail: `slug ${f.slug}, ${f.timezone}, default role ${f.defaultRole}` });
          setDone(true);
          showToast("Organization profile saved in this demo workspace.");
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <div className="flex items-center gap-3 sm:col-span-2">
          <span data-testid="org-logo" aria-hidden className="grid size-14 place-items-center rounded-2xl bg-accent text-2xl font-bold text-accent-fg">{logoInitial(f.name)}</span>
          <p className="text-sm text-muted">The logo is the first letter of your organization name. Image upload is not available in this demo.</p>
        </div>
        <div>
          <label htmlFor="org-name" className={labelCls}>Organization name</label>
          <input id="org-name" data-testid="org-name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} className={fieldCls} />
          {errors.name && <p role="alert" className={errCls}>{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="org-slug" className={labelCls}>URL slug</label>
          <input id="org-slug" data-testid="org-slug" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase()); }} aria-invalid={!!errors.slug} className={`${fieldCls} font-mono`} />
          {errors.slug ? <p role="alert" className={errCls}>{errors.slug}</p> : <p className={hintCls}>Used in the demo domain-verification record. No public URL is created.</p>}
        </div>
        <div>
          <label htmlFor="org-tz" className={labelCls}>Time zone</label>
          <select id="org-tz" value={f.timezone} onChange={(e) => set("timezone", e.target.value)} className={fieldCls}>
            {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
          </select>
          {errors.timezone && <p role="alert" className={errCls}>{errors.timezone}</p>}
        </div>
        <div>
          <label htmlFor="org-role" className={labelCls}>Default role for new members</label>
          <select id="org-role" data-testid="org-role" value={f.defaultRole} onChange={(e) => isRole(e.target.value) && set("defaultRole", e.target.value)} className={fieldCls}>
            {DEFAULT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          {errors.defaultRole ? <p role="alert" className={errCls}>{errors.defaultRole}</p> : <p className={hintCls}>{ROLE_BLURB[f.defaultRole]}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" data-testid="org-save" disabled={!dirty && !done}>Save profile</Button>
          {!dirty && !done && <span className="text-xs text-muted">No unsaved changes.</span>}
          {done && <span role="status" data-testid="org-saved" className="inline-flex items-center gap-1 text-sm text-success"><Check className="size-4" aria-hidden /> Saved in this demo workspace (browser only).</span>}
        </div>
      </form>
    </Section>
  );
}

/* ---------------- workspace settings ---------------- */

function WorkspaceSection() {
  const retention = useSecurity((s) => s.retention);
  const setRetention = useSecurity((s) => s.setRetention);
  return (
    <Section id="workspace" title="Workspace settings" pills={<StatusPill status="demo" label="Saved locally" />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Palette className="size-4" aria-hidden /> Default accent and theme</h3>
          <p className="mt-1 text-sm text-muted">Accent colour and light/dark mode are personal preferences that apply instantly. Change them in Settings.</p>
          <Link href="/settings" data-testid="goto-settings" className={`${linkCls} mt-2 inline-flex min-h-11 items-center gap-1 text-sm`}>Open Settings <ExternalLink className="size-3.5" aria-hidden /></Link>
        </div>
        <div className="rounded-xl border border-line p-3">
          <label htmlFor="retention" className={labelCls}>Data retention</label>
          <select
            id="retention"
            data-testid="retention"
            value={retention}
            onChange={(e) => {
              const v = e.target.value as RetentionId;
              setRetention(v);
              recordActing({ action: "workspace.retention_changed", target: "Data retention", detail: RETENTION.find((r) => r.id === v)?.label });
              showToast("Retention preference saved locally. It is not enforced in this demo.");
            }}
            className={fieldCls}
          >
            {RETENTION.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <p className="mt-1.5 text-xs text-muted" data-testid="retention-note"><StatusPill status="not-configured" label="Not enforced in demo" className="mr-1" /> Nothing is deleted automatically; there is no retention job.</p>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- RBAC matrix ---------------- */

function RbacSection() {
  const rows = [...ACTIONS.map((a) => ({ id: a.id as string, label: a.label, allowed: (r: (typeof ROLES)[number]) => can(r, a.id) })), { id: "approve_projects", label: "Approve or reject project reviews", allowed: canApprove }];
  return (
    <Section id="rbac" title="Role-based access" pills={<StatusPill status="demo" label="Enforced in this UI only" />} description="Permissions as the workspace screens apply them. The same rules drive the Team, Projects and Billing pages; they are not enforced by a server.">
      <div className="-mx-1 overflow-x-auto px-1">
        <table data-testid="rbac-matrix" className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="sr-only">Permission matrix by role</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Permission</th>
              {ROLES.map((r) => <th key={r} scope="col" className="px-2 py-2 text-center font-medium">{ROLE_LABEL[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/60 last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-normal">{row.label}</th>
                {ROLES.map((r) => {
                  const ok = row.allowed(r);
                  return (
                    <td key={r} className="px-2 py-2 text-center" data-testid={`rbac-${row.id}-${r}`} data-allowed={ok}>
                      {ok ? <Check className="mx-auto size-4 text-success" aria-label="Allowed" /> : <span className="text-muted" aria-label="Not allowed">–</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Change who you act as on the Team or Projects page to see the screens react.</p>
    </Section>
  );
}

/* ---------------- checklist ---------------- */

function StatusSection() {
  return (
    <Section id="status" title="Security configuration status" description="An honest view of what is and is not available. Only “Active” items genuinely work.">
      <ul data-testid="security-checklist" className="divide-y divide-line">
        {SECURITY_CHECKLIST.map((c) => (
          <li key={c.id} data-testid={`check-${c.id}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-3">
            <div className="min-w-0 flex-1 basis-56">
              <p className="font-medium">{c.name}</p>
              <p className="mt-0.5 text-sm text-muted">{c.detail}</p>
            </div>
            <StatusPill status={c.status} />
            {c.action.href?.startsWith("#") ? (
              <a href={c.action.href} className={`${linkCls} inline-flex min-h-11 items-center text-sm`}>{c.action.label}</a>
            ) : (
              <Link href={c.action.href ?? "#"} className={`${linkCls} inline-flex min-h-11 items-center text-sm`}>{c.action.label}</Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
