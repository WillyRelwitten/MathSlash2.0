import type { ReactNode } from "react";
import {
  BookOpen,
  ChevronLeft,
  Heart,
  Lock,
  Pause,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRUIT_KINDS } from "@/game/assets";
import { difficultyBlurb, neededToUnlock } from "@/game/problems";
import { ALL_OPS, diffIndex } from "@/game/save";
import { useGame } from "@/game/store";
import { DIFFS, DIFF_LABEL, OP_LABEL, TABLES, type OpSel } from "@/game/types";
import { cn } from "@/lib/utils";

export function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="pointer-events-auto relative flex h-full flex-col px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-xs font-medium tracking-[0.28em] text-muted uppercase">Slash the fact</p>
        <h1 className="font-display mt-3 text-5xl font-extrabold tracking-tight text-fg sm:text-6xl">
          MathSlash
        </h1>
        <p className="mt-3 max-w-xs text-base leading-snug text-muted">
          Slash the right answer. Miss it, and you lose a life.
        </p>
        <div className="mt-8 flex items-end justify-center gap-2">
          {FRUIT_KINDS.map((f) => (
            <img
              key={f.id}
              src={f.src}
              alt=""
              className="h-11 w-11 object-contain sm:h-12 sm:w-12"
              draggable={false}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
        <Button size="xl" className="w-full font-display text-lg" onClick={onPlay}>
          Play
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" onClick={() => setScreen("how")}>
            <BookOpen className="size-4" />
            How to play
          </Button>
          <Button variant="secondary" size="lg" onClick={() => setScreen("scores")}>
            <Trophy className="size-4" />
            Best scores
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SetupScreen({ onStart }: { onStart: () => void }) {
  const { config, patchConfig, setScreen, isDiffOpen, best, save } = useGame();
  const showTables = config.op === "mul" || config.op === "div" || config.op === "mix";

  return (
    <div className="pointer-events-auto flex h-full flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="font-display text-lg font-semibold">Set the drill</h2>
      </header>

      <div className="mx-auto mt-4 flex w-full max-w-md flex-1 flex-col gap-6 overflow-y-auto pb-4">
        <section>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Operation</p>
          <div className="grid grid-cols-5 gap-2">
            {(["add", "sub", "mul", "div", "mix"] as OpSel[]).map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => patchConfig({ op })}
                className={cn(
                  "h-12 rounded-md border font-display text-lg",
                  config.op === op
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-raised text-fg",
                )}
                aria-pressed={config.op === op}
                aria-label={OP_LABEL[op]}
              >
                {op === "add" ? "+" : op === "sub" ? "−" : op === "mul" ? "×" : op === "div" ? "÷" : "±"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{OP_LABEL[config.op]}</p>
        </section>

        {showTables ? (
          <section>
            <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Table</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={config.table === "all"} onClick={() => patchConfig({ table: "all" })}>
                All
              </Chip>
              {TABLES.map((n) => (
                <Chip
                  key={n}
                  active={config.table === n}
                  onClick={() => patchConfig({ table: n })}
                >
                  {n}
                </Chip>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">Rank</p>
          <div className="grid grid-cols-2 gap-2">
            {DIFFS.map((d) => {
              const open = isDiffOpen(d);
              const prev = DIFFS[diffIndex(d) - 1] ?? "easy";
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!open}
                  onClick={() => patchConfig({ difficulty: d })}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left",
                    config.difficulty === d && open
                      ? "border-primary bg-primary text-primary-fg"
                      : "border-border bg-raised text-fg",
                    !open && "opacity-50",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-display text-sm font-semibold">
                    {!open ? <Lock className="size-3.5" /> : null}
                    {DIFF_LABEL[d]}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-xs leading-snug",
                      config.difficulty === d && open ? "text-primary-fg/70" : "text-muted",
                    )}
                  >
                    {open
                      ? difficultyBlurb(config.op, d, config.table)
                      : `Solve ${neededToUnlock(prev)} on ${DIFF_LABEL[prev]} to unlock`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-center text-sm text-muted">
          Best this setup <span className="tabular-nums text-fg">{best()}</span>
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <Button size="xl" className="w-full font-display text-lg" onClick={onStart}>
          Start
        </Button>
        <p className="mt-2 text-center text-xs text-muted">
          {save.unlocked[config.op] < 3
            ? "Clear a run to unlock the next rank."
            : "Every rank is open for this operation."}
        </p>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 min-w-10 rounded-md border px-3 text-sm font-medium",
        active ? "border-primary bg-primary text-primary-fg" : "border-border bg-raised text-fg",
      )}
    >
      {children}
    </button>
  );
}

export function HowScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const steps = [
    {
      title: "Read the problem",
      body: "The equation sits at the top. Addition, subtraction, multiplication, or division — you pick.",
    },
    {
      title: "Swipe the right fruit",
      body: "Fruits fly up with numbers on them. Draw a blade through the correct answer. One fruit per swipe.",
    },
    {
      title: "Wrong slices cost a life",
      body: "Hit a decoy, or let the right fruit fall, and you lose a life. Three lives. Combos multiply your score.",
    },
    {
      title: "Unlock the next rank",
      body: "Easy starts open. Solve enough in one run and Medium, Hard, then Expert come unlocked for that operation.",
    },
  ];
  return (
    <div className="pointer-events-auto flex h-full flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="font-display text-lg font-semibold">How to play</h2>
      </header>
      <ol className="mx-auto mt-6 flex w-full max-w-md flex-1 flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">Step {i + 1}</p>
            <h3 className="font-display mt-1 text-base font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <Button className="mx-auto mt-4 w-full max-w-md" size="lg" onClick={() => setScreen("setup")}>
        Set up a drill
      </Button>
    </div>
  );
}

export function ScoresScreen() {
  const { save, setScreen } = useGame();
  const rows: { label: string; value: number }[] = [];
  for (const op of ALL_OPS) {
    for (const d of DIFFS) {
      const key = `${op}:${d}:all`;
      const v = save.best[key];
      if (v) rows.push({ label: `${OP_LABEL[op]} · ${DIFF_LABEL[d]}`, value: v });
    }
  }
  rows.sort((a, b) => b.value - a.value);

  return (
    <div className="pointer-events-auto flex h-full flex-col px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setScreen("home")} aria-label="Back">
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="font-display text-lg font-semibold">Best scores</h2>
      </header>
      <div className="mx-auto mt-6 w-full max-w-md flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted">
            No scores yet. Play a drill and MathSlash will remember.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
              >
                <span className="text-sm">{r.label}</span>
                <span className="font-display tabular-nums text-fg">{r.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PlayHud({ onPause }: { onPause: () => void }) {
  const hud = useGame((s) => s.hud);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-4 pt-[max(10px,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Score</p>
          <p className="font-display text-2xl tabular-nums leading-none">{hud.score}</p>
          {hud.combo >= 2 ? (
            <p className="mt-1 text-xs font-semibold text-ok tabular-nums">×{hud.combo} combo</p>
          ) : (
            <p className="mt-1 text-xs text-muted">{hud.solved} solved</p>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-1 pr-1">
            {Array.from({ length: 3 }, (_, i) => (
              <Heart
                key={i}
                className={cn("size-5", i < hud.lives ? "fill-danger text-danger" : "text-border")}
              />
            ))}
          </div>
          <Button variant="secondary" size="icon" onClick={onPause} aria-label="Pause">
            <Pause className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 text-center">
        {hud.reveal ? (
          <p className="font-display text-2xl font-bold tracking-tight text-ok sm:text-3xl">
            {hud.reveal}
          </p>
        ) : (
          <p className="font-display text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">
            {hud.problem}
          </p>
        )}
      </div>
    </div>
  );
}

export function PauseScreen({
  onResume,
  onQuit,
}: {
  onResume: () => void;
  onQuit: () => void;
}) {
  const { save, toggleMute, toggleShake } = useGame();
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-bg/75 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Paused</h2>
        <p className="mt-1 text-sm text-muted">The fruits will wait.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onResume}>
            Resume
          </Button>
          <Button variant="secondary" size="lg" onClick={toggleMute}>
            {save.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {save.muted ? "Sound off" : "Sound on"}
          </Button>
          <Button variant="secondary" size="lg" onClick={toggleShake}>
            {save.shake ? "Screen shake on" : "Screen shake off"}
          </Button>
          <Button variant="outline" size="lg" onClick={onQuit}>
            Quit to menu
          </Button>
        </div>
      </div>
    </div>
  );
}

export function OverScreen({ onAgain, onMenu }: { onAgain: () => void; onMenu: () => void }) {
  const last = useGame((s) => s.lastRun);
  if (!last) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-bg/70 px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs font-medium tracking-[0.22em] text-muted uppercase">Run over</p>
        <h2 className="font-display mt-1 text-3xl font-bold tabular-nums">{last.score}</h2>
        <p className="mt-1 text-sm text-muted">
          {last.newBest ? "New best for this setup." : `Best ${last.best}`}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-raised px-3 py-2">
            <dt className="text-xs text-muted">Solved</dt>
            <dd className="font-display tabular-nums text-lg">{last.solved}</dd>
          </div>
          <div className="rounded-lg bg-raised px-3 py-2">
            <dt className="text-xs text-muted">Max combo</dt>
            <dd className="font-display tabular-nums text-lg">{last.maxCombo}</dd>
          </div>
        </dl>
        {last.unlockedNew ? (
          <p className="mt-3 text-sm text-ok">
            {DIFF_LABEL[last.unlockedNew]} is now unlocked for {OP_LABEL[last.config.op]}.
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <Button size="lg" onClick={onAgain}>
            <RotateCcw className="size-4" />
            Play again
          </Button>
          <Button variant="secondary" size="lg" onClick={onMenu}>
            Menu
          </Button>
        </div>
      </div>
    </div>
  );
}
