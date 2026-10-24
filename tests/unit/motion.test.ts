import { describe, expect, it, vi } from "vitest";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { createSlotManager } from "@/lib/playback-slots";
import { getPosts } from "@/lib/seed";
import { PHOTOS, motionFor } from "@/lib/media-library";
import { pickMedia } from "@/lib/generate";
import { ASPECTS } from "@/lib/models";

const pub = (p: string) => path.join(process.cwd(), "public", p);

describe("playback slot manager", () => {
  const sym = (n: string) => Symbol(n);

  it("never exceeds max concurrent and queues the rest", () => {
    const m = createSlotManager({ max: () => 3 });
    const ids = Array.from({ length: 6 }, (_, i) => sym(`v${i}`));
    const granted = ids.map((id) => m.request(id, { stop: () => undefined }));
    expect(granted).toEqual([true, true, true, false, false, false]);
    expect(m.active()).toBe(3);
    expect(m.waiting()).toBe(3);
  });

  it("release frees a slot and grants the next waiter in order", () => {
    const m = createSlotManager({ max: () => 2 });
    const [a, b, c, d] = [sym("a"), sym("b"), sym("c"), sym("d")];
    const granted: string[] = [];
    m.request(a, { stop: () => undefined });
    m.request(b, { stop: () => undefined });
    m.request(c, { stop: () => undefined, onGrant: () => granted.push("c") });
    m.request(d, { stop: () => undefined, onGrant: () => granted.push("d") });
    m.release(a);
    expect(granted).toEqual(["c"]);
    expect(m.active()).toBe(2);
    m.release(c);
    expect(granted).toEqual(["c", "d"]);
    m.release(b);
    m.release(d);
    expect(m.active()).toBe(0);
    expect(m.waiting()).toBe(0);
  });

  it("a released waiter is dequeued and never granted", () => {
    const m = createSlotManager({ max: () => 1 });
    const [a, b] = [sym("a"), sym("b")];
    const onGrant = vi.fn();
    m.request(a, { stop: () => undefined });
    m.request(b, { stop: () => undefined, onGrant });
    m.release(b);
    m.release(a);
    expect(onGrant).not.toHaveBeenCalled();
  });

  it("steal pauses the oldest holder to make room", () => {
    const m = createSlotManager({ max: () => 2 });
    const stopA = vi.fn();
    const [a, b, c] = [sym("a"), sym("b"), sym("c")];
    m.request(a, { stop: stopA });
    m.request(b, { stop: () => undefined });
    expect(m.request(c, { stop: () => undefined, steal: true })).toBe(true);
    expect(stopA).toHaveBeenCalledOnce();
    expect(m.active()).toBe(2);
  });

  it("re-requesting the same id does not take a second slot", () => {
    const m = createSlotManager({ max: () => 2 });
    const a = sym("a");
    m.request(a, { stop: () => undefined });
    m.request(a, { stop: () => undefined });
    expect(m.active()).toBe(1);
  });

  it("max is read live (3 desktop, 2 touch)", () => {
    let max = 3;
    const m = createSlotManager({ max: () => max });
    const ids = [sym("a"), sym("b"), sym("c")];
    ids.forEach((id) => m.request(id, { stop: () => undefined }));
    expect(m.active()).toBe(3);
    max = 2;
    expect(m.request(sym("d"), { stop: () => undefined })).toBe(false);
  });

  it("reduced motion / data saver denies automatic playback and queues nothing; explicit tap is allowed", () => {
    let allowed = false;
    const m = createSlotManager({ max: () => 3, allowed: () => allowed });
    const a = sym("a");
    expect(m.request(a, { stop: () => undefined })).toBe(false);
    expect(m.active()).toBe(0);
    expect(m.waiting()).toBe(0);
    expect(m.request(a, { stop: () => undefined, explicit: true })).toBe(true);
    allowed = true;
    expect(m.request(sym("b"), { stop: () => undefined })).toBe(true);
  });
});

describe("motion assets", () => {
  it("every image post has a motion loop that exists on disk, within size budget", () => {
    const images = getPosts().filter((p) => p.kind === "image");
    expect(images.length).toBeGreaterThan(30);
    for (const p of images) {
      expect(p.motion, p.id).toBeTruthy();
      expect(existsSync(pub(p.motion!)), p.motion).toBe(true);
      expect(statSync(pub(p.motion!)).size, p.motion).toBeLessThanOrEqual(120_000);
      // poster is the original photo and still present
      expect(p.poster).toBe(p.src);
      expect(existsSync(pub(p.src))).toBe(true);
    }
  });

  it("video posts keep working without a motion field", () => {
    for (const p of getPosts().filter((x) => x.kind === "video")) {
      expect(p.motion).toBeUndefined();
      expect(existsSync(pub(p.src))).toBe(true);
    }
  });

  it("every library photo has a loop on disk", () => {
    for (const ph of PHOTOS) {
      const m = motionFor(ph.src);
      expect(m, ph.id).toBeTruthy();
      expect(existsSync(pub(m!)), m).toBe(true);
    }
    expect(motionFor("https://example.com/x.jpg")).toBeUndefined();
    expect(motionFor("/media/vid/hero.mp4")).toBeUndefined();
  });

  it("mock image generations return an additive motion loop for every aspect", () => {
    for (const aspect of ASPECTS) {
      const out = pickMedia({ kind: "image", model: "x", prompt: "a fox", aspect });
      expect(out.motion).toBeTruthy();
      expect(existsSync(pub(out.motion!))).toBe(true);
    }
    expect(pickMedia({ kind: "video", model: "x", prompt: "a fox", aspect: "16:9" }).motion).toBeUndefined();
  });
});
