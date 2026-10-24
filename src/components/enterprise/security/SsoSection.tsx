"use client";
import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/components/ui/Toast";
import { StatusPill } from "../shared/StatusPill";
import { Section } from "../shared/Section";
import { useOrigin } from "../shared/LocalTime";
import { errCls, fieldCls, hintCls, labelCls, textareaCls } from "../shared/ui";
import { recordActing } from "@/lib/enterprise/audit";
import { SSO_LOCAL_ONLY, useSecurity, validateSso, type SsoErrors, type SsoForm } from "@/lib/enterprise/security";

export function SsoSection() {
  const saved = useSecurity((s) => s.sso);
  const savedAt = useSecurity((s) => s.ssoSavedAt);
  const setSso = useSecurity((s) => s.setSso);
  const [f, setF] = useState<SsoForm>(saved);
  const [errors, setErrors] = useState<SsoErrors>({});
  const [result, setResult] = useState<"ok" | "bad" | null>(null);
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);

  const acs = `${origin || "https://your-domain.example"}/api/sso/acs`;
  const set = <K extends keyof SsoForm>(k: K, v: SsoForm[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    setResult(null);
  };
  const saml = f.protocol === "saml";

  const test = () => {
    const e = validateSso(f);
    setErrors(e);
    setResult(Object.keys(e).length ? "bad" : "ok");
  };

  return (
    <Section
      id="sso"
      title="SSO configuration (SAML / OIDC)"
      pills={<StatusPill status="needs-integration" />}
      description="Single sign-on is not active. Kinetic has no identity-provider backend; this form only lets you rehearse the setup and validates the fields in your browser."
    >
      <div role="note" className="mb-4 flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <p>Nobody can sign in with SSO today. Saving stores these values in this browser only; they are not sent to any identity provider.</p>
      </div>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSso(f, new Date().toISOString());
          recordActing({ action: "sso.settings_saved_demo", target: f.protocol.toUpperCase(), detail: "saved locally, not applied" });
          showToast("Saved in this demo workspace — not applied to a real identity provider.");
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <fieldset className="sm:col-span-2">
          <legend className={labelCls}>Protocol</legend>
          <div className="flex gap-2">
            {(["saml", "oidc"] as const).map((p) => (
              <label key={p} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${f.protocol === p ? "border-accent bg-accent font-semibold text-accent-fg" : "border-line text-muted hover:text-fg"} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent`}>
                <input type="radio" name="sso-protocol" className="sr-only" checked={f.protocol === p} onChange={() => { set("protocol", p); setErrors({}); }} data-testid={`sso-${p}`} />
                {p === "saml" ? "SAML 2.0" : "OpenID Connect"}
              </label>
            ))}
          </div>
        </fieldset>
        {saml ? (
          <>
            <div className="sm:col-span-2">
              <label htmlFor="sso-meta" className={labelCls}>IdP metadata URL</label>
              <input id="sso-meta" data-testid="sso-meta" inputMode="url" value={f.metadataUrl} onChange={(e) => set("metadataUrl", e.target.value)} aria-invalid={!!errors.metadataUrl} placeholder="https://idp.example.com/metadata.xml" className={fieldCls} />
              {errors.metadataUrl && <p role="alert" className={errCls}>{errors.metadataUrl}</p>}
            </div>
            <div>
              <label htmlFor="sso-entity" className={labelCls}>IdP entity ID</label>
              <input id="sso-entity" data-testid="sso-entity" value={f.entityId} onChange={(e) => set("entityId", e.target.value)} aria-invalid={!!errors.entityId} className={fieldCls} />
              {errors.entityId && <p role="alert" className={errCls}>{errors.entityId}</p>}
            </div>
            <div>
              <span id="acs-l" className={labelCls}>ACS URL (placeholder)</span>
              <div className="flex gap-2">
                <code aria-labelledby="acs-l" data-testid="sso-acs" className="min-h-11 min-w-0 flex-1 break-all rounded-xl border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs">{acs}</code>
                <Button variant="secondary" size="icon" aria-label="Copy ACS URL" onClick={async () => { try { await navigator.clipboard.writeText(acs); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { showToast("Copy failed. Select the text manually."); } }}>
                  {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                </Button>
              </div>
              <p className={hintCls}>No endpoint exists at this address yet; it shows the shape you would register with your IdP.</p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="sso-cert" className={labelCls}>IdP signing certificate (PEM)</label>
              <textarea id="sso-cert" data-testid="sso-cert" rows={4} spellCheck={false} value={f.certificate} onChange={(e) => set("certificate", e.target.value)} aria-invalid={!!errors.certificate} placeholder={"-----BEGIN CERTIFICATE-----\n…\n-----END CERTIFICATE-----"} className={`${textareaCls} font-mono text-xs`} />
              {errors.certificate && <p role="alert" className={errCls}>{errors.certificate}</p>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="sso-issuer" className={labelCls}>Issuer URL</label>
              <input id="sso-issuer" data-testid="sso-issuer" inputMode="url" value={f.issuer} onChange={(e) => set("issuer", e.target.value)} aria-invalid={!!errors.issuer} placeholder="https://login.example.com" className={fieldCls} />
              {errors.issuer && <p role="alert" className={errCls}>{errors.issuer}</p>}
            </div>
            <div>
              <label htmlFor="sso-client" className={labelCls}>Client ID</label>
              <input id="sso-client" data-testid="sso-client" value={f.clientId} onChange={(e) => set("clientId", e.target.value)} aria-invalid={!!errors.clientId} className={fieldCls} />
              {errors.clientId && <p role="alert" className={errCls}>{errors.clientId}</p>}
            </div>
          </>
        )}
        <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
          <legend className={`${labelCls} sm:col-span-3`}>Attribute mapping</legend>
          {([["attrEmail", "Email"], ["attrName", "Name"], ["attrGroups", "Groups"]] as const).map(([k, label]) => (
            <div key={k}>
              <label htmlFor={`sso-${k}`} className="mb-1 block text-xs text-muted">{label} attribute</label>
              <input id={`sso-${k}`} value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={!!errors[k]} className={`${fieldCls} font-mono`} />
              {errors[k] && <p role="alert" className={errCls}>{errors[k]}</p>}
            </div>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <Button type="button" variant="secondary" data-testid="sso-test" onClick={test}>Test connection</Button>
          <Button type="submit" data-testid="sso-save">Save draft locally</Button>
          {savedAt && <span className="text-xs text-muted">Draft saved locally. Not applied.</span>}
        </div>
        {result && (
          <div role="status" data-testid="sso-result" data-result={result} className="rounded-xl border border-line bg-surface-2 p-3 text-sm sm:col-span-2">
            <p className="font-medium">{result === "ok" ? "Form fields look valid." : "Some fields need attention (see above)."}</p>
            <p className="mt-0.5 text-muted">{SSO_LOCAL_ONLY}</p>
          </div>
        )}
      </form>
    </Section>
  );
}
