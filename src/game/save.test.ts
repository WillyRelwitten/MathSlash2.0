import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSave, recordRun } from "./save.ts";

describe("save", () => {
  it("keeps theme and last classic from an older payload", () => {
    const save = parseSave({
      version: 1,
      best: { "mul:easy:all": 400 },
      unlocked: { add: 0, sub: 0, mul: 1, div: 0, mix: 0 },
      muted: false,
      shake: true,
      lastClassic: { op: "mul", difficulty: "medium", table: 6 },
      theme: "cave",
    });
    assert.equal(save.theme, "cave");
    assert.deepEqual(save.lastClassic, { op: "mul", difficulty: "medium", table: 6 });
    assert.equal(save.best["mul:easy:all"], 400);
    assert.equal(save.unlocked.mul, 1);
  });

  it("drops unknown worlds and broken last-classic rows", () => {
    const save = parseSave({
      version: 1,
      best: {},
      unlocked: {},
      muted: false,
      shake: true,
      lastClassic: { op: "laser", difficulty: "easy", table: "all" },
      theme: "forest",
    });
    assert.equal(save.theme, undefined);
    assert.equal(save.lastClassic, undefined);
  });

  it("recordRun keeps theme and last classic while writing a best", () => {
    const before = parseSave({
      version: 1,
      best: {},
      unlocked: { add: 0, sub: 0, mul: 0, div: 0, mix: 0 },
      muted: false,
      shake: true,
      lastClassic: { op: "add", difficulty: "easy", table: "all" },
      theme: "cave",
    });
    const { save, newBest, unlockedNew } = recordRun(
      before,
      { op: "add", difficulty: "easy", table: "all" },
      250,
      3,
    );
    assert.equal(newBest, true);
    assert.equal(unlockedNew, null);
    assert.equal(save.theme, "cave");
    assert.deepEqual(save.lastClassic, { op: "add", difficulty: "easy", table: "all" });
    assert.equal(save.best["add:easy:all"], 250);
  });
});
