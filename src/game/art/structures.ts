// Construções e objetos do cenário, todos em perspectiva (ver scene3d.ts).
// Coordenadas em pixels de TELA; (x, yb) = base do objeto.
import { VIEW_W } from '../../engine/view';
import {
  box, boxColors, cylinder, ellipse, glow, groundShadow, OL, persp, poly, rnd, tone,
  type Ctx, type Pt,
} from './scene3d';

// ───────────────────────── efeitos pequenos ─────────────────────────

export function smoke(ctx: Ctx, x: number, y: number, t: number, seed: number, color = '#d8d8d8'): void {
  for (let i = 0; i < 5; i++) {
    const ph = (t * 0.22 + i / 5 + seed * 0.13) % 1;
    const r = 3 + ph * 9;
    ctx.globalAlpha = (1 - ph) * 0.45;
    ellipse(ctx, x + Math.sin(ph * 4 + seed) * 5 + ph * 14, y - ph * 55, r, r * 0.85, color);
  }
  ctx.globalAlpha = 1;
}

function sparks(ctx: Ctx, x: number, y: number, t: number, seed: number): void {
  ctx.fillStyle = '#ffd36b';
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.7 + i / 6 + seed) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.fillRect(x + Math.sin(i * 2.3 + ph * 6) * 8 * ph, y - ph * 45, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
}

function flame(ctx: Ctx, x: number, y: number, t: number, s: number, seed: number): void {
  const fl = 0.85 + Math.sin(t * 13 + seed) * 0.1 + Math.sin(t * 23 + seed * 2) * 0.06;
  glow(ctx, x, y - 3 * s, 34 * s * fl, '#ff9a3c', 0.32);
  poly(ctx, [[x - 4 * s, y], [x - 2 * s, y - 7 * s * fl], [x, y - 12 * s * fl], [x + 2.5 * s, y - 6 * s * fl], [x + 4 * s, y]], '#ff7a2a', null);
  poly(ctx, [[x - 2 * s, y], [x, y - 7 * s * fl], [x + 2 * s, y]], '#ffe08a', null);
}

// ───────────────────────── vila ─────────────────────────

const HOUSE_STYLES = [
  { wall: '#f1e3c8', roof: '#c4553c', trim: '#8a5a3a', door: '#7a4a2a', w: 92, h: 52 },
  { wall: '#e8d2a8', roof: '#3f6f9a', trim: '#6b4a32', door: '#5a3a22', w: 80, h: 48 },
  { wall: '#efe8dc', roof: '#6a8f4a', trim: '#7a5a3a', door: '#6b3f22', w: 100, h: 56 },
];

function window2(ctx: Ctx, x: number, y: number, w: number, h: number, frame: string, lit = false): void {
  poly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], lit ? '#ffe08a' : '#9fd3f0');
  if (!lit) poly(ctx, [[x + 1, y + 1], [x + w * 0.45, y + 1], [x + 1, y + h * 0.6]], 'rgba(255,255,255,0.55)', null);
  ctx.strokeStyle = frame;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.fillStyle = frame;
  ctx.fillRect(x - 2, y + h, w + 4, 2.5);
}

/** Casa com telhado de duas águas. clinic = casa do curandeiro (cruz verde). */
export function house(ctx: Ctx, x: number, yb: number, variant: number, t: number, clinic = false): void {
  const st = HOUSE_STYLES[variant % HOUSE_STYLES.length];
  const { w, h } = st;
  const wall = clinic ? '#f4f1ea' : st.wall;
  const roof = clinic ? '#3f8a6a' : st.roof;
  const f = 0.16;
  groundShadow(ctx, x + w / 2 + 6, yb + 2, w * 0.62, 6);
  box(ctx, x, yb, w, h, f, { front: wall, side: tone(wall, -0.25), top: wall });
  // vigas de madeira na fachada
  ctx.fillStyle = st.trim;
  ctx.fillRect(x, yb - h, 3, h);
  ctx.fillRect(x + w - 3, yb - h, 3, h);
  ctx.fillRect(x, yb - h * 0.55, w, 2.5);
  // telhado
  const e = 6;
  const P: Pt = [x + w / 2, yb - h - w * 0.42];
  const L: Pt = [x - e, yb - h + 4];
  const R: Pt = [x + w + e, yb - h + 4];
  const P2 = persp(P[0], P[1], f), L2 = persp(L[0], L[1], f), R2 = persp(R[0], R[1], f);
  const leftOfCenter = x + w / 2 < VIEW_W / 2;
  const slopeL = (): void => poly(ctx, [L, P, P2, L2], tone(roof, -0.22));
  const slopeR = (): void => poly(ctx, [P, R, R2, P2], tone(roof, -0.08));
  if (leftOfCenter) { slopeL(); slopeR(); } else { slopeR(); slopeL(); }
  // telhas: fileiras paralelas à cumeeira, nas duas águas
  ctx.strokeStyle = tone(roof, -0.32);
  ctx.lineWidth = 1;
  for (const E of [L, R]) {
    for (let k = 1; k < 4; k++) {
      const a: Pt = [E[0] + (P[0] - E[0]) * k / 4, E[1] + (P[1] - E[1]) * k / 4];
      const b = persp(a[0], a[1], f);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
  }
  // chaminé
  if (!clinic) {
    const cx = x + w * 0.72;
    box(ctx, cx, yb - h - w * 0.2, 11, 22, 0.08, boxColors('#9a7a6a'));
    smoke(ctx, cx + 5, yb - h - w * 0.2 - 24, t, x * 0.01);
  }
  // empena (triângulo da frente)
  poly(ctx, [[x, yb - h], [x + w, yb - h], P], tone(wall, -0.06));
  window2(ctx, P[0] - 6, yb - h - w * 0.2, 12, 10, st.trim);
  // beiral do telhado
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(L[0], L[1]);
  ctx.lineTo(P[0], P[1]);
  ctx.lineTo(R[0], R[1]);
  ctx.stroke();
  ctx.strokeStyle = roof;
  ctx.lineWidth = 4.5;
  ctx.stroke();
  // porta
  const dw = w * 0.2, dh = h * 0.6, dx = x + w * 0.4;
  poly(ctx, [[dx, yb], [dx, yb - dh + dw / 2], [dx + dw / 2, yb - dh], [dx + dw, yb - dh + dw / 2], [dx + dw, yb]], st.door);
  ellipse(ctx, dx + dw * 0.78, yb - dh * 0.45, 1.4, 1.4, '#e0b04f');
  window2(ctx, x + w * 0.1, yb - h * 0.82, w * 0.18, h * 0.24, st.trim);
  window2(ctx, x + w * 0.72, yb - h * 0.82, w * 0.18, h * 0.24, st.trim);
  // floreira
  poly(ctx, [[x + w * 0.08, yb - h * 0.5], [x + w * 0.3, yb - h * 0.5], [x + w * 0.28, yb - h * 0.42], [x + w * 0.1, yb - h * 0.42]], '#8a5a3a');
  for (let k = 0; k < 4; k++) ellipse(ctx, x + w * (0.11 + k * 0.055), yb - h * 0.53, 2.2, 2.2, ['#ff7aa0', '#ffd36b', '#ff6b6b', '#c49bff'][k]);
  if (clinic) {
    // placa com cruz
    const sx = x + w * 0.5 - 9, sy = yb - h * 0.98;
    poly(ctx, [[sx, sy], [sx + 18, sy], [sx + 18, sy + 14], [sx, sy + 14]], '#ffffff');
    ctx.fillStyle = '#3fae6a';
    ctx.fillRect(sx + 7, sy + 2, 4, 10);
    ctx.fillRect(sx + 4, sy + 5, 10, 4);
  }
}

/** Forja: galpão aberto com fornalha acesa. */
export function forge(ctx: Ctx, x: number, yb: number, t: number): void {
  const w = 112, h = 60, f = 0.2;
  const stone = '#8d8478';
  groundShadow(ctx, x + w / 2 + 6, yb + 2, w * 0.62, 6);
  // luz da fornalha no chão
  glow(ctx, x + w * 0.55, yb + 6, 70, '#ff8a3c', 0.18 + Math.sin(t * 9) * 0.03);
  // interior escuro (parede do fundo)
  const back = (px: number, py: number) => persp(px, py, f);
  poly(ctx, [back(x, yb), back(x + w, yb), back(x + w, yb - h), back(x, yb - h)], '#3a2f2a');
  box(ctx, x, yb, w, h, f, { front: 'rgba(0,0,0,0)', side: tone(stone, -0.3), top: stone }, null);
  // fornalha de tijolos
  const fx = x + w * 0.42, fw = 40, fh = 40;
  poly(ctx, [[fx, yb - 2], [fx, yb - fh * 0.6], [fx + fw / 2, yb - fh], [fx + fw, yb - fh * 0.6], [fx + fw, yb - 2]], '#9a5a3a');
  ctx.strokeStyle = 'rgba(60,30,20,0.5)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 5; k++) {
    ctx.beginPath(); ctx.moveTo(fx + 2, yb - k * 8); ctx.lineTo(fx + fw - 2, yb - k * 8); ctx.stroke();
  }
  const fl = 0.8 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17) * 0.08;
  poly(ctx, [[fx + 9, yb - 3], [fx + 9, yb - 15], [fx + fw / 2, yb - 22], [fx + fw - 9, yb - 15], [fx + fw - 9, yb - 3]], '#2a1a14');
  ellipse(ctx, fx + fw / 2, yb - 8, 10 * fl, 7 * fl, '#ff7a2a');
  ellipse(ctx, fx + fw / 2, yb - 7, 5 * fl, 4 * fl, '#ffe08a');
  glow(ctx, fx + fw / 2, yb - 10, 40 * fl, '#ff9a3c', 0.45);
  // pilares e viga da frente
  box(ctx, x, yb, 10, h, f, boxColors(stone));
  box(ctx, x + w - 10, yb, 10, h, f, boxColors(stone));
  box(ctx, x - 3, yb - h + 8, w + 6, 9, f, boxColors('#7a5030'));
  // telhado inclinado de tábuas
  const L: Pt = [x - 8, yb - h + 2], R: Pt = [x + w + 8, yb - h + 2];
  const L2 = persp(x - 8, yb - h - 26, f + 0.1), R2 = persp(x + w + 8, yb - h - 26, f + 0.1);
  poly(ctx, [L, R, R2, L2], '#7a4a2a');
  ctx.strokeStyle = 'rgba(40,20,10,0.45)';
  for (let k = 1; k < 9; k++) {
    const a: Pt = [L[0] + (R[0] - L[0]) * k / 9, L[1]];
    const b: Pt = [L2[0] + (R2[0] - L2[0]) * k / 9, L2[1]];
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // chaminé alta com fumaça e faíscas
  const cx = x + w * 0.62;
  box(ctx, cx, yb - h - 10, 16, 40, 0.1, boxColors('#7d756a'));
  smoke(ctx, cx + 8, yb - h - 52, t, 3, '#9a9a9a');
  sparks(ctx, cx + 8, yb - h - 52, t, 0.3);
  // placa com martelo
  const sx = x + 18, sy = yb - h + 18;
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + 3, sy - 2); ctx.lineTo(sx + 3, sy + 2); ctx.moveTo(sx + 19, sy - 2); ctx.lineTo(sx + 19, sy + 2); ctx.stroke();
  poly(ctx, [[sx, sy + 2], [sx + 22, sy + 2], [sx + 22, sy + 16], [sx, sy + 16]], '#c79a5a');
  ctx.fillStyle = '#3a3f48';
  ctx.fillRect(sx + 6, sy + 5, 10, 4);
  ctx.fillStyle = '#7a5030';
  ctx.fillRect(sx + 10, sy + 9, 2.5, 6);
}

/** Torre da guarda com bandeira. */
export function tower(ctx: Ctx, x: number, yb: number, t: number): void {
  const w = 50, h = 118, f = 0.12;
  const stone = '#a8a196';
  groundShadow(ctx, x + w / 2 + 6, yb + 2, w * 0.75, 6);
  box(ctx, x, yb, w, h, f, boxColors(stone));
  // pedras
  ctx.strokeStyle = 'rgba(60,55,50,0.35)';
  ctx.lineWidth = 1;
  for (let r = 0; r < 12; r++) {
    const yy = yb - r * 10;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    for (let c = 0; c < 4; c++) {
      const xx = x + c * 14 + (r % 2) * 7;
      if (xx > x && xx < x + w) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy - 10); ctx.stroke(); }
    }
  }
  // ameias
  for (let k = 0; k < 4; k++) box(ctx, x - 3 + k * 15, yb - h, 9, 10, f, boxColors(tone(stone, 0.05)));
  // porta e janelas estreitas
  poly(ctx, [[x + 16, yb], [x + 16, yb - 22], [x + 25, yb - 30], [x + 34, yb - 22], [x + 34, yb]], '#4a3a2a');
  for (const yy of [55, 85]) poly(ctx, [[x + 22, yb - yy], [x + 28, yb - yy], [x + 28, yb - yy - 12], [x + 22, yb - yy - 12]], '#2a2a3a');
  // estandarte azul na fachada
  poly(ctx, [[x + 8, yb - 40], [x + 16, yb - 40], [x + 16, yb - 62], [x + 8, yb - 62]], '#3f5fb0');
  ellipse(ctx, x + 12, yb - 51, 2.5, 2.5, '#e0b04f');
  // mastro e bandeira tremulando
  const px = x + w / 2, py = yb - h - 10;
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 34); ctx.stroke();
  const pts: Pt[] = [];
  for (let k = 0; k <= 6; k++) pts.push([px + k * 5, py - 33 + Math.sin(t * 5 - k * 0.8) * k * 0.7]);
  for (let k = 6; k >= 0; k--) pts.push([px + k * 5, py - 19 + Math.sin(t * 5 - k * 0.8) * k * 0.7]);
  poly(ctx, pts, '#3f5fb0');
  ellipse(ctx, px + 15, py - 26 + Math.sin(t * 5 - 2.4) * 2, 3, 3, '#e0b04f');
}

/** Portão de pedra com lanternas (onde ficam os portais da vila). */
export function gate(ctx: Ctx, x: number, yb: number, t: number): void {
  const w = 96, h = 92, f = 0.12;
  const stone = '#9a948a';
  groundShadow(ctx, x + w / 2, yb + 2, w * 0.7, 6);
  box(ctx, x, yb, 20, h, f, boxColors(stone));
  box(ctx, x + w - 20, yb, 20, h, f, boxColors(stone));
  box(ctx, x - 8, yb - h, w + 16, 16, f, boxColors('#7a5030'));
  // telhadinho
  const L: Pt = [x - 14, yb - h - 16], R: Pt = [x + w + 14, yb - h - 16];
  poly(ctx, [L, R, [R[0] - 12, R[1] - 14], [L[0] + 12, L[1] - 14]], '#c4553c');
  // lanternas
  for (const lx of [x + 26, x + w - 26]) {
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, yb - h + 16); ctx.lineTo(lx, yb - h + 24); ctx.stroke();
    poly(ctx, [[lx - 4, yb - h + 24], [lx + 4, yb - h + 24], [lx + 3, yb - h + 34], [lx - 3, yb - h + 34]], '#ffd36b');
    glow(ctx, lx, yb - h + 29, 22 + Math.sin(t * 6 + lx) * 2, '#ffc060', 0.4);
  }
}

// ───────────────────────── natureza ─────────────────────────

export interface TreeColors {
  trunk: string;
  leaves: string;
}

/** Árvore de copa redonda, com volume (sombra embaixo/à direita, luz em cima/à esquerda). */
export function roundTree(ctx: Ctx, x: number, yb: number, s: number, c: TreeColors, seed: number, t = 0, outline = true): void {
  groundShadow(ctx, x + 4 * s, yb + 1, 22 * s, 5 * s);
  cylinder(ctx, x, yb, 10 * s, 34 * s, c.trunk, outline ? OL : null);
  const sway = Math.sin(t * 1.2 + seed * 3) * 1.2 * s;
  const cy = yb - 50 * s;
  const blobs = (dx: number, dy: number, r: number, color: string) => ellipse(ctx, x + dx * s + sway, cy + dy * s, r * s, r * s * 0.9, color);
  const dark = tone(c.leaves, -0.3), mid = c.leaves, light = tone(c.leaves, 0.18);
  for (let k = 0; k < 6; k++) blobs(Math.cos(k * 1.05) * 20, Math.sin(k * 1.05) * 12 + 4, 15 + rnd(seed, k) * 4, dark);
  for (let k = 0; k < 5; k++) blobs(Math.cos(k * 1.26 + 0.5) * 14 - 3, Math.sin(k * 1.26 + 0.5) * 9 - 3, 13 + rnd(seed, k, 1) * 3, mid);
  for (let k = 0; k < 3; k++) blobs(-8 + k * 6, -12 + rnd(seed, k, 2) * 4, 7, light);
}

/** Pinheiro: camadas triangulares com lado iluminado e lado na sombra. */
export function pine(ctx: Ctx, x: number, yb: number, s: number, c: TreeColors, seed: number, t = 0): void {
  groundShadow(ctx, x + 3 * s, yb + 1, 16 * s, 4 * s);
  cylinder(ctx, x, yb, 7 * s, 16 * s, c.trunk);
  const sway = Math.sin(t * 1.1 + seed * 3) * 1 * s;
  for (let k = 0; k < 4; k++) {
    const by = yb - 12 * s - k * 17 * s;
    const hw = (24 - k * 4.5) * s;
    const tip: Pt = [x + sway * (k + 1) * 0.4, by - 28 * s];
    poly(ctx, [[x - hw, by], [x, by + 3 * s], tip], tone(c.leaves, 0.08));
    poly(ctx, [[x, by + 3 * s], [x + hw, by], tip], tone(c.leaves, -0.22));
  }
}

export function bush(ctx: Ctx, x: number, yb: number, s: number, color: string, seed: number): void {
  groundShadow(ctx, x, yb + 1, 18 * s, 4 * s);
  for (let k = 0; k < 4; k++) ellipse(ctx, x + (k - 1.5) * 9 * s, yb - 8 * s - rnd(seed, k) * 4 * s, 10 * s, 9 * s, tone(color, -0.2));
  for (let k = 0; k < 3; k++) ellipse(ctx, x + (k - 1) * 8 * s - 2, yb - 11 * s - rnd(seed, k, 1) * 3 * s, 8 * s, 7 * s, color);
  for (let k = 0; k < 4; k++) ellipse(ctx, x + (rnd(seed, k, 3) - 0.6) * 18 * s, yb - 14 * s, 1.6 * s, 1.6 * s, ['#ff7aa0', '#ffffff', '#ffd36b'][k % 3]);
}

/** Pedra facetada. */
export function rock(ctx: Ctx, x: number, yb: number, s: number, base: string, seed: number): void {
  groundShadow(ctx, x + 2, yb + 1, 14 * s, 3.5 * s);
  const h = (10 + rnd(seed, 1) * 8) * s, w = (13 + rnd(seed, 2) * 7) * s;
  const top: Pt = [x - w * 0.15 + rnd(seed, 3) * w * 0.3, yb - h];
  poly(ctx, [[x - w, yb], [x - w * 0.7, yb - h * 0.6], top, [x, yb - h * 0.2], [x - w * 0.2, yb]], tone(base, 0.15));
  poly(ctx, [top, [x + w * 0.7, yb - h * 0.55], [x + w, yb], [x - w * 0.2, yb], [x, yb - h * 0.2]], tone(base, -0.18));
}

// ───────────────────────── ruínas ─────────────────────────

/** Coluna clássica. broken = quebrada (topo irregular, sem capitel). */
export function column(ctx: Ctx, cx: number, yb: number, h: number, w: number, base: string, broken: boolean, seed: number): void {
  groundShadow(ctx, cx + 6, yb + 1, w * 1.1, 5);
  box(ctx, cx - w * 0.75, yb, w * 1.5, 7, 0.06, boxColors(tone(base, -0.05)));
  if (broken) {
    const top = yb - 7 - h;
    cylinder(ctx, cx, yb - 7, w, h, base, OL, tone(base, 0.25));
    // topo quebrado
    const pts: Pt[] = [[cx - w / 2, top]];
    for (let k = 1; k < 5; k++) pts.push([cx - w / 2 + (w * k) / 5, top - rnd(seed, k) * 10]);
    pts.push([cx + w / 2, top]);
    pts.push([cx + w / 2, top + 3]);
    pts.push([cx - w / 2, top + 3]);
    poly(ctx, pts, tone(base, 0.1));
  } else {
    cylinder(ctx, cx, yb - 7, w, h, base);
    box(ctx, cx - w * 0.75, yb - 7 - h, w * 1.5, 8, 0.06, boxColors(tone(base, 0.05)));
  }
  // caneluras
  ctx.strokeStyle = 'rgba(60,45,30,0.25)';
  ctx.lineWidth = 1;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(cx + k * w * 0.25, yb - 9);
    ctx.lineTo(cx + k * w * 0.25, yb - 7 - h + (broken ? 6 : 2));
    ctx.stroke();
  }
  // rachadura
  ctx.strokeStyle = 'rgba(40,30,20,0.45)';
  ctx.beginPath();
  const ky = yb - 7 - h * (0.3 + rnd(seed, 9) * 0.4);
  ctx.moveTo(cx - w * 0.2, ky);
  ctx.lineTo(cx + w * 0.05, ky + 6);
  ctx.lineTo(cx - w * 0.05, ky + 12);
  ctx.stroke();
}

export function archRuin(ctx: Ctx, x: number, yb: number, base: string, seed: number): void {
  const span = 70, h = 84, w = 16;
  column(ctx, x, yb, h, w, base, false, seed);
  column(ctx, x + span, yb, h * (0.55 + rnd(seed, 5) * 0.2), w, base, true, seed + 1);
  // arco quebrado preso à coluna inteira
  box(ctx, x - w, yb - h - 15, span * 0.7, 12, 0.08, boxColors(tone(base, 0.04)));
  poly(ctx, [[x - w + span * 0.7, yb - h - 15], [x - w + span * 0.7 + 8, yb - h - 9], [x - w + span * 0.7 + 2, yb - h - 3]], tone(base, -0.1));
}

export function ruinWall(ctx: Ctx, x: number, yb: number, w: number, base: string, seed: number): void {
  const h = 30 + rnd(seed, 0) * 22;
  groundShadow(ctx, x + w / 2 + 6, yb + 1, w * 0.6, 4);
  box(ctx, x, yb, w, h, 0.08, boxColors(base));
  // topo irregular (desmoronado)
  const pts: Pt[] = [[x, yb - h]];
  for (let k = 1; k < 6; k++) pts.push([x + (w * k) / 6, yb - h - rnd(seed, k) * 12]);
  pts.push([x + w, yb - h]);
  poly(ctx, pts, tone(base, 0.12));
  ctx.strokeStyle = 'rgba(60,45,30,0.3)';
  ctx.lineWidth = 1;
  for (let r = 1; r * 9 < h; r++) {
    ctx.beginPath(); ctx.moveTo(x, yb - r * 9); ctx.lineTo(x + w, yb - r * 9); ctx.stroke();
    for (let c = 0; c * 18 < w; c++) {
      const xx = x + c * 18 + (r % 2) * 9;
      ctx.beginPath(); ctx.moveTo(xx, yb - r * 9); ctx.lineTo(xx, yb - r * 9 + 9); ctx.stroke();
    }
  }
  // trepadeira
  ctx.strokeStyle = '#5f8f45';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, yb - h);
  ctx.quadraticCurveTo(x + w * 0.35, yb - h * 0.5, x + w * 0.25, yb - 4);
  ctx.stroke();
}

// ───────────────────────── caverna ─────────────────────────

/** Estalagmite (cone que sobe do chão) com face iluminada e face na sombra. */
export function stalagmite(ctx: Ctx, cx: number, yb: number, w: number, h: number, base: string, stroke: string | null = OL): void {
  const tip: Pt = [cx + w * 0.08, yb - h];
  poly(ctx, [[cx - w / 2, yb], [cx, yb + 2], tip], tone(base, 0.12), stroke);
  poly(ctx, [[cx, yb + 2], [cx + w / 2, yb], tip], tone(base, -0.2), stroke);
  // anéis de mineral
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    const yy = yb - h * k * 0.22;
    const hw = (w / 2) * (1 - k * 0.22);
    ctx.beginPath(); ctx.moveTo(cx - hw, yy); ctx.quadraticCurveTo(cx, yy + 2, cx + hw, yy); ctx.stroke();
  }
}

/** Estalactite (cone pendurado do teto). */
export function stalactite(ctx: Ctx, cx: number, yt: number, w: number, h: number, base: string, stroke: string | null = OL): void {
  const tip: Pt = [cx - w * 0.06, yt + h];
  poly(ctx, [[cx - w / 2, yt], [cx, yt - 2], tip], tone(base, 0.1), stroke);
  poly(ctx, [[cx, yt - 2], [cx + w / 2, yt], tip], tone(base, -0.22), stroke);
}

/** Cristal brilhante (prisma de 3 faces). */
export function crystal(ctx: Ctx, cx: number, yb: number, s: number, color: string, t: number, seed: number): void {
  const pulse = 0.75 + Math.sin(t * 2 + seed * 5) * 0.25;
  glow(ctx, cx, yb - 12 * s, 40 * s, color, 0.35 * pulse);
  const shard = (dx: number, h: number, w: number, lean: number) => {
    const b = cx + dx * s, tipX = b + lean * s, tipY = yb - h * s;
    poly(ctx, [[b - w * s, yb], [b - w * s * 0.8, yb - h * 0.75 * s], [tipX, tipY], [b, yb - h * 0.7 * s], [b, yb]], tone(color, 0.35));
    poly(ctx, [[b, yb], [b, yb - h * 0.7 * s], [tipX, tipY], [b + w * s * 0.8, yb - h * 0.75 * s], [b + w * s, yb]], tone(color, -0.15));
  };
  shard(-7, 14, 3.5, -4);
  shard(7, 16, 3.5, 4);
  shard(0, 24, 4.5, 0);
}

export function torch(ctx: Ctx, x: number, y: number, t: number, seed: number): void {
  poly(ctx, [[x - 2, y], [x + 2, y], [x + 1.5, y + 14], [x - 1.5, y + 14]], '#6b4a32');
  poly(ctx, [[x - 4, y - 1], [x + 4, y - 1], [x + 3, y + 3], [x - 3, y + 3]], '#4a4f5a');
  flame(ctx, x, y - 1, t, 1, seed);
}

// ───────────────────────── objetos do caminho (entram na ordem de profundidade) ─────────────────────────

export function barrel(ctx: Ctx, cx: number, yb: number): void {
  groundShadow(ctx, cx + 2, yb + 1, 11, 3.5);
  cylinder(ctx, cx, yb, 16, 20, '#a0683a');
  ctx.strokeStyle = '#4a4f5a';
  ctx.lineWidth = 1.6;
  for (const k of [0.25, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(cx - 8, yb - 20 * k);
    ctx.quadraticCurveTo(cx, yb - 20 * k + 2, cx + 8, yb - 20 * k);
    ctx.stroke();
  }
}

export function crate(ctx: Ctx, x: number, yb: number, s = 1): void {
  groundShadow(ctx, x + 9 * s, yb + 1, 13 * s, 3.5 * s);
  box(ctx, x, yb, 18 * s, 16 * s, 0.06, boxColors('#c79a5a'));
  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, yb - 1.5); ctx.lineTo(x + 18 * s - 1.5, yb - 16 * s + 1.5);
  ctx.moveTo(x + 1.5, yb - 16 * s + 1.5); ctx.lineTo(x + 18 * s - 1.5, yb - 1.5);
  ctx.stroke();
}

export function lampPost(ctx: Ctx, x: number, yb: number, t: number): void {
  groundShadow(ctx, x + 2, yb + 1, 6, 2);
  box(ctx, x - 2, yb, 4, 44, 0.04, boxColors('#3a3f48'));
  ctx.strokeStyle = '#3a3f48';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, yb - 44); ctx.lineTo(x + 8, yb - 46); ctx.stroke();
  poly(ctx, [[x + 4, yb - 46], [x + 12, yb - 46], [x + 11, yb - 36], [x + 5, yb - 36]], '#ffe08a');
  glow(ctx, x + 8, yb - 41, 24 + Math.sin(t * 5 + x) * 1.5, '#ffd080', 0.3);
}

export function fence(ctx: Ctx, x: number, yb: number, w: number): void {
  ctx.fillStyle = '#c79a5a';
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1;
  for (let k = 0; k <= w; k += 12) {
    poly(ctx, [[x + k, yb], [x + k + 4, yb], [x + k + 4, yb - 16], [x + k + 2, yb - 19], [x + k, yb - 16]], '#c79a5a');
  }
  poly(ctx, [[x - 2, yb - 12], [x + w + 6, yb - 12], [x + w + 6, yb - 9], [x - 2, yb - 9]], '#a87a42');
  poly(ctx, [[x - 2, yb - 6], [x + w + 6, yb - 6], [x + w + 6, yb - 3], [x - 2, yb - 3]], '#a87a42');
}

export function well(ctx: Ctx, cx: number, yb: number): void {
  groundShadow(ctx, cx + 3, yb + 2, 22, 5);
  cylinder(ctx, cx, yb, 36, 16, '#9a948a');
  ellipse(ctx, cx, yb - 16, 14, 3.5, '#2a3a4a');
  box(ctx, cx - 18, yb - 14, 3, 30, 0.04, boxColors('#7a5030'));
  box(ctx, cx + 15, yb - 14, 3, 30, 0.04, boxColors('#7a5030'));
  poly(ctx, [[cx - 24, yb - 42], [cx + 24, yb - 42], [cx + 16, yb - 54], [cx - 16, yb - 54]], '#c4553c');
}

export function stump(ctx: Ctx, cx: number, yb: number, s: number): void {
  groundShadow(ctx, cx + 2, yb + 1, 13 * s, 3.5 * s);
  cylinder(ctx, cx, yb, 20 * s, 12 * s, '#7a5030', OL, '#c79a5a');
  ctx.strokeStyle = 'rgba(122,80,48,0.7)';
  ctx.lineWidth = 0.8;
  ellipse(ctx, cx, yb - 12 * s, 5 * s, 1.2 * s, 'rgba(0,0,0,0)', 'rgba(122,80,48,0.7)');
}

export function log(ctx: Ctx, x: number, yb: number, s: number): void {
  groundShadow(ctx, x + 22 * s, yb + 1, 26 * s, 3.5 * s);
  box(ctx, x, yb, 44 * s, 11 * s, 0.05, { front: '#7a5030', side: '#c79a5a', top: '#9a6a3a' });
  ellipse(ctx, x + 44 * s, yb - 5.5 * s, 4 * s, 5.5 * s, '#c79a5a', OL);
  ellipse(ctx, x + 6, yb - 12 * s, 3, 1.5, '#6aa36f');
}

export function mushrooms(ctx: Ctx, cx: number, yb: number, s: number, seed: number): void {
  for (let k = 0; k < 3; k++) {
    const x = cx + (k - 1) * 7 * s, h = (5 + rnd(seed, k) * 6) * s;
    ctx.fillStyle = '#f3e3c3';
    ctx.fillRect(x - 1.2 * s, yb - h, 2.4 * s, h);
    poly(ctx, [[x - 5 * s, yb - h], [x, yb - h - 5 * s], [x + 5 * s, yb - h]], '#d84a4a');
    ellipse(ctx, x - 1.2 * s, yb - h - 2 * s, 0.9 * s, 0.9 * s, '#ffffff');
  }
}

export function drum(ctx: Ctx, x: number, yb: number, base: string): void {
  // tambor de coluna caído (cilindro deitado)
  groundShadow(ctx, x + 18, yb + 1, 24, 4);
  box(ctx, x, yb, 34, 15, 0.05, boxColors(base));
  ctx.strokeStyle = 'rgba(60,45,30,0.25)';
  for (const k of [4, 8, 12]) { ctx.beginPath(); ctx.moveTo(x, yb - k); ctx.lineTo(x + 34, yb - k); ctx.stroke(); }
  ellipse(ctx, x + 34, yb - 7.5, 5, 7.5, tone(base, 0.15), OL);
}

export function vase(ctx: Ctx, cx: number, yb: number): void {
  groundShadow(ctx, cx + 2, yb + 1, 8, 2.5);
  ctx.beginPath();
  ctx.moveTo(cx - 3, yb - 18);
  ctx.quadraticCurveTo(cx - 10, yb - 10, cx - 4, yb);
  ctx.lineTo(cx + 4, yb);
  ctx.quadraticCurveTo(cx + 10, yb - 10, cx + 3, yb - 18);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
  g.addColorStop(0, '#d98a4a');
  g.addColorStop(0.35, '#e8a868');
  g.addColorStop(1, '#8a4a2a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(cx - 6, yb - 11, 12, 1.5);
}


// ───────────────────────── pântano ─────────────────────────

/** Árvore morta retorcida com galhos e musgo pendurado. */
export function deadTree(ctx: Ctx, x: number, yb: number, s: number, color: string, seed: number, t: number): void {
  groundShadow(ctx, x + 4, yb + 1, 18 * s, 4 * s);
  const lean = (rnd(seed, 1) - 0.5) * 10 * s;
  // raízes
  poly(ctx, [[x - 12 * s, yb], [x - 4 * s, yb - 10 * s], [x + 4 * s, yb - 10 * s], [x + 13 * s, yb], [x + 3 * s, yb - 3 * s], [x - 3 * s, yb - 3 * s]], tone(color, -0.1));
  // tronco
  poly(ctx, [[x - 5 * s, yb - 2], [x - 3 * s + lean, yb - 70 * s], [x + 3 * s + lean, yb - 72 * s], [x + 6 * s, yb - 2]], color);
  ctx.fillStyle = tone(color, -0.25);
  ctx.fillRect(x + 1 * s, yb - 60 * s, 3 * s, 55 * s);
  // galhos
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, ang: number, len: number, w: number) => {
    const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
    ctx.strokeStyle = OL; ctx.lineWidth = w + 2;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
    return [ex, ey] as Pt;
  };
  const top: Pt = [x + lean, yb - 70 * s];
  const b1 = branch(top[0], top[1] + 20 * s, -1.0, 26 * s, 3 * s);
  const b2 = branch(top[0], top[1] + 8 * s, 0.9, 30 * s, 3 * s);
  branch(b1[0], b1[1], -0.3, 12 * s, 1.6 * s);
  branch(b2[0], b2[1], 0.4, 14 * s, 1.6 * s);
  branch(top[0], top[1], 0.1, 14 * s, 2 * s);
  // musgo pendurado balançando
  ctx.strokeStyle = '#7a9a52';
  ctx.lineWidth = 1.6 * s;
  for (const [mx, my] of [b1, b2, [top[0] - 6 * s, top[1] + 22 * s] as Pt]) {
    const sw = Math.sin(t * 1.3 + mx * 0.05) * 3 * s;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(mx + sw, my + 10 * s, mx + sw * 0.5, my + 20 * s); ctx.stroke();
  }
}

export function reeds(ctx: Ctx, x: number, yb: number, s: number, t: number, seed: number): void {
  ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const bx = x + (k - 2.5) * 3.5 * s;
    const h = (18 + rnd(seed, k) * 14) * s;
    const sw = Math.sin(t * 1.5 + k + seed) * 2 * s;
    ctx.strokeStyle = k % 2 ? '#5f7a3a' : '#7a9a4a';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(bx, yb); ctx.quadraticCurveTo(bx, yb - h * 0.6, bx + sw, yb - h); ctx.stroke();
    if (k % 2 === 0) ellipse(ctx, bx + sw, yb - h - 3 * s, 1.8 * s, 4.5 * s, '#7a4a2a', OL);
  }
}

// ───────────────────────── deserto ─────────────────────────

export function cactus(ctx: Ctx, x: number, yb: number, s: number, seed: number): void {
  groundShadow(ctx, x + 4, yb + 1, 12 * s, 3 * s);
  const c = '#5f9a48';
  const arm = (side: number, ay: number, h: number) => {
    const ax = x + side * 9 * s;
    cylinder(ctx, ax, yb - ay, 7 * s, h, c);
    poly(ctx, [[x + side * 3 * s, yb - ay + 5 * s], [ax, yb - ay + 5 * s], [ax, yb - ay], [x + side * 3 * s, yb - ay]], tone(c, -0.1));
  };
  arm(-1, 22 * s + rnd(seed, 1) * 8 * s, 18 * s);
  if (rnd(seed, 2) < 0.7) arm(1, 30 * s + rnd(seed, 3) * 8 * s, 14 * s);
  cylinder(ctx, x, yb, 10 * s, 52 * s, c);
  ctx.strokeStyle = 'rgba(30,70,30,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, yb - 2); ctx.lineTo(x, yb - 50 * s); ctx.stroke();
  if (rnd(seed, 4) < 0.5) ellipse(ctx, x, yb - 53 * s, 3 * s, 2.5 * s, '#ff7aa0', OL);
}

export function bones(ctx: Ctx, x: number, yb: number, s: number): void {
  groundShadow(ctx, x, yb + 1, 12 * s, 2.5 * s);
  ellipse(ctx, x - 4 * s, yb - 5 * s, 6 * s, 5 * s, '#f0e6d0', OL);
  ellipse(ctx, x - 6 * s, yb - 6 * s, 1.4 * s, 1.6 * s, '#3a2a1a');
  ellipse(ctx, x - 2 * s, yb - 6 * s, 1.4 * s, 1.6 * s, '#3a2a1a');
  poly(ctx, [[x + 2 * s, yb - 2 * s], [x + 14 * s, yb - 4 * s], [x + 14 * s, yb - 2 * s], [x + 2 * s, yb]], '#e8dcc4');
}

/** Duna (morro de areia suave com lado iluminado). */
export function dune(ctx: Ctx, x: number, yb: number, w: number, h: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, yb);
  ctx.quadraticCurveTo(x - w * 0.15, yb - h * 1.6, x + w * 0.08, yb - h);
  ctx.quadraticCurveTo(x + w * 0.3, yb - h * 0.55, x + w / 2, yb);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, yb - h);
  ctx.quadraticCurveTo(x + w * 0.3, yb - h * 0.55, x + w / 2, yb);
  ctx.lineTo(x + w * 0.05, yb);
  ctx.closePath();
  ctx.fillStyle = tone(color, -0.12);
  ctx.fill();
}

export function palm(ctx: Ctx, x: number, yb: number, s: number, t: number, seed: number): void {
  groundShadow(ctx, x + 10 * s, yb + 1, 18 * s, 4 * s);
  const topX = x + 12 * s, topY = yb - 62 * s;
  ctx.strokeStyle = OL; ctx.lineWidth = 8 * s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, yb); ctx.quadraticCurveTo(x + 2 * s, yb - 40 * s, topX, topY); ctx.stroke();
  ctx.strokeStyle = '#a87a42'; ctx.lineWidth = 6 * s; ctx.stroke();
  for (let k = 0; k < 6; k++) {
    const a = -2.6 + k * 1.05 + Math.sin(t * 1.4 + k + seed) * 0.08;
    const ex = topX + Math.cos(a) * 28 * s, ey = topY + Math.sin(a) * 14 * s + 8 * s;
    poly(ctx, [[topX, topY], [topX + Math.cos(a - 0.2) * 16 * s, topY + Math.sin(a - 0.2) * 9 * s - 3 * s], [ex, ey], [topX + Math.cos(a + 0.2) * 16 * s, topY + Math.sin(a + 0.2) * 9 * s + 2 * s]], k % 2 ? '#4f8a3a' : '#5f9a48');
  }
  ellipse(ctx, topX - 2 * s, topY + 3 * s, 3 * s, 3 * s, '#7a5030', OL);
}

// ───────────────────────── neve ─────────────────────────

export function snowPine(ctx: Ctx, x: number, yb: number, s: number, seed: number, t: number): void {
  pine(ctx, x, yb, s, { trunk: '#5a3a22', leaves: '#2f5a4a' }, seed, t);
  for (let k = 0; k < 4; k++) {
    const by = yb - 12 * s - k * 17 * s;
    const hw = (24 - k * 4.5) * s;
    poly(ctx, [[x - hw * 0.75, by - 8 * s], [x, by - 22 * s], [x + hw * 0.55, by - 9 * s], [x + hw * 0.2, by - 6 * s], [x - hw * 0.3, by - 8 * s]], '#f4f8fc', null);
  }
  poly(ctx, [[x - 5 * s, yb - 74 * s], [x, yb - 80 * s], [x + 4 * s, yb - 74 * s]], '#ffffff', null);
}

export function snowman(ctx: Ctx, x: number, yb: number): void {
  groundShadow(ctx, x + 2, yb + 1, 12, 3);
  ellipse(ctx, x, yb - 9, 11, 10, '#f4f8fc', OL);
  ellipse(ctx, x, yb - 25, 8, 7.5, '#f4f8fc', OL);
  ellipse(ctx, x - 3, yb - 9, 4, 4, '#dfe8f2');
  ellipse(ctx, x + 2.5, yb - 27, 1.2, 1.2, '#1d1a24');
  ellipse(ctx, x - 2, yb - 27, 1.2, 1.2, '#1d1a24');
  poly(ctx, [[x + 1, yb - 25], [x + 9, yb - 24], [x + 1, yb - 23]], '#ff8a3c');
  poly(ctx, [[x - 8, yb - 31], [x + 8, yb - 31], [x + 6, yb - 33], [x - 6, yb - 33]], '#3a3f48');
  poly(ctx, [[x - 5, yb - 33], [x + 5, yb - 33], [x + 5, yb - 42], [x - 5, yb - 42]], '#3a3f48');
  ctx.fillStyle = '#c4553c';
  ctx.fillRect(x - 7, yb - 19, 14, 3);
}

export function iceRock(ctx: Ctx, x: number, yb: number, s: number, seed: number): void {
  rock(ctx, x, yb, s, '#9fc8e8', seed);
  poly(ctx, [[x - 8 * s, yb - 8 * s], [x - 2 * s, yb - 15 * s], [x + 4 * s, yb - 9 * s]], '#f4f8fc', null);
}

// ───────────────────────── vulcão ─────────────────────────

/** Coluna de basalto (prisma hexagonal escuro). */
export function basalt(ctx: Ctx, x: number, yb: number, w: number, h: number): void {
  box(ctx, x, yb, w, h, 0.07, { front: '#3a3038', side: '#241c24', top: '#5a4a50' });
  ctx.strokeStyle = 'rgba(255,120,60,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w * 0.3, yb - h * 0.2); ctx.lineTo(x + w * 0.5, yb - h * 0.45); ctx.lineTo(x + w * 0.35, yb - h * 0.7); ctx.stroke();
}

export function lavaRock(ctx: Ctx, x: number, yb: number, s: number, seed: number, t: number): void {
  rock(ctx, x, yb, s, '#3a2a2a', seed);
  const pulse = 0.6 + Math.sin(t * 3 + seed) * 0.3;
  ctx.strokeStyle = `rgba(255,140,60,${pulse})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x - 6 * s, yb - 3 * s); ctx.lineTo(x - 1 * s, yb - 9 * s); ctx.lineTo(x + 4 * s, yb - 5 * s); ctx.stroke();
  glow(ctx, x, yb - 6 * s, 16 * s, '#ff7a2a', 0.2 * pulse);
}

/** Vulcão distante soltando fumaça e brilho. */
export function volcanoCone(ctx: Ctx, x: number, yb: number, w: number, h: number, t: number): void {
  const top = yb - h;
  poly(ctx, [[x - w / 2, yb], [x - w * 0.09, top], [x + w * 0.04, top + 4], [x + w * 0.05, yb]], '#5a3a3a', null);
  poly(ctx, [[x + w * 0.05, yb], [x + w * 0.04, top + 4], [x + w * 0.09, top], [x + w / 2, yb]], '#3a2428', null);
  // rios de lava escorrendo
  ctx.strokeStyle = '#ff7a2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x - w * 0.02, top + 3); ctx.quadraticCurveTo(x - w * 0.1, yb - h * 0.5, x - w * 0.16, yb - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.03, top + 4); ctx.quadraticCurveTo(x + w * 0.12, yb - h * 0.4, x + w * 0.2, yb - 3); ctx.stroke();
  glow(ctx, x, top, 60, '#ff6a2a', 0.45 + Math.sin(t * 2) * 0.1);
  for (let i = 0; i < 6; i++) {
    const ph = (t * 0.12 + i / 6) % 1;
    const r = 10 + ph * 34;
    ctx.globalAlpha = (1 - ph) * 0.5;
    ellipse(ctx, x + Math.sin(ph * 3 + i) * 12 + ph * 40, top - ph * 90, r, r * 0.8, '#4a3a40');
  }
  ctx.globalAlpha = 1;
}

// ───────────────────────── cidadela ─────────────────────────

/** Trecho de muralha com janelas em arco iluminadas. */
export function castleWall(ctx: Ctx, x: number, yb: number, w: number, h: number, t: number, seed: number): void {
  const stone = '#5a5670';
  groundShadow(ctx, x + w / 2 + 6, yb + 2, w * 0.6, 6);
  box(ctx, x, yb, w, h, 0.1, boxColors(stone));
  ctx.strokeStyle = 'rgba(20,18,30,0.35)';
  ctx.lineWidth = 1;
  for (let r = 1; r * 11 < h; r++) {
    ctx.beginPath(); ctx.moveTo(x, yb - r * 11); ctx.lineTo(x + w, yb - r * 11); ctx.stroke();
    for (let c = 0; c * 20 < w; c++) {
      const xx = x + c * 20 + (r % 2) * 10;
      ctx.beginPath(); ctx.moveTo(xx, yb - r * 11); ctx.lineTo(xx, yb - r * 11 + 11); ctx.stroke();
    }
  }
  for (let k = 0; k * 14 < w; k++) box(ctx, x + k * 14, yb - h, 8, 9, 0.1, boxColors(tone(stone, 0.05)));
  // janelas
  const nWin = Math.max(1, Math.floor(w / 46));
  for (let k = 0; k < nWin; k++) {
    const wx = x + (w / nWin) * (k + 0.5) - 6, wy = yb - h * 0.62;
    const lit = rnd(seed, k) < 0.7;
    poly(ctx, [[wx, wy + 18], [wx, wy + 5], [wx + 6, wy], [wx + 12, wy + 5], [wx + 12, wy + 18]], lit ? '#ffd080' : '#1a1828');
    if (lit) glow(ctx, wx + 6, wy + 10, 22 + Math.sin(t * 3 + k) * 2, '#ffb060', 0.3);
  }
  // estandarte
  if (rnd(seed, 9) < 0.6) {
    const bx = x + w * 0.5 - 7, by = yb - h + 14;
    const pts: Pt[] = [[bx, by], [bx + 14, by]];
    for (let k = 0; k <= 4; k++) pts.push([bx + 14 - k * 3.5 + Math.sin(t * 2 + k) * 0.8, by + 30 + (k % 2) * 5]);
    poly(ctx, [[bx, by], [bx + 14, by], [bx + 14, by + 30], [bx + 7, by + 24], [bx, by + 30]], '#6a2a4a');
    ellipse(ctx, bx + 7, by + 12, 3, 3, '#d9a83f');
  }
}

export function castleTower(ctx: Ctx, x: number, yb: number, h: number, t: number): void {
  const w = 40;
  box(ctx, x, yb, w, h, 0.1, boxColors('#4f4b66'));
  // telhado cônico
  poly(ctx, [[x - 5, yb - h], [x + w / 2, yb - h - 40], [x + w + 5, yb - h]], '#3a2a4a');
  poly(ctx, [[x + w / 2, yb - h - 40], [x + w + 5, yb - h], [x + w / 2 + 4, yb - h]], '#2a1e38', null);
  poly(ctx, [[x + 15, yb - h * 0.55], [x + 15, yb - h * 0.55 - 12], [x + 20, yb - h * 0.55 - 17], [x + 25, yb - h * 0.55 - 12], [x + 25, yb - h * 0.55]], '#ffd080');
  glow(ctx, x + 20, yb - h * 0.55 - 8, 24 + Math.sin(t * 3 + x) * 2, '#ffb060', 0.3);
}

export function brazier(ctx: Ctx, x: number, yb: number, t: number, seed: number): void {
  groundShadow(ctx, x + 2, yb + 1, 9, 2.5);
  poly(ctx, [[x - 2, yb], [x + 2, yb], [x + 1.5, yb - 18], [x - 1.5, yb - 18]], '#3a3f48');
  poly(ctx, [[x - 9, yb - 18], [x + 9, yb - 18], [x + 6, yb - 25], [x - 6, yb - 25]], '#4a4f5a');
  ellipse(ctx, x, yb - 25, 9, 2.5, '#2a1a14', OL);
  // chama
  const fl = 0.85 + Math.sin(t * 13 + seed) * 0.1;
  glow(ctx, x, yb - 30, 34 * fl, '#ff9a3c', 0.32);
  poly(ctx, [[x - 6, yb - 25], [x - 3, yb - 33 * fl], [x, yb - 40 * fl], [x + 3, yb - 32 * fl], [x + 6, yb - 25]], '#ff7a2a', null);
  poly(ctx, [[x - 3, yb - 25], [x, yb - 32 * fl], [x + 3, yb - 25]], '#ffe08a', null);
}

// ───────────────────────── céu ─────────────────────────

/** Ilha flutuante: grama em cima, rocha pendurada embaixo. */
export function floatingIsland(ctx: Ctx, x: number, y: number, w: number, t: number, seed: number, detail = true): void {
  const bob = Math.sin(t * 0.8 + seed) * 3;
  const yy = y + bob;
  poly(ctx, [[x - w / 2, yy], [x + w / 2, yy], [x + w * 0.25, yy + w * 0.35], [x + w * 0.05, yy + w * 0.6], [x - w * 0.2, yy + w * 0.3]], '#9a8a7a', detail ? OL : null);
  poly(ctx, [[x + w * 0.05, yy], [x + w / 2, yy], [x + w * 0.25, yy + w * 0.35], [x + w * 0.05, yy + w * 0.6]], '#7a6a5a', null);
  ellipse(ctx, x, yy, w / 2 + 2, w * 0.08 + 2, '#7fc06a', detail ? OL : null);
  if (detail) {
    ellipse(ctx, x - w * 0.15, yy - w * 0.12, w * 0.12, w * 0.12, '#5f9a48', OL);
    ellipse(ctx, x - w * 0.15, yy - w * 0.12, w * 0.07, w * 0.07, '#7fc06a');
    // cachoeirinha
    ctx.fillStyle = 'rgba(200,235,255,0.7)';
    ctx.fillRect(x + w * 0.2, yy + 2, 3, w * 0.4 + Math.sin(t * 4) * 2);
  }
}

export function cloudPuff(ctx: Ctx, x: number, yb: number, s: number): void {
  for (let k = 0; k < 4; k++) ellipse(ctx, x + (k - 1.5) * 9 * s, yb - 6 * s - (k % 2) * 4 * s, 10 * s, 8 * s, '#e8eefc');
  ellipse(ctx, x - 6 * s, yb - 10 * s, 7 * s, 5 * s, '#ffffff');
}
