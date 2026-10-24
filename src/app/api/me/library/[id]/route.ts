import { deleteGeneration } from "@/server/credits";
import { err, json } from "@/server/http";
import { authed } from "@/server/route";

export const DELETE = (req: Request, ctx: { params: Promise<{ id: string }> }) =>
  authed(req, true, async (u) => {
    const { id } = await ctx.params;
    // another user's id is indistinguishable from a missing one
    return (await deleteGeneration(u.id, id)) ? json({ ok: true }) : err("Not found", 404);
  });
