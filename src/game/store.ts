import { create } from "zustand";
import type { Difficulty, HudSnap, Mode, OpSel, RunConfig } from "./types.ts";
import { scoreKey } from "./types.ts";
import {
  type SaveData,
  bestFor,
  isUnlocked,
  loadSave,
  persistSave,
  recordRun,
} from "./save.ts";

export type Screen =
  | "home"
  | "setup"
  | "junior"
  | "how"
  | "scores"
  | "playing"
  | "paused"
  | "over";

export interface LastRun {
  score: number;
  solved: number;
  maxCombo: number;
  best: number;
  newBest: boolean;
  unlockedNew: Difficulty | null;
  config: RunConfig;
}

interface GameState {
  screen: Screen;
  mode: Mode;
  config: RunConfig;
  save: SaveData;
  hud: HudSnap;
  lastRun: LastRun | null;
  setScreen: (s: Screen) => void;
  setMode: (m: Mode) => void;
  patchConfig: (p: Partial<RunConfig>) => void;
  applyLastClassic: () => void;
  rememberClassic: () => void;
  setHud: (h: HudSnap) => void;
  toggleMute: () => void;
  toggleShake: () => void;
  finishRun: (score: number, solved: number, maxCombo: number) => void;
  isDiffOpen: (diff: Difficulty) => boolean;
  best: () => number;
}

const idleHud: HudSnap = {
  score: 0,
  combo: 0,
  lives: 3,
  solved: 0,
  problem: "",
  reveal: null,
  feedback: null,
};

const DEFAULT_CLASSIC: RunConfig = { op: "mul", difficulty: "easy", table: "all" };

function bootSave() {
  const save = loadSave();
  return { save, config: save.lastClassic ?? DEFAULT_CLASSIC };
}

const booted = bootSave();

function persistClassic(save: SaveData, config: RunConfig): SaveData {
  const next = { ...save, lastClassic: config };
  persistSave(next);
  return next;
}

export const useGame = create<GameState>((set, get) => ({
  screen: "home",
  mode: "classic",
  config: booted.config,
  save: booted.save,
  hud: idleHud,
  lastRun: null,
  setScreen: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  patchConfig: (p) => {
    const config = { ...get().config, ...p };
    if (p.op && p.op !== "mul" && p.op !== "div" && p.op !== "mix") {
      config.table = "all";
    }
    if (get().screen === "setup") {
      set({ config, save: persistClassic(get().save, config) });
    } else {
      set({ config });
    }
  },
  applyLastClassic: () => {
    set({ config: get().save.lastClassic ?? DEFAULT_CLASSIC });
  },
  rememberClassic: () => {
    set({ save: persistClassic(get().save, get().config) });
  },
  setHud: (hud) => set({ hud }),
  toggleMute: () => {
    const save = { ...get().save, muted: !get().save.muted };
    persistSave(save);
    set({ save });
  },
  toggleShake: () => {
    const save = { ...get().save, shake: !get().save.shake };
    persistSave(save);
    set({ save });
  },
  finishRun: (score, solved, maxCombo) => {
    if (get().mode === "junior") return;
    const { save, config } = get();
    const result = recordRun(save, config, score, solved);
    set({
      save: result.save,
      screen: "over",
      lastRun: {
        score,
        solved,
        maxCombo,
        best: result.save.best[scoreKey(config)] ?? score,
        newBest: result.newBest,
        unlockedNew: result.unlockedNew,
        config,
      },
    });
  },
  isDiffOpen: (diff) => isUnlocked(get().save, get().config.op, diff),
  best: () => bestFor(get().save, get().config),
}));

export type { OpSel };

