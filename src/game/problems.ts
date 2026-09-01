import {
  type Difficulty,
  type Op,
  type OpSel,
  type Problem,
  type RunConfig,
  type TableSel,
  OP_SYMBOL,
  OPS,
} from "./types.ts";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, min: number, max: number): number {
  if (max < min) return min;
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function distractorCount(diff: Difficulty): number {
  switch (diff) {
    case "easy":
      return 2;
    case "medium":
      return 3;
    case "hard":
      return 4;
    case "expert":
      return 5;
  }
}

function factorRange(diff: Difficulty, table: TableSel): { lo: number; hi: number } {
  if (table !== "all") {
    switch (diff) {
      case "easy":
        return { lo: 1, hi: 5 };
      case "medium":
        return { lo: 2, hi: 10 };
      case "hard":
        return { lo: 2, hi: 12 };
      case "expert":
        return { lo: 2, hi: 12 };
    }
  }
  switch (diff) {
    case "easy":
      return { lo: 1, hi: 5 };
    case "medium":
      return { lo: 2, hi: 10 };
    case "hard":
      return { lo: 2, hi: 12 };
    case "expert":
      return { lo: 6, hi: 12 };
  }
}

function addRange(diff: Difficulty): { lo: number; hi: number } {
  switch (diff) {
    case "easy":
      return { lo: 1, hi: 9 };
    case "medium":
      return { lo: 4, hi: 20 };
    case "hard":
      return { lo: 10, hi: 50 };
    case "expert":
      return { lo: 20, hi: 99 };
  }
}

function evalOp(op: Op, a: number, b: number): number {
  switch (op) {
    case "add":
      return a + b;
    case "sub":
      return a - b;
    case "mul":
      return a * b;
    case "div":
      return b === 0 ? NaN : a / b;
  }
}

function makePrompt(op: Op, a: number, b: number): string {
  return `${a} ${OP_SYMBOL[op]} ${b}`;
}

function pushUnique(into: number[], value: number, answer: number) {
  if (!Number.isInteger(value)) return;
  if (value === answer) return;
  if (value < 0 || value > 999) return;
  if (into.includes(value)) return;
  into.push(value);
}

function fillDistractors(
  rng: Rng,
  op: Op,
  a: number,
  b: number,
  answer: number,
  count: number,
): number[] {
  const out: number[] = [];
  const extras: number[] = [];

  switch (op) {
    case "add":
      extras.push(
        a + b + 1,
        a + b - 1,
        a + b + 2,
        a + b - 2,
        a + b + 10,
        a + b - 10,
        Math.abs(a - b),
        a,
        b,
        a + a,
        b + b,
        a * b > 120 ? answer + 3 : a * b,
      );
      break;
    case "sub":
      extras.push(
        a + b,
        Math.abs(b - a),
        answer + 1,
        answer - 1,
        answer + 2,
        answer - 2,
        a,
        b,
        a - b + 10,
        a - 1 - b,
      );
      break;
    case "mul":
      extras.push(
        a + b,
        a * (b + 1),
        a * (b - 1),
        (a + 1) * b,
        (a - 1) * b,
        a * a,
        b * b,
        answer + a,
        answer - a,
        answer + 1,
        answer - 1,
        answer + 10,
        a * b + b,
      );
      break;
    case "div":
      extras.push(
        a - b,
        a + b,
        answer + 1,
        answer - 1,
        answer + 2,
        b,
        a,
        b === 0 ? 1 : Math.round(a / (b + 1)),
        answer * 2,
        a - answer,
      );
      break;
  }

  for (const v of shuffle(rng, extras)) {
    pushUnique(out, v, answer);
    if (out.length >= count) return out;
  }

  let k = 1;
  while (out.length < count && k < 80) {
    pushUnique(out, answer + k, answer);
    if (out.length >= count) break;
    pushUnique(out, answer - k, answer);
    k += 1;
  }
  return out.slice(0, count);
}

function generateAdd(rng: Rng, diff: Difficulty, table: TableSel): { a: number; b: number } {
  const range = addRange(diff);
  if (table !== "all") {
    const other = randInt(rng, range.lo, Math.min(range.hi, diff === "easy" ? 9 : range.hi));
    return rng() < 0.5 ? { a: table, b: other } : { a: other, b: table };
  }
  return { a: randInt(rng, range.lo, range.hi), b: randInt(rng, range.lo, range.hi) };
}

function generateSub(rng: Rng, diff: Difficulty, table: TableSel): { a: number; b: number } {
  if (table !== "all") {
    if (table > 1 && rng() < 0.4) {
      const b = randInt(rng, 1, table - 1);
      return { a: table, b };
    }
    const otherHi =
      diff === "easy" ? 9 : diff === "medium" ? 12 : diff === "hard" ? 20 : 40;
    const other = randInt(rng, 1, otherHi);
    return { a: table + other, b: table };
  }

  if (diff === "easy") {
    const a = randInt(rng, 2, 10);
    const b = randInt(rng, 1, a);
    return { a, b };
  }
  if (diff === "medium") {
    const a = randInt(rng, 10, 20);
    const b = randInt(rng, 1, Math.min(12, a));
    return { a, b };
  }
  if (diff === "hard") {
    const a = randInt(rng, 20, 60);
    const b = randInt(rng, 5, Math.min(40, a));
    return { a, b };
  }
  // Expert: prefer borrowing.
  let a = randInt(rng, 40, 99);
  let b = randInt(rng, 10, a);
  if (a % 10 >= b % 10) {
    const ones = randInt(rng, (a % 10) + 1, 9);
    const tens = randInt(rng, 1, Math.floor(a / 10));
    b = tens * 10 + ones;
    if (b > a) b = a - randInt(rng, 1, 9);
  }
  return { a, b };
}

function generateMul(rng: Rng, diff: Difficulty, table: TableSel): { a: number; b: number } {
  const range = factorRange(diff, table);
  if (table !== "all") {
    const other = randInt(rng, range.lo, range.hi);
    return rng() < 0.5 ? { a: table, b: other } : { a: other, b: table };
  }
  let a = randInt(rng, range.lo, range.hi);
  let b = randInt(rng, range.lo, range.hi);
  if (diff === "easy") {
    // Keep at least one factor small so kids can start.
    if (a > 5 && b > 5) a = randInt(rng, 1, 5);
  }
  if (diff === "expert" && rng() < 0.2) {
    a = randInt(rng, 12, 15);
    b = randInt(rng, 6, 12);
  }
  return { a, b };
}

function generateDiv(rng: Rng, diff: Difficulty, table: TableSel): { a: number; b: number } {
  const range = factorRange(diff, table);
  if (table !== "all") {
    const other = Math.max(2, randInt(rng, range.lo, range.hi));
    if (rng() < 0.7) {
      // n × table, divided by table → other
      return { a: table * other, b: table };
    }
    // n × table, divided by n → table
    return { a: table * other, b: other };
  }
  let divisor = randInt(rng, Math.max(2, range.lo), range.hi);
  let quotient = randInt(rng, Math.max(2, range.lo), range.hi);
  if (diff === "easy") {
    divisor = randInt(rng, 2, 5);
    quotient = randInt(rng, 2, 8);
  }
  return { a: divisor * quotient, b: divisor };
}

function generatePair(
  rng: Rng,
  op: Op,
  diff: Difficulty,
  table: TableSel,
): { a: number; b: number } {
  switch (op) {
    case "add":
      return generateAdd(rng, diff, table);
    case "sub":
      return generateSub(rng, diff, table);
    case "mul":
      return generateMul(rng, diff, table);
    case "div":
      return generateDiv(rng, diff, table);
  }
}

export function makeProblem(config: RunConfig, rng: Rng = Math.random): Problem {
  const op: Op = config.op === "mix" ? pick(rng, OPS) : config.op;
  const table = config.op === "mix" && config.table === "all" ? "all" : config.table;

  let a = 0;
  let b = 0;
  let answer = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    const pair = generatePair(rng, op, config.difficulty, table);
    a = pair.a;
    b = pair.b;
    answer = evalOp(op, a, b);
    if (!Number.isFinite(answer)) continue;
    if (!Number.isInteger(answer)) continue;
    if (answer < 0) continue;
    if (op === "div" && b === 0) continue;
    if (op === "div" && a !== answer * b) continue;
    break;
  }

  const distractors = fillDistractors(
    rng,
    op,
    a,
    b,
    answer,
    distractorCount(config.difficulty),
  );

  return {
    op,
    a,
    b,
    answer,
    prompt: makePrompt(op, a, b),
    distractors,
  };
}

export function problemKey(p: Problem): string {
  return `${p.op}:${p.a}:${p.b}`;
}

export function difficultyBlurb(
  op: OpSel,
  diff: Difficulty,
  table: TableSel,
): string {
  if (table !== "all" && (op === "mul" || op === "div" || op === "mix")) {
    const label = `${table}s`;
    switch (diff) {
      case "easy":
        return `${label} · factors 1–5 · slower throws`;
      case "medium":
        return `${label} · factors 2–10`;
      case "hard":
        return `${label} · full table · faster`;
      case "expert":
        return `${label} · full table · packed throws`;
    }
  }
  const byOp: Record<OpSel, Record<Difficulty, string>> = {
    add: {
      easy: "Sums within 18",
      medium: "Sums up to 40",
      hard: "Two-digit addition",
      expert: "Large two-digit sums",
    },
    sub: {
      easy: "Take-aways within 10",
      medium: "Within 20",
      hard: "Two-digit subtraction",
      expert: "Borrowing required",
    },
    mul: {
      easy: "Tables 1–5",
      medium: "Tables 2–10",
      hard: "Tables 2–12",
      expert: "Tables 6–12, quicker",
    },
    div: {
      easy: "÷ 2–5, exact facts",
      medium: "Tables to 10",
      hard: "Tables to 12",
      expert: "Tables to 12, quicker",
    },
    mix: {
      easy: "All four, small numbers",
      medium: "All four, to 10",
      hard: "All four, to 12",
      expert: "All four, fast",
    },
  };
  return byOp[op][diff];
}

export function neededToUnlock(from: Difficulty): number {
  switch (from) {
    case "easy":
      return 8;
    case "medium":
      return 12;
    case "hard":
      return 15;
    case "expert":
      return 0;
  }
}
