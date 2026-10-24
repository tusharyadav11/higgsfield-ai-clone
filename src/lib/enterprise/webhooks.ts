// DEMO webhooks. Endpoints are configuration only: no events are delivered and no secret is
// registered with any server. Signing uses WebCrypto in the browser so the payload/signature
// shape can be inspected honestly.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const STORE_KEY = "kinetic-ws-webhooks";
export const MAX_ENDPOINTS = 5;

export const WEBHOOK_EVENTS = [
  { id: "generation.completed", label: "Generation completed" },
  { id: "generation.failed", label: "Generation failed" },
  { id: "credits.low", label: "Credit pool running low" },
  { id: "project.approved", label: "Project approved" },
  { id: "member.invited", label: "Member invited" },
  { id: "api_key.created", label: "API key created" },
  { id: "api_key.revoked", label: "API key revoked" },
] as const;
export type WebhookEventId = (typeof WEBHOOK_EVENTS)[number]["id"];
export const isEventId = (v: string): v is WebhookEventId => WEBHOOK_EVENTS.some((e) => e.id === v);

/** https only, no credentials, a real-looking public hostname (no localhost / private literals). */
export function validateEndpoint(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Enter an endpoint URL.";
  if (v.length > 500) return "URL is too long (500 characters max).";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "That is not a valid URL.";
  }
  if (u.protocol !== "https:") return "Endpoints must use https://.";
  if (u.username || u.password) return "Do not put credentials in the URL.";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || (!h.includes(".") && !h.includes(":"))) return "Use a public hostname (localhost and internal names are not allowed).";
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h === "[::1]") return "Private and loopback addresses are not allowed.";
  return null;
}

const hexOf = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b as ArrayBuffer), (x) => x.toString(16).padStart(2, "0")).join("");

/** whsec_ + 32 random bytes (base64url). Generated in the browser; shown once; never stored. */
export function generateSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return "whsec_" + btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
/** Safe-to-persist preview: prefix and last 4 characters only. */
export const secretPreview = (secret: string) => `${secret.slice(0, 10)}…${secret.slice(-4)}`;

export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hexOf(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Stripe-style header: signed string is `${timestamp}.${body}`. */
export async function signPayload(secret: string, timestampSec: number, body: string) {
  const v1 = await hmacHex(secret, `${timestampSec}.${body}`);
  return { header: `t=${timestampSec},v1=${v1}`, v1 };
}

export async function verifySignature(secret: string, header: string, body: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header);
  if (!m) return false;
  if (Math.abs(nowSec - Number(m[1])) > toleranceSec) return false;
  const want = await hmacHex(secret, `${m[1]}.${body}`);
  let diff = want.length ^ m[2].length;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (m[2].charCodeAt(i) || 0);
  return diff === 0;
}

export function buildTestEvent(type: WebhookEventId, nowSec: number, seq = 1) {
  const data: Record<WebhookEventId, Record<string, unknown>> = {
    "generation.completed": { id: "gen_demo_0001", kind: "image", model: "sample-model", credits: 3 },
    "generation.failed": { id: "gen_demo_0002", kind: "video", reason: "sample_failure", refunded: true },
    "credits.low": { pool_remaining_pct: 12 },
    "project.approved": { project_id: "p-launch", approved_by: "Noah Okafor" },
    "member.invited": { email: "new.person@acme-demo.example", role: "editor" },
    "api_key.created": { prefix: "kn_demo000" },
    "api_key.revoked": { prefix: "kn_demo000" },
  };
  return { id: `evt_demo_${seq.toString().padStart(4, "0")}`, type, created: nowSec, livemode: false, demo: true, data: { object: data[type] } };
}

export type Endpoint = { id: string; url: string; events: WebhookEventId[]; createdAt: string; secretPreview: string };
type State = {
  endpoints: Endpoint[];
  add: (e: Endpoint) => void;
  remove: (id: string) => void;
};
export const useWebhooks = create<State>()(
  persist(
    (set) => ({
      endpoints: [],
      add: (e) => set((s) => ({ endpoints: [...s.endpoints, e].slice(0, MAX_ENDPOINTS) })),
      remove: (id) => set((s) => ({ endpoints: s.endpoints.filter((x) => x.id !== id) })),
    }),
    { name: STORE_KEY, version: 1, skipHydration: true, partialize: ({ endpoints }) => ({ endpoints }) },
  ),
);

/** Secrets generated this page-visit, kept in memory only (never persisted) so test events can be signed. */
export const sessionSecrets = new Map<string, string>();
