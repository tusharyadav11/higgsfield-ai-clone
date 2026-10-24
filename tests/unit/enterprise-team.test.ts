import { describe, expect, it } from "vitest";
import { ACTIONS, assignableRoles, can, canAssign, canManage, canRemove, canTransfer, needsRoleConfirm, ROLES } from "@/lib/enterprise/roles";
import { MAX_INVITES, ownerCount, parseEmails, planInvite, removeFrom, seatLevel, seatsFree, seedMembers, setRoleIn, transferIn } from "@/lib/enterprise/team-store";
import { aggregate, bucketsFor, generateUsage, groupBy, hash, inWindow, projectRunOut, scaleForPct, severityOf, sumCredits, windowOf, monthStartKey, dayKey, poolFor, SAMPLE_PROJECTS } from "@/lib/enterprise/demo-data";

const NOW = Date.UTC(2026, 9, 24, 15, 30); // 2026-10-24 15:30 UTC
const members = () => seedMembers(NOW);

describe("roles matrix", () => {
  it("owner can do everything; viewer is read-only", () => {
    for (const a of ACTIONS) expect(can("owner", a.id)).toBe(true);
    for (const a of ["invite", "change_role", "remove", "export_usage", "manage_billing", "transfer_ownership", "edit_projects"] as const) expect(can("viewer", a)).toBe(false);
    expect(can("viewer", "view_usage")).toBe(true);
  });
  it("only the owner transfers ownership or manages billing", () => {
    expect(ROLES.filter((r) => canTransfer(r))).toEqual(["owner"]);
    expect(ROLES.filter((r) => can(r, "manage_billing"))).toEqual(["owner"]);
  });
  it("admins cannot touch owners or admins; editors and viewers cannot manage anyone", () => {
    expect(canManage("admin", "owner")).toBe(false);
    expect(canManage("admin", "admin")).toBe(false);
    expect(canManage("admin", "editor")).toBe(true);
    expect(canAssign("admin", "editor", "admin")).toBe(false);
    expect(canAssign("admin", "viewer", "editor")).toBe(true);
    expect(assignableRoles("editor", "viewer")).toEqual([]);
    expect(assignableRoles("viewer", "viewer")).toEqual([]);
  });
  it("the owner can never be removed, demoted or assigned", () => {
    for (const r of ROLES) {
      expect(canRemove(r, "owner")).toBe(false);
      expect(canAssign(r, "owner", "admin")).toBe(false);
      expect(canAssign(r, "editor", "owner")).toBe(false);
    }
  });
  it("downgrades and promotions to admin need confirmation", () => {
    expect(needsRoleConfirm("editor", "admin")).toBe(true);
    expect(needsRoleConfirm("admin", "editor")).toBe(true);
    expect(needsRoleConfirm("editor", "viewer")).toBe(true);
    expect(needsRoleConfirm("viewer", "editor")).toBe(false);
  });
});

describe("invites and seats", () => {
  it("parses commas, spaces, semicolons and newlines, lowercases", () => {
    expect(parseEmails(" A@x.io, b@x.io;c@x.io\nD@x.io  ")).toEqual(["a@x.io", "b@x.io", "c@x.io", "d@x.io"]);
    expect(parseEmails("  ")).toEqual([]);
  });
  it("accepts valid new addresses", () => {
    const p = planInvite(members(), 25, "new1@x.io, new2@x.io");
    expect(p.error).toBeNull();
    expect(p.emails).toEqual(["new1@x.io", "new2@x.io"]);
  });
  it("rejects invalid, duplicate (existing, pending and repeated) and empty input", () => {
    expect(planInvite(members(), 25, "").error).toMatch(/at least one/i);
    expect(planInvite(members(), 25, "nope").error).toMatch(/valid email/i);
    expect(planInvite(members(), 25, "AVA@acme-demo.example").error).toMatch(/already/i);
    expect(planInvite(members(), 25, "ines@acme-demo.example").error).toMatch(/already/i); // pending counts
    expect(planInvite(members(), 25, "x@y.io, X@y.io").error).toMatch(/already|repeated/i);
  });
  it("caps at 10 addresses per request", () => {
    const many = Array.from({ length: MAX_INVITES + 1 }, (_, i) => `u${i}@x.io`).join(",");
    expect(planInvite(members(), 500, many).error).toMatch(/up to 10/);
    const ten = Array.from({ length: MAX_INVITES }, (_, i) => `u${i}@x.io`).join(",");
    expect(planInvite(members(), 500, ten).error).toBeNull();
  });
  it("enforces the seat limit atomically", () => {
    const m = members(); // 9 used
    expect(seatsFree(m, 10)).toBe(1);
    const p = planInvite(m, 10, "a@x.io, b@x.io");
    expect(p.error).toMatch(/seat limit/i);
    expect(planInvite(m, 10, "a@x.io").error).toBeNull();
    expect(planInvite(m, 9, "a@x.io").error).toMatch(/seat limit/i);
  });
  it("seat levels warn at 80% and 100%", () => {
    expect(seatLevel(19, 25)).toBe("ok");
    expect(seatLevel(20, 25)).toBe("warn");
    expect(seatLevel(25, 25)).toBe("full");
    expect(seatLevel(0, 0)).toBe("ok");
  });
});

describe("ownership rules", () => {
  it("has exactly one owner and never loses it", () => {
    const m = members();
    expect(ownerCount(m)).toBe(1);
    expect(removeFrom(m, ["m-ava"])).toHaveLength(m.length);
    expect(setRoleIn(m, "m-ava", "viewer").find((x) => x.id === "m-ava")?.role).toBe("owner");
    expect(setRoleIn(m, "m-leo", "owner").find((x) => x.id === "m-leo")?.role).toBe("editor");
    expect(ownerCount(setRoleIn(m, "m-leo", "admin"))).toBe(1);
  });
  it("transfer swaps the owner to admin and keeps exactly one owner; only to active members", () => {
    const m = transferIn(members(), "m-noah");
    expect(ownerCount(m)).toBe(1);
    expect(m.find((x) => x.id === "m-noah")?.role).toBe("owner");
    expect(m.find((x) => x.id === "m-ava")?.role).toBe("admin");
    expect(transferIn(members(), "m-ines")).toEqual(members()); // pending
    expect(transferIn(members(), "m-omar")).toEqual(members()); // suspended
  });
  it("removing members frees seats", () => {
    const m = removeFrom(members(), ["m-ines", "m-omar"]);
    expect(m).toHaveLength(7);
  });
});

describe("usage generator and reconciliation", () => {
  const entries = generateUsage(NOW);
  it("is deterministic and stable per day when time moves", () => {
    expect(generateUsage(NOW)).toEqual(entries);
    const later = generateUsage(NOW + 86_400_000);
    const key = (e: { date: string }) => e.date === "2026-10-20";
    expect(later.filter(key)).toEqual(entries.filter(key));
    expect(hash("a")).toBe(hash("a"));
  });
  it("members = projects = days = total for every range", () => {
    for (const range of ["daily", "weekly", "monthly"] as const) {
      const { from, to } = windowOf(range, NOW);
      const w = inWindow(entries, from, to);
      const total = sumCredits(w);
      expect(total).toBeGreaterThan(0);
      expect(sumCredits(groupBy(w, "memberId").map((g) => ({ credits: g.credits })) as never)).toBe(total);
      expect(groupBy(w, "projectId").reduce((s, g) => s + g.credits, 0)).toBe(total);
      expect(aggregate(entries, range, NOW).reduce((s, b) => s + b.credits, 0)).toBe(total);
    }
  });
  it("only uses known projects and positive integer credits", () => {
    const ids = new Set(SAMPLE_PROJECTS.map((p) => p.id as string));
    for (const e of entries) {
      expect(ids.has(e.projectId)).toBe(true);
      expect(Number.isInteger(e.credits) && e.credits > 0).toBe(true);
    }
  });
});

describe("range boundaries", () => {
  it("daily is the last 14 UTC days, inclusive of today", () => {
    const b = bucketsFor("daily", NOW);
    expect(b).toHaveLength(14);
    expect(b[13].key).toBe("2026-10-24");
    expect(b[0].key).toBe("2026-10-11");
  });
  it("weekly is 12 rolling 7-day windows ending today with no gaps or overlap", () => {
    const b = bucketsFor("weekly", NOW);
    expect(b).toHaveLength(12);
    expect(b[11].to).toBe("2026-10-24");
    expect(b[11].from).toBe("2026-10-18");
    expect(b[0].from).toBe("2026-08-02");
    for (let i = 1; i < b.length; i++) expect(Date.parse(b[i].from) - Date.parse(b[i - 1].to)).toBe(86_400_000);
  });
  it("monthly is 6 calendar months, current one month-to-date", () => {
    const b = bucketsFor("monthly", NOW);
    expect(b.map((x) => x.from)).toEqual(["2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(b[4].to).toBe("2026-09-30");
    expect(b[5].to).toBe("2026-10-24");
  });
  it("entries on the boundary days land in exactly one bucket", () => {
    const mk = (date: string) => [{ id: date, date, memberId: "m-ava", projectId: "p-spring", tool: "Image" as const, credits: 5 }];
    const sum = (d: string, r: "daily" | "weekly" | "monthly") => aggregate(mk(d), r, NOW).reduce((s, x) => s + x.credits, 0);
    expect(sum("2026-10-24", "daily")).toBe(5);
    expect(sum("2026-10-11", "daily")).toBe(5);
    expect(sum("2026-10-10", "daily")).toBe(0);
    expect(sum("2026-10-25", "daily")).toBe(0);
    expect(sum("2026-08-02", "weekly")).toBe(5);
    expect(sum("2026-08-01", "weekly")).toBe(0);
    expect(sum("2026-05-01", "monthly")).toBe(5);
    expect(sum("2026-04-30", "monthly")).toBe(0);
  });
});

describe("pool, severity and run-out", () => {
  it("pool = seats x credits per seat", () => expect(poolFor(25)).toBe(37500));
  it("default demo month is comfortably below the warning threshold", () => {
    const used = sumCredits(inWindow(generateUsage(NOW), monthStartKey(NOW), dayKey(NOW)));
    expect(used / poolFor(25)).toBeLessThan(0.8);
  });
  it("severity thresholds", () => {
    expect([79, 80, 94, 95, 99, 100, 120].map(severityOf)).toEqual(["ok", "warn", "warn", "high", "high", "full", "full"]);
  });
  it("debug scale lands the month near the requested percentage", () => {
    const s = scaleForPct(NOW, 96, 25);
    const used = sumCredits(inWindow(generateUsage(NOW, s), monthStartKey(NOW), dayKey(NOW)));
    expect(used / poolFor(25)).toBeGreaterThan(0.9);
    expect(used / poolFor(25)).toBeLessThan(1.02);
  });
  it("run-out uses the trailing 7-day average", () => {
    const e = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: String(i), date: dayKey(NOW - i * 86_400_000), memberId: "m-ava", projectId: "p-spring", tool: "Image" as const, credits: 10 }));
    expect(projectRunOut(e, 100, NOW)).toEqual({ days: 10, date: "2026-11-03" });
    expect(projectRunOut(e, 0, NOW)).toBeNull();
    expect(projectRunOut([], 100, NOW)).toBeNull();
  });
});
