// Sprites em pixel art (atlas gerado por tools/build_sprites.py a partir de assets-src/).
// Enquanto a imagem não carrega, o jogo usa os desenhos vetoriais como reserva.
import atlasData from '../data/atlas.json';

/** [x, y, largura, altura, âncoraX, âncoraY, (cabeçaX, cabeçaY relativos à âncora)] no atlas */
type Frame = [number, number, number, number, number, number, number?, number?];

interface SpriteDef {
  /** escala para o tamanho no jogo */
  scale: number;
  /** para onde o desenho olha: 1 = direita, -1 = esquerda */
  faces: number;
  frames: Frame[];
  /** cores do céu acima de um panorama [topo, logo abaixo] */
  sky?: [string, string];
  /** 1 = prancha de cenário (public/sprites/scenery.png) */
  sheet?: number;
}

const ATLAS = atlasData as unknown as Record<string, SpriteDef>;

let img: HTMLImageElement | null = null;
let white: HTMLCanvasElement | null = null;
let scenery: HTMLImageElement | null = null;
let powers: HTMLImageElement | null = null;
let powersWhite: HTMLCanvasElement | null = null;
let bosses: HTMLImageElement | null = null;
let bossesWhite: HTMLCanvasElement | null = null;
let itemsImg: HTMLImageElement | null = null;
let mythic: HTMLImageElement | null = null;
let mythicWhite: HTMLCanvasElement | null = null;

const sheetOf = (d: SpriteDef): HTMLImageElement | null => (d.sheet === 1 ? scenery : d.sheet === 2 ? powers : d.sheet === 3 ? bosses : d.sheet === 4 ? itemsImg : d.sheet === 5 ? mythic : img);

function whiteCopy(im: HTMLImageElement): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = im.width;
  c.height = im.height;
  const g = c.getContext('2d');
  if (!g) return null;
  g.drawImage(im, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Prancha de cenário carregada? */
export function sceneryReady(): boolean {
  return !!scenery;
}
let ready = false;

export function loadSprites(): Promise<void> {
  const sc = new Image();
  sc.onload = () => { scenery = sc; };
  sc.src = './sprites/scenery.png';
  const pw = new Image();
  pw.onload = () => { powers = pw; powersWhite = whiteCopy(pw); };
  pw.src = './sprites/powers.png';
  const bs = new Image();
  bs.onload = () => { bosses = bs; bossesWhite = whiteCopy(bs); };
  bs.src = './sprites/bosses.png';
  const it = new Image();
  it.onload = () => { itemsImg = it; };
  it.src = './sprites/items.png';
  const my = new Image();
  my.onload = () => { mythic = my; mythicWhite = whiteCopy(my); };
  my.src = './sprites/mythic.png';
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      img = im;
      // versão toda branca (piscar ao levar dano)
      const c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d');
      if (g) {
        g.drawImage(im, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, c.width, c.height);
        white = c;
      }
      ready = true;
      resolve();
    };
    im.onerror = () => resolve();
    im.src = './sprites/atlas.png';
  });
}

export function spritesReady(): boolean {
  return ready;
}

export function hasSprite(name: string | undefined): name is string {
  return !!name && !!ATLAS[name];
}

export function frameCount(name: string): number {
  return ATLAS[name]?.frames.length ?? 0;
}

/** Altura no jogo (px lógicos) do 1º quadro. */
export function spriteHeight(name: string, mul = 1): number {
  const d = ATLAS[name];
  return d ? d.frames[0][3] * d.scale * mul : 0;
}

export interface SpriteOpts {
  scale?: number;
  /** achatamento (squash & stretch) */
  sx?: number;
  sy?: number;
  rot?: number;
  alpha?: number;
  flash?: boolean;
  /** pinta faixas do corpo (fração da altura a partir do topo: [de, até, cor, força]) — roupas em camadas */
  tint?: [number, number, string, number][];
}

let tintCanvas: HTMLCanvasElement | null = null;

/** Desenha o quadro com os pés em (x, y). `facing` = 1 direita, -1 esquerda. */
export function drawSprite(ctx: CanvasRenderingContext2D, name: string, frame: number, x: number, y: number, facing: number, o: SpriteOpts = {}): void {
  const d = ATLAS[name];
  const sheet = d && sheetOf(d);
  if (!d || !sheet) return;
  const f = d.frames[Math.max(0, Math.floor(frame)) % d.frames.length];
  const s = d.scale * (o.scale ?? 1);
  const flip = facing === d.faces ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(s * flip * (o.sx ?? 1), s * (o.sy ?? 1));
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  // pixel art ampliado fica nítido sem suavização; reduzido fica melhor suavizado
  ctx.imageSmoothingEnabled = Math.abs(s) < 1;
  ctx.drawImage(sheet, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  if (o.tint?.length) {
    // cópia do quadro pintada só onde há pixels (source-atop), depois por cima do original
    tintCanvas ??= document.createElement('canvas');
    const tc = tintCanvas;
    if (tc.width < f[2] || tc.height < f[3]) { tc.width = Math.max(tc.width, f[2]); tc.height = Math.max(tc.height, f[3]); }
    const t = tc.getContext('2d')!;
    t.clearRect(0, 0, f[2], f[3]);
    t.globalCompositeOperation = 'source-over';
    t.drawImage(sheet, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
    t.globalCompositeOperation = 'source-atop';
    for (const [a, b, c, k] of o.tint) {
      t.globalAlpha = k;
      t.fillStyle = c;
      t.fillRect(0, f[3] * a, f[2], f[3] * (b - a));
    }
    t.globalAlpha = 1;
    t.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tc, 0, 0, f[2], f[3], -f[4], -f[5], f[2], f[3]);
  }
  const wh = d.sheet === 2 ? powersWhite : d.sheet === 3 ? bossesWhite : d.sheet === 5 ? mythicWhite : d.sheet === 1 || d.sheet === 4 ? null : white;
  if (o.flash && wh) {
    ctx.globalAlpha *= 0.85;
    ctx.drawImage(wh, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  }
  ctx.restore();
}

/** Desenha o quadro inteiro esticado no retângulo (blocos de terreno). */
export function drawTile(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number): void {
  const d = ATLAS[name];
  const sheet = d && sheetOf(d);
  if (!d || !sheet) return;
  const f = d.frames[0];
  ctx.drawImage(sheet, f[0], f[1], f[2], f[3], x, y, w, h);
}

/** Proporção altura/largura do 1º quadro. */
export function tileAspect(name: string): number {
  const d = ATLAS[name];
  return d ? d.frames[0][3] / d.frames[0][2] : 1;
}

/** Desenha com uma altura final em px (objetos de cenário), pés em (x, y). */
export function drawSpriteH(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, height: number, facing = 1, o: SpriteOpts = {}): boolean {
  const d = ATLAS[name];
  if (!d || !sheetOf(d)) return false;
  drawSprite(ctx, name, 0, x, y, facing, { ...o, scale: (o.scale ?? 1) * height / (d.frames[0][3] * d.scale) });
  return true;
}

/** Tamanho original (px) do 1º quadro. */
export function frameSize(name: string): [number, number] {
  const f = ATLAS[name]?.frames[0];
  return f ? [f[2], f[3]] : [0, 0];
}

/** Desenha um pedaço (sx, sy, sw, sh, em px do quadro) esticado no retângulo de destino. */
export function drawSub(ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
  const d = ATLAS[name];
  const sheet = d && sheetOf(d);
  if (!d || !sheet || sw <= 0 || sh <= 0) return;
  const f = d.frames[0];
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false; // ampliado em pixel art: sem borrão
  ctx.drawImage(sheet, f[0] + sx, f[1] + sy, sw, sh, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = smooth;
}

export function panoSky(name: string): [string, string] {
  return ATLAS[name]?.sky ?? ['#6aa8e8', '#9fd0f0'];
}

/** Prancha de poderes carregada? */
export function powersReady(): boolean {
  return !!powers;
}

/** Topo da cabeça no quadro (em px do jogo, relativo aos pés), já virado para `facing`. */
export function headOf(name: string, frame: number, facing: number, scale = 1): { x: number; y: number } {
  const d = ATLAS[name];
  if (!d) return { x: 0, y: -48 };
  const f = d.frames[Math.max(0, Math.floor(frame)) % d.frames.length];
  const s = d.scale * scale;
  const flip = facing === d.faces ? 1 : -1;
  return { x: (f[6] ?? 0) * s * flip, y: (f[7] ?? -f[3]) * s };
}

export function mythicReady(): boolean {
  return !!mythic;
}

/**
 * Desenha o quadro encaixado na caixa (x0,y0)-(x1,y1), no sistema de coordenadas atual do contexto
 * (boneco em camadas). `fill` estica; `contain` mantém a proporção. `align` posiciona na vertical.
 */
export function drawFit(
  ctx: CanvasRenderingContext2D, name: string, x0: number, y0: number, x1: number, y1: number,
  mode: 'fill' | 'contain' = 'contain', align: 'top' | 'mid' | 'bottom' = 'mid', frame = 0, flash = false,
): void {
  const d = ATLAS[name];
  const sheet = d && sheetOf(d);
  if (!d || !sheet) return;
  const f = d.frames[Math.max(0, Math.floor(frame)) % d.frames.length];
  const bw = x1 - x0, bh = y1 - y0;
  let w = bw, h = bh;
  if (mode === 'contain') { const s = Math.min(bw / f[2], bh / f[3]); w = f[2] * s; h = f[3] * s; }
  const dx = x0 + (bw - w) / 2;
  const dy = align === 'top' ? y0 : align === 'bottom' ? y1 - h : y0 + (bh - h) / 2;
  ctx.drawImage(sheet, f[0], f[1], f[2], f[3], dx, dy, w, h);
  const wh = d.sheet === 5 ? mythicWhite : null;
  if (flash && wh) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.85;
    ctx.drawImage(wh, f[0], f[1], f[2], f[3], dx, dy, w, h);
    ctx.globalAlpha = a;
  }
}

/** Tamanho (px da prancha) e âncora do quadro. */
export function frameRect(name: string, frame = 0): [number, number, number, number] | null {
  const f = ATLAS[name]?.frames[Math.max(0, Math.floor(frame)) % ATLAS[name].frames.length];
  return f ? [f[2], f[3], f[4], f[5]] : null;
}

/**
 * Desenha um pedaço (sx, sy, sw, sh em px do quadro) deformado no paralelogramo p0 (canto de cima à esquerda),
 * p1 (cima à direita), p2 (baixo à esquerda) — usado para vestir peças que seguem o corpo (pernas inclinadas).
 */
export function drawAffine(
  ctx: CanvasRenderingContext2D, name: string, sx: number, sy: number, sw: number, sh: number,
  p0: [number, number], p1: [number, number], p2: [number, number], flash = false,
): void {
  const d = ATLAS[name];
  const sheet = d && sheetOf(d);
  if (!d || !sheet || sw <= 0 || sh <= 0) return;
  const f = d.frames[0];
  ctx.save();
  ctx.transform((p1[0] - p0[0]) / sw, (p1[1] - p0[1]) / sw, (p2[0] - p0[0]) / sh, (p2[1] - p0[1]) / sh, p0[0], p0[1]);
  ctx.drawImage(sheet, f[0] + sx, f[1] + sy, sw, sh, 0, 0, sw, sh);
  if (flash && mythicWhite && d.sheet === 5) { ctx.globalAlpha *= 0.85; ctx.drawImage(mythicWhite, f[0] + sx, f[1] + sy, sw, sh, 0, 0, sw, sh); }
  ctx.restore();
}
