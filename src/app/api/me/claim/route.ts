import { claimDaily } from "@/server/credits";
import { json } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) => authed(req, true, async (u) => json(await claimDaily(u.id)));
