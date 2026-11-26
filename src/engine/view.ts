// Resolução lógica fixa; o canvas escala para caber em qualquer tela (celular ou PC).
/** Largura lógica: varia de 640 a 960 conforme a proporção da tela (altura fixa em 360), sem faixas pretas. */
export let VIEW_W = 640;
export let VIEW_H = 360;
const UI_H = 360;
let uiW = 640;
/** Aproximação da câmera do mundo no celular (personagens e cenário maiores; menus continuam iguais). */
export let WORLD_ZOOM = 1;

/** Durante a atualização e o desenho do mundo, VIEW_W/VIEW_H valem a área visível do mundo (menor com zoom). */
export function worldView(on: boolean): void {
  VIEW_W = on ? Math.round(uiW / WORLD_ZOOM) : uiW;
  VIEW_H = on ? Math.round(UI_H / WORLD_ZOOM) : UI_H;
}

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

/** transparent: o fundo vem de outra camada (modo 3D): limpa em vez de pintar de preto. */
export function setupCanvas(canvas: HTMLCanvasElement, transparent = false): View {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  let dpr = 1, scale = 1, ox = 0, oy = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    uiW = Math.round(Math.max(640, Math.min(960, (w / h) * UI_H)));
    VIEW_W = uiW;
    VIEW_H = UI_H;
    // celular (toque): mundo 30% mais perto
    const touch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
    WORLD_ZOOM = touch ? 1.3 : 1;
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
      if (transparent) ctx.clearRect(0, 0, canvas.width, canvas.height);
      else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
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
