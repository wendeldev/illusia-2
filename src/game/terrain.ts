// Terreno de plataforma lateral: chão contínuo com degraus (alturas diferentes)
// e plataformas flutuantes "atravessáveis" (sobe-se por baixo e pousa-se em cima).
import type { TerrainDef, TerrainSeg } from '../types';

/** Altura total do mundo (px). A câmera mostra 360 por vez. */
export const WORLD_H = 520;
/** Altura padrão do chão. */
export const BASE_GROUND = 420;

export const GRAVITY = 1500;
export const JUMP_SPEED = 600;
const MAX_FALL = 900;

export class Terrain {
  readonly ground: TerrainSeg[];
  readonly platforms: TerrainSeg[];

  constructor(def: TerrainDef | undefined, readonly width: number) {
    this.ground = def?.ground.length ? def.ground : [{ x0: 0, x1: width, y: BASE_GROUND }];
    this.platforms = def?.platforms ?? [];
  }

  /** Topo do chão na posição x. */
  groundAt(x: number): number {
    const cx = Math.max(0, Math.min(this.width - 0.01, x));
    for (const s of this.ground) if (cx >= s.x0 && cx < s.x1) return s.y;
    return this.ground[this.ground.length - 1].y;
  }

  /** Plataforma em que os pés estão apoiados (ou null). */
  platformAt(x: number, y: number): TerrainSeg | null {
    for (const p of this.platforms) if (x >= p.x0 && x <= p.x1 && Math.abs(p.y - y) < 1.5) return p;
    return null;
  }

  /** Superfícies (chão + plataformas) que cobrem x, de cima para baixo. */
  surfacesAt(x: number): number[] {
    const list = this.platforms.filter((p) => x >= p.x0 + 6 && x <= p.x1 - 6).map((p) => p.y);
    list.push(this.groundAt(x));
    return list.sort((a, b) => a - b);
  }
}

export interface PhysBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  /** tempo em que ignora plataformas (para descer delas) */
  dropT: number;
}

/**
 * Move um corpo com gravidade, degraus (paredes) e plataformas.
 * Retorna true se bateu numa parede (degrau mais alto).
 */
export function moveBody(b: PhysBody, dx: number, dt: number, t: Terrain, minX: number, maxX: number, gravity = true): boolean {
  let blocked = false;
  // horizontal: degrau mais alto que os pés funciona como parede
  let nx = Math.max(minX, Math.min(maxX, b.x + dx));
  if (t.groundAt(nx) < b.y - 6) {
    nx = b.x;
    blocked = true;
  }
  b.x = nx;
  if (!gravity) return blocked;

  b.dropT = Math.max(0, b.dropT - dt);
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
  const ny = b.y + b.vy * dt;
  if (b.vy >= 0) {
    let land = Infinity;
    const g = t.groundAt(b.x);
    if (ny >= g) land = g;
    if (b.dropT <= 0) {
      for (const p of t.platforms) {
        if (b.x >= p.x0 && b.x <= p.x1 && b.y <= p.y + 0.5 && ny >= p.y) land = Math.min(land, p.y);
      }
    }
    if (land < Infinity) {
      b.y = land;
      b.vy = 0;
      b.onGround = true;
      return blocked;
    }
  }
  b.y = ny;
  b.onGround = false;
  return blocked;
}

// ───────────────────────── geração ─────────────────────────

function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Gera o terreno de uma fase: começo e fim planos (portais), degraus de 30px no meio
 * e plataformas flutuantes em 1 ou 2 andares (sempre alcançáveis com um pulo).
 */
export function generateTerrain(seed: number, width: number, hilly = 1): TerrainDef {
  const r = rng(seed * 9973 + 17);
  const ground: TerrainSeg[] = [];
  const flatStart = 280, flatEnd = width - 300;
  let x = 0, y = BASE_GROUND;
  while (x < width) {
    let len: number;
    if (x < flatStart) {
      len = flatStart - x;
      y = BASE_GROUND;
    } else if (x >= flatEnd - 1) {
      len = width - x;
      y = BASE_GROUND;
    } else {
      len = Math.min(flatEnd - x, 170 + r() * 230);
      const roll = r();
      if (roll < 0.33 * hilly) y -= 30;
      else if (roll < 0.66 * hilly) y += 30;
      y = Math.max(BASE_GROUND - 60, Math.min(BASE_GROUND, y));
    }
    const prev = ground[ground.length - 1];
    if (prev && prev.y === y) prev.x1 = x + len;
    else ground.push({ x0: x, x1: x + len, y });
    x += len;
  }
  const groundAt = (gx: number) => (ground.find((s) => gx >= s.x0 && gx < s.x1) ?? ground[ground.length - 1]).y;

  const platforms: TerrainSeg[] = [];
  let px = 330;
  while (px < width - 380) {
    if (r() < 0.78) {
      const w = 90 + r() * 120;
      let top = Infinity;
      for (let k = px; k <= px + w; k += 10) top = Math.min(top, groundAt(k));
      const py = Math.round(top - 88 - r() * 18);
      platforms.push({ x0: px, x1: px + w, y: py });
      if (r() < 0.45) {
        const w2 = 80 + r() * 70;
        const x2 = px + (r() < 0.5 ? -40 : w * 0.5);
        platforms.push({ x0: x2, x1: x2 + w2, y: py - 92 });
      }
      px += w + 90 + r() * 140;
    } else {
      px += 160 + r() * 120;
    }
  }
  return { ground, platforms };
}
