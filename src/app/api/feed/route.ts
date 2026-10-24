import type { NextRequest } from "next/server";
import { queryFeed } from "@/lib/feed-server";

export function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tag = (sp.get("tag") ?? "").trim().toLowerCase();
  const rawLimit = Number.parseInt(sp.get("limit") ?? "", 10);
  const limit = Math.min(48, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12));
  try {
    const data = queryFeed(tag, sp.get("cursor"), limit);
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
    });
  } catch {
    return Response.json(
      { error: "Invalid cursor" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
