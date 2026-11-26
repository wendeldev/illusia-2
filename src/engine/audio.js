// Efeitos sonoros sintetizados com WebAudio (sem arquivos externos).
let ctx = null;
let muted = false;

export function initAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

const SFX = {
  swing: { type: 'triangle', f0: 620, f1: 180, d: 0.08, v: 0.06 },
  hit: { type: 'square', f0: 240, f1: 70, d: 0.09, v: 0.08 },
  crit: { type: 'square', f0: 520, f1: 90, d: 0.14, v: 0.1 },
  jump: { type: 'sine', f0: 300, f1: 620, d: 0.12, v: 0.06 },
  coin: { type: 'square', f0: 900, f1: 1500, d: 0.09, v: 0.04 },
  item: { type: 'triangle', f0: 500, f1: 1100, d: 0.2, v: 0.08 },
  hurt: { type: 'sawtooth', f0: 320, f1: 80, d: 0.22, v: 0.09 },
  level: { type: 'triangle', f0: 400, f1: 1300, d: 0.6, v: 0.1 },
  magic: { type: 'sine', f0: 900, f1: 260, d: 0.22, v: 0.08 },
  boom: { type: 'sawtooth', f0: 130, f1: 35, d: 0.4, v: 0.14 },
  dash: { type: 'sine', f0: 200, f1: 90, d: 0.12, v: 0.06 },
  ui: { type: 'sine', f0: 700, f1: 950, d: 0.05, v: 0.05 },
};

export function sfx(name) {
  if (!ctx || muted) return;
  const p = SFX[name];
  if (!p) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = p.type;
  o.frequency.setValueAtTime(p.f0, t);
  o.frequency.exponentialRampToValueAtTime(p.f1, t + p.d);
  g.gain.setValueAtTime(p.v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + p.d);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + p.d + 0.02);
}
