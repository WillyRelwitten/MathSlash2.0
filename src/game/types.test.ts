import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSetup, labelForScoreKey } from "./types.ts";

describe("setup and score labels", () => {
  it("formats classic play hint without a table for add/sub", () => {
    assert.equal(formatSetup({ op: "add", difficulty: "easy", table: "all" }), "Addition · Easy");
  });

  it("includes the table for multiplication", () => {
    assert.equal(
      formatSetup({ op: "mul", difficulty: "medium", table: 7 }),
      "Multiplication · Medium · 7",
    );
  });

  it("labels saved bests including times-table runs", () => {
    assert.equal(labelForScoreKey("mul:hard:8"), "Multiplication · Hard · 8s");
    assert.equal(labelForScoreKey("mix:easy:all"), "Mix · Easy");
    assert.equal(labelForScoreKey("nope"), null);
  });
});
