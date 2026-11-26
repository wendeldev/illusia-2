import { rand, cx } from '../engine/util.js';

// Partículas, cortes, anéis e números de dano.
export class Effects {
  constructor() { this.clear(); }
  clear() { this.parts = []; this.slashes = []; this.rings = []; this.numbers = []; this.ghosts = []; }

  burst(x, y, color, n = 10, speed = 2.5, grav = 0.08) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: rand(18, 36), max: 36, color, size: rand(1.5, 3.5), grav });
    }
  }
  sparks(x, y, dir, color) {
    for (let i = 0; i < 6; i++) {
      this.parts.push({ x, y, vx: dir * rand(1, 4), vy: rand(-3, 1), life: rand(10, 20), max: 20, color, size: rand(1, 2.5), grav: 0.15 });
    }
  }
  slash(p, range, color, idx = 0) {
    this.slashes.push({ x: cx(p) + p.face * 6, y: p.y + p.h / 2 - 2, face: p.face, r: range * 0.9, life: 10, max: 10, color, flip: idx % 2 });
  }
  spin(p, r, color) {
    this.slashes.push({ x: cx(p), y: p.y + p.h / 2, face: p.face, r, life: 8, max: 8, color, spin: true });
  }
  ring(x, y, r, color, life = 20, width = 2) { this.rings.push({ x, y, r, life, max: life, color, width }); }
  quake(x, y, w, color) {
    this.ring(x, y, w * 0.6, color, 24, 4);
    for (let i = 0; i < 20; i++) {
      this.parts.push({ x: x + rand(-w / 2, w / 2), y, vx: rand(-0.5, 0.5), vy: rand(-4, -1.5), life: rand(20, 35), max: 35, color: i % 2 ? color : '#8a7a5a', size: rand(2, 4), grav: 0.2 });
    }
  }
  number(x, y, text, color, big = false) {
    if (!text) return;
    this.numbers.push({ x: x + rand(-6, 6), y, text, color, life: 50, max: 50, big });
  }
  afterimage(p, color = null) {
    this.ghosts.push({ x: p.x, y: p.y, w: p.w, h: p.h, face: p.face, life: 12, max: 12, color: color || 'rgba(200,230,255,0.45)' });
  }

  update() {
    const step = (arr, fn) => { for (let i = arr.length - 1; i >= 0; i--) { const o = arr[i]; if (fn) fn(o); if (--o.life <= 0) arr.splice(i, 1); } };
    step(this.parts, (o) => { o.x += o.vx; o.y += o.vy; o.vy += o.grav; o.vx *= 0.97; });
    step(this.slashes);
    step(this.rings);
    step(this.numbers, (o) => { o.y -= o.life > 30 ? 1 : 0.3; });
    step(this.ghosts);
  }

  draw(ctx) {
    for (const g of this.ghosts) {
      ctx.globalAlpha = g.life / g.max;
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.roundRect(g.x, g.y + 4, g.w, g.h - 4, 6); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const s of this.slashes) {
      const k = s.life / s.max;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.strokeStyle = s.color; ctx.globalAlpha = k; ctx.lineCap = 'round';
      if (s.spin) {
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, s.r, (1 - k) * 6, (1 - k) * 6 + 4); ctx.stroke();
      } else {
        ctx.scale(s.face, s.flip ? -1 : 1);
        ctx.lineWidth = 6 * k + 1;
        ctx.beginPath(); ctx.arc(0, 0, s.r, -1.2, 1.1); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.arc(0, 0, s.r - 3, -1.0, 0.9); ctx.stroke();
      }
      ctx.restore();
    }
    for (const r of this.rings) {
      const k = r.life / r.max;
      ctx.globalAlpha = k; ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1.1 - k * 0.9), 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const n of this.numbers) {
      ctx.globalAlpha = Math.min(1, n.life / 15);
      ctx.font = `bold ${n.big ? 16 : 12}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(n.text, n.x, n.y);
      ctx.fillStyle = n.color; ctx.fillText(n.text, n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }
}
