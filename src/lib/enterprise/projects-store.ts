// DEMO projects & collaboration. Everything lives in this browser (zustand persist, key
// "kinetic-ws-projects"); there is no shared project backend, so nobody else sees these changes.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PHOTOS, VIDEOS, type PhotoAsset, type VideoAsset } from "@/lib/media-library";
import { SAMPLE_MEMBERS, SAMPLE_PROJECTS } from "./demo-data";
import { can, RANK, type Role } from "./roles";
import { record } from "./audit";

export const STORE_KEY = "kinetic-ws-projects";
export const STATUSES = ["draft", "in_review", "approved", "archived"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { draft: "Draft", in_review: "In Review", approved: "Approved", archived: "Archived" };

export type Decision = "approved" | "changes_requested" | "rejected";
export type Review = { decision: Decision; reason?: string; by: string; at: string };
export type Version = { n: number; at: string; by: string; note: string; assets: string[] };
export type Comment = { id: string; author: string; text: string; at: string; editedAt?: string };
export type Activity = { id: string; at: string; actor: string; text: string };
export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  tags: string[];
  status: Status;
  archivedFrom?: Status;
  review?: Review;
  createdAt: string;
  updatedAt: string;
  versions: Version[];
  comments: Comment[];
  activity: Activity[];
};

/** Who "You" are when acting in this demo workspace (comment ownership). */
export const ACTOR = "You";
export type Ctx = { actor: string; role: Role; at: string };
export type Out = { ok: true; projects: Project[]; id?: string } | { ok: false; error: string };
const fail = (error: string): Out => ({ ok: false, error });

/* ---------------- rules ---------------- */

/** Approving is an Owner/Admin power (roles.ts has no dedicated action for it). */
export const canApprove = (role: Role) => RANK[role] >= RANK.admin;
export const canEdit = (role: Role) => can(role, "edit_projects");
/** Everyone who can see a project may comment, including Viewers. */
export const canComment = (role: Role) => can(role, "view_projects");

export const currentAssets = (p: Project): string[] => p.versions[p.versions.length - 1]?.assets ?? [];
export const latestVersion = (p: Project) => p.versions[p.versions.length - 1];

/* ---------------- library assets (real local media) ---------------- */

export type LibAsset = { id: string; kind: "image" | "video"; src: string; poster?: string; aspect: PhotoAsset["aspect"]; w: number; h: number; blur: string; title: string };
const photoTitle = (a: PhotoAsset) => `Frame ${a.id.slice(3)}`;
const videoTitle = (a: VideoAsset) => a.id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") + " loop";
export const LIBRARY: LibAsset[] = [
  ...PHOTOS.map((a): LibAsset => ({ id: a.id, kind: "image", src: a.src, aspect: a.aspect, w: a.w, h: a.h, blur: a.blur, title: photoTitle(a) })),
  ...VIDEOS.map((a): LibAsset => ({ id: a.id, kind: "video", src: a.src, poster: a.poster, aspect: a.aspect, w: a.w, h: a.h, blur: a.blur, title: videoTitle(a) })),
];
const LIB = new Map(LIBRARY.map((a) => [a.id, a]));
export const getAsset = (id: string): LibAsset | undefined => LIB.get(id);

/* ---------------- validation helpers ---------------- */

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const DESC_MAX = 300;
export const COMMENT_MAX = 500;
export const REASON_MIN = 3;
export const REASON_MAX = 300;
export const MAX_TAGS = 6;

export function parseTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(/[,\n]+/)) {
    const v = t.trim().toLowerCase().replace(/\s+/g, "-").replace(/^#/, "");
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

export type CreateInput = { name: string; description?: string; owner: string; tags?: string; assets?: string[] };
export type CreateErrors = Partial<Record<"name" | "description" | "owner" | "tags", string>>;

export function validateCreate(projects: Project[], i: CreateInput): CreateErrors {
  const e: CreateErrors = {};
  const name = i.name.trim();
  if (name.length < NAME_MIN) e.name = `Name must be at least ${NAME_MIN} characters.`;
  else if (name.length > NAME_MAX) e.name = `Name must be ${NAME_MAX} characters or fewer.`;
  else if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) e.name = "A project with this name already exists.";
  if ((i.description ?? "").trim().length > DESC_MAX) e.description = `Description must be ${DESC_MAX} characters or fewer.`;
  if (!i.owner.trim()) e.owner = "Choose an owner.";
  const tags = parseTags(i.tags ?? "");
  if (tags.length > MAX_TAGS) e.tags = `Use at most ${MAX_TAGS} tags.`;
  else if (tags.some((t) => !/^[a-z0-9-]{1,20}$/.test(t))) e.tags = "Tags: letters, numbers and dashes, up to 20 characters each.";
  return e;
}

/* ---------------- mutations (pure) ---------------- */

const upd = (projects: Project[], id: string, f: (p: Project) => Project) => projects.map((p) => (p.id === id ? f(p) : p));
const find = (projects: Project[], id: string) => projects.find((p) => p.id === id);
let aid = 0;
const act = (ctx: Ctx, text: string): Activity => ({ id: `a-${ctx.at}-${++aid}`, at: ctx.at, actor: ctx.actor, text });
const nextId = (prefix: string, existing: string[]) => {
  let n = existing.length + 1;
  while (existing.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
};

export function createProject(projects: Project[], i: CreateInput, ctx: Ctx): Out {
  if (!canEdit(ctx.role)) return fail("Your role cannot create projects (Editor or above).");
  const errs = validateCreate(projects, i);
  const first = Object.values(errs)[0];
  if (first) return fail(first);
  const id = nextId("p-new-", projects.map((p) => p.id));
  const assets = (i.assets ?? []).filter((a, k, arr) => LIB.has(a) && arr.indexOf(a) === k);
  const p: Project = {
    id,
    name: i.name.trim(),
    description: (i.description ?? "").trim(),
    owner: i.owner.trim(),
    tags: parseTags(i.tags ?? ""),
    status: "draft",
    createdAt: ctx.at,
    updatedAt: ctx.at,
    versions: [{ n: 1, at: ctx.at, by: ctx.actor, note: assets.length ? `Created with ${assets.length} asset${assets.length === 1 ? "" : "s"}` : "Created (no assets yet)", assets }],
    comments: [],
    activity: [act(ctx, "Created the project")],
  };
  return { ok: true, projects: [p, ...projects], id };
}

/** Edits to an in-review/approved project send it back to Draft so approval never covers unseen changes. */
function afterEdit(p: Project, ctx: Ctx, text: string): Project {
  const reset = p.status === "in_review" || p.status === "approved";
  return {
    ...p,
    status: reset ? "draft" : p.status,
    review: reset ? undefined : p.review,
    updatedAt: ctx.at,
    activity: [act(ctx, text + (reset ? ` (${STATUS_LABEL[p.status]} reset to Draft)` : "")), ...p.activity],
  };
}

function pushVersion(p: Project, assets: string[], note: string, ctx: Ctx): Project {
  const n = (latestVersion(p)?.n ?? 0) + 1;
  return { ...p, versions: [...p.versions, { n, at: ctx.at, by: ctx.actor, note, assets }] };
}

export function addAssets(projects: Project[], id: string, ids: string[], ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot edit projects (Editor or above).");
  if (p.status === "archived") return fail("Restore this project before editing it.");
  const have = new Set(currentAssets(p));
  const add = ids.filter((a, k) => LIB.has(a) && !have.has(a) && ids.indexOf(a) === k);
  if (!add.length) return fail("Pick at least one asset that is not already in the project.");
  const note = `Added ${add.length} asset${add.length === 1 ? "" : "s"}`;
  return { ok: true, projects: upd(projects, id, (x) => afterEdit(pushVersion(x, [...currentAssets(x), ...add], note, ctx), ctx, note)) };
}

export function removeAsset(projects: Project[], id: string, assetId: string, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot edit projects (Editor or above).");
  if (p.status === "archived") return fail("Restore this project before editing it.");
  if (!currentAssets(p).includes(assetId)) return fail("That asset is not in the project.");
  const note = `Removed ${getAsset(assetId)?.title ?? assetId}`;
  return { ok: true, projects: upd(projects, id, (x) => afterEdit(pushVersion(x, currentAssets(x).filter((a) => a !== assetId), note, ctx), ctx, note)) };
}

/** Restoring never rewrites history: it appends a new version holding the old snapshot. */
export function restoreVersion(projects: Project[], id: string, n: number, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot restore versions (Editor or above).");
  if (p.status === "archived") return fail("Restore this project before editing it.");
  const v = p.versions.find((x) => x.n === n);
  if (!v) return fail("Version not found.");
  if (n === latestVersion(p).n) return fail("That is already the current version.");
  const note = `Restored from v${n}`;
  return { ok: true, projects: upd(projects, id, (x) => afterEdit(pushVersion(x, [...v.assets], note, ctx), ctx, `${note}: created v${latestVersion(x).n + 1}`)) };
}

export function submitForReview(projects: Project[], id: string, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot submit projects for review (Editor or above).");
  if (p.status !== "draft") return fail("Only Draft projects can be submitted for review.");
  if (!currentAssets(p).length) return fail("Add at least one asset before submitting for review.");
  return {
    ok: true,
    projects: upd(projects, id, (x) => ({ ...x, status: "in_review", review: undefined, updatedAt: ctx.at, activity: [act(ctx, `Submitted v${latestVersion(x).n} for review`), ...x.activity] })),
  };
}

export function decide(projects: Project[], id: string, decision: Decision, reason: string, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canApprove(ctx.role)) return fail("Only an Admin or Owner can review projects.");
  if (p.status !== "in_review") return fail("This project is not waiting for review.");
  const r = reason.trim();
  if (decision !== "approved" && r.length < REASON_MIN) return fail("A reason is required.");
  if (r.length > REASON_MAX) return fail(`Reason must be ${REASON_MAX} characters or fewer.`);
  const review: Review = { decision, by: ctx.actor, at: ctx.at, ...(r ? { reason: r } : {}) };
  const text = decision === "approved" ? "Approved the project" : decision === "changes_requested" ? `Requested changes: ${r}` : `Rejected the project: ${r}`;
  return {
    ok: true,
    projects: upd(projects, id, (x) => ({
      ...x,
      review,
      status: decision === "approved" ? "approved" : decision === "changes_requested" ? "draft" : "archived",
      archivedFrom: decision === "rejected" ? "draft" : x.archivedFrom,
      updatedAt: ctx.at,
      activity: [act(ctx, text), ...x.activity],
    })),
  };
}

export function archiveProject(projects: Project[], id: string, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot archive projects (Editor or above).");
  if (p.status === "archived") return fail("Already archived.");
  return { ok: true, projects: upd(projects, id, (x) => ({ ...x, archivedFrom: x.status, status: "archived", updatedAt: ctx.at, activity: [act(ctx, "Archived the project"), ...x.activity] })) };
}

export function unarchiveProject(projects: Project[], id: string, ctx: Ctx): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canEdit(ctx.role)) return fail("Your role cannot restore projects (Editor or above).");
  if (p.status !== "archived") return fail("Project is not archived.");
  // never resurrect straight into Approved/In Review after a rejection: go back to what it was, but Draft if unsure
  const to: Status = p.archivedFrom && p.archivedFrom !== "archived" ? p.archivedFrom : "draft";
  return { ok: true, projects: upd(projects, id, (x) => ({ ...x, status: to, archivedFrom: undefined, updatedAt: ctx.at, activity: [act(ctx, `Restored the project to ${STATUS_LABEL[to]}`), ...x.activity] })) };
}

export function addComment(projects: Project[], id: string, text: string, ctx: Ctx, cid?: string): Out {
  const p = find(projects, id);
  if (!p) return fail("Project not found.");
  if (!canComment(ctx.role)) return fail("Your role cannot comment.");
  const t = text.trim();
  if (!t) return fail("Write a comment first.");
  if (t.length > COMMENT_MAX) return fail(`Comments are limited to ${COMMENT_MAX} characters.`);
  const c: Comment = { id: cid ?? nextId("c-", p.comments.map((x) => x.id)), author: ctx.actor, text: t, at: ctx.at };
  return { ok: true, projects: upd(projects, id, (x) => ({ ...x, comments: [...x.comments, c], activity: [act(ctx, "Commented"), ...x.activity] })) };
}

export function editComment(projects: Project[], id: string, cid: string, text: string, ctx: Ctx): Out {
  const p = find(projects, id);
  const c = p?.comments.find((x) => x.id === cid);
  if (!p || !c) return fail("Comment not found.");
  if (c.author !== ctx.actor) return fail("You can only edit your own comments.");
  const t = text.trim();
  if (!t) return fail("A comment cannot be empty. Delete it instead.");
  if (t.length > COMMENT_MAX) return fail(`Comments are limited to ${COMMENT_MAX} characters.`);
  return { ok: true, projects: upd(projects, id, (x) => ({ ...x, comments: x.comments.map((y) => (y.id === cid ? { ...y, text: t, editedAt: ctx.at } : y)) })) };
}

export function deleteComment(projects: Project[], id: string, cid: string, ctx: Ctx): Out {
  const p = find(projects, id);
  const c = p?.comments.find((x) => x.id === cid);
  if (!p || !c) return fail("Comment not found.");
  if (c.author !== ctx.actor) return fail("You can only delete your own comments.");
  return { ok: true, projects: upd(projects, id, (x) => ({ ...x, comments: x.comments.filter((y) => y.id !== cid), activity: [act(ctx, "Deleted a comment"), ...x.activity] })) };
}

/* ---------------- queries ---------------- */

export type SortKey = "updated" | "name" | "status";
export type Query = { q?: string; status?: Status | "all"; owner?: string; tag?: string; sort?: SortKey };
const STATUS_ORDER: Record<Status, number> = { in_review: 0, draft: 1, approved: 2, archived: 3 };

export function queryProjects(projects: Project[], f: Query): Project[] {
  const q = f.q?.trim().toLowerCase();
  const out = projects.filter(
    (p) =>
      (!f.status || f.status === "all" || p.status === f.status) &&
      (!f.owner || p.owner === f.owner) &&
      (!f.tag || p.tags.includes(f.tag)) &&
      (!q || `${p.name} ${p.description} ${p.owner} ${p.tags.join(" ")}`.toLowerCase().includes(q)),
  );
  const s = f.sort ?? "updated";
  return [...out].sort((a, b) =>
    s === "name" ? a.name.localeCompare(b.name) : s === "status" ? STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name) : b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name),
  );
}

/** Counts for filter chips; respects search/owner/tag but not the status filter itself. */
export function statusCounts(projects: Project[], f: Omit<Query, "status">): Record<Status | "all", number> {
  const base = queryProjects(projects, { ...f, status: "all" });
  const c = { all: base.length, draft: 0, in_review: 0, approved: 0, archived: 0 };
  for (const p of base) c[p.status]++;
  return c;
}

export const allTags = (projects: Project[]) => [...new Set(projects.flatMap((p) => p.tags))].sort();
export const allOwners = (projects: Project[]) => [...new Set(projects.map((p) => p.owner))].sort();

export type VersionDiff = { added: string[]; removed: string[]; kept: string[] };
export function compareVersions(p: Project, a: number, b: number): VersionDiff | null {
  const va = p.versions.find((v) => v.n === a);
  const vb = p.versions.find((v) => v.n === b);
  if (!va || !vb) return null;
  const sa = new Set(va.assets);
  const sb = new Set(vb.assets);
  return { added: vb.assets.filter((x) => !sa.has(x)), removed: va.assets.filter((x) => !sb.has(x)), kept: vb.assets.filter((x) => sa.has(x)) };
}

/** Split text into plain / @mention segments for highlighting. */
export function splitMentions(text: string): { text: string; mention: boolean }[] {
  const out: { text: string; mention: boolean }[] = [];
  const re = /(^|[^\w@])(@[A-Za-z](?:[\w.-]{0,29}\w)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const start = m.index + m[1].length;
    if (start > last) out.push({ text: text.slice(last, start), mention: false });
    out.push({ text: m[2], mention: true });
    last = start + m[2].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: false });
  return out;
}

/* ---------------- deterministic sample data ---------------- */

const T0 = Date.parse("2026-09-14T09:00:00.000Z");
const H = 3_600_000;
const at = (h: number) => new Date(T0 + h * H).toISOString();
const who = (id: string) => SAMPLE_MEMBERS.find((m) => m.id === id)!.name;

type SeedV = [h: number, by: string, note: string, assets: string[]];
function mk(i: number, o: { id: string; owner: string; desc: string; tags: string[]; status: Status; versions: SeedV[]; comments?: [string, number, string][]; review?: Review; archivedFrom?: Status }): Project {
  const name = SAMPLE_PROJECTS[i].name;
  const versions = o.versions.map(([h, by, note, assets], k) => ({ n: k + 1, at: at(h), by: who(by), note, assets }));
  const last = versions[versions.length - 1];
  return {
    id: o.id,
    name,
    description: o.desc,
    owner: who(o.owner),
    tags: o.tags,
    status: o.status,
    ...(o.archivedFrom ? { archivedFrom: o.archivedFrom } : {}),
    ...(o.review ? { review: o.review } : {}),
    createdAt: versions[0].at,
    updatedAt: last.at,
    versions,
    comments: (o.comments ?? []).map(([by, h, text], k) => ({ id: `c-${k + 1}`, author: by === "you" ? ACTOR : who(by), text, at: at(h) })),
    activity: [
      ...versions.map((v) => ({ id: `a-v${v.n}`, at: v.at, actor: v.by, text: v.n === 1 ? "Created the project" : `Saved v${v.n}: ${v.note}` })),
      ...(o.status === "in_review" ? [{ id: "a-sub", at: last.at, actor: who(o.owner), text: `Submitted v${last.n} for review` }] : []),
      ...(o.review ? [{ id: "a-rev", at: o.review.at, actor: o.review.by, text: o.review.decision === "approved" ? "Approved the project" : `Requested changes: ${o.review.reason ?? ""}` }] : []),
    ].sort((a, b) => b.at.localeCompare(a.at)),
  };
}

export function seedProjects(): Project[] {
  return [
    mk(0, {
      id: "p-spring", owner: "m-leo", desc: "Seasonal hero visuals and short loops for the spring push.", tags: ["campaign", "social"], status: "in_review",
      versions: [
        [0, "m-leo", "Initial moodboard", ["ph-01", "ph-02", "ph-03"]],
        [30, "m-mei", "Added motion loops", ["ph-01", "ph-02", "ph-03", "aurora-neon"]],
        [75, "m-leo", "Swapped frame 03 for 05", ["ph-01", "ph-02", "ph-05", "aurora-neon"]],
      ],
      comments: [["m-noah", 80, "Love the loop. @Leo can we try a warmer grade on frame 05?"], ["m-leo", 82, "On it. Will upload a graded version today."]],
    }),
    mk(1, {
      id: "p-launch", owner: "m-mei", desc: "Cinematic reel cutting the three hero shots for launch day.", tags: ["video", "launch"], status: "approved",
      versions: [
        [10, "m-mei", "Rough cut", ["ember-flow", "ocean-silk"]],
        [60, "m-mei", "Added the closing shot", ["ember-flow", "ocean-silk", "violet-nebula"]],
      ],
      review: { decision: "approved", by: who("m-noah"), at: at(100) },
      comments: [["m-noah", 99, "Approved. Great pacing. @Mei please export the vertical variant next."]],
    }),
    mk(2, {
      id: "p-social", owner: "m-sam", desc: "Vertical cutdowns for stories and shorts.", tags: ["social", "video"], status: "draft",
      versions: [[20, "m-sam", "First vertical pass", ["v-neon", "v-ember"]]],
      comments: [["m-priya", 40, "Needs a 9:16 safe-area check before review."]],
    }),
    mk(3, {
      id: "p-brand", owner: "m-priya", desc: "Exploring the refreshed palette and texture language.", tags: ["brand", "stills"], status: "draft",
      versions: [
        [5, "m-priya", "Palette exploration", ["ph-11", "ph-12"]],
        [50, "m-priya", "More texture studies", ["ph-11", "ph-12", "ph-13", "ph-14"]],
      ],
      review: { decision: "changes_requested", by: who("m-ava"), at: at(90), reason: "Pull back the saturation on the second pair." },
      comments: [["m-ava", 90, "Pull back the saturation on the second pair, then resubmit. @Priya"]],
    }),
    mk(4, {
      id: "p-catalog", owner: "m-leo", desc: "Square product imagery for the catalogue refresh.", tags: ["stills", "catalog"], status: "archived", archivedFrom: "approved",
      versions: [[2, "m-leo", "Final set", ["ph-06", "ph-07", "ph-08", "ph-09"]]],
    }),
    mk(5, {
      id: "p-pitch", owner: "m-ava", desc: "Visuals for the investor deck: hero, market and team slides.", tags: ["deck", "stills"], status: "draft",
      versions: [[15, "m-ava", "Outline frames", ["ph-32", "ph-33", "ph-34"]]],
    }),
  ];
}

/* ---------------- store ---------------- */

type State = {
  projects: Project[];
  create: (i: CreateInput, ctx: Ctx) => Out;
  addAssets: (id: string, ids: string[], ctx: Ctx) => Out;
  removeAsset: (id: string, assetId: string, ctx: Ctx) => Out;
  restoreVersion: (id: string, n: number, ctx: Ctx) => Out;
  submit: (id: string, ctx: Ctx) => Out;
  decide: (id: string, d: Decision, reason: string, ctx: Ctx) => Out;
  archive: (id: string, ctx: Ctx) => Out;
  unarchive: (id: string, ctx: Ctx) => Out;
  comment: (id: string, text: string, ctx: Ctx) => Out;
  editComment: (id: string, cid: string, text: string, ctx: Ctx) => Out;
  deleteComment: (id: string, cid: string, ctx: Ctx) => Out;
  resetDemo: () => void;
};

export const useProjects = create<State>()(
  persist(
    (set, get) => {
      const run = (f: (p: Project[]) => Out, audit?: (r: Extract<Out, { ok: true }>, p: Project[]) => { action: string; target: string; detail?: string } | null, ctx?: Ctx): Out => {
        const before = get().projects;
        const r = f(before);
        if (r.ok) {
          set({ projects: r.projects });
          const ev = audit?.(r, r.projects);
          if (ev && ctx) record({ ...ev, actor: ctx.actor, role: ctx.role, at: ctx.at });
        }
        return r;
      };
      const nameOf = (ps: Project[], id: string) => ps.find((p) => p.id === id)?.name ?? id;
      return {
        projects: seedProjects(),
        create: (i, ctx) => run((p) => createProject(p, i, ctx), (r) => ({ action: "project.created", target: i.name.trim(), detail: r.id }), ctx),
        addAssets: (id, ids, ctx) => run((p) => addAssets(p, id, ids, ctx)),
        removeAsset: (id, a, ctx) => run((p) => removeAsset(p, id, a, ctx)),
        restoreVersion: (id, n, ctx) => run((p) => restoreVersion(p, id, n, ctx), (_r, ps) => ({ action: "project.version_restored", target: nameOf(ps, id), detail: `from v${n}` }), ctx),
        submit: (id, ctx) => run((p) => submitForReview(p, id, ctx), (_r, ps) => ({ action: "project.submitted", target: nameOf(ps, id) }), ctx),
        decide: (id, d, reason, ctx) =>
          run((p) => decide(p, id, d, reason, ctx), (_r, ps) => ({ action: d === "approved" ? "project.approved" : d === "changes_requested" ? "project.changes_requested" : "project.rejected", target: nameOf(ps, id), detail: reason.trim() || undefined }), ctx),
        archive: (id, ctx) => run((p) => archiveProject(p, id, ctx), (_r, ps) => ({ action: "project.archived", target: nameOf(ps, id) }), ctx),
        unarchive: (id, ctx) => run((p) => unarchiveProject(p, id, ctx), (_r, ps) => ({ action: "project.restored", target: nameOf(ps, id) }), ctx),
        comment: (id, text, ctx) => run((p) => addComment(p, id, text, ctx)),
        editComment: (id, cid, text, ctx) => run((p) => editComment(p, id, cid, text, ctx)),
        deleteComment: (id, cid, ctx) => run((p) => deleteComment(p, id, cid, ctx)),
        resetDemo: () => set({ projects: seedProjects() }),
      };
    },
    {
      name: STORE_KEY,
      version: 1,
      skipHydration: true, // rehydrated after mount: nothing from storage in prerendered output
      partialize: ({ projects }) => ({ projects }),
    },
  ),
);
