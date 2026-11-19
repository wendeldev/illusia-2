// Resolução lógica fixa; o canvas escala para caber em qualquer tela (celular ou PC).
/** Largura lógica: varia de 640 a 800 conforme a proporção da tela (altura fixa em 360). */
export let VIEW_W = 640;
export const VIEW_H = 360;

export interface Point {
  x: number;
  y: number;
}

export interface View {
  ctx: CanvasRenderingContext2D;
  begin(): void;
  end(): void;
  toLogical(clientX: number, clientY: number): Point;
}

export function setupCanvas(canvas: HTMLCanvasElement): View {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  let dpr = 1, scale = 1, ox = 0, oy = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    VIEW_W = Math.round(Math.max(640, Math.min(800, (w / h) * VIEW_H)));
    scale = Math.min(w / VIEW_W, h / VIEW_H);
    ox = (w - VIEW_W * scale) / 2;
    oy = (h - VIEW_H * scale) / 2;
  };
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  return {
    ctx,
    begin() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      ctx.beginPath();
      ctx.rect(0, 0, VIEW_W, VIEW_H);
      ctx.clip();
    },
    end() {
      ctx.restore();
    },
    toLogical: (x, y) => ({ x: (x - ox) / scale, y: (y - oy) / scale }),
  };
}
