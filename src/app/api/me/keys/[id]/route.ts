import { revokeKey } from "@/server/keys";
import { err, json } from "@/server/http";
import { authed } from "@/server/route";

export const DELETE = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  authed(req, true, async (u) => {
    const { id } = await ctx.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return err("Not found", 404);
    return (await revokeKey(u.id, id)) ? json({ ok: true }) : err("Not found", 404);
  });
