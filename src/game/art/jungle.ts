// Detalhes das fases de selva: enfeites (flores, plantas, pedras), baús de tesouro, água rasa dos lagos e a
// cobertura de cipós e moitas pendurada no alto da tela.
import { drawSpriteH, spritesReady } from '../../engine/sprites';
import { VIEW_W } from '../../engine/view';
import type { Terrain } from '../terrain';
import { glow, rnd, type Ctx } from './scene3d';

/** Flores, plantas e pedras (coordenadas do mundo). */
export function drawDecor(ctx: Ctx, terrain: Terrain, camX: number, t: number): void {
  if (!spritesReady()) return;
  for (const d of terrain.decor) {
    if (d.x - camX < -60 || d.x - camX > VIEW_W + 60) continue;
    // balanço leve das plantas
    const sway = d.name.startsWith('o_rock') ? 0 : Math.sin(t * 1.6 + d.x * 0.05) * 0.04;
    ctx.save();
    ctx.translate(d.x, d.y + 2);
    ctx.transform(1, 0, sway, 1, 0, 0);
    drawSpriteH(ctx, d.name, 0, 0, d.h, d.flip ? -1 : 1);
    ctx.restore();
  }
}

/** Baús: fechados brilham; abertos somem aos poucos. */
export function drawChests(ctx: Ctx, terrain: Terrain, opened: Map<number, number>, camX: number, t: number): void {
  terrain.chests.forEach((c, i) => {
    if (c.x - camX < -60 || c.x - camX > VIEW_W + 60) return;
    const o = opened.get(i);
    if (o !== undefined && o > 1) return;
    const a = o === undefined ? 1 : 1 - o;
    const name = c.tier >= 3 ? 'chest_red' : c.tier >= 2 ? 'chest_blue' : 'chest';
    ctx.save();
    ctx.globalAlpha *= a;
    if (o === undefined) glow(ctx, c.x, c.y - 12, 26 + Math.sin(t * 3 + i) * 3, '#ffd36b', 0.35);
    const lift = o === undefined ? 0 : -o * 14;
    drawSpriteH(ctx, name, c.x, c.y + 2 + lift, 24);
    ctx.restore();
  });
}

/** Água rasa por cima dos pés: faixa azul transparente com ondinhas e brilhos. */
export function drawWater(ctx: Ctx, terrain: Terrain, camX: number, bottom: number, t: number): void {
  for (const w of terrain.water) {
    if (w.x1 - camX < -20 || w.x0 - camX > VIEW_W + 20) continue;
    const g = ctx.createLinearGradient(0, w.y, 0, bottom);
    g.addColorStop(0, 'rgba(70,150,230,0.55)');
    g.addColorStop(0.25, 'rgba(30,90,180,0.75)');
    g.addColorStop(1, 'rgba(10,40,110,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w.x0, bottom);
    for (let x = w.x0; x <= w.x1; x += 6) ctx.lineTo(x, w.y + Math.sin(t * 2.4 + x * 0.12) * 1.4);
    ctx.lineTo(w.x1, bottom);
    ctx.closePath();
    ctx.fill();
    // linha clara da superfície e brilhos
    ctx.strokeStyle = 'rgba(200,235,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = w.x0; x <= w.x1; x += 6) {
      const y = w.y + Math.sin(t * 2.4 + x * 0.12) * 1.4;
      if (x === w.x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let k = 0; k < (w.x1 - w.x0) / 30; k++) {
      const a = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.7);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
      ctx.fillRect(w.x0 + 10 + ((k * 37 + t * 8) % (w.x1 - w.x0 - 20)), w.y + 5 + (k % 3) * 4, 3, 1.2);
    }
  }
}

/** Cipós em guirlanda e moitas penduradas no alto da tela (coordenadas da tela, rolam com a câmera). */
export function drawCanopy(ctx: Ctx, camX: number, t: number, seed: number): void {
  const SP = 230;
  const first = Math.floor((camX - 120) / SP);
  const anchor = (i: number) => ({ x: i * SP + rnd(seed, i, 1) * 60 - camX, y: 6 + rnd(seed, i, 2) * 10 });
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = first; i * SP - camX < VIEW_W + 200; i++) {
    const a = anchor(i), b = anchor(i + 1);
    // dois cipós por vão, com folhinhas
    for (let v = 0; v < 2; v++) {
      const sag = 34 + rnd(seed, i, 3 + v) * 34 + Math.sin(t * 0.9 + i + v) * 2;
      const mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + sag;
      ctx.strokeStyle = v ? '#1f5a2a' : '#2e7a34';
      ctx.lineWidth = v ? 2.4 : 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my + sag * 0.6, b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = v ? '#2f8a3a' : '#48a844';
      for (let k = 1; k < 9; k++) {
        const u = k / 9, iu = 1 - u;
        const px = iu * iu * a.x + 2 * iu * u * mx + u * u * b.x;
        const py = iu * iu * a.y + 2 * iu * u * (my + sag * 0.6) + u * u * b.y;
        ctx.beginPath();
        ctx.ellipse(px, py + 3, 2.2, 4, (k % 2 ? 0.6 : -0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // cipó solto pendurado
    if (rnd(seed, i, 7) < 0.7) {
      const hx = a.x + 40 + rnd(seed, i, 8) * 120, len = 30 + rnd(seed, i, 9) * 40;
      const sw = Math.sin(t * 1.3 + i) * 4;
      ctx.strokeStyle = '#6aa83a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, 20);
      ctx.quadraticCurveTo(hx + sw, 20 + len * 0.6, hx + sw * 1.4, 20 + len);
      ctx.stroke();
      ctx.fillStyle = '#8acb4a';
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath();
        ctx.ellipse(hx + (sw * 1.4 * k) / 4 + (k % 2 ? 2 : -2), 20 + (len * k) / 4, 1.8, 3, k % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // moita pendurada no ponto de apoio (desenho de folhagem virado para baixo)
    if (spritesReady()) {
      ctx.save();
      ctx.translate(a.x, -4);
      ctx.scale(1, -1);
      drawSpriteH(ctx, ['bush2', 'bush', 'o_bush_g'][Math.floor(rnd(seed, i, 10) * 3)], 0, 4, 30 + rnd(seed, i, 11) * 16, rnd(seed, i, 12) < 0.5 ? 1 : -1);
      ctx.restore();
    }
  }
  ctx.restore();
}
