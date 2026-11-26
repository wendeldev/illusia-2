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

/** Barra polida: moldura escura, degradê, brilho no topo e marcas de 25%. */
export function fancyBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, c1: string, c2: string,
): void {
  const r = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = '#0b0710';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x, y, w, h);
  if (r > 0) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * r, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w * r, Math.max(1, h * 0.3));
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let k = 1; k < 4; k++) ctx.fillRect(Math.round(x + (w * k) / 4), y, 1, h);
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
}

/** Fita dourada de título (painéis e anúncios). */
export function ribbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, label: string, size = 13): void {
  const x = cx - w / 2, y = cy - h / 2;
  ctx.fillStyle = '#5a1a1e';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    const ex = s < 0 ? x + 6 : x + w - 6;
    ctx.moveTo(ex, y + 4); ctx.lineTo(ex + s * 18, y + 4); ctx.lineTo(ex + s * 12, y + h / 2 + 2); ctx.lineTo(ex + s * 18, y + h); ctx.lineTo(ex, y + h);
    ctx.closePath(); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#b8323a'); g.addColorStop(1, '#7a1c24');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f0c060'; ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x + 1, y + 1, w - 2, h * 0.35);
  text(ctx, label, cx, cy + 1, { size, align: 'center', color: '#fff4d0' });
}
