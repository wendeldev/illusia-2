// Estrelas por fase: 1 por vencer, 1 por rapidez, 1 por perder pouca vida.
// As estrelas conquistadas se somam entre tentativas (ficam salvas).

/** Fração máxima da vida que pode ser perdida para ganhar a 3ª estrela. */
export const DAMAGE_LIMIT = 0.5;

export interface StageResult {
  stageId: string;
  /** segundos */
  time: number;
  par: number;
  /** dano recebido / vida máxima */
  damage: number;
  /** estrelas desta tentativa: [vencer, rapidez, pouco dano] */
  stars: [boolean, boolean, boolean];
  /** estrelas que ainda não tinha */
  newStars: [boolean, boolean, boolean];
  bonusGold: number;
}

export function starBits(stars: boolean[]): number {
  return stars.reduce((acc, s, i) => acc | (s ? 1 << i : 0), 0);
}

export function countStars(bits: number | undefined): number {
  const b = bits ?? 0;
  return (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1);
}

export function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Uma estrela (cheia ou vazia) de raio r. */
export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, on: boolean): void {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffd36b' : 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = on ? '#8a5a1a' : 'rgba(255,255,255,0.35)';
  ctx.stroke();
}

/** Desenha 3 estrelas pequenas (cheias ou vazias) centradas em x. */
export function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, bits: number): void {
  for (let i = 0; i < 3; i++) drawStar(ctx, x + (i - 1) * size * 1.15, y, size / 2, !!((bits >> i) & 1));
}
