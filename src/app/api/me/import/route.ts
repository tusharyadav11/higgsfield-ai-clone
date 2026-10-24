import { importGuest } from "@/server/credits";
import { err, json, readJson } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) =>
  authed(req, true, async (u) => {
    const b = await readJson(req);
    if (!b) return err("Invalid JSON body");
    return json(await importGuest(u.id, b));
  });
