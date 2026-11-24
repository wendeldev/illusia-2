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

/** Altura do topo do trecho em x (rampas: interpola de y até y1). */
export function segY(s: TerrainSeg, x: number): number {
  if (s.y1 === undefined || s.x1 === s.x0) return s.y;
  const k = Math.max(0, Math.min(1, (x - s.x0) / (s.x1 - s.x0)));
  return s.y + (s.y1 - s.y) * k;
}

export class Terrain {
  readonly ground: TerrainSeg[];
  readonly platforms: TerrainSeg[];
  readonly ladders: { x: number; top: number; bottom: number }[];
  readonly water: NonNullable<TerrainDef['water']>;
  readonly decor: NonNullable<TerrainDef['decor']>;
  readonly chests: NonNullable<TerrainDef['chests']>;
  readonly canopy: boolean;

  constructor(def: TerrainDef | undefined, readonly width: number) {
    this.ground = def?.ground.length ? def.ground : [{ x0: 0, x1: width, y: BASE_GROUND }];
    this.platforms = def?.platforms ?? [];
    this.ladders = def?.ladders ?? [];
    this.water = def?.water ?? [];
    this.decor = def?.decor ?? [];
    this.chests = def?.chests ?? [];
    this.canopy = !!def?.canopy;
  }

  /** Topo do chão na posição x. */
  groundAt(x: number): number {
    const cx = Math.max(0, Math.min(this.width - 0.01, x));
    for (const s of this.ground) if (cx >= s.x0 && cx < s.x1) return s.y;
    return this.ground[this.ground.length - 1].y;
  }

  /** Plataforma em que os pés estão apoiados (ou null). */
  platformAt(x: number, y: number): TerrainSeg | null {
    for (const p of this.platforms) if (x >= p.x0 && x <= p.x1 && Math.abs(segY(p, x) - y) < 1.5) return p;
    return null;
  }

  /** Superfícies (chão + plataformas) que cobrem x, de cima para baixo. */
  surfacesAt(x: number): number[] {
    const list = this.platforms.filter((p) => x >= p.x0 + 6 && x <= p.x1 - 6).map((p) => segY(p, x));
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
  // apoiado numa plataforma (rampa ou plana): segue o topo dela ao andar
  const sup = gravity && b.onGround && b.vy >= 0 && b.dropT <= 0 ? t.platformAt(b.x, b.y) : null;
  // horizontal: degrau mais alto que os pés funciona como parede
  let nx = Math.max(minX, Math.min(maxX, b.x + dx));
  if (t.groundAt(nx) < b.y - 6 && !(sup && nx >= sup.x0 && nx <= sup.x1)) {
    nx = b.x;
    blocked = true;
  }
  b.x = nx;
  if (!gravity) return blocked;
  // saiu da ponta da plataforma: continua na vizinha que começa na mesma altura (rampa → topo → rampa)
  const next = sup && (nx < sup.x0 || nx > sup.x1)
    ? t.platforms.find((q) => q !== sup && nx >= q.x0 && nx <= q.x1 && Math.abs(segY(q, nx) - segY(sup, nx)) < 8) ?? null
    : sup;
  if (next && nx >= next.x0 && nx <= next.x1 && segY(next, nx) <= t.groundAt(nx)) {
    b.y = segY(next, nx);
    b.vy = 0;
    b.onGround = true;
    b.dropT = Math.max(0, b.dropT - dt);
    return blocked;
  }

  b.dropT = Math.max(0, b.dropT - dt);
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
  const ny = b.y + b.vy * dt;
  if (b.vy >= 0) {
    let land = Infinity;
    const g = t.groundAt(b.x);
    if (ny >= g) land = g;
    if (b.dropT <= 0) {
      for (const p of t.platforms) {
        const py = segY(p, b.x);
        if (b.x >= p.x0 && b.x <= p.x1 && b.y <= py + (p.y1 !== undefined ? 4 : 0.5) && ny >= py) land = Math.min(land, py);
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
  // escadas: ligam o chão (ou a plataforma de baixo) a cerca de metade das plataformas
  const ladders: { x: number; top: number; bottom: number }[] = [];
  for (const p of platforms) {
    if (r() > 0.5 || p.x1 - p.x0 < 90) continue;
    const x = Math.round(r() < 0.5 ? p.x0 + 22 : p.x1 - 22);
    const below = platforms.filter((q) => q !== p && q.y > p.y + 20 && x >= q.x0 + 8 && x <= q.x1 - 8).map((q) => q.y);
    const bottom = Math.min(groundAt(x), ...below);
    if (bottom - p.y > 40) ladders.push({ x, top: p.y, bottom });
  }
  return { ground, platforms, ladders };
}

// ───────────────────────── selva (fases com rampas, lagos e ilhas) ─────────────────────────

const FLOWERS = ['o_flowers1', 'o_flowers2', 'o_flowers3', 'o_flowers4', 'o_flowers5', 'o_flowers6', 'o_flowers7', 'flowers_y', 'flowers_b'];
const PLANTS = ['o_plant', 'bush', 'bush2', 'o_bush_g', 'o_bush_y'];
const ROCKS = ['o_rock1', 'o_rock2', 'o_rock3', 'o_rock4'];

/**
 * Terreno de selva: chão com lagos rasos, morros de grama com rampas (sobe andando), blocos altos de pedra com
 * escada, ilhas flutuantes (algumas de areia com pedras) em 2–3 andares, um deque alto com rampa de descida,
 * flores e plantas espalhadas, baús no alto e cipós no topo da tela. Tudo alcançável com um pulo (≤ 90 px).
 */
export function generateJungle(seed: number, width: number, chestTier = 1): TerrainDef {
  const r = rng(seed * 7919 + 31);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const B = BASE_GROUND;
  const ground: TerrainSeg[] = [];
  const platforms: TerrainSeg[] = [];
  const ladders: NonNullable<TerrainDef['ladders']> = [];
  const water: NonNullable<TerrainDef['water']> = [];
  const decor: NonNullable<TerrainDef['decor']> = [];
  const chests: NonNullable<TerrainDef['chests']> = [];
  const setGround = (x0: number, x1: number, y: number) => {
    const prev = ground[ground.length - 1];
    if (prev && prev.y === y) prev.x1 = x1;
    else ground.push({ x0, x1, y });
  };
  const plant = (x: number, y: number, list: string[], h: number) =>
    decor.push({ x: Math.round(x), y, name: pick(list), h: Math.round(h * (0.85 + r() * 0.3)), flip: r() < 0.5 });
  const onTop = (p: TerrainSeg, n: number) => {
    for (let k = 0; k < n; k++) {
      const x = p.x0 + 14 + r() * (p.x1 - p.x0 - 28);
      const y = segY(p, x);
      if (p.kind === 'sand') plant(x, y, ROCKS, 16);
      else plant(x, y, r() < 0.6 ? FLOWERS : PLANTS, r() < 0.6 ? 22 : 26);
    }
  };
  const plat = (p: TerrainSeg, deco = 1) => { platforms.push(p); onTop(p, deco); return p; };
  let chestsLeft = 1 + (width > 2300 ? 1 : 0);

  let x = 0;
  setGround(0, 300, B);
  x = 300;
  const end = width - 330;
  let last = '';
  while (x < end - 160) {
    const room = end - x;
    const kinds = ['pool', 'hill', 'pillar', 'islands', 'deck'].filter((k) => k !== last && (k !== 'deck' || room > 760) && (k !== 'hill' || room > 560));
    const kind = pick(kinds);
    last = kind;
    if (kind === 'pool') {
      const w = Math.round(130 + r() * 90);
      setGround(x, x + 40, B);
      setGround(x + 40, x + 40 + w, B + 26);
      water.push({ x0: x + 40, x1: x + 40 + w, y: B + 8 });
      setGround(x + 40 + w, x + w + 90, B);
      if (r() < 0.7) plat({ x0: x + 40 + w / 2 - 34, x1: x + 40 + w / 2 + 34, y: B - 70 }, 1);
      plant(x + 18, B, PLANTS, 26);
      x += w + 90;
    } else if (kind === 'hill') {
      // morro: rampa de subida, topo e rampa de descida; ilhas embaixo
      const up = 150 + r() * 40, top = 160 + r() * 140, down = 150 + r() * 40;
      const lo = B - 30, hi = B - 112 - Math.round(r() * 10);
      const x0 = x + 30;
      setGround(x, x0 + up + top + down + 40, B);
      plat({ x0, x1: x0 + up, y: lo, y1: hi }, 1);
      const t = plat({ x0: x0 + up, x1: x0 + up + top, y: hi }, 2);
      plat({ x0: x0 + up + top, x1: x0 + up + top + down, y: hi, y1: lo }, 1);
      plat({ x0: x0 + up + top / 2 - 32, x1: x0 + up + top / 2 + 32, y: B - 52 }, 1);
      if (chestsLeft > 0 && r() < 0.5) { chests.push({ x: Math.round((t.x0 + t.x1) / 2), y: hi, tier: chestTier }); chestsLeft--; }
      for (let k = 0; k < 3; k++) plant(x0 + r() * (up + top + down), B, r() < 0.5 ? FLOWERS : PLANTS, 24);
      x = x0 + up + top + down + 40;
    } else if (kind === 'pillar') {
      // bloco alto de pedra: ilha de apoio na frente e escada na parede
      const w = Math.round(170 + r() * 80), h = 90 + Math.round(r() * 12);
      setGround(x, x + 110, B);
      plat({ x0: x + 20, x1: x + 84, y: B - 50 }, 1);
      // escada encostada na parede, com um degrauzinho no alto para passar ao topo do bloco
      ladders.push({ x: x + 100, top: B - h, bottom: B });
      platforms.push({ x0: x + 88, x1: x + 112, y: B - h });
      setGround(x + 110, x + 110 + w, B - h);
      plant(x + 110 + w * 0.3, B - h, ['o_bush_big'], 40);
      plant(x + 110 + w * 0.75, B - h, r() < 0.5 ? ROCKS : FLOWERS, 20);
      setGround(x + 110 + w, x + 110 + w + 70, B);
      plat({ x0: x + 110 + w + 10, x1: x + 110 + w + 64, y: B - 48 }, 0);
      x += 110 + w + 70;
    } else if (kind === 'islands') {
      // ilhas flutuantes em andares (algumas de areia com pedras)
      const n = 3 + Math.floor(r() * 3);
      setGround(x, x + n * 95 + 40, B);
      for (let k = 0; k < n; k++) {
        const tier = k % 3 === 1 ? 2 : k % 3 === 2 ? 3 : 1;
        const w = Math.round(58 + r() * 40);
        const px = x + 20 + k * 95;
        plat({ x0: px, x1: px + w, y: B - 60 * tier - Math.round(r() * 10) + 10, kind: r() < 0.45 ? 'sand' : undefined }, 1);
      }
      for (let k = 0; k < n; k++) plant(x + 30 + r() * n * 95, B, r() < 0.5 ? FLOWERS : PLANTS, 22);
      x += n * 95 + 40;
    } else {
      // deque alto: escadinha de ilhas até um caminho no alto e rampa de descida no fim
      setGround(x, x + 740, B);
      plat({ x0: x + 20, x1: x + 90, y: B - 62 });
      plat({ x0: x + 110, x1: x + 180, y: B - 128, kind: r() < 0.5 ? 'sand' : undefined });
      const len = 330 + r() * 80;
      const d = plat({ x0: x + 200, x1: x + 200 + len, y: B - 192 }, 3);
      plat({ x0: x + 200 + len, x1: x + 200 + len + 140, y: B - 192, y1: B - 104 }, 1);
      plat({ x0: x + 260, x1: x + 330, y: B - 66 }, 1);
      if (chestsLeft > 0) { chests.push({ x: Math.round(d.x1 - 40), y: B - 192, tier: chestTier + 1 }); chestsLeft--; }
      for (let k = 0; k < 4; k++) plant(x + r() * 720, B, r() < 0.5 ? FLOWERS : PLANTS, 24);
      x += 740;
    }
  }
  setGround(x, width, B);
  plant(width - 200, B, PLANTS, 26);
  plant(160, B, FLOWERS, 22);
  return { ground, platforms, ladders, water, decor, chests, canopy: true };
}
