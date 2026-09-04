import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_THEME, THEME_PACKS, THEMES, isThemeId } from "./themes.ts";

describe("themes", () => {
  it("only ships Beach and Cave", () => {
    assert.deepEqual([...THEMES], ["beach", "cave"]);
  });

  it("defaults to beach", () => {
    assert.equal(DEFAULT_THEME, "beach");
  });

  it("accepts known ids only", () => {
    assert.equal(isThemeId("beach"), true);
    assert.equal(isThemeId("cave"), true);
    assert.equal(isThemeId("forest"), false);
    assert.equal(isThemeId(undefined), false);
  });

  it("has player-facing copy for each world", () => {
    for (const id of THEMES) {
      const pack = THEME_PACKS[id];
      assert.ok(pack.homeSubtitle.length > 10);
      assert.ok(pack.howSwipe.length > 10);
      assert.ok(pack.howWrong.length > 10);
      assert.ok(pack.pauseWait.length > 4);
    }
  });
});
