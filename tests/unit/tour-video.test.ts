import { describe, expect, it } from "vitest";
import { activeChapter, clampSeek, fmtClock, parseChaptersVtt, parseTimestamp } from "@/lib/guide/tour-video";

const VTT = `WEBVTT

1
00:00:00.800 --> 00:00:09.000
Welcome

2
00:00:09.000 --> 00:01:02.500
Search

bad
nonsense --> 00:00:03.000
Broken

3
00:01:02.500 --> 00:01:10.000 line:90%
Create
`;

describe("tour video chapters", () => {
  it("parses timestamps with and without hours", () => {
    expect(parseTimestamp("00:01:02.500")).toBe(62.5);
    expect(parseTimestamp("01:02.5")).toBe(62.5);
    expect(parseTimestamp("1:00:00")).toBe(3600);
    expect(parseTimestamp("x")).toBeNaN();
  });
  it("parses cues, skipping malformed ones", () => {
    const c = parseChaptersVtt(VTT);
    expect(c.map((x) => x.title)).toEqual(["Welcome", "Search", "Create"]);
    expect(c[1]).toEqual({ start: 9, end: 62.5, title: "Search" });
  });
  it("finds the active chapter", () => {
    const c = parseChaptersVtt(VTT);
    expect(activeChapter(c, 0)).toBe(-1);
    expect(activeChapter(c, 0.8)).toBe(0);
    expect(activeChapter(c, 9)).toBe(1);
    expect(activeChapter(c, 62.4)).toBe(1);
    expect(activeChapter(c, 999)).toBe(2);
    expect(activeChapter([], 5)).toBe(-1);
  });
  it("clamps seeks", () => {
    expect(clampSeek(-3, 70)).toBe(0);
    expect(clampSeek(80, 70)).toBe(70);
    expect(clampSeek(12, NaN)).toBe(12);
    expect(clampSeek(NaN, 70)).toBe(0);
  });
  it("formats clock", () => expect(fmtClock(65.9)).toBe("1:05"));
});
