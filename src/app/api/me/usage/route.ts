import { isRange } from "@/lib/usage";
import { err, json } from "@/server/http";
import { authed } from "@/server/route";
import { usageFor } from "@/server/usage";

/** GET /api/me/usage?range=7d|30d|90d: credit spend/earn aggregated from the ledger (signed-in users). */
export const GET = (req: Request) => {
  // touch request data outside authed()'s try/catch so Next sees this route as dynamic (cacheComponents)
  req.headers.get("cookie");
  return authed(req, false, async (u) => {
    const range = new URL(req.url).searchParams.get("range") ?? "30d";
    if (!isRange(range)) return err("range must be 7d, 30d or 90d", 400);
    return json(await usageFor(u.id, range));
  });
}
