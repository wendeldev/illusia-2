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
}

const ATLAS = atlasData as unknown as Record<string, SpriteDef>;

let img: HTMLImageElement | null = null;
let white: HTMLCanvasElement | null = null;
let ready = false;

export function loadSprites(): Promise<void> {
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
  if (!d || !img) return;
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
  ctx.drawImage(img, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  if (o.flash && white) {
    ctx.globalAlpha *= 0.85;
    ctx.drawImage(white, f[0], f[1], f[2], f[3], -f[4], -f[5], f[2], f[3]);
  }
  ctx.restore();
}
