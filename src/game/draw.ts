// Utilitários de desenho (texto, barras, cores). A arte dos personagens fica em ./art/.

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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
