// DEMO security & settings. Nothing here is enforced or connected: there is no SSO/SAML backend,
// no domain-verification service and no data-retention job. Values are saved in this browser only.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isRole, type Role } from "./roles";
import type { PillStatus } from "@/components/enterprise/shared/StatusPill";

export const STORE_KEY = "kinetic-ws-security";

/* ---------------- organization profile ---------------- */

export const TIMEZONES = ["UTC", "America/Los_Angeles", "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Africa/Lagos", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"] as const;
export const DEFAULT_ROLES: Role[] = ["viewer", "editor", "admin"];
export const RETENTION = [
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "365", label: "1 year" },
  { id: "forever", label: "Keep until deleted" },
] as const;
export type RetentionId = (typeof RETENTION)[number]["id"];

export type OrgProfile = { name: string; slug: string; timezone: string; defaultRole: Role };
export const DEFAULT_ORG: OrgProfile = { name: "Acme Demo Studio", slug: "acme-demo", timezone: "UTC", defaultRole: "editor" };

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
export const logoInitial = (name: string) => (name.trim()[0] ?? "?").toUpperCase();

export type OrgErrors = Partial<Record<keyof OrgProfile, string>>;
export function validateOrg(o: OrgProfile): OrgErrors {
  const e: OrgErrors = {};
  const name = o.name.trim();
  if (name.length < 2) e.name = "Organization name must be at least 2 characters.";
  else if (name.length > 60) e.name = "Organization name must be 60 characters or fewer.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.slug) || o.slug.length < 3 || o.slug.length > 40) e.slug = "Slug: 3 to 40 characters, lowercase letters, numbers and single dashes.";
  if (!(TIMEZONES as readonly string[]).includes(o.timezone)) e.timezone = "Choose a time zone from the list.";
  if (!isRole(o.defaultRole) || o.defaultRole === "owner") e.defaultRole = "Default role can be Viewer, Editor or Admin.";
  return e;
}

/* ---------------- SSO (form validation only) ---------------- */

export type SsoProtocol = "saml" | "oidc";
export type SsoForm = {
  protocol: SsoProtocol;
  metadataUrl: string;
  entityId: string;
  issuer: string;
  clientId: string;
  certificate: string;
  attrEmail: string;
  attrName: string;
  attrGroups: string;
};
export const DEFAULT_SSO: SsoForm = { protocol: "saml", metadataUrl: "", entityId: "", issuer: "", clientId: "", certificate: "", attrEmail: "email", attrName: "name", attrGroups: "groups" };
export const SSO_LOCAL_ONLY = "Validated locally only. SSO requires a backend identity-provider integration that is not connected.";

export const isHttpsUrl = (v: string) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && !!u.hostname.includes(".") && !u.username && !u.password;
  } catch {
    return false;
  }
};

export type SsoErrors = Partial<Record<keyof SsoForm, string>>;
export function validateSso(f: SsoForm): SsoErrors {
  const e: SsoErrors = {};
  if (f.protocol === "saml") {
    if (!isHttpsUrl(f.metadataUrl)) e.metadataUrl = "Enter the IdP metadata URL (must be https).";
    if (!f.entityId.trim()) e.entityId = "Entity ID is required.";
    else if (f.entityId.length > 255) e.entityId = "Entity ID must be 255 characters or fewer.";
    const c = f.certificate.trim();
    if (!c) e.certificate = "Paste the IdP signing certificate (PEM).";
    else if (!/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(c)) e.certificate = "Certificate must be PEM: -----BEGIN CERTIFICATE----- … -----END CERTIFICATE-----.";
  } else {
    if (!isHttpsUrl(f.issuer)) e.issuer = "Issuer URL is required and must be https.";
    if (!f.clientId.trim()) e.clientId = "Client ID is required.";
  }
  for (const k of ["attrEmail", "attrName", "attrGroups"] as const) {
    if (!/^[\w.:/\-@]{1,100}$/.test(f[k].trim())) e[k] = "Use a claim/attribute name (letters, numbers, . : / - _ @).";
  }
  return e;
}

/* ---------------- domain verification (deterministic demo token) ---------------- */

/** cyrb53: small deterministic string hash (not cryptographic; the token is a demo placeholder). */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const hex = (n: number) => n.toString(16).padStart(14, "0");

export const normalizeDomain = (d: string) => d.trim().toLowerCase().replace(/\.$/, "");
export function validateDomain(raw: string, existing: string[] = []): string | null {
  const d = normalizeDomain(raw);
  if (!d) return "Enter a domain, for example example.com.";
  if (/[/:@\s]/.test(d)) return "Enter the bare domain without https://, paths or spaces.";
  if (d.length > 253 || !/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return "That does not look like a valid domain.";
  if (existing.includes(d)) return "This domain is already in the list.";
  return null;
}

export const domainToken = (domain: string, orgSlug: string) => {
  const key = `${orgSlug}|${normalizeDomain(domain)}`;
  return hex(cyrb53(key, 1)) + hex(cyrb53(key, 2));
};
export const dnsRecordFor = (domain: string, orgSlug: string) => ({
  type: "TXT" as const,
  host: `_kinetic-verify.${normalizeDomain(domain)}`,
  value: `kinetic-verify=${domainToken(domain, orgSlug)}`,
});

/* ---------------- security checklist ---------------- */

export type CheckItem = { id: string; name: string; status: PillStatus; detail: string; action: { label: string; href?: string; note?: string } };
export const SECURITY_CHECKLIST: CheckItem[] = [
  { id: "2fa", name: "Two-factor authentication", status: "not-available", detail: "Accounts use a password only. There is no authenticator-app or passkey support yet.", action: { label: "Review your account", href: "/settings" } },
  { id: "sso", name: "Single sign-on (SAML / OIDC)", status: "needs-integration", detail: "The form above validates fields locally. No identity-provider integration is connected.", action: { label: "Open SSO configuration", href: "#sso" } },
  { id: "scim", name: "SCIM user provisioning", status: "needs-integration", detail: "Requires a SCIM endpoint and an identity provider. Neither exists in this build.", action: { label: "Request via enterprise quote", href: "/enterprise#quote" } },
  { id: "ip", name: "IP allowlist", status: "not-available", detail: "Access is not restricted by network address. Needs an edge/proxy policy layer.", action: { label: "Request via enterprise quote", href: "/enterprise#quote" } },
  { id: "export", name: "Audit-log export", status: "demo", detail: "You can export the local demo log as CSV. It is not a tamper-proof compliance export.", action: { label: "Go to audit log", href: "#audit" } },
  { id: "residency", name: "Data residency", status: "not-configured", detail: "No region selection exists; data location is whatever the deployment uses.", action: { label: "Request via enterprise quote", href: "/enterprise#quote" } },
  { id: "sessions", name: "Session management", status: "active", detail: "Real: you can list and revoke your own sign-in sessions (needs a signed-in account).", action: { label: "Manage sessions", href: "#sessions" } },
];

/* ---------------- store ---------------- */

export type Domain = { domain: string; addedAt: string; lastCheckedAt?: string };
type State = {
  org: OrgProfile;
  retention: RetentionId;
  sso: SsoForm;
  ssoSavedAt: string | null;
  domains: Domain[];
  setOrg: (o: OrgProfile) => void;
  setRetention: (r: RetentionId) => void;
  setSso: (s: SsoForm, savedAt: string) => void;
  addDomain: (d: string, at: string) => string | null;
  removeDomain: (d: string) => void;
  markChecked: (d: string, at: string) => void;
};

export const useSecurity = create<State>()(
  persist(
    (set, get) => ({
      org: DEFAULT_ORG,
      retention: "365",
      sso: DEFAULT_SSO,
      ssoSavedAt: null,
      domains: [],
      setOrg: (org) => set({ org: { ...org, name: org.name.trim() } }),
      setRetention: (retention) => set({ retention }),
      setSso: (sso, ssoSavedAt) => set({ sso, ssoSavedAt }),
      addDomain: (raw, at) => {
        const err = validateDomain(raw, get().domains.map((d) => d.domain));
        if (err) return err;
        set((s) => ({ domains: [...s.domains, { domain: normalizeDomain(raw), addedAt: at }] }));
        return null;
      },
      removeDomain: (d) => set((s) => ({ domains: s.domains.filter((x) => x.domain !== d) })),
      markChecked: (d, at) => set((s) => ({ domains: s.domains.map((x) => (x.domain === d ? { ...x, lastCheckedAt: at } : x)) })),
    }),
    { name: STORE_KEY, version: 1, skipHydration: true, partialize: ({ org, retention, sso, ssoSavedAt, domains }) => ({ org, retention, sso, ssoSavedAt, domains }) },
  ),
);
