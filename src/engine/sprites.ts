// Sprites em pixel art (atlas gerado por tools/build_sprites.py a partir de assets-src/).
// Enquanto a imagem não carrega, o jogo usa os desenhos vetoriais como reserva.
import atlasData from '../data/atlas.json';

/** [x, y, largura, altura, âncoraX, âncoraY] no atlas */
type Frame = [number, number, number, number, number, number];

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

const sheetOf = (d: SpriteDef): HTMLImageElement | null => (d.sheet === 1 ? scenery : d.sheet === 2 ? powers : d.sheet === 3 ? bosses : img);

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
}

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
  const wh = d.sheet === 2 ? powersWhite : d.sheet === 3 ? bossesWhite : d.sheet === 1 ? null : white;
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
