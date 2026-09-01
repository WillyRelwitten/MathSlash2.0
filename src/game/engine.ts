import { FRUIT_KINDS, type FruitKind, type GameAssets } from "./assets.ts";
import { pathLength, swipeHitsCircle, type Pt } from "./geometry.ts";
import { makeProblem, problemKey } from "./problems.ts";
import type { Problem, RunConfig, HudSnap } from "./types.ts";

export type { HudSnap };

const STEP = 1 / 60;
const MAX_DT = 0.1;
const MIN_SWIPE = 28;
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

interface Fruit {
  id: number;
  kind: FruitKind;
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
}

interface Half {
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
  side: 0 | 1;
  sliceAngle: number;
  life: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  color: string;
}

interface Stain {
  x: number;
  y: number;
  r: number;
  color: string;
  life: number;
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
  private problem: Problem | null = null;
  private lastKey = "";
  private fruits: Fruit[] = [];
  private halves: Half[] = [];
  private particles: Particle[] = [];
  private stains: Stain[] = [];
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

  start(config: RunConfig) {
    this.config = config;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = 3;
    this.solved = 0;
    this.lastKey = "";
    this.fruits = [];
    this.halves = [];
    this.particles = [];
    this.stains = [];
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
        fruits: this.fruits
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
        const f = this.fruits.find((x) => x.alive && !x.sliced && x.value === value);
        if (!f) return false;
        this.sliceFruit(f, 0, 1, 0);
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

    const toLocal = (e: PointerEvent): Pt => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * this.w,
        y: ((e.clientY - rect.top) / rect.height) * this.h,
      };
    };

    const down = (e: PointerEvent) => {
      if (!this.running || this.paused || this.phase === "over") return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events and some browsers */
      }
      this.swiping = true;
      this.swipeSpent = false;
      const p = toLocal(e);
      const now = performance.now() / 1000;
      this.swipePts = [{ ...p, t: now }];
      this.trail.push({ ...p, t: now });
    };
    const move = (e: PointerEvent) => {
      if (!this.swiping) return;
      e.preventDefault();
      const p = toLocal(e);
      const now = performance.now() / 1000;
      this.swipePts.push({ ...p, t: now });
      this.trail.push({ ...p, t: now });
      if (this.swipePts.length > 48) this.swipePts.shift();
      this.trySlice();
    };
    const up = (e: PointerEvent) => {
      if (!this.swiping) return;
      e.preventDefault();
      this.swiping = false;
      this.swipePts = [];
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };

    canvas.addEventListener("pointerdown", down, { passive: false });
    canvas.addEventListener("pointermove", move, { passive: false });
    canvas.addEventListener("pointerup", up, { passive: false });
    canvas.addEventListener("pointercancel", up, { passive: false });
    this.unsub.push(() => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
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
    this.fruits = [];
    this.throwHadWrong = false;
    this.phase = "throw";
    const values = [this.problem.answer, ...this.problem.distractors].sort(
      () => Math.random() - 0.5,
    );
    const kinds = [...FRUIT_KINDS].sort(() => Math.random() - 0.5);
    const n = values.length;
    const g = this.gravity();
    const pad = 24;
    const baseR = Math.min(72, Math.max(44, Math.min(this.w, this.h) * 0.09));

    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length]!;
      const r = baseR * kind.scale;
      const slot = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const edge = pad + r;
      const usable = Math.max(40, this.w - edge * 2);
      // Bunch near the middle so they have room to fan out as they rise.
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
      // Aim the *end* of the flight at a wider band so they drift apart in the
      // air without already being off-screen at the apex.
      const endHalf = Math.min(usable * 0.5, Math.max(startHalf * 1.2, usable * 0.46));
      const tOff = Math.max(0.7, (Math.abs(vy) / g) * 2);
      const vx = (this.w * 0.5 + slot * endHalf - x) / tOff + (Math.random() - 0.5) * 14;
      this.fruits.push({
        id: this.nextId++,
        kind,
        value: values[i]!,
        isAnswer: values[i] === this.problem.answer,
        x,
        y,
        vx,
        vy,
        r,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 4.2,
        alive: true,
        sliced: false,
        fade: 1,
      });
    }
    this.handlers.onEvent("throw");
  }

  private gravity(): number {
    // 25% lighter than the original 1450 so fruit hang in the slice zone longer
    return 1450 * 0.75 * (this.h / 800) * this.speed();
  }

  private trySlice() {
    if (this.swipeSpent || this.phase !== "throw" || this.freezeLeft > 0) return;
    if (pathLength(this.swipePts) < MIN_SWIPE) return;
    const live = this.fruits.filter((f) => f.alive && !f.sliced && f.fade > 0.8);
    // Prefer the fruit whose center is closest to the latest segment.
    let best: Fruit | null = null;
    let bestHit: ReturnType<typeof swipeHitsCircle> | null = null;
    let bestDist = Infinity;
    const last = this.swipePts[this.swipePts.length - 1];
    for (const f of live) {
      const hit = swipeHitsCircle(this.swipePts, f.x, f.y, f.r * 0.88);
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
    this.sliceFruit(best, bestHit.angle, bestHit.nx, bestHit.ny);
  }

  private sliceFruit(f: Fruit, angle: number, nx: number, ny: number) {
    f.sliced = true;
    f.alive = false;
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    this.spawnHalves(f, angle, nx, ny);
    this.burst(f.x, f.y, f.kind.juice, nx, ny);
    this.stains.push({
      x: f.x,
      y: f.y + f.r * 0.2,
      r: f.r * (1.2 + Math.random() * 0.4),
      color: f.kind.juice,
      life: 2.4,
    });
    if (this.stains.length > 18) this.stains.shift();

    if (f.isAnswer) {
      this.onCorrect(f);
    } else {
      this.onWrong(f);
    }
  }

  private onCorrect(f: Fruit) {
    this.solved += 1;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const gain = Math.round(BASE_SCORE[this.config!.difficulty] * (1 + Math.min(this.combo, 10) * 0.22));
    this.score += gain;
    this.floaters.push({
      x: f.x,
      y: f.y - f.r,
      text: `+${gain}`,
      life: 0.8,
      color: "#ece7df",
    });
    this.feedback = "correct";
    this.trauma = Math.min(1, this.trauma + 0.22);
    this.flash = 0.18;
    this.freezeLeft = this.reduced ? 0 : 0.045;
    this.handlers.onEvent(this.combo >= 3 ? "combo" : "correct");
    for (const other of this.fruits) {
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

  private onWrong(f: Fruit) {
    this.throwHadWrong = true;
    this.combo = 0;
    this.lives -= 1;
    this.feedback = "wrong";
    this.trauma = Math.min(1, this.trauma + 0.5);
    this.flash = 0.28;
    this.floaters.push({ x: f.x, y: f.y - f.r, text: "Wrong", life: 0.7, color: "#c4564a" });
    this.handlers.onEvent("wrong");
    this.emitHud();
    if (this.lives <= 0) {
      this.beginOver();
      return;
    }
    this.feedback = null;
  }

  private onMiss() {
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
    this.fruits = [];
  }

  private beginOver() {
    this.phase = "over";
    this.running = true;
    this.handlers.onOver({
      score: this.score,
      solved: this.solved,
      maxCombo: this.maxCombo,
    });
  }

  private spawnHalves(f: Fruit, angle: number, nx: number, ny: number) {
    const impulse = 240;
    for (const side of [0, 1] as const) {
      const sign = side === 0 ? -1 : 1;
      this.halves.push({
        kind: f.kind,
        x: f.x + nx * sign * 8,
        y: f.y + ny * sign * 8,
        vx: f.vx * 0.4 + nx * sign * impulse,
        vy: f.vy * 0.25 + ny * sign * impulse * 0.45 - 90,
        r: f.r,
        rot: f.rot,
        spin: f.spin + sign * 6,
        side,
        sliceAngle: angle,
        life: 0.9,
      });
    }
  }

  private burst(x: number, y: number, color: string, nx: number, ny: number) {
    const n = this.reduced ? 8 : 18;
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(ny, nx) + (Math.random() - 0.5) * Math.PI;
      const sp = 80 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        r: 2.5 + Math.random() * 4.5,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
      });
    }
  }

  private step(dt: number) {
    const now = performance.now() / 1000;
    this.trail = this.trail.filter((p) => now - p.t < 0.16);

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

    for (const f of this.fruits) {
      if (f.sliced) continue;
      f.vy += g * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt;
      if (f.fade < 1) {
        f.fade -= dt * 3.5;
        if (f.fade <= 0) f.alive = false;
      }
      if (f.y - f.r > this.h + 36) {
        if (f.isAnswer && !f.sliced && f.fade > 0.5 && this.phase === "throw") {
          f.alive = false;
          this.onMiss();
        } else {
          f.alive = false;
        }
      }
    }

    for (const h of this.halves) {
      h.vy += g * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.rot += h.spin * dt;
      h.life -= dt;
    }
    this.halves = this.halves.filter((h) => h.life > 0 && h.y < this.h + 80);

    for (const p of this.particles) {
      p.vy += g * 0.7 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const s of this.stains) s.life -= dt;
    this.stains = this.stains.filter((s) => s.life > 0);

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

    for (const s of this.stains) {
      ctx.globalAlpha = Math.max(0, Math.min(0.28, s.life * 0.14));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.55, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const h of this.halves) this.drawHalf(ctx, h);
    for (const f of this.fruits) {
      if (f.sliced || (!f.alive && f.fade <= 0)) continue;
      this.drawFruit(ctx, f);
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
          ? `rgba(196,86,74,${this.flash * 0.35})`
          : `rgba(244,240,234,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const img = w >= h ? this.assets.landscape : this.assets.portrait;
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(12,12,11,0.45)");
    g.addColorStop(0.45, "rgba(12,12,11,0.12)");
    g.addColorStop(1, "rgba(12,12,11,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawFruit(ctx: CanvasRenderingContext2D, f: Fruit) {
    const img = this.assets.fruits[f.kind.id];
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, f.fade));
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    const s = f.r * 2;
    if (img) ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.rotate(-f.rot);
    this.drawBadge(ctx, f.value, f.r);
    ctx.restore();
  }

  private drawHalf(ctx: CanvasRenderingContext2D, h: Half) {
    const img = this.assets.fruits[h.kind.id];
    if (!img) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, h.life / 0.5));
    ctx.translate(h.x, h.y);
    ctx.rotate(h.sliceAngle);
    ctx.beginPath();
    if (h.side === 0) ctx.rect(-h.r - 4, -h.r - 4, h.r + 4, h.r * 2 + 8);
    else ctx.rect(0, -h.r - 4, h.r + 4, h.r * 2 + 8);
    ctx.clip();
    ctx.rotate(-h.sliceAngle + h.rot);
    const s = h.r * 2;
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  private drawBadge(ctx: CanvasRenderingContext2D, value: number, r: number) {
    const label = String(value);
    const br = r * (label.length > 2 ? 0.5 : 0.46);
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12,12,11,0.72)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(244,240,234,0.35)";
    ctx.stroke();
    ctx.fillStyle = "#f4f0ea";
    const size = label.length > 2 ? r * 0.42 : r * 0.52;
    ctx.font = `800 ${Math.round(size)}px Sora, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 1);
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.trail.length < 2) return;
    const now = performance.now() / 1000;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]!;
      const b = this.trail[i]!;
      const age = 1 - (now - b.t) / 0.16;
      if (age <= 0) continue;
      ctx.strokeStyle = `rgba(244,240,234,${0.2 + 0.75 * age})`;
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
