// Desenho provisório com formas simples. Quando houver arte própria (sprites),
// basta trocar estas funções — a lógica do jogo não muda.
import type { EnemyShape } from '../types';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
  const r = c((n >> 16) & 255), g = c((n >> 8) & 255), b = c(n & 255);
  return `rgb(${r},${g},${b})`;
}

export function humanoid(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, r: number,
  body: string, head: string, facing: number, flash: boolean, bob: number,
): void {
  shadow(ctx, x, groundY, r);
  const h = r * 2.6;
  const top = groundY - h + bob;
  ctx.fillStyle = flash ? '#fff' : shade(body, -0.15);
  ctx.fillRect(x - r * 0.5, groundY - r * 0.9 + bob, r * 0.35, r * 0.9 - bob);
  ctx.fillRect(x + r * 0.15, groundY - r * 0.9 + bob, r * 0.35, r * 0.9 - bob);
  ctx.fillStyle = flash ? '#fff' : body;
  ctx.fillRect(x - r * 0.7, top + r * 1.05, r * 1.4, h - r * 1.9);
  circle(ctx, x, top + r * 0.6, r * 0.6, flash ? '#fff' : head);
  circle(ctx, x + facing * r * 0.3, top + r * 0.55, 1.7, '#222');
}

export function monster(
  ctx: CanvasRenderingContext2D,
  shape: EnemyShape, x: number, groundY: number, r: number,
  color: string, facing: number, flash: boolean, t: number,
): void {
  const c = flash ? '#fff' : color;
  switch (shape) {
    case 'blob': {
      shadow(ctx, x, groundY, r);
      const squish = Math.sin(t * 6) * 0.08;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, groundY - r * (0.75 - squish), r * (1 + squish), r * (0.8 - squish), 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, x + facing * r * 0.35, groundY - r * 0.9, r * 0.14, '#fff');
      circle(ctx, x + facing * r * 0.4, groundY - r * 0.9, r * 0.07, '#222');
      break;
    }
    case 'beast': {
      shadow(ctx, x, groundY, r * 1.2);
      const leg = Math.sin(t * 12) * 3;
      ctx.fillStyle = shade(color, -0.15);
      ctx.fillRect(x - r * 0.8, groundY - r * 0.6 + leg * 0.3, r * 0.3, r * 0.6);
      ctx.fillRect(x + r * 0.5, groundY - r * 0.6 - leg * 0.3, r * 0.3, r * 0.6);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, groundY - r * 0.9, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, x + facing * r * 1.0, groundY - r * 1.2, r * 0.45, c);
      circle(ctx, x + facing * r * 1.15, groundY - r * 1.3, 1.8, '#ff5050');
      break;
    }
    case 'flyer': {
      const fy = groundY - r * 2.6 + Math.sin(t * 5) * 4;
      shadow(ctx, x, groundY, r * 0.8);
      const wing = Math.sin(t * 18) * r * 0.6;
      ctx.fillStyle = shade(color, -0.2);
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x - r * 1.6, fy - wing);
      ctx.lineTo(x - r * 0.6, fy + r * 0.4);
      ctx.moveTo(x, fy);
      ctx.lineTo(x + r * 1.6, fy - wing);
      ctx.lineTo(x + r * 0.6, fy + r * 0.4);
      ctx.fill();
      circle(ctx, x, fy, r * 0.65, c);
      circle(ctx, x + facing * r * 0.3, fy - 2, 1.6, '#ff5050');
      break;
    }
    case 'humanoid':
      humanoid(ctx, x, groundY, r, color, shade(color, 0.1), facing, flash, 0);
      break;
  }
}

export function bar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  ratio: number, color: string, back = 'rgba(0,0,0,0.55)',
): void {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string, x: number, y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; bold?: boolean; outline?: boolean } = {},
): void {
  const { size = 12, color = '#fff', align = 'left', bold = true, outline = true } = opts;
  ctx.font = `${bold ? '700 ' : ''}${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function wrapText(ctx: CanvasRenderingContext2D, str: string, maxW: number, size: number): string[] {
  ctx.font = `700 ${size}px ${FONT}`;
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
