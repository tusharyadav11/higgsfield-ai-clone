import { toggleLike } from "@/server/credits";
import { err, json, readJson } from "@/server/http";
import { authed } from "@/server/route";

export const POST = (req: Request) =>
  authed(req, true, async (u) => {
    const b = await readJson(req);
    const postId = typeof b?.postId === "string" ? b.postId : "";
    if (!postId || postId.length > 100) return err("postId required");
    return json({ liked: await toggleLike(u.id, postId), postId });
  });
