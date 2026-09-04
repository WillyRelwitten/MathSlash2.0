import {
  type Difficulty,
  type OpSel,
  type RunConfig,
  type TableSel,
  DIFFS,
  TABLES,
  scoreKey,
} from "./types.ts";
import { neededToUnlock } from "./problems.ts";
import { type ThemeId, isThemeId } from "./themes.ts";

const KEY = "mathslash-save";
const VERSION = 1;

export interface SaveData {
  version: number;
  best: Record<string, number>;
  /** Highest difficulty index unlocked per operation (0 = easy only). */
  unlocked: Record<OpSel, number>;
  muted: boolean;
  shake: boolean;
  /** Last classic Play setup. Optional so old saves keep loading. */
  lastClassic?: RunConfig;
  /** Selected world skin. Optional so old saves keep loading (default beach). */
  theme?: ThemeId;
}

const OPS_SEL: OpSel[] = ["add", "sub", "mul", "div", "mix"];

function empty(): SaveData {
  const unlocked = { add: 0, sub: 0, mul: 0, div: 0, mix: 0 } as Record<OpSel, number>;
  return { version: VERSION, best: {}, unlocked, muted: false, shake: true };
}

function parseTheme(raw: unknown): ThemeId | undefined {
  return isThemeId(raw) ? raw : undefined;
}

function parseLastClassic(raw: unknown): RunConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (!OPS_SEL.includes(c.op as OpSel)) return undefined;
  if (!DIFFS.includes(c.difficulty as Difficulty)) return undefined;
  const table = c.table;
  const tableOk =
    table === "all" ||
    (typeof table === "number" &&
      Number.isInteger(table) &&
      (TABLES as readonly number[]).includes(table));
  if (!tableOk) return undefined;
  const op = c.op as OpSel;
  const resolvedTable: TableSel =
    op === "mul" || op === "div" || op === "mix" ? (table as TableSel) : "all";
  return { op, difficulty: c.difficulty as Difficulty, table: resolvedTable };
}

function migrate(raw: SaveData): SaveData {
  const base = empty();
  const lastClassic = parseLastClassic(raw.lastClassic);
  const theme = parseTheme(raw.theme);
  const next: SaveData = {
    ...base,
    ...raw,
    version: VERSION,
    best: raw.best ?? {},
    unlocked: { ...base.unlocked, ...(raw.unlocked ?? {}) },
    muted: Boolean(raw.muted),
    shake: raw.shake !== false,
  };
  if (lastClassic) next.lastClassic = lastClassic;
  else delete next.lastClassic;
  if (theme) next.theme = theme;
  else delete next.theme;
  return next;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || typeof parsed !== "object") return empty();
    return migrate(parsed);
  } catch {
    return empty();
  }
}

export function persistSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* private mode / quota */
  }
}

export function diffIndex(d: Difficulty): number {
  return DIFFS.indexOf(d);
}

export function isUnlocked(save: SaveData, op: OpSel, diff: Difficulty): boolean {
  return diffIndex(diff) <= (save.unlocked[op] ?? 0);
}

export function recordRun(
  save: SaveData,
  config: RunConfig,
  score: number,
  solved: number,
): { save: SaveData; newBest: boolean; unlockedNew: Difficulty | null } {
  const next: SaveData = {
    ...save,
    best: { ...save.best },
    unlocked: { ...save.unlocked },
  };
  const key = scoreKey(config);
  const prevBest = next.best[key] ?? 0;
  const newBest = score > prevBest;
  if (newBest) next.best[key] = score;

  let unlockedNew: Difficulty | null = null;
  const idx = diffIndex(config.difficulty);
  const need = neededToUnlock(config.difficulty);
  if (need > 0 && solved >= need && (next.unlocked[config.op] ?? 0) < idx + 1) {
    next.unlocked[config.op] = idx + 1;
    unlockedNew = DIFFS[idx + 1] ?? null;
  }
  persistSave(next);
  return { save: next, newBest, unlockedNew };
}

export function bestFor(save: SaveData, config: RunConfig): number {
  return save.best[scoreKey(config)] ?? 0;
}

export const ALL_OPS: OpSel[] = OPS_SEL;
