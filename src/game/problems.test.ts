import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeProblem, mulberry32, problemKey } from "./problems.ts";
import { DIFFS, OPS, type Op } from "./types.ts";

function check(p: ReturnType<typeof makeProblem>, op?: Op) {
  assert.equal(Number.isInteger(p.a), true, "a integer");
  assert.equal(Number.isInteger(p.b), true, "b integer");
  assert.equal(Number.isInteger(p.answer), true, "answer integer");
  assert.ok(p.answer >= 0, "answer non-negative");
  if (op) assert.equal(p.op, op);
  const expected =
    p.op === "add"
      ? p.a + p.b
      : p.op === "sub"
        ? p.a - p.b
        : p.op === "mul"
          ? p.a * p.b
          : p.a / p.b;
  assert.equal(p.answer, expected, `${p.prompt} should equal ${expected}`);
  if (p.op === "div") {
    assert.notEqual(p.b, 0);
    assert.equal(p.a, p.answer * p.b);
  }
  if (p.op === "sub") assert.ok(p.a >= p.b);
  assert.ok(p.prompt.includes(String(p.a)));
  assert.ok(p.prompt.includes(String(p.b)));
  assert.ok(!p.distractors.includes(p.answer), "distractor != answer");
  assert.equal(new Set(p.distractors).size, p.distractors.length, "unique distractors");
  for (const d of p.distractors) {
    assert.equal(Number.isInteger(d), true);
    assert.ok(d >= 0);
    assert.ok(d <= 999);
  }
}

describe("makeProblem", () => {
  for (const op of OPS) {
    for (const diff of DIFFS) {
      it(`${op} ${diff} produces valid facts`, () => {
        const rng = mulberry32(op.length * 100 + DIFFS.indexOf(diff) * 17 + 9);
        for (let i = 0; i < 80; i++) {
          const p = makeProblem({ op, difficulty: diff, table: "all" }, rng);
          check(p, op);
        }
      });
    }
  }

  it("mix never returns an invalid op", () => {
    const rng = mulberry32(4242);
    for (let i = 0; i < 60; i++) {
      const p = makeProblem({ op: "mix", difficulty: "medium", table: "all" }, rng);
      assert.ok((OPS as readonly string[]).includes(p.op));
      check(p);
    }
  });

  it("specific times table sticks to that factor", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 40; i++) {
      const p = makeProblem({ op: "mul", difficulty: "medium", table: 7 }, rng);
      check(p, "mul");
      assert.ok(p.a === 7 || p.b === 7, `7 times: ${p.prompt}`);
    }
  });

  it("specific division table uses the table as divisor or quotient", () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 40; i++) {
      const p = makeProblem({ op: "div", difficulty: "hard", table: 8 }, rng);
      check(p, "div");
      assert.ok(p.b === 8 || p.answer === 8, `8s division: ${p.prompt} = ${p.answer}`);
    }
  });

  it("easy addition stays in a kid-friendly band", () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 40; i++) {
      const p = makeProblem({ op: "add", difficulty: "easy", table: "all" }, rng);
      check(p, "add");
      assert.ok(p.a <= 9 && p.b <= 9);
      assert.ok(p.answer <= 18);
    }
  });

  it("does not immediately repeat when rng varies", () => {
    const rng = mulberry32(99);
    const keys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      keys.add(problemKey(makeProblem({ op: "mul", difficulty: "medium", table: "all" }, rng)));
    }
    assert.ok(keys.size > 5);
  });
});

