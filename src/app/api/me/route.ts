import { hasDb } from "@/db";
import { getSessionUser, publicUser, readCookie } from "@/server/auth";
import { loadState } from "@/server/credits";
import { err, json } from "@/server/http";

/** Full server-side state for the signed-in user. 200 {user:null} when there is no session. */
export async function GET(req: Request) {
  if (!hasDb()) return json({ db: false, user: null });
  if (!readCookie(req)) return json({ db: true, user: null });
  try {
    const u = await getSessionUser(req);
    if (!u) return json({ db: true, user: null });
    return json({ db: true, user: publicUser(u), ...(await loadState(u.id)) });
  } catch (e) {
    console.error("[me]", e);
    return err("Server error", 500);
  }
}
