import { describe, expect, it } from "vitest";

import {
  ALL_CHAPTERS_MASK,
  CHAPTER_BIT,
  SAVE_MAX_BYTES,
  buildClearCookie,
  buildSaveCookie,
  hasVisited,
  newSave,
  parseSave,
  readCookieValue,
  sanitizeSave,
  serializeSave,
  visitedCount,
  withVisited,
  type SaveFile,
} from "./save";

const T = 1_760_000_000_000;

const sample = (over: Partial<SaveFile> = {}): SaveFile => ({
  ...newSave(T),
  loadout: [8, 11, 10, 4],
  defeated: [2],
  badges: ["first-steps", "first-blood"],
  hints: ["hero", "skills"],
  visited: CHAPTER_BIT.hero | CHAPTER_BIT.about,
  ...over,
});

describe("serialize / parse", () => {
  it("round-trips a save", () => {
    const save = sample();
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it("is URL-encoded compact JSON in the documented key order", () => {
    const raw = decodeURIComponent(serializeSave(sample()));
    expect(raw).toBe(
      '{"v":1,"loadout":[8,11,10,4],"defeated":[2],"badges":["first-steps","first-blood"],"hints":["hero","skills"],"visited":6,"t":1760000000000}',
    );
    expect(serializeSave(sample())).not.toMatch(/[;,\s"]/); // safe as a cookie value
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not JSON", "%7Bnope"],
    ["bad encoding", "%E0%A4%A"],
    ["unknown version", encodeURIComponent(JSON.stringify({ ...sample(), v: 2 }))],
    [
      "too many loadout slots",
      encodeURIComponent(JSON.stringify({ ...sample(), loadout: [1, 2, 3, 4, 5] })),
    ],
    ["string ids", encodeURIComponent(JSON.stringify({ ...sample(), defeated: ["2"] }))],
    ["visited out of range", encodeURIComponent(JSON.stringify({ ...sample(), visited: 256 }))],
    ["missing field", encodeURIComponent(JSON.stringify({ v: 1, loadout: [] }))],
  ])("rejects %s → null (start a new save)", (_, raw) => {
    expect(parseSave(raw)).toBeNull();
  });

  it("collapses duplicate ids", () => {
    const raw = encodeURIComponent(
      JSON.stringify({ ...sample(), defeated: [2, 2, 3], hints: ["hero", "hero"] }),
    );
    expect(parseSave(raw)).toMatchObject({ defeated: [2, 3], hints: ["hero"] });
  });

  it("stays under 2 KB by dropping hints first, then the oldest defeats", () => {
    const hints = Array.from({ length: 50 }, (_, i) => `project:some-long-project-slug-${i}`);
    const withHints = sample({ hints });
    const small = serializeSave(withHints);
    expect(small.length).toBeLessThanOrEqual(SAVE_MAX_BYTES);
    expect(parseSave(small)?.hints).toEqual([]);
    expect(parseSave(small)?.defeated).toEqual([2]);

    const defeated = Array.from({ length: 500 }, (_, i) => 100000 + i);
    const huge = serializeSave(sample({ hints, defeated }));
    expect(huge.length).toBeLessThanOrEqual(SAVE_MAX_BYTES);
    const parsed = parseSave(huge)!;
    expect(parsed.defeated.at(-1)).toBe(100499); // newest kept
    expect(parsed.badges).toEqual(["first-steps", "first-blood"]);
    expect(parsed.loadout).toEqual([8, 11, 10, 4]);
  });
});

describe("sanitizeSave", () => {
  it("drops skills and projects the site no longer has", () => {
    const save = sample({ loadout: [8, 99, 10], defeated: [2, 77] });
    expect(sanitizeSave(save, { skillIds: [8, 10], projectIds: [2, 3] })).toMatchObject({
      loadout: [8, 10],
      defeated: [2],
    });
  });
});

describe("visited bitmask", () => {
  it("marks chapters once and counts them", () => {
    let save = newSave(T);
    expect(hasVisited(save, "journey")).toBe(false);
    save = withVisited(save, "journey");
    const again = withVisited(save, "journey");
    expect(again).toBe(save); // unchanged → same object (no needless cookie write)
    expect(hasVisited(save, "journey")).toBe(true);
    expect(visitedCount(save.visited)).toBe(1);
    expect(visitedCount(ALL_CHAPTERS_MASK)).toBe(8);
  });
});

describe("cookie strings", () => {
  it("builds the documented attributes", () => {
    expect(buildSaveCookie("abc", { secure: false })).toBe(
      "hackker_save=abc; Max-Age=604800; Path=/; SameSite=Lax",
    );
    expect(buildSaveCookie("abc", { secure: true })).toMatch(/; Secure$/);
    expect(buildClearCookie({ secure: false })).toBe(
      "hackker_save=; Max-Age=0; Path=/; SameSite=Lax",
    );
  });

  it("reads one cookie out of document.cookie", () => {
    expect(readCookieValue("a=1; hackker_save=xyz; b=2")).toBe("xyz");
    expect(readCookieValue("hackker_save_old=1")).toBeNull();
    expect(readCookieValue("")).toBeNull();
  });
});
