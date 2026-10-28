import { describe, expect, it } from "vitest";

import {
  KONAMI_KEYS,
  KONAMI_MAX_GAP_MS,
  KONAMI_START,
  KONAMI_TOUCH,
  keyToken,
  konamiProgress,
  stepKonami,
  touchToken,
  type KonamiState,
  type KonamiToken,
} from "./konami";

/** Feeds tokens 100 ms apart; returns the final state and how many times the code matched. */
function feed(
  tokens: readonly KonamiToken[],
  sequence: readonly KonamiToken[] = KONAMI_KEYS,
  start: KonamiState = KONAMI_START,
  gap = 100,
) {
  let state = start;
  let matches = 0;
  let now = 1000;
  for (const token of tokens) {
    const result = stepKonami(state, token, now, sequence);
    state = result.state;
    if (result.matched) matches++;
    now += gap;
  }
  return { state, matches };
}

describe("keyToken", () => {
  it("maps arrows and B/A, case-insensitively", () => {
    expect(keyToken("ArrowUp")).toBe("up");
    expect(keyToken("ArrowDown")).toBe("down");
    expect(keyToken("ArrowLeft")).toBe("left");
    expect(keyToken("ArrowRight")).toBe("right");
    expect(keyToken("b")).toBe("b");
    expect(keyToken("B")).toBe("b");
    expect(keyToken("A")).toBe("a");
  });

  it("ignores every other key", () => {
    expect(keyToken("Enter")).toBeNull();
    expect(keyToken("1")).toBeNull();
    expect(keyToken("c")).toBeNull();
  });
});

describe("stepKonami", () => {
  it("matches the exact sequence once", () => {
    expect(feed(KONAMI_KEYS).matches).toBe(1);
  });

  it("does not match a partial or wrong sequence", () => {
    expect(feed(KONAMI_KEYS.slice(0, 9)).matches).toBe(0);
    expect(feed([...KONAMI_KEYS.slice(0, 8), "a", "b"]).matches).toBe(0);
  });

  it("keeps a valid prefix after an extra press (↑ ↑ ↑ ↓ ↓ …)", () => {
    expect(feed(["up", ...KONAMI_KEYS]).matches).toBe(1);
    expect(feed(["up", "up", "up", "up", ...KONAMI_KEYS.slice(2)]).matches).toBe(1);
  });

  it("recovers after noise in the middle", () => {
    expect(feed(["up", "up", "down", "left", ...KONAMI_KEYS]).matches).toBe(1);
  });

  it("matches again when the code is entered a second time (toggle off)", () => {
    expect(feed([...KONAMI_KEYS, ...KONAMI_KEYS]).matches).toBe(2);
  });

  it("clears the buffer after a match, so a trailing B A alone never re-triggers", () => {
    const { state } = feed(KONAMI_KEYS);
    expect(state.buffer).toEqual([]);
    expect(feed(["b", "a"], KONAMI_KEYS, state).matches).toBe(0);
  });

  it("starts over after a long pause", () => {
    let state = KONAMI_START;
    let now = 0;
    let matched = false;
    KONAMI_KEYS.forEach((token, index) => {
      // A pause longer than the limit before the last key.
      now += index === KONAMI_KEYS.length - 1 ? KONAMI_MAX_GAP_MS + 1 : 200;
      const result = stepKonami(state, token, now);
      state = result.state;
      matched ||= result.matched;
    });
    expect(matched).toBe(false);
    expect(state.buffer).toEqual(["a"]);
  });

  it("works with the touch sequence", () => {
    expect(feed(KONAMI_TOUCH, KONAMI_TOUCH).matches).toBe(1);
    expect(feed(KONAMI_KEYS, KONAMI_TOUCH).matches).toBe(0);
  });
});

describe("konamiProgress", () => {
  it("reports how far into the code the visitor is", () => {
    expect(konamiProgress(KONAMI_START)).toBe(0);
    expect(konamiProgress(feed(KONAMI_KEYS.slice(0, 4)).state)).toBe(4);
    expect(konamiProgress(feed(["up", "up", "up"]).state)).toBe(2);
    expect(konamiProgress(feed(["left"]).state)).toBe(0);
  });
});

describe("touchToken", () => {
  it("reads swipes by their dominant axis (finger direction)", () => {
    expect(touchToken({ dx: 0, dy: -80, ms: 200 })).toBe("up");
    expect(touchToken({ dx: 4, dy: 90, ms: 200 })).toBe("down");
    expect(touchToken({ dx: -70, dy: 10, ms: 200 })).toBe("left");
    expect(touchToken({ dx: 70, dy: -12, ms: 200 })).toBe("right");
  });

  it("reads short, still touches as taps", () => {
    expect(touchToken({ dx: 3, dy: -2, ms: 120 })).toBe("tap");
    expect(touchToken({ dx: 3, dy: -2, ms: 900 })).toBeNull(); // long press
  });

  it("ignores diagonal, tiny or slow gestures", () => {
    expect(touchToken({ dx: 60, dy: 55, ms: 200 })).toBeNull();
    expect(touchToken({ dx: 20, dy: 0, ms: 200 })).toBeNull();
    expect(touchToken({ dx: 0, dy: 200, ms: 1500 })).toBeNull();
  });
});
