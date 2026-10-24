import { getSessionUser, type SessionUser } from "./auth";
import { err, guard } from "./http";

/** Wraps a route handler that needs a signed-in user: DB check, CSRF check for mutations, session lookup. */
export async function authed(req: Request, mutating: boolean, fn: (u: SessionUser) => Promise<Response>): Promise<Response> {
  const g = guard(req, { mutating });
  if (g) return g;
  try {
    const u = await getSessionUser(req);
    if (!u) return err("Not signed in", 401);
    return await fn(u);
  } catch (e) {
    console.error("[api]", e);
    return err("Server error", 500);
  }
}
