import { hasDb } from "@/db";

const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

export const err = (error: string, status = 400, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

export const noDb = () => err("Accounts are not enabled on this deployment (no database). Running in local demo mode.", 503, { demo: true });

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * CSRF defence for cookie-authenticated mutations (on top of SameSite=Lax):
 * a present Origin must match the host we were addressed as; with no Origin, a browser-set
 * Sec-Fetch-Site of cross-site is refused. Non-browser clients (curl, tests) send neither.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return false;
    }
    const want = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
    return host === want;
  }
  const site = req.headers.get("sec-fetch-site");
  return !site || site === "same-origin" || site === "none";
}

/** Returns an error Response when the request must not proceed, else null. */
export function guard(req: Request, opts: { mutating?: boolean } = {}): Response | null {
  if (!hasDb()) return noDb();
  if (opts.mutating && !sameOrigin(req)) return err("Cross-origin request blocked", 403);
  return null;
}
