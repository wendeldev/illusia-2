// Primitivas de "2.5D": perspectiva de um ponto de fuga no horizonte.
// Objetos à esquerda do centro mostram a lateral direita e vice-versa; ao andar,
// as laterais mudam como numa câmera 3D, sem custo de um motor 3D.
import { VIEW_W } from '../../engine/view';

/** Altura do horizonte (ponto de fuga) na tela. */
export const HORIZON = 168;
/** Linha onde fica a base das construções do fundo. */
export const BACK_ROW_Y = 197;

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export const OL = 'rgba(29,26,36,0.6)';

// ── cores ──

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mistura duas cores hex (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  const c = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}

/** Clareia (amt > 0) ou escurece (amt < 0) uma cor hex. */
export function tone(hex: string, amt: number): string {
  return mix(hex, amt > 0 ? '#ffffff' : '#000000', Math.abs(amt));
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ── aleatório determinístico (o cenário é sempre igual para a mesma fase) ──

export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function rnd(seed: number, i: number, k = 0): number {
  return hash(seed * 7919 + i * 104729 + k * 1299709);
}

export function seedOf(str: string): number {
  let h = 7;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
  return h;
}

// ── desenho ──

export function poly(ctx: Ctx, pts: Pt[], fill: string, stroke: string | null = OL, lw = 1.2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = null): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Move um ponto em direção ao ponto de fuga (f = 0 frente, 1 = no horizonte). */
export function persp(x: number, y: number, f: number): Pt {
  const vx = VIEW_W / 2;
  return [x + (vx - x) * f, y + (HORIZON - y) * f];
}

export interface BoxColors {
  front: string;
  side: string;
  top: string;
}

/**
 * Caixa em perspectiva. (x, yb) = canto inferior esquerdo da face da frente.
 * `f` = profundidade (0.05 rasa ... 0.3 funda).
 */
export function box(ctx: Ctx, x: number, yb: number, w: number, h: number, f: number, c: BoxColors, stroke: string | null = OL): void {
  const A: Pt = [x, yb], B: Pt = [x + w, yb], C: Pt = [x + w, yb - h], D: Pt = [x, yb - h];
  const A2 = persp(x, yb, f), B2 = persp(x + w, yb, f), C2 = persp(x + w, yb - h, f), D2 = persp(x, yb - h, f);
  const vx = VIEW_W / 2;
  if (x + w < vx) poly(ctx, [B, C, C2, B2], c.side, stroke);
  else if (x > vx) poly(ctx, [A, D, D2, A2], c.side, stroke);
  if (yb - h > HORIZON) poly(ctx, [D, C, C2, D2], c.top, stroke);
  poly(ctx, [A, B, C, D], c.front, stroke);
}

export function boxColors(base: string): BoxColors {
  return { front: base, side: tone(base, -0.28), top: tone(base, 0.18) };
}

/**
 * Cilindro em pé (colunas, barris, troncos). Sombreado em faixas: lado da luz à esquerda.
 */
export function cylinder(ctx: Ctx, cx: number, yb: number, w: number, h: number, base: string, stroke: string | null = OL, topColor?: string): void {
  const r = w / 2;
  const top = yb - h;
  // achatamento das elipses depende da distância ao horizonte
  const ryTop = Math.max(0.5, Math.min(r * 0.45, Math.abs(top - HORIZON) * 0.05 * r * 0.25));
  const ryBot = Math.max(0.8, Math.min(r * 0.45, Math.abs(yb - HORIZON) * 0.05 * r * 0.25));
  ctx.beginPath();
  ctx.moveTo(cx - r, top);
  ctx.lineTo(cx - r, yb);
  ctx.ellipse(cx, yb, r, ryBot, 0, Math.PI, 0, true);
  ctx.lineTo(cx + r, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  g.addColorStop(0, tone(base, -0.05));
  g.addColorStop(0.28, tone(base, 0.2));
  g.addColorStop(0.55, base);
  g.addColorStop(1, tone(base, -0.38));
  ctx.fillStyle = g;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  if (top > HORIZON) ellipse(ctx, cx, top, r, ryTop, topColor ?? tone(base, 0.12), stroke);
}

/** Sombra suave no chão. */
export function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  ellipse(ctx, x, y, rx, ry, `rgba(0,0,0,${a})`);
}

/** Brilho radial (fogo, cristais, lanternas). Usa composição aditiva. */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(1, alpha(color, 0));
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prev;
}
