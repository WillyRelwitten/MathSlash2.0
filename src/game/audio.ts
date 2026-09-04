import { DEFAULT_THEME, type ThemeId } from "./themes.ts";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private theme: ThemeId = DEFAULT_THEME;

  unlock() {
    if (!this.ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new C({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
    }
  }

  setTheme(theme: ThemeId) {
    this.theme = theme;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain = 0.12,
    slide?: number,
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private noise(dur: number, gain = 0.08, hp = 800) {
    if (!this.ctx || !this.master || this.muted) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = hp;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  slice() {
    if (this.theme === "cave") {
      this.noise(0.14, 0.11, 220 + Math.random() * 90);
      this.noise(0.08, 0.07, 1100 + Math.random() * 280);
      this.tone(110 + Math.random() * 30, 0.08, "triangle", 0.04, 60);
      return;
    }
    this.noise(0.16, 0.12, 380 + Math.random() * 160);
    this.noise(0.09, 0.07, 820 + Math.random() * 200);
    this.tone(160 + Math.random() * 40, 0.09, "sine", 0.045, 80);
  }

  correct() {
    this.slice();
    if (this.theme === "cave") {
      this.noise(0.2, 0.14, 160);
      this.noise(0.12, 0.08, 480);
      this.tone(196, 0.09, "triangle", 0.055, 100);
      this.tone(523.25, 0.1, "sine", 0.08);
      this.tone(659.25, 0.13, "sine", 0.06);
      return;
    }
    this.tone(523.25, 0.1, "sine", 0.1);
    this.tone(659.25, 0.14, "sine", 0.08);
  }

  wrong() {
    if (this.theme === "cave") {
      this.noise(0.1, 0.09, 140);
      this.tone(88, 0.16, "sine", 0.055, 50);
      this.tone(64, 0.12, "triangle", 0.035);
      return;
    }
    this.noise(0.22, 0.07, 2600);
    this.noise(0.16, 0.045, 4200);
    this.tone(280, 0.12, "sine", 0.03, 120);
  }

  miss() {
    this.tone(140, 0.22, "sine", 0.08, 70);
  }

  combo(n: number) {
    const base = 392 + Math.min(n, 8) * 40;
    this.tone(base, 0.08, "triangle", 0.07);
    this.tone(base * 1.5, 0.12, "sine", 0.05);
  }

  gameover() {
    this.tone(330, 0.18, "sine", 0.08, 220);
    this.tone(220, 0.3, "triangle", 0.07, 110);
  }

  throwWhoosh() {
    if (this.theme === "cave") {
      this.noise(0.2, 0.055, 260);
      this.noise(0.1, 0.03, 140);
      return;
    }
    this.noise(0.16, 0.045, 400);
  }
}

export const audio = new GameAudio();
