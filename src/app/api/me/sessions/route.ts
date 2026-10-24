import { err, json } from "@/server/http";
import { authed } from "@/server/route";
import { currentTokenHash, listSessions, revokeOtherSessions } from "@/server/sessions";

/** GET /api/me/sessions: the signed-in user's live sessions. Never returns token hashes or cookies. */
export const GET = (req: Request) => {
  // touch request data outside authed()'s try/catch so Next sees this route as dynamic (cacheComponents)
  req.headers.get("cookie");
  return authed(req, false, async (u) => json({ sessions: await listSessions(u.id, currentTokenHash(req)) }));
};

/** DELETE /api/me/sessions: sign out every OTHER session (the current one stays). */
export const DELETE = (req: Request) =>
  authed(req, true, async (u) => {
    const cur = currentTokenHash(req);
    if (!cur) return err("Not signed in", 401);
    return json({ ok: true, revoked: await revokeOtherSessions(u.id, cur) });
  });
