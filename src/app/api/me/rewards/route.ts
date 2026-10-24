import { claimReward } from "@/server/credits";
import { err, json, readJson } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) =>
  authed(req, true, async (u) => {
    const b = await readJson(req);
    const r = await claimReward(u.id, Number(b?.invites));
    return r.ok ? json(r) : err(r.error, 400);
  });
