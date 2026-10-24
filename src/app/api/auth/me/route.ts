import { hasDb } from "@/db";
import { getSessionUser, publicUser, readCookie } from "@/server/auth";
import { json } from "@/server/http";

/** Always 200 so the client can probe cheaply without console noise. */
export async function GET(req: Request) {
  if (!hasDb()) return json({ db: false, user: null });
  if (!readCookie(req)) return json({ db: true, user: null });
  try {
    const u = await getSessionUser(req);
    return json({ db: true, user: u ? publicUser(u) : null });
  } catch (e) {
    console.error("[auth/me]", e);
    return json({ db: true, user: null }, 200);
  }
}
