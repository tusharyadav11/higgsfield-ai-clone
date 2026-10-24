import { describe, expect, it } from "vitest";
import {
  addAssets, addComment, archiveProject, canApprove, compareVersions, createProject, currentAssets, decide, deleteComment, editComment, queryProjects, removeAsset, restoreVersion,
  seedProjects, splitMentions, statusCounts, submitForReview, unarchiveProject, validateCreate, parseTags, type Ctx, type Project,
} from "../../src/lib/enterprise/projects-store";
import type { Role } from "../../src/lib/enterprise/roles";

const ctx = (role: Role = "owner", at = "2026-10-24T10:00:00.000Z"): Ctx => ({ actor: "You", role, at });
const ok = (r: { ok: boolean }) => expect(r.ok).toBe(true);
const get = (ps: Project[], id: string) => ps.find((p) => p.id === id)!;

describe("seed", () => {
  it("is deterministic and covers every status", () => {
    expect(JSON.stringify(seedProjects())).toBe(JSON.stringify(seedProjects()));
    const s = new Set(seedProjects().map((p) => p.status));
    expect([...s].sort()).toEqual(["approved", "archived", "draft", "in_review"]);
  });
  it("only references real library assets", async () => {
    const { getAsset } = await import("../../src/lib/enterprise/projects-store");
    for (const p of seedProjects()) for (const v of p.versions) for (const a of v.assets) expect(getAsset(a), a).toBeTruthy();
  });
});

describe("create", () => {
  const ps = seedProjects();
  it("validates name, owner, tags and duplicates", () => {
    expect(validateCreate(ps, { name: "x", owner: "A" }).name).toMatch(/at least 2/);
    expect(validateCreate(ps, { name: "Spring CAMPAIGN", owner: "A" }).name).toMatch(/already exists/);
    expect(validateCreate(ps, { name: "Fine name", owner: "" }).owner).toBeTruthy();
    expect(validateCreate(ps, { name: "Fine name", owner: "A", tags: "a,b,c,d,e,f,g" }).tags).toMatch(/at most/);
    expect(validateCreate(ps, { name: "Fine name", owner: "A", tags: "ok!" }).tags).toBeTruthy();
    expect(validateCreate(ps, { name: "Fine name", owner: "A" })).toEqual({});
    expect(parseTags(" #Social, social , Big Idea")).toEqual(["social", "big-idea"]);
  });
  it("viewers cannot create; editors can; new project starts as Draft v1", () => {
    expect(createProject(ps, { name: "New one", owner: "A" }, ctx("viewer")).ok).toBe(false);
    const r = createProject(ps, { name: "New one", owner: "Ava", assets: ["ph-01", "nope", "ph-01"] }, ctx("editor"));
    ok(r);
    if (!r.ok) return;
    const p = get(r.projects, r.id!);
    expect(p.status).toBe("draft");
    expect(p.versions).toHaveLength(1);
    expect(currentAssets(p)).toEqual(["ph-01"]);
  });
});

describe("approval workflow", () => {
  const ps = seedProjects();
  it("submit needs Editor+ and at least one asset", () => {
    expect(submitForReview(ps, "p-social", ctx("viewer")).ok).toBe(false);
    const empty = createProject(ps, { name: "Empty", owner: "Ava" }, ctx());
    if (!empty.ok) throw new Error("setup");
    expect(submitForReview(empty.projects, empty.id!, ctx()).ok).toBe(false);
    ok(submitForReview(ps, "p-social", ctx("editor")));
    expect(submitForReview(ps, "p-spring", ctx()).ok).toBe(false); // already in review
  });
  it("only Admin/Owner approve; reasons are required for changes and rejection", () => {
    expect(canApprove("editor")).toBe(false);
    expect(canApprove("viewer")).toBe(false);
    expect(canApprove("admin")).toBe(true);
    expect(decide(ps, "p-spring", "approved", "", ctx("editor")).ok).toBe(false);
    expect(decide(ps, "p-spring", "changes_requested", "  ", ctx("admin")).ok).toBe(false);
    expect(decide(ps, "p-spring", "rejected", "no", ctx("admin")).ok).toBe(false);
    const a = decide(ps, "p-spring", "approved", "", ctx("admin"));
    ok(a);
    if (a.ok) expect(get(a.projects, "p-spring").status).toBe("approved");
    const c = decide(ps, "p-spring", "changes_requested", "Warmer grade please", ctx("owner"));
    if (c.ok) {
      expect(get(c.projects, "p-spring").status).toBe("draft");
      expect(get(c.projects, "p-spring").review?.reason).toBe("Warmer grade please");
    } else throw new Error(c.error);
    const r = decide(ps, "p-spring", "rejected", "Off brand", ctx("owner"));
    if (r.ok) {
      expect(get(r.projects, "p-spring").status).toBe("archived");
      const back = unarchiveProject(r.projects, "p-spring", ctx("editor"));
      if (back.ok) expect(get(back.projects, "p-spring").status).toBe("draft");
      else throw new Error(back.error);
    } else throw new Error(r.error);
    expect(decide(ps, "p-social", "approved", "", ctx("owner")).ok).toBe(false); // draft is not awaiting review
  });
  it("editing an in-review or approved project resets it to Draft", () => {
    const r = addAssets(ps, "p-launch", ["ph-10"], ctx("editor"));
    if (!r.ok) throw new Error(r.error);
    expect(get(r.projects, "p-launch").status).toBe("draft");
    expect(get(r.projects, "p-launch").review).toBeUndefined();
  });
  it("archive and restore", () => {
    const a = archiveProject(ps, "p-launch", ctx("editor"));
    if (!a.ok) throw new Error(a.error);
    expect(get(a.projects, "p-launch").status).toBe("archived");
    expect(archiveProject(a.projects, "p-launch", ctx()).ok).toBe(false);
    expect(addAssets(a.projects, "p-launch", ["ph-10"], ctx()).ok).toBe(false);
    const u = unarchiveProject(a.projects, "p-launch", ctx("editor"));
    if (u.ok) expect(get(u.projects, "p-launch").status).toBe("approved");
    expect(archiveProject(ps, "p-launch", ctx("viewer")).ok).toBe(false);
  });
});

describe("versions", () => {
  it("restoring appends a new version and never mutates history", () => {
    const ps = seedProjects();
    const before = JSON.stringify(get(ps, "p-spring").versions);
    const r = restoreVersion(ps, "p-spring", 1, ctx("editor"));
    if (!r.ok) throw new Error(r.error);
    const p = get(r.projects, "p-spring");
    expect(p.versions).toHaveLength(4);
    expect(p.versions[3].note).toBe("Restored from v1");
    expect(p.versions[3].assets).toEqual(get(ps, "p-spring").versions[0].assets);
    expect(JSON.stringify(p.versions.slice(0, 3))).toBe(before);
    expect(JSON.stringify(get(ps, "p-spring").versions)).toBe(before); // input untouched
    expect(restoreVersion(r.projects, "p-spring", 4, ctx()).ok).toBe(false); // already current
    expect(restoreVersion(ps, "p-spring", 1, ctx("viewer")).ok).toBe(false);
    expect(restoreVersion(ps, "p-spring", 99, ctx()).ok).toBe(false);
  });
  it("add/remove assets create versions; compare reports the diff", () => {
    let ps = seedProjects();
    const a = addAssets(ps, "p-social", ["ph-01", "ph-02", "v-neon"], ctx());
    if (!a.ok) throw new Error(a.error);
    ps = a.projects;
    expect(currentAssets(get(ps, "p-social"))).toEqual(["v-neon", "v-ember", "ph-01", "ph-02"]);
    const rm = removeAsset(ps, "p-social", "v-ember", ctx());
    if (!rm.ok) throw new Error(rm.error);
    expect(get(rm.projects, "p-social").versions).toHaveLength(3);
    const d = compareVersions(get(rm.projects, "p-social"), 1, 3)!;
    expect(d.added.sort()).toEqual(["ph-01", "ph-02"]);
    expect(d.removed).toEqual(["v-ember"]);
    expect(d.kept).toEqual(["v-neon"]);
    expect(compareVersions(get(ps, "p-social"), 1, 9)).toBeNull();
    expect(addAssets(ps, "p-social", ["v-neon"], ctx()).ok).toBe(false); // nothing new
  });
});

describe("comments", () => {
  const ps = seedProjects();
  it("anyone with access (even viewers) can comment; only authors edit/delete", () => {
    const a = addComment(ps, "p-social", "  hello @Sam  ", ctx("viewer"), "c-x");
    if (!a.ok) throw new Error(a.error);
    expect(get(a.projects, "p-social").comments.at(-1)?.text).toBe("hello @Sam");
    expect(addComment(ps, "p-social", "   ", ctx()).ok).toBe(false);
    expect(addComment(ps, "p-social", "x".repeat(501), ctx()).ok).toBe(false);
    // seeded comments belong to other people
    expect(editComment(ps, "p-social", "c-1", "hijack", ctx("owner")).ok).toBe(false);
    expect(deleteComment(ps, "p-social", "c-1", ctx("owner")).ok).toBe(false);
    const e = editComment(a.projects, "p-social", "c-x", "edited", ctx("viewer"));
    if (!e.ok) throw new Error(e.error);
    expect(get(e.projects, "p-social").comments.at(-1)?.editedAt).toBeTruthy();
    expect(editComment(e.projects, "p-social", "c-x", " ", ctx()).ok).toBe(false);
    const d = deleteComment(e.projects, "p-social", "c-x", ctx("viewer"));
    if (d.ok) expect(get(d.projects, "p-social").comments.some((c) => c.id === "c-x")).toBe(false);
    else throw new Error(d.error);
  });
  it("splits @mentions without matching emails", () => {
    expect(splitMentions("hi @Leo, see a@b.com and @Mei.").filter((s) => s.mention).map((s) => s.text)).toEqual(["@Leo", "@Mei"]);
  });
});

describe("filter, search, sort, counts", () => {
  const ps = seedProjects();
  it("counts respect other filters but not the status chip", () => {
    const all = statusCounts(ps, {});
    expect(all.all).toBe(ps.length);
    expect(all.draft + all.in_review + all.approved + all.archived).toBe(ps.length);
    const owner = statusCounts(ps, { owner: "Leo Marchetti" });
    expect(owner.all).toBe(queryProjects(ps, { owner: "Leo Marchetti" }).length);
  });
  it("search, tag, status and sort", () => {
    expect(queryProjects(ps, { q: "launch" }).map((p) => p.id)).toContain("p-launch");
    expect(queryProjects(ps, { tag: "video" }).every((p) => p.tags.includes("video"))).toBe(true);
    expect(queryProjects(ps, { status: "archived" }).map((p) => p.id)).toEqual(["p-catalog"]);
    const names = queryProjects(ps, { sort: "name" }).map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(queryProjects(ps, { sort: "status" })[0].status).toBe("in_review");
    expect(queryProjects(ps, { q: "zzzz-nothing" })).toEqual([]);
  });
});
