// Equipamento em camadas ("layered sprites"): as peças equipadas são desenhadas por cima da animação
// do personagem. Atrás: aura, asas traseiras, capa. Corpo: armadura/calças/botas pintam o corpo na cor
// da raridade. Na frente: capacete (preso à cabeça do quadro atual) e asas frontais.
import { getItem } from '../../data';
import { RARITY_COLORS } from '../../data/gear';
import { drawSprite, drawSpriteH, hasSprite, headOf } from '../../engine/sprites';
import type { Slot } from '../../types';
import type { Progress } from '../progress';
import { glow } from './scene3d';

export interface GearLook {
  aura?: string; auraColor?: string;
  wings?: string; wingsGlow?: boolean;
  wingsFront?: string;
  cape?: string;
  helmet?: string;
  tint: [number, number, string, number][];
  weaponColor?: string; weaponUp: number;
}

function icon(p: Progress, slot: Slot): string | undefined {
  const id = p.equipped[slot];
  if (!id) return undefined;
  const ic = getItem(id).icon;
  return ic && hasSprite(ic) ? ic : undefined;
}
const rar = (p: Progress, slot: Slot) => { const id = p.equipped[slot]; return id ? getItem(id).rarity ?? 0 : -1; };

export function gearLook(p: Progress): GearLook {
  const tint: GearLook['tint'] = [];
  const band = (slot: Slot, a: number, b: number, k: number) => {
    const r = rar(p, slot);
    if (r >= 1) tint.push([a, b, RARITY_COLORS[r], k + r * 0.015]);
  };
  band('armor', 0.24, 0.62, 0.16);
  band('pants', 0.62, 0.9, 0.16);
  band('boots', 0.9, 1, 0.24);
  band('gloves', 0.4, 0.55, 0.12);
  const wid = p.equipped.wings ?? '';
  const wr = rar(p, 'weapon');
  const helm = icon(p, 'helmet');
  return {
    aura: icon(p, 'aura'), auraColor: RARITY_COLORS[Math.max(0, rar(p, 'aura'))],
    wings: icon(p, 'wings'), wingsGlow: wid === 'wings_angel' || wid === 'wings_white' || rar(p, 'wings') >= 5,
    wingsFront: icon(p, 'wingsFront'),
    cape: icon(p, 'cape'),
    helmet: helm?.startsWith('gs_') ? helm : undefined,
    tint,
    weaponColor: wr >= 3 ? RARITY_COLORS[wr] : undefined,
    weaponUp: p.upgrades?.[p.equipped.weapon ?? ''] ?? 0,
  };
}

/** Camadas de trás. `h` = altura do personagem em px; `k` = escala (1 no jogo). */
export function drawBackLayers(ctx: CanvasRenderingContext2D, L: GearLook, x: number, y: number, facing: number, h: number, time: number, flying: boolean, k = 1): void {
  if (L.weaponUp >= 4 || L.weaponColor) {
    const up = L.weaponUp;
    const c = up >= 10 ? '#ff5fd0' : up >= 7 ? '#ffd36b' : L.weaponColor ?? '#7fc8ff';
    glow(ctx, x, y - h * 0.45, (30 + up * 2 + Math.sin(time * 4) * 3) * k, c, 0.16 + up * 0.02);
  }
  if (L.aura) {
    const pulse = 1 + Math.sin(time * 3) * 0.06;
    glow(ctx, x, y - h * 0.4, h * 0.9, L.auraColor ?? '#ffffff', 0.18);
    ctx.globalCompositeOperation = 'lighter';
    drawSpriteH(ctx, L.aura, x, y + 4 * k, h * 0.75 * pulse, 1, { alpha: 0.75 + Math.sin(time * 5) * 0.15 });
    ctx.globalCompositeOperation = 'source-over';
  }
  if (L.wings) {
    const flap = 0.75 + Math.abs(Math.sin(time * (flying ? 9 : 3))) * 0.3;
    if (L.wingsGlow) glow(ctx, x - facing * 6 * k, y - h * 0.6, 30 * k, '#ffffff', 0.15);
    drawSpriteH(ctx, L.wings, x - facing * 6 * k, y - h * 0.28, h * 0.72, facing, { sx: flap, alpha: 0.95 });
  }
  if (L.cape) {
    const sway = 1 + Math.sin(time * 4) * 0.05;
    drawSpriteH(ctx, L.cape, x - facing * 5 * k, y - h * 0.12, h * 0.6, facing, { sx: sway, alpha: 0.95 });
  }
}

/** Camadas da frente: capacete na cabeça do quadro atual e asas frontais. */
export function drawFrontLayers(ctx: CanvasRenderingContext2D, L: GearLook, sprite: string, frame: number, x: number, y: number, facing: number, h: number, time: number, k = 1): void {
  if (L.helmet) {
    const hd = headOf(sprite, frame, facing, k);
    const hh = h * 0.3;
    drawSpriteH(ctx, L.helmet, x + hd.x, y + hd.y + hh * 0.78, hh, facing);
  }
  if (L.wingsFront) {
    const flap = 0.85 + Math.abs(Math.sin(time * 3 + 1)) * 0.2;
    drawSpriteH(ctx, L.wingsFront, x - facing * 1 * k, y - h * 0.2, h * 0.36, facing, { sx: flap, alpha: 0.75 });
  }
}

/** Personagem completo com camadas (tela de equipamento). */
export function drawLayered(ctx: CanvasRenderingContext2D, p: Progress, sprite: string, frame: number, x: number, y: number, facing: number, scale: number, h: number, time: number): void {
  const L = gearLook(p);
  drawBackLayers(ctx, L, x, y, facing, h, time, false, scale);
  drawSprite(ctx, sprite, frame, x, y, facing, { scale, tint: L.tint });
  drawFrontLayers(ctx, L, sprite, frame, x, y, facing, h, time, scale);
}
