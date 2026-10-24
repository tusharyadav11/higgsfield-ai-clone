import { login, publicUser, sessionCookie } from "@/server/auth";
import { err, guard, json, readJson } from "@/server/http";

export async function POST(req: Request) {
  const g = guard(req, { mutating: true });
  if (g) return g;
  const b = await readJson(req);
  if (!b) return err("Invalid JSON body");
  try {
    const r = await login(b);
    if (!r.ok) return err(r.error, r.status);
    return json({ user: publicUser(r.user) }, 200, { "Set-Cookie": sessionCookie(req, r.token) });
  } catch (e) {
    console.error("[login]", e);
    return err("Server error", 500);
  }
}
