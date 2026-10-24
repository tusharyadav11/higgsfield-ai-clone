import { createKey } from "@/server/keys";
import { err, json } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) =>
  authed(req, true, async (u) => {
    const k = await createKey(u.id);
    return k ? json(k, 201) : err("Key limit reached. Revoke one first.", 409);
  });
