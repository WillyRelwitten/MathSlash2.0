export const OPS = ["add", "sub", "mul", "div"] as const;
export type Op = (typeof OPS)[number];
export type OpSel = Op | "mix";

export const DIFFS = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFS)[number];

export type TableSel = number | "all";

export interface RunConfig {
  op: OpSel;
  difficulty: Difficulty;
  table: TableSel;
}

export interface Problem {
  op: Op;
  a: number;
  b: number;
  answer: number;
  prompt: string;
  distractors: number[];
}

export const OP_SYMBOL: Record<Op, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

export const OP_LABEL: Record<OpSel, string> = {
  add: "Addition",
  sub: "Subtraction",
  mul: "Multiplication",
  div: "Division",
  mix: "Mix",
};

export const DIFF_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function configKey(c: RunConfig): string {
  const table = c.table === "all" ? "all" : String(c.table);
  return `${c.op}:${c.difficulty}:${table}`;
}

export function scoreKey(c: RunConfig): string {
  return configKey(c);
}

export interface HudSnap {
  score: number;
  combo: number;
  lives: number;
  solved: number;
  problem: string;
  reveal: string | null;
  feedback: "correct" | "wrong" | "miss" | null;
}
