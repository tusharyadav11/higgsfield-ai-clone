import { clearCookie, destroySession } from "@/server/auth";
import { err, guard, json } from "@/server/http";

export async function POST(req: Request) {
  const g = guard(req, { mutating: true });
  if (g) return g;
  try {
    await destroySession(req);
    return json({ ok: true }, 200, { "Set-Cookie": clearCookie(req) });
  } catch (e) {
    console.error("[logout]", e);
    return err("Server error", 500);
  }
}
