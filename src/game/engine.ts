import { backdropFor, type BalloonKind, type GameAssets } from "./assets.ts";
import { pathLength, swipeHitsCircle, type Pt } from "./geometry.ts";
import { makeProblem, problemKey } from "./problems.ts";
import {
  CHIP_COLORS,
  DEFAULT_THEME,
  DUST_COLORS,
  FIZZLE_COLORS,
  SPARK_COLORS,
  TRAIL_RGB,
  WATER_COLORS,
  kindsFor,
  type ThemeId,
} from "./themes.ts";
import type { Mode, Problem, RunConfig, HudSnap } from "./types.ts";

export type { HudSnap };

const STEP = 1 / 60;
const MAX_DT = 0.1;
const MIN_SWIPE = 12;
const BASE_SCORE: Record<RunConfig["difficulty"], number> = {
  easy: 100,
  medium: 160,
  hard: 240,
  expert: 360,
};

export interface RunResult {
  score: number;
  solved: number;
  maxCombo: number;
}

/** Projectile. Beach draws a water balloon; cave draws a rock. Same physics either way. */
interface Balloon {
  id: number;
  kind: BalloonKind;
  value: number;
  isAnswer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  alive: boolean;
  sliced: boolean;
  fade: number;
  /** 0 = full; >0 shrinking fizzle / crumble. Correct pops skip this. */
  deflate: number;
}

type ParticleKind = "water" | "fizzle" | "dust" | "spark" | "shard" | "chip";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  color: string;
  kind: ParticleKind;
  rot?: number;
  spin?: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

interface TrailPt extends Pt {
  t: number;
}

export interface EngineHandlers {
  onHud: (hud: HudSnap) => void;
  onOver: (result: RunResult) => void;
  onEvent: (kind: "correct" | "wrong" | "miss" | "combo" | "throw") => void;
}

function rockJitter(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = m((pa >> 16) & 255, (pb >> 16) & 255);
  const g = m((pa >> 8) & 255, (pb >> 8) & 255);
  const bl = m(pa & 255, pb & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

export class SliceEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private assets: GameAssets;
  private handlers: EngineHandlers;
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private paused = false;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private config: RunConfig | null = null;
  private mode: Mode = "classic";
  private theme: ThemeId = DEFAULT_THEME;
  private problem: Problem | null = null;
  private lastKey = "";
  private balloons: Balloon[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private trail: TrailPt[] = [];
  private swiping = false;
  private swipePts: TrailPt[] = [];
  private swipeSpent = false;
  private phase: "think" | "throw" | "reveal" | "over" = "think";
  private thinkLeft = 0;
  private freezeLeft = 0;
  private trauma = 0;
  private flash = 0;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private lives = 3;
  private solved = 0;
  private nextId = 1;
  private throwHadWrong = false;
  private revealText: string | null = null;
  private feedback: HudSnap["feedback"] = null;
  private reduced = false;
  private shakeOn = true;
  private unsub: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement, assets: GameAssets, handlers: EngineHandlers) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas 2D unavailable");
    this.ctx = ctx;
    this.assets = assets;
    this.handlers = handlers;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.bind();
    this.resize();
  }

  setShake(on: boolean) {
    this.shakeOn = on;
  }

  setTheme(theme: ThemeId) {
    this.theme = theme;
  }

  start(config: RunConfig, mode: Mode = "classic", theme: ThemeId = DEFAULT_THEME) {
    this.config = config;
    this.mode = mode;
    this.theme = theme;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = 3;
    this.solved = 0;
    this.lastKey = "";
    this.balloons = [];
    this.particles = [];
    this.floaters = [];
    this.trail = [];
    this.phase = "think";
    this.thinkLeft = 0.35;
    this.problem = this.nextProblem();
    this.revealText = null;
    this.feedback = null;
    this.paused = false;
    this.running = true;
    this.acc = 0;
    this.last = performance.now();
    this.emitHud();
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p && this.running) this.last = performance.now();
  }

  destroy() {
    this.stop();
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  debug() {
    return {
      get: () => ({
        lives: this.lives,
        score: this.score,
        combo: this.combo,
        solved: this.solved,
        phase: this.phase,
        problem: this.problem,
        fruits: this.balloons
          .filter((f) => f.alive && !f.sliced)
          .map((f) => ({
            x: f.x,
            y: f.y,
            r: f.r,
            value: f.value,
            isAnswer: f.isAnswer,
          })),
      }),
      sliceValue: (value: number) => {
        const f = this.balloons.find((x) => x.alive && !x.sliced && x.value === value);
        if (!f) return false;
        this.sliceBalloon(f, 0, 1, 0);
        return true;
      },
    };
  }

  private bind() {
    const canvas = this.canvas;
    const onResize = () => this.resize();
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);
    this.unsub.push(() => ro.disconnect());
    window.addEventListener("resize", onResize);
    this.unsub.push(() => window.removeEventListener("resize", onResize));

    const toLocal = (clientX: number, clientY: number): Pt => {
      const rect = canvas.getBoundingClientRect();
      const rw = rect.width || 1;
      const rh = rect.height || 1;
      return {
        x: ((clientX - rect.left) / rw) * this.w,
        y: ((clientY - rect.top) / rh) * this.h,
      };
    };

    const isHud = (e: Event) => {
      const el = e.target as HTMLElement | null;
      return !!el?.closest?.("button, a, input, textarea, [data-ui]");
    };

    canvas.style.pointerEvents = "auto";
    canvas.style.touchAction = "none";

    const downAt = (clientX: number, clientY: number) => {
      if (!this.running || this.paused || this.phase === "over") return;
      this.swiping = true;
      this.swipeSpent = false;
      const p = toLocal(clientX, clientY);
      const now = performance.now() / 1000;
      this.swipePts = [{ ...p, t: now }];
      this.trail.push({ ...p, t: now });
    };
    const moveAt = (clientX: number, clientY: number) => {
      if (!this.swiping) return;
      const p = toLocal(clientX, clientY);
      const now = performance.now() / 1000;
      this.swipePts.push({ ...p, t: now });
      this.trail.push({ ...p, t: now });
      if (this.swipePts.length > 96) this.swipePts.shift();
      this.trySlice();
    };
    const upAt = () => {
      if (!this.swiping) return;
      this.swiping = false;
      this.swipePts = [];
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isHud(e)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      downAt(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.swiping) return;
      moveAt(e.clientX, e.clientY);
      e.preventDefault();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!this.swiping) return;
      upAt();
      e.preventDefault();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isHud(e)) return;
      downAt(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!this.swiping) return;
      moveAt(e.clientX, e.clientY);
    };
    const onMouseUp = () => upAt();
    const onTouchStart = (e: TouchEvent) => {
      if (isHud(e)) return;
      const t = e.touches[0];
      if (!t) return;
      downAt(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      moveAt(t.clientX, t.clientY);
      e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!this.swiping) return;
      upAt();
      e.preventDefault();
    };

    const opts: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener("pointerdown", onPointerDown, opts);
    window.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);
    window.addEventListener("pointercancel", onPointerUp, opts);
    window.addEventListener("mousedown", onMouseDown, opts);
    window.addEventListener("mousemove", onMouseMove, opts);
    window.addEventListener("mouseup", onMouseUp, opts);
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onTouchEnd, opts);
    this.unsub.push(() => {
      window.removeEventListener("pointerdown", onPointerDown, opts);
      window.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
      window.removeEventListener("pointercancel", onPointerUp, opts);
      window.removeEventListener("mousedown", onMouseDown, opts);
      window.removeEventListener("mousemove", onMouseMove, opts);
      window.removeEventListener("mouseup", onMouseUp, opts);
      window.removeEventListener("touchstart", onTouchStart, opts);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd, opts);
      window.removeEventListener("touchcancel", onTouchEnd, opts);
    });
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.paused) {
      this.render();
      return;
    }
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!Number.isFinite(dt) || dt < 0) dt = STEP;
    dt = Math.min(dt, MAX_DT);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 8) {
      this.step(STEP);
      this.acc -= STEP;
      steps += 1;
    }
    this.render();
  };

  private nextProblem(): Problem {
    if (!this.config) throw new Error("no config");
    let p = makeProblem(this.config);
    for (let i = 0; i < 8 && problemKey(p) === this.lastKey; i++) {
      p = makeProblem(this.config);
    }
    this.lastKey = problemKey(p);
    return p;
  }

  private emitHud() {
    this.handlers.onHud({
      score: this.score,
      combo: this.combo,
      lives: this.lives,
      solved: this.solved,
      problem: this.problem?.prompt ?? "",
      reveal: this.revealText,
      feedback: this.feedback,
    });
  }

  private thinkTime(): number {
    const d = this.config?.difficulty ?? "easy";
    return { easy: 0.7, medium: 0.45, hard: 0.28, expert: 0.16 }[d];
  }

  private speed(): number {
    const d = this.config?.difficulty ?? "easy";
    return { easy: 0.82, medium: 1, hard: 1.18, expert: 1.36 }[d];
  }

  private spawnThrow() {
    if (!this.problem) return;
    this.balloons = [];
    this.throwHadWrong = false;
    this.phase = "throw";
    const values = [this.problem.answer, ...this.problem.distractors].sort(
      () => Math.random() - 0.5,
    );
    const kinds = [...kindsFor(this.theme)].sort(() => Math.random() - 0.5);
    const n = values.length;
    const baseR = Math.min(72, Math.max(44, Math.min(this.w, this.h) * 0.09));

    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length]!;
      const r = baseR * kind.scale;
      const slot = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const toss = this.tossFromWater(r, slot, n);
      this.balloons.push({
        id: this.nextId++,
        kind,
        value: values[i]!,
        isAnswer: values[i] === this.problem.answer,
        x: toss.x,
        y: toss.y,
        vx: toss.vx,
        vy: toss.vy,
        r,
        rot: (Math.random() - 0.5) * 0.5,
        spin: (Math.random() - 0.5) * 1.2,
        alive: true,
        sliced: false,
        fade: 1,
        deflate: 0,
      });
    }
    this.handlers.onEvent("throw");
  }

  /** Shared launch arc used by the initial throw and Junior relaunch. */
  private tossFromWater(r: number, slot: number, n: number) {
    const g = this.gravity();
    const pad = 24;
    const edge = pad + r;
    const usable = Math.max(40, this.w - edge * 2);
    const packedHalf = n <= 1 ? 0 : (r * 2.1 * (n - 1)) / 2;
    const startHalf = Math.min(usable * 0.36, Math.max(packedHalf, usable * 0.18));
    let x =
      this.w * 0.5 +
      slot * startHalf +
      (Math.random() - 0.5) * Math.min(16, usable * 0.03);
    x = Math.max(edge + 2, Math.min(this.w - edge - 2, x));
    const y = this.h + r * 0.4;
    const apex = this.h * (0.2 + Math.random() * 0.16);
    const rise = Math.max(80, y - apex);
    const vy = -Math.sqrt(2 * g * rise) * (0.92 + Math.random() * 0.12);
    const endHalf = Math.min(usable * 0.5, Math.max(startHalf * 1.2, usable * 0.46));
    const tOff = Math.max(0.7, (Math.abs(vy) / g) * 2);
    const vx = (this.w * 0.5 + slot * endHalf - x) / tOff + (Math.random() - 0.5) * 14;
    return { x, y, vx, vy };
  }

  private relaunch(f: Balloon) {
    const cohort = this.balloons.filter((b) => b.alive && !b.sliced && b.fade >= 1);
    const n = Math.max(1, cohort.length);
    const i = Math.max(0, cohort.indexOf(f));
    const slot = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const toss = this.tossFromWater(f.r, slot, n);
    f.x = toss.x;
    f.y = toss.y;
    f.vx = toss.vx;
    f.vy = toss.vy;
  }

  private gravity(): number {
    const g = 1450 * 0.75 * (this.h / 800) * this.speed();
    return this.mode === "junior" ? g * 0.15 : g;
  }

  private trySlice() {
    if (this.swipeSpent || this.phase !== "throw" || this.freezeLeft > 0) return;
    if (pathLength(this.swipePts) < MIN_SWIPE) return;
    const live = this.balloons.filter((f) => f.alive && !f.sliced && f.fade > 0.8);
    let best: Balloon | null = null;
    let bestHit: ReturnType<typeof swipeHitsCircle> | null = null;
    let bestDist = Infinity;
    const last = this.swipePts[this.swipePts.length - 1];
    for (const f of live) {
      const hit = swipeHitsCircle(this.swipePts, f.x, f.y, f.r * 1.38);
      if (!hit.hit) continue;
      const d = last ? Math.hypot(last.x - f.x, last.y - f.y) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = f;
        bestHit = hit;
      }
    }
    if (!best || !bestHit) return;
    this.swipeSpent = true;
    this.sliceBalloon(best, bestHit.angle, bestHit.nx, bestHit.ny);
  }

  private sliceBalloon(f: Balloon, _angle: number, nx: number, ny: number) {
    f.sliced = true;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    if (f.isAnswer) {
      f.alive = false;
      if (this.theme === "cave") this.rockShatter(f.x, f.y, nx, ny, f.kind);
      else this.waterBurst(f.x, f.y, nx, ny);
      this.onCorrect(f);
    } else {
      f.deflate = 0.02;
      if (this.theme === "cave") this.rockChip(f.x, f.y, f.kind);
      else this.fizzle(f.x, f.y);
      this.onWrong(f);
    }
  }

  private onCorrect(f: Balloon) {
    this.solved += 1;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const gain = Math.round(BASE_SCORE[this.config!.difficulty] * (1 + Math.min(this.combo, 10) * 0.22));
    this.score += gain;
    this.floaters.push({
      x: f.x,
      y: f.y - f.r,
      text: this.mode === "junior" ? "Nice!" : `+${gain}`,
      life: 0.8,
      color: this.theme === "cave" ? "#f6efe2" : "#1a2430",
    });
    this.feedback = "correct";
    this.trauma = Math.min(1, this.trauma + 0.22);
    this.flash = 0.18;
    this.freezeLeft = this.reduced ? 0 : 0.07;
    this.handlers.onEvent(this.combo >= 3 ? "combo" : "correct");
    for (const other of this.balloons) {
      if (!other.sliced && other.alive) {
        other.fade = 0.7;
        other.vy += 220;
      }
    }
    this.phase = "think";
    this.thinkLeft = 0.38 + this.thinkTime() * 0.35;
    this.revealText = null;
    this.problem = this.nextProblem();
    this.emitHud();
  }

  private onWrong(f: Balloon) {
    this.throwHadWrong = true;
    this.combo = 0;
    if (this.mode !== "junior") this.lives -= 1;
    this.feedback = "wrong";
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.flash = 0.28;
    this.floaters.push({
      x: f.x,
      y: f.y - f.r,
      text: this.mode === "junior" ? "Try again" : "Wrong",
      life: 0.7,
      color: this.mode === "junior" ? (this.theme === "cave" ? "#f6efe2" : "#1a2430") : "#c4564a",
    });
    this.handlers.onEvent("wrong");
    this.emitHud();
    if (this.mode !== "junior" && this.lives <= 0) {
      this.beginOver();
      return;
    }
    this.feedback = null;
  }

  private onMiss() {
    if (this.mode === "junior") return;
    this.combo = 0;
    if (!this.throwHadWrong) this.lives -= 1;
    this.feedback = "miss";
    this.trauma = Math.min(1, this.trauma + 0.35);
    const p = this.problem;
    this.revealText = p ? `${p.prompt}  =  ${p.answer}` : null;
    this.handlers.onEvent("miss");
    this.emitHud();
    if (this.lives <= 0) {
      this.beginOver();
      return;
    }
    this.phase = "reveal";
    this.thinkLeft = 0.95;
    this.balloons = [];
  }

  private beginOver() {
    if (this.mode === "junior") return;
    this.phase = "over";
    this.running = true;
    this.handlers.onOver({
      score: this.score,
      solved: this.solved,
      maxCombo: this.maxCombo,
    });
  }

  private waterBurst(x: number, y: number, nx: number, ny: number) {
    const n = this.reduced ? 14 : 32;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * Math.PI * 1.45;
      const sp = 90 + Math.random() * 340;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 140,
        r: 3 + Math.random() * 6.5,
        life: 0.4 + Math.random() * 0.45,
        max: 0.85,
        color: WATER_COLORS[i % WATER_COLORS.length]!,
        kind: "water",
      });
    }
  }

  private fizzle(x: number, y: number) {
    const n = this.reduced ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 18 + Math.random() * 95;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 16,
        r: 1.2 + Math.random() * 2.4,
        life: 0.28 + Math.random() * 0.3,
        max: 0.58,
        color: FIZZLE_COLORS[i % FIZZLE_COLORS.length]!,
        kind: "fizzle",
      });
    }
  }

  private rockShatter(x: number, y: number, nx: number, ny: number, kind: BalloonKind) {
    const shards = this.reduced ? 8 : 16;
    const dust = this.reduced ? 10 : 22;
    const sparks = this.reduced ? 4 : 10;
    for (let i = 0; i < shards; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * Math.PI * 1.5;
      const sp = 70 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        r: 4 + Math.random() * 8,
        life: 0.38 + Math.random() * 0.4,
        max: 0.8,
        color: i % 2 === 0 ? kind.fill : (kind.rim ?? kind.fill),
        kind: "shard",
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
      });
    }
    for (let i = 0; i < dust; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        r: 2.5 + Math.random() * 5,
        life: 0.45 + Math.random() * 0.4,
        max: 0.85,
        color: DUST_COLORS[i % DUST_COLORS.length]!,
        kind: "dust",
      });
    }
    for (let i = 0; i < sparks; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * 1.2;
      const sp = 160 + Math.random() * 260;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        r: 1.1 + Math.random() * 1.6,
        life: 0.18 + Math.random() * 0.16,
        max: 0.34,
        color: SPARK_COLORS[i % SPARK_COLORS.length]!,
        kind: "spark",
      });
    }
  }

  private rockChip(x: number, y: number, kind: BalloonKind) {
    const n = this.reduced ? 5 : 12;
    const chips = [kind.fill, kind.rim, kind.highlight, ...CHIP_COLORS];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 16 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        r: 1.4 + Math.random() * 2.8,
        life: 0.3 + Math.random() * 0.28,
        max: 0.58,
        color: chips[i % chips.length]!,
        kind: "chip",
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * (20 + Math.random() * 40),
        vy: Math.sin(a) * (20 + Math.random() * 40),
        r: 1 + Math.random() * 1.4,
        life: 0.16 + Math.random() * 0.12,
        max: 0.28,
        color: SPARK_COLORS[i % SPARK_COLORS.length]!,
        kind: "spark",
      });
    }
  }

  private step(dt: number) {
    const now = performance.now() / 1000;
    this.trail = this.trail.filter((p) => now - p.t < 0.45);

    if (this.freezeLeft > 0) {
      this.freezeLeft -= dt;
      this.flash = Math.max(0, this.flash - dt * 3);
      this.trauma = Math.max(0, this.trauma - dt * 1.8);
      return;
    }

    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);

    if (this.phase === "think" || this.phase === "reveal") {
      this.thinkLeft -= dt;
      if (this.thinkLeft <= 0) {
        const fromReveal = this.phase === "reveal";
        this.revealText = null;
        this.feedback = null;
        if (fromReveal || !this.problem) this.problem = this.nextProblem();
        this.spawnThrow();
        this.emitHud();
      }
    }

    const g = this.gravity();

    for (const f of this.balloons) {
      if (f.sliced) {
        if (f.deflate > 0) {
          f.deflate = Math.min(1, f.deflate + dt * 2.5);
          f.vy += g * 0.25 * dt;
          f.x += f.vx * dt * 0.25;
          f.y += f.vy * dt * 0.35;
          f.rot += f.spin * dt * 0.4;
          if (f.deflate >= 1) f.alive = false;
        }
        continue;
      }
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.fade < 1) {
        f.fade -= dt * 3.5;
        if (f.fade <= 0) f.alive = false;
      }
      if (f.y - f.r > this.h + 36) {
        if (this.mode === "junior" && !f.sliced && f.fade >= 1) {
          this.relaunch(f);
        } else if (f.isAnswer && !f.sliced && f.fade > 0.5 && this.phase === "throw") {
          f.alive = false;
          this.onMiss();
        } else {
          f.alive = false;
        }
      }
    }

    for (const p of this.particles) {
      const grav =
        p.kind === "fizzle" || p.kind === "chip"
          ? g * 0.12
          : p.kind === "dust"
            ? g * 0.35
            : p.kind === "spark"
              ? g * 0.08
              : p.kind === "shard"
                ? g * 0.95
                : g * 0.85;
      p.vy += grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot = (p.rot ?? 0) + p.spin * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const f of this.floaters) {
      f.y -= 48 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  private render() {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    let sx = 0;
    let sy = 0;
    if (this.shakeOn && !this.reduced && this.trauma > 0) {
      const mag = this.trauma * this.trauma * 14;
      sx = (Math.random() - 0.5) * mag;
      sy = (Math.random() - 0.5) * mag;
    }
    ctx.save();
    ctx.translate(sx, sy);

    this.drawBg(ctx, w, h);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      if (p.kind === "water" || p.kind === "spark") {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r * (p.kind === "spark" ? 2.1 : 1.35), p.r * 0.68, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === "shard") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot ?? 0);
        ctx.beginPath();
        ctx.moveTo(p.r, 0);
        ctx.lineTo(-p.r * 0.55, p.r * 0.7);
        ctx.lineTo(-p.r * 0.35, -p.r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    for (const f of this.balloons) {
      if (f.sliced && f.deflate <= 0) continue;
      if (!f.alive && f.deflate <= 0 && f.fade <= 0) continue;
      if (f.fade <= 0 && f.deflate <= 0) continue;
      this.drawBalloon(ctx, f);
    }

    this.drawTrail(ctx);
    for (const fl of this.floaters) {
      ctx.globalAlpha = Math.max(0, fl.life / 0.8);
      ctx.fillStyle = fl.color;
      ctx.font = `700 ${Math.round(Math.min(w, h) * 0.038)}px Sora, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle =
        this.feedback === "wrong" || this.feedback === "miss"
          ? `rgba(196,86,74,${this.flash * 0.28})`
          : this.theme === "cave"
            ? `rgba(255,176,72,${this.flash * 0.2})`
            : `rgba(126,234,246,${this.flash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pair = backdropFor(this.assets, this.theme);
    const img = w >= h ? pair.landscape : pair.portrait;
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (this.theme === "cave") {
      g.addColorStop(0, "rgba(8, 10, 14, 0.22)");
      g.addColorStop(0.5, "rgba(12, 14, 18, 0.08)");
      g.addColorStop(1, "rgba(6, 6, 8, 0.28)");
    } else {
      g.addColorStop(0, "rgba(170, 214, 242, 0.10)");
      g.addColorStop(0.48, "rgba(255, 244, 220, 0.05)");
      g.addColorStop(1, "rgba(232, 204, 154, 0.16)");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawBalloon(ctx: CanvasRenderingContext2D, f: Balloon) {
    if (this.theme === "cave") {
      this.drawRock(ctx, f);
      return;
    }
    const k = f.kind;
    const def = Math.max(0, Math.min(1, f.deflate));
    const scale = 1 - def * 0.84;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.fade)) * (1 - def * 0.4);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    const r = f.r * scale;
    const fill = mixHex(k.fill, "#f4efe6", def * 0.72);
    const rim = mixHex(k.rim, "#cfc8bc", def * 0.72);
    const hi = mixHex(k.highlight, "#ffffff", def * 0.4);

    const grd = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, r * 0.12, r * 1.05);
    grd.addColorStop(0, mixHex(fill, "#ffffff", 0.38));
    grd.addColorStop(0.52, fill);
    grd.addColorStop(1, rim);

    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.98, r * 1.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = Math.max(2.2, r * 0.06);
    ctx.strokeStyle = rim;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-r * 0.15, r * 0.78);
    ctx.quadraticCurveTo(0, r * 0.9, r * 0.15, r * 0.78);
    ctx.lineTo(r * 0.09, r * 1.02);
    ctx.quadraticCurveTo(0, r * 1.12, -r * 0.09, r * 1.02);
    ctx.closePath();
    ctx.fillStyle = rim;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(0, r * 1.13, r * 0.16, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = mixHex(rim, "#1a1814", 0.18);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, r * 1.13, r * 0.09, r * 0.065, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.38, r * 0.22, r * 0.14, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = hi;
    ctx.globalAlpha *= 0.78;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-r * 0.06, -r * 0.54, r * 0.08, r * 0.05, 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.fade)) * (1 - def * 0.4);

    ctx.rotate(-f.rot);
    this.drawBalloonNumber(ctx, f.value, r);
    ctx.restore();
  }

  private drawRock(ctx: CanvasRenderingContext2D, f: Balloon) {
    const k = f.kind;
    const def = Math.max(0, Math.min(1, f.deflate));
    const scale = 1 - def * 0.42;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.fade)) * (1 - def * 0.35);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);

    const r = f.r * scale;
    const fill = mixHex(k.fill, "#4a453c", def * 0.55);
    const rim = mixHex(k.rim, "#2a2620", def * 0.45);
    const hi = mixHex(k.highlight, "#c8c0b4", def * 0.35);
    const vein = k.vein ?? hi;

    const grd = ctx.createRadialGradient(-r * 0.22, -r * 0.28, r * 0.1, r * 0.1, r * 0.2, r * 1.1);
    grd.addColorStop(0, mixHex(fill, hi, 0.28));
    grd.addColorStop(0.55, fill);
    grd.addColorStop(1, rim);

    this.rockOutline(ctx, r, f.id);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.strokeStyle = rim;
    ctx.stroke();

    ctx.save();
    ctx.clip();
    ctx.globalAlpha *= 0.55;
    ctx.strokeStyle = vein;
    ctx.lineWidth = Math.max(1.2, r * 0.045);
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, -r * 0.1);
    ctx.quadraticCurveTo(0, r * 0.15, r * 0.5, -r * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = mixHex(rim, "#1a1814", 0.3);
    ctx.moveTo(-r * 0.2, r * 0.35);
    ctx.quadraticCurveTo(r * 0.1, r * 0.05, r * 0.42, r * 0.4);
    ctx.stroke();

    ctx.globalAlpha = Math.max(0, Math.min(1, f.fade)) * (1 - def * 0.35) * 0.5;
    ctx.fillStyle = hi;
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.32, r * 0.18, r * 0.1, -0.6, 0, Math.PI * 2);
    ctx.fill();

    if (def > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.fade)) * Math.min(1, def * 1.6);
      ctx.strokeStyle = mixHex(rim, "#1a1612", 0.4);
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.45);
      ctx.lineTo(r * 0.05, -r * 0.05);
      ctx.lineTo(-r * 0.08, r * 0.38);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.22, -r * 0.2);
      ctx.lineTo(r * 0.02, r * 0.12);
      ctx.stroke();
    }
    ctx.restore();

    ctx.rotate(-f.rot);
    this.drawBalloonNumber(ctx, f.value, r);
    ctx.restore();
  }

  private rockOutline(ctx: CanvasRenderingContext2D, r: number, seed: number) {
    const n = 8;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const jag = 0.78 + rockJitter(seed, i) * 0.26;
      const x = Math.cos(a) * r * jag;
      const y = Math.sin(a) * r * jag * 0.94;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  private drawBalloonNumber(ctx: CanvasRenderingContext2D, value: number, r: number) {
    const label = String(value);
    const size = label.length > 2 ? r * 0.7 : r * 0.86;
    ctx.font = `800 ${Math.round(size)}px Sora, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = Math.max(4, size * 0.18);
    ctx.strokeStyle = "rgba(255,255,255,0.94)";
    ctx.fillStyle = "#1a2430";
    ctx.strokeText(label, 0, -r * 0.06);
    ctx.fillText(label, 0, -r * 0.06);
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.trail.length < 2) return;
    const now = performance.now() / 1000;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]!;
      const b = this.trail[i]!;
      const age = 1 - (now - b.t) / 0.45;
      if (age <= 0) continue;
      const tint = TRAIL_RGB[this.theme];
      ctx.strokeStyle = `rgba(${tint.r},${tint.g},${tint.b},${0.18 + 0.7 * age})`;
      ctx.lineWidth = 2 + 13 * age;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

declare global {
  interface Window {
    __mathSlash?: ReturnType<SliceEngine["debug"]>;
  }
}
