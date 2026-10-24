import { describe, expect, it } from "vitest";
import { buildTestEvent, generateSecret, hmacHex, secretPreview, signPayload, validateEndpoint, verifySignature } from "../../src/lib/enterprise/webhooks";
import { INTEGRATIONS, validateInterest } from "../../src/lib/enterprise/integrations";

describe("webhook endpoint validation", () => {
  it("accepts public https only", () => {
    expect(validateEndpoint("https://example.com/hooks")).toBeNull();
    expect(validateEndpoint("http://example.com/hooks")).toMatch(/https/);
    expect(validateEndpoint("")).toBeTruthy();
    expect(validateEndpoint("not a url")).toBeTruthy();
    expect(validateEndpoint("https://user:pw@example.com/")).toMatch(/credentials/);
    expect(validateEndpoint("https://localhost/x")).toBeTruthy();
    expect(validateEndpoint("https://192.168.1.4/x")).toMatch(/Private/);
    expect(validateEndpoint("https://internal-host/x")).toBeTruthy();
    expect(validateEndpoint("ftp://example.com")).toMatch(/https/);
  });
});

describe("webhook signing", () => {
  it("matches the RFC 4231 HMAC-SHA256 test vector", async () => {
    expect(await hmacHex("Jefe", "what do ya want for nothing?")).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });
  it("is deterministic, verifies, and rejects tampering, wrong secret and stale timestamps", async () => {
    const secret = "whsec_test";
    const body = JSON.stringify(buildTestEvent("generation.completed", 1_700_000_000, 1));
    const a = await signPayload(secret, 1_700_000_000, body);
    expect(a).toEqual(await signPayload(secret, 1_700_000_000, body));
    expect(a.header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);
    expect(await verifySignature(secret, a.header, body, 300, 1_700_000_100)).toBe(true);
    expect(await verifySignature(secret, a.header, body + " ", 300, 1_700_000_100)).toBe(false);
    expect(await verifySignature("other", a.header, body, 300, 1_700_000_100)).toBe(false);
    expect(await verifySignature(secret, a.header, body, 300, 1_700_001_000)).toBe(false);
    expect(await verifySignature(secret, "garbage", body)).toBe(false);
  });
  it("generates unique base64url secrets and previews never expose the whole secret", () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    const p = secretPreview(a);
    expect(p.length).toBeLessThan(a.length - 20);
    expect(p).toContain("…");
  });
  it("test events are clearly demo events", () => {
    const e = buildTestEvent("credits.low", 1, 7);
    expect(e).toMatchObject({ id: "evt_demo_0007", livemode: false, demo: true, type: "credits.low" });
  });
});

describe("integrations catalogue", () => {
  it("never claims an unbuilt integration is connected", () => {
    for (const i of INTEGRATIONS) {
      if (i.href) expect(["/connect"]).toContain(i.href);
      else expect(["planned", "not-available"]).toContain(i.status);
    }
    expect(INTEGRATIONS.find((i) => i.id === "slack")?.status).toBe("not-available");
  });
  it("validates interest forms", () => {
    expect(validateInterest("", "")).toEqual({});
    expect(validateInterest("x".repeat(301), "").note).toBeTruthy();
    expect(validateInterest("", "nope").email).toBeTruthy();
    expect(validateInterest("ok", "a@b.co")).toEqual({});
  });
});
