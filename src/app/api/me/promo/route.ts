import { db, t } from "@/db";
import { validatePromo, WELCOME_HOURS } from "@/lib/promo";
import { err, json, readJson } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) =>
  authed(req, true, async (u) => {
    const b = await readJson(req);
    const code = typeof b?.code === "string" ? b.code : "";
    const r = validatePromo(code, { yearly: b?.yearly === true, signedIn: true, welcomeExpiresAt: u.createdAt.getTime() + WELCOME_HOURS * 3600_000, now: Date.now() });
    if (!r.ok) return err(r.error, 400);
    await db().insert(t.promoRedemptions).values({ userId: u.id, code: r.code }).onConflictDoNothing();
    return json(r);
  });
