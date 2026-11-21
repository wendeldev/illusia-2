// Música de fundo gerada em tempo real com Web Audio (nada é baixado).
// Cada faixa é descrita em dados (src/data/music.ts): andamento, escala, sequência de
// acordes e os "instrumentos". A melodia é composta uma vez (sempre igual para a mesma
// faixa) e tocada em loop de 8 compassos.
import type { Sfx } from './audio';

export interface TrackDef {
  id: string;
  bpm: number;
  /** nota base (MIDI: 60 = Dó central) */
  root: number;
  /** 7 intervalos da escala, em semitons */
  scale: number[];
  /** grau do acorde em cada compasso (0 = I, 3 = IV, 4 = V...) */
  prog: number[];
  pad?: { wave: OscillatorType; vol: number };
  bass: { wave: OscillatorType; steps: number[]; vol: number };
  arp?: { wave: OscillatorType; steps: number[]; octave: number; vol: number };
  lead?: { wave: OscillatorType; density: number; octave: number; vol: number; vibrato?: boolean };
  drums?: { kick: number[]; snare: number[]; hat: number[]; vol: number };
  /** corte do filtro (som mais abafado = número menor) */
  filter: number;
  /** eco (0 = sem eco) */
  echo?: number;
}

const MUTE_KEY = 'lumen-music-muted';
const STEPS_PER_BAR = 16;
const LOOP_BARS = 8;
const LOOKAHEAD = 0.25;

interface LeadNote {
  step: number;
  deg: number;
  len: number;
}

class Player {
  out: GainNode;
  private fx: AudioNode;
  private step = 0;
  private nextTime: number;
  private lead: LeadNote[];

  constructor(private ctx: AudioContext, private def: TrackDef, dest: AudioNode, private noise: AudioBuffer) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = def.filter;
    filter.connect(this.out);
    this.out.connect(dest);
    if (def.echo) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = (60 / def.bpm) * 0.75;
      const fb = ctx.createGain();
      fb.gain.value = def.echo;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      const input = ctx.createGain();
      input.connect(filter);
      input.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(filter);
      this.fx = input;
    } else {
      this.fx = filter;
    }
    this.nextTime = ctx.currentTime + 0.1;
    this.lead = composeLead(def);
  }

  fadeTo(v: number, secs: number): void {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(v, t + secs);
  }

  /** Agenda as notas que caem nos próximos instantes. */
  schedule(): void {
    const ctx = this.ctx;
    const stepDur = 60 / this.def.bpm / 4;
    // aba em segundo plano: não tenta "recuperar" o atraso tocando tudo de uma vez
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % (STEPS_PER_BAR * LOOP_BARS);
      this.nextTime += stepDur;
    }
  }

  private note(deg: number, octave: number): number {
    const d = this.def;
    const o = Math.floor(deg / 7);
    const i = ((deg % 7) + 7) % 7;
    return d.root + 12 * (o + octave) + d.scale[i];
  }

  private playStep(step: number, t: number, stepDur: number): void {
    const d = this.def;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const s = step % STEPS_PER_BAR;
    const chord = d.prog[bar % d.prog.length];
    const barDur = stepDur * STEPS_PER_BAR;
    if (s === 0 && d.pad) {
      for (const k of [0, 2, 4]) this.tone(this.note(chord + k, 0), t, barDur * 1.02, d.pad.wave, d.pad.vol, 0.35, 0.4, this.fx);
    }
    if (d.bass.steps.includes(s)) {
      const alt = s >= 8 && d.bass.steps.length > 3 ? (s % 4 === 2 ? 4 : 0) : 0;
      this.tone(this.note(chord + alt, -2), t, stepDur * 1.8, d.bass.wave, d.bass.vol, 0.01, 0.08, this.out);
    }
    if (d.arp && d.arp.steps.includes(s)) {
      const idx = d.arp.steps.indexOf(s);
      const k = [0, 2, 4, 7][idx % 4];
      this.tone(this.note(chord + k, d.arp.octave), t, stepDur * 1.5, d.arp.wave, d.arp.vol, 0.005, 0.1, this.fx);
    }
    if (d.lead) {
      for (const n of this.lead) {
        if (n.step !== step) continue;
        this.tone(this.note(n.deg, d.lead.octave), t, stepDur * n.len, d.lead.wave, d.lead.vol, 0.02, 0.12, this.fx, d.lead.vibrato);
      }
    }
    if (d.drums) {
      if (d.drums.kick.includes(s)) this.kick(t, d.drums.vol);
      if (d.drums.snare.includes(s)) this.snare(t, d.drums.vol * 0.6);
      if (d.drums.hat.includes(s)) this.hat(t, d.drums.vol * 0.35);
    }
  }

  private tone(midi: number, t: number, dur: number, wave: OscillatorType, vol: number, attack: number, release: number, dest: AudioNode, vibrato = false): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t + dur + release);
    osc.connect(g).connect(dest);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.value = osc.frequency.value * 0.012;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t + 0.12);
      lfo.stop(t + dur + release + 0.05);
    }
    osc.start(t);
    osc.stop(t + dur + release + 0.05);
  }

  private kick(t: number, vol: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(this.out);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  private noiseHit(t: number, vol: number, type: BiquadFilterType, freq: number, dur: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol: number): void {
    this.noiseHit(t, vol, 'bandpass', 1800, 0.14);
  }

  private hat(t: number, vol: number): void {
    this.noiseHit(t, vol, 'highpass', 7000, 0.04);
  }
}

/** Compõe a melodia de 8 compassos (determinística para cada faixa). */
function composeLead(def: TrackDef): LeadNote[] {
  if (!def.lead) return [];
  let seed = 0;
  for (const c of def.id) seed = (seed * 31 + c.charCodeAt(0)) % 100000;
  const rand = () => {
    seed = (seed * 16807 + 11) % 2147483647;
    return (seed % 10000) / 10000;
  };
  const notes: LeadNote[] = [];
  let deg = def.prog[0] + 2;
  // os compassos 5–8 repetem 1–4 com variação: dá sensação de "música" e não de ruído
  const firstHalf: LeadNote[] = [];
  for (let bar = 0; bar < LOOP_BARS / 2; bar++) {
    const chord = def.prog[bar % def.prog.length];
    for (let s = 0; s < STEPS_PER_BAR; s += 2) {
      if (rand() > def.lead.density) continue;
      const tones = [chord, chord + 2, chord + 4, chord + 7];
      const target = rand() < 0.65 ? tones[Math.floor(rand() * tones.length)] : deg + (rand() < 0.5 ? 1 : -1);
      deg = Math.max(chord - 3, Math.min(chord + 9, target));
      const len = rand() < 0.3 ? 4 : 2;
      firstHalf.push({ step: bar * STEPS_PER_BAR + s, deg, len });
      if (len === 4) s += 2;
    }
  }
  notes.push(...firstHalf);
  for (const n of firstHalf) {
    const bar = Math.floor(n.step / STEPS_PER_BAR) + LOOP_BARS / 2;
    const chordA = def.prog[(bar - LOOP_BARS / 2) % def.prog.length], chordB = def.prog[bar % def.prog.length];
    notes.push({ step: n.step + (LOOP_BARS / 2) * STEPS_PER_BAR, deg: n.deg + (chordB - chordA), len: n.len });
  }
  return notes;
}

export class Music {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private current: Player | null = null;
  private currentId: string | null = null;
  private wanted: TrackDef | null = null;
  private timer = 0;

  constructor(sfx: Sfx) {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* sem storage */ }
    sfx.onUnlock((ctx) => {
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.3;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.timer = window.setInterval(() => this.current?.schedule(), 60);
      if (this.wanted) this.play(this.wanted);
    });
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* sem storage */ }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 0.3, this.ctx.currentTime, 0.1);
    }
  }

  /** Troca de faixa com transição suave (não reinicia se já está tocando a mesma). */
  play(track: TrackDef): void {
    this.wanted = track;
    if (!this.ctx || !this.master || !this.noise || this.currentId === track.id) return;
    const old = this.current;
    if (old) {
      old.fadeTo(0, 1.2);
      window.setTimeout(() => old.out.disconnect(), 1500);
    }
    this.current = new Player(this.ctx, track, this.master, this.noise);
    this.current.fadeTo(1, old ? 1.5 : 2.5);
    this.currentId = track.id;
  }

  dispose(): void {
    window.clearInterval(this.timer);
  }
}
