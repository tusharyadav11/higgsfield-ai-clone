import { err, json } from "@/server/http";
import { authed } from "@/server/route";
import { SESSION_ID_RE, currentTokenHash, revokeSession } from "@/server/sessions";

/** DELETE /api/me/sessions/:id: revoke another session of the signed-in user. The current session ends via logout only. */
export const DELETE = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  authed(req, true, async (u) => {
    const { id } = await ctx.params;
    if (!SESSION_ID_RE.test(id)) return err("Not found", 404);
    const r = await revokeSession(u.id, id, currentTokenHash(req));
    if (r === "current") return err("This is your current session. Use Log out to end it.", 400);
    return r === "ok" ? json({ ok: true }) : err("Not found", 404);
  });
