import { MODELS } from "@/lib/models";

export function GET() {
  return Response.json(MODELS, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
