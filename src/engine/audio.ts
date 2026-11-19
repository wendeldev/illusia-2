// Efeitos sonoros sintetizados com Web Audio: nenhum arquivo de áudio para baixar.
// O navegador só libera o som depois do primeiro toque/tecla, por isso o unlock().

export type SoundName =
  | 'swing' | 'hit' | 'heavy' | 'crit' | 'kill' | 'hurt'
  | 'wind' | 'whirl' | 'thunder' | 'levelup' | 'coin' | 'ui' | 'wave' | 'nomp';

const MUTE_KEY = 'lumen-muted';

export class Sfx {
  /** contexto de áudio compartilhado com a música (existe após o primeiro toque) */
  ctx: AudioContext | null = null;
  private unlockListeners: ((ctx: AudioContext) => void)[] = [];
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* sem storage */ }
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* sem storage */ }
  }

  private unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    const ctx = this.ctx;
    this.unlockListeners.forEach((fn) => fn(ctx));
    this.unlockListeners = [];
  }

  /** Chama `fn` quando o áudio estiver liberado (na hora, se já estiver). */
  onUnlock(fn: (ctx: AudioContext) => void): void {
    if (this.ctx) fn(this.ctx);
    else this.unlockListeners.push(fn);
  }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, vol: number, delay = 0): void {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0): void {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bq).connect(g).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name: SoundName): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const v = 0.9 + Math.random() * 0.2; // pequena variação para não soar repetitivo
    switch (name) {
      case 'swing': this.noise(0.09, 0.25, 'bandpass', 900 * v, 3200 * v); break;
      case 'hit':
        this.noise(0.08, 0.5, 'lowpass', 2500, 400);
        this.tone(190 * v, 60, 0.09, 'square', 0.18);
        break;
      case 'heavy':
        this.noise(0.18, 0.7, 'lowpass', 1800, 200);
        this.tone(130 * v, 40, 0.22, 'sine', 0.6);
        break;
      case 'crit':
        this.noise(0.1, 0.55, 'lowpass', 3500, 500);
        this.tone(900 * v, 1600, 0.1, 'triangle', 0.25);
        this.tone(160, 50, 0.12, 'square', 0.2);
        break;
      case 'kill':
        this.tone(420 * v, 90, 0.2, 'square', 0.16);
        this.noise(0.25, 0.35, 'lowpass', 1500, 150);
        break;
      case 'hurt':
        this.tone(320, 120, 0.18, 'sawtooth', 0.25);
        this.noise(0.12, 0.4, 'lowpass', 1200, 200);
        break;
      case 'wind': this.noise(0.3, 0.4, 'highpass', 800, 5000); break;
      case 'whirl':
        this.noise(0.35, 0.45, 'bandpass', 500, 2500);
        this.noise(0.35, 0.3, 'bandpass', 2500, 600, 0.12);
        break;
      case 'thunder':
        this.noise(0.5, 0.9, 'lowpass', 4000, 120);
        this.tone(90, 35, 0.45, 'sawtooth', 0.35);
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.25, i * 0.08));
        break;
      case 'coin':
        this.tone(988, 988, 0.06, 'square', 0.08);
        this.tone(1319, 1319, 0.12, 'square', 0.08, 0.06);
        break;
      case 'ui': this.tone(660, 700, 0.05, 'triangle', 0.15); break;
      case 'wave': this.tone(110, 70, 0.5, 'sawtooth', 0.18); break;
      case 'nomp': this.tone(220, 160, 0.12, 'square', 0.12); break;
    }
  }
}

/** Vibração curta (funciona no Android; iPhone ignora). */
export function vibrate(ms: number): void {
  try { navigator.vibrate?.(ms); } catch { /* ignore */ }
}
