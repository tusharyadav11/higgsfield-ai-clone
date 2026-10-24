import { hasDb } from "@/db";
import { sessionCookie, signup, publicUser } from "@/server/auth";
import { err, guard, json, readJson } from "@/server/http";

export async function POST(req: Request) {
  const g = guard(req, { mutating: true });
  if (g) return g;
  const b = await readJson(req);
  if (!b) return err("Invalid JSON body");
  try {
    const r = await signup(b);
    if (!r.ok) return err(r.error, r.status, r.field ? { field: r.field } : {});
    return json({ user: publicUser({ ...r.user }), referred: r.referred }, 201, { "Set-Cookie": sessionCookie(req, r.token) });
  } catch (e) {
    console.error("[signup]", hasDb(), e);
    return err("Server error", 500);
  }
}
