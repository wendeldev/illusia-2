// Visual do terreno de plataforma: blocos de chão com topo (grama, neve, areia...)
// e plataformas flutuantes com a parte de baixo de terra/pedra e raízes penduradas.
// Coordenadas de mundo convertidas para tela com (x - camX, y - camY).
import { VIEW_H, VIEW_W } from '../../engine/view';
import type { SceneryTheme, TerrainSeg } from '../../types';
import { WORLD_H, type Terrain } from '../terrain';
import { ellipse, glow, OL, rnd, tone, type Ctx } from './scene3d';
import { drawTile, spritesReady, tileAspect } from '../../engine/sprites';

/** Blocos de pixel art por região: topo do chão, recheio e plataforma. */
export const PX_TILES: Record<SceneryTheme, { top: string; fill: string; plat: string }> = {
  village: { top: 'b_grass', fill: 'b_grass_fill', plat: 'b_grass2' },
  forest: { top: 'b_grass2', fill: 'b_grass2_fill', plat: 'b_grass' },
  swamp: { top: 'b_purple', fill: 'b_purple_fill', plat: 'b_purple2' },
  ruins: { top: 'b_moss', fill: 'b_moss_fill', plat: 'b_carved' },
  desert: { top: 'b_sand', fill: 'b_sand_fill', plat: 'b_carved2' },
  cave: { top: 'b_purple2', fill: 'b_purple2_fill', plat: 'b_ice' },
  snow: { top: 'b_snowbrick', fill: 'b_snowbrick_fill', plat: 'b_ice' },
  volcano: { top: 'b_lava', fill: 'b_lava2_fill', plat: 'b_lava2' },
  castle: { top: 'b_brick', fill: 'b_brick_fill', plat: 'b_purplebrick' },
  sky: { top: 'b_grass', fill: 'b_grass_fill', plat: 'b_grass2' },
};
/** largura de cada bloco na tela */
export const TILE_W = 48;

function pxGround(ctx: Ctx, s: TerrainSeg, prev: TerrainSeg | undefined, next: TerrainSeg | undefined, theme: SceneryTheme, camX: number, camY: number): void {
  const tiles = PX_TILES[theme];
  const x = s.x0 - camX, w = s.x1 - s.x0, y = s.y - camY;
  const bottom = Math.min(VIEW_H + 40, WORLD_H + 60 - camY);
  const topH = Math.round(TILE_W * tileAspect(tiles.top));
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - 14, w, bottom - y + 14);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  // alinhados ao mundo: os blocos não "andam" com a câmera
  const start = Math.floor(s.x0 / TILE_W) * TILE_W - camX;
  for (let tx = start; tx < x + w; tx += TILE_W) {
    const fillH = Math.round(TILE_W * tileAspect(tiles.fill));
    for (let ty = y + topH - 10; ty < bottom; ty += fillH) drawTile(ctx, tiles.fill, Math.round(tx), Math.round(ty), TILE_W + 1, fillH + 1);
  }
  // escurece o recheio com a profundidade (fica menos repetitivo e destaca o topo)
  const g = ctx.createLinearGradient(0, y + topH - 8, 0, y + topH + 120);
  g.addColorStop(0, 'rgba(10,6,12,0.15)');
  g.addColorStop(1, 'rgba(10,6,12,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y + topH - 8, w, bottom - y);
  for (let tx = start; tx < x + w; tx += TILE_W) drawTile(ctx, tiles.top, Math.round(tx), Math.round(y - 8), TILE_W + 1, topH);
  ctx.restore();
  // contorno das laterais expostas (degraus)
  ctx.strokeStyle = 'rgba(20,16,24,0.7)';
  ctx.lineWidth = 2;
  for (const [nb, edgeX] of [[prev, x], [next, x + w]] as const) {
    if (nb && nb.y > s.y) {
      ctx.beginPath();
      ctx.moveTo(edgeX, y - 6);
      ctx.lineTo(edgeX, nb.y - camY);
      ctx.stroke();
    }
  }
}

function pxPlatform(ctx: Ctx, p: TerrainSeg, theme: SceneryTheme, camX: number, camY: number): void {
  const name = PX_TILES[theme].plat;
  const x = p.x0 - camX, w = p.x1 - p.x0, y = p.y - camY;
  const tw = 52, th = Math.round(tw * tileAspect(name));
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + th + 26, w * 0.4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, y - 14, w + 4, th + 20);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const n = Math.max(1, Math.round(w / tw));
  const step = w / n;
  for (let k = 0; k < n; k++) drawTile(ctx, name, Math.round(x + k * step), Math.round(y - 10), Math.ceil(step) + 1, th);
  ctx.restore();
}

interface GroundStyle {
  /** cobertura do topo (grama, neve, areia...) */
  top: string;
  /** corpo (terra, rocha...) */
  soil: string;
  /** detalhes do topo */
  tuft: string | null;
  flowers: string[];
  /** camadas horizontais no corpo */
  strata: boolean;
  /** tijolos (castelo/ruínas) */
  bricks: boolean;
  /** rachaduras brilhando (vulcão) */
  lava: boolean;
  /** raízes/cipós pendurados sob as plataformas */
  roots: string | null;
}

const STYLES: Record<SceneryTheme, GroundStyle> = {
  village: { top: '#7cc84a', soil: '#9a6a3a', tuft: '#5aa83a', flowers: ['#ff7aa0', '#ffffff', '#ffd36b'], strata: true, bricks: false, lava: false, roots: '#6a8a3a' },
  forest: { top: '#6cbf42', soil: '#8a5a32', tuft: '#4a9a32', flowers: ['#ffffff', '#ffd36b', '#c49bff'], strata: true, bricks: false, lava: false, roots: '#5a7a32' },
  swamp: { top: '#6a8a3a', soil: '#5a4a32', tuft: '#4a6a2a', flowers: ['#ff9ac8'], strata: true, bricks: false, lava: false, roots: '#7a9a52' },
  ruins: { top: '#c8b48a', soil: '#a88a62', tuft: '#9a9a52', flowers: [], strata: false, bricks: true, lava: false, roots: null },
  desert: { top: '#f0d090', soil: '#d09a5a', tuft: '#a89a52', flowers: [], strata: true, bricks: false, lava: false, roots: null },
  cave: { top: '#5f7a6a', soil: '#4a4562', tuft: '#4f6a5a', flowers: ['#5ff0e0'], strata: true, bricks: false, lava: false, roots: '#5f7a6a' },
  snow: { top: '#f4f8fc', soil: '#7a8aa0', tuft: null, flowers: [], strata: true, bricks: false, lava: false, roots: '#bfe4ff' },
  volcano: { top: '#4a3434', soil: '#2e2226', tuft: null, flowers: [], strata: false, bricks: false, lava: true, roots: null },
  castle: { top: '#6a6684', soil: '#4a4660', tuft: null, flowers: [], strata: false, bricks: true, lava: false, roots: '#5a7a4a' },
  sky: { top: '#9ad888', soil: '#a89a8a', tuft: '#6ab05a', flowers: ['#ffffff', '#ffe08a'], strata: true, bricks: false, lava: false, roots: '#7fc06a' },
};

const TOP_H = 9;

export function drawTerrain(ctx: Ctx, terrain: Terrain, theme: SceneryTheme, camX: number, camY: number, t: number, seed: number): void {
  const st = STYLES[theme];
  const pixel = spritesReady();
  const visible = (s: TerrainSeg) => s.x1 - camX > -40 && s.x0 - camX < VIEW_W + 40;
  // chão
  const ground = terrain.ground;
  for (let i = 0; i < ground.length; i++) {
    const s = ground[i];
    if (!visible(s)) continue;
    if (pixel) pxGround(ctx, s, ground[i - 1], ground[i + 1], theme, camX, camY);
    else drawGroundSeg(ctx, s, ground[i - 1], ground[i + 1], st, camX, camY, t, seed + i);
  }
  // plataformas
  for (let i = 0; i < terrain.platforms.length; i++) {
    const p = terrain.platforms[i];
    if (!visible(p)) continue;
    if (pixel) pxPlatform(ctx, p, theme, camX, camY);
    else drawPlatform(ctx, p, st, camX, camY, t, seed * 7 + i);
  }
}

function soilBody(ctx: Ctx, x: number, y: number, w: number, h: number, st: GroundStyle, seed: number, wx: number): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, st.soil);
  g.addColorStop(1, tone(st.soil, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (st.strata) {
    ctx.fillStyle = tone(st.soil, -0.12);
    for (let k = 1; k * 26 < h; k++) {
      ctx.fillRect(x, y + k * 26 + Math.sin((wx + k * 40) * 0.05) * 3, w, 3);
    }
    // pedrinhas
    for (let k = 0; k < w / 22; k++) {
      const px = x + rnd(seed, k, 1) * w, py = y + 14 + rnd(seed, k, 2) * Math.min(h - 10, 90);
      ellipse(ctx, px, py, 3 + rnd(seed, k, 3) * 3, 2 + rnd(seed, k, 4) * 2, tone(st.soil, 0.12));
    }
  }
  if (st.bricks) {
    ctx.strokeStyle = tone(st.soil, -0.3);
    ctx.lineWidth = 1;
    for (let r = 0; r * 14 < h; r++) {
      const yy = y + r * 14;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      const off = (r % 2) * 14 - (wx % 28);
      for (let c = off; c < w; c += 28) {
        if (c < 0) continue;
        ctx.beginPath(); ctx.moveTo(x + c, yy); ctx.lineTo(x + c, yy + 14); ctx.stroke();
      }
    }
  }
}

function drawGroundSeg(ctx: Ctx, s: TerrainSeg, prev: TerrainSeg | undefined, next: TerrainSeg | undefined, st: GroundStyle, camX: number, camY: number, t: number, seed: number): void {
  const x = s.x0 - camX, w = s.x1 - s.x0, y = s.y - camY;
  const bottom = Math.min(VIEW_H + 40, WORLD_H + 60 - camY);
  soilBody(ctx, x, y, w, bottom - y, st, seed, s.x0);
  if (st.lava) lavaCracks(ctx, x, y, w, t, seed);
  // topo com borda ondulada
  ctx.beginPath();
  ctx.moveTo(x, y - 1);
  ctx.lineTo(x + w, y - 1);
  ctx.lineTo(x + w, y + TOP_H - 3);
  for (let k = w; k >= 0; k -= 8) ctx.quadraticCurveTo(x + k + 4, y + TOP_H + 3, x + k, y + TOP_H - 2);
  ctx.closePath();
  ctx.fillStyle = st.top;
  ctx.fill();
  ctx.fillStyle = tone(st.top, 0.18);
  ctx.fillRect(x, y - 1, w, 3);
  // contorno do topo e das laterais expostas (degraus)
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  for (const [nb, edgeX] of [[prev, x], [next, x + w]] as const) {
    if (nb && nb.y > s.y) {
      // lado à mostra: este trecho é mais alto que o vizinho
      ctx.beginPath();
      ctx.moveTo(edgeX, y);
      ctx.lineTo(edgeX, nb.y - camY);
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(edgeX === x ? x : x + w - 6, y + TOP_H, 6, nb.y - s.y - TOP_H);
      // borda arredondada da grama
      ellipse(ctx, edgeX, y + 3, 4, 5, st.top, OL);
    }
  }
  decorTop(ctx, s.x0, s.x1, y, st, camX, t, seed);
}

function drawPlatform(ctx: Ctx, p: TerrainSeg, st: GroundStyle, camX: number, camY: number, t: number, seed: number): void {
  const x = p.x0 - camX, w = p.x1 - p.x0, y = p.y - camY;
  const depth = 22 + Math.min(18, w * 0.12);
  // sombra no que está embaixo
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + depth + 30, w * 0.4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // parte de baixo (terra/pedra afunilando)
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 4);
  const n = Math.max(3, Math.round(w / 26));
  for (let k = 0; k <= n; k++) {
    const fx = k / n;
    const bulge = Math.sin(fx * Math.PI);
    const yy = y + 6 + bulge * depth * (0.75 + rnd(seed, k) * 0.35);
    ctx.lineTo(x + 4 + fx * (w - 8), yy);
  }
  ctx.lineTo(x + w - 2, y + 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + depth + 8);
  g.addColorStop(0, st.soil);
  g.addColorStop(1, tone(st.soil, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (st.lava) lavaCracks(ctx, x + w * 0.2, y + 4, w * 0.6, t, seed);
  if (st.bricks) {
    ctx.strokeStyle = tone(st.soil, -0.3);
    ctx.lineWidth = 1;
    for (let c = 16; c < w - 10; c += 24) { ctx.beginPath(); ctx.moveTo(x + c, y + 6); ctx.lineTo(x + c, y + 18); ctx.stroke(); }
  }
  // raízes/cipós pendurados balançando
  if (st.roots) {
    ctx.strokeStyle = st.roots;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let k = 0; k < Math.floor(w / 40); k++) {
      const rx = x + 14 + rnd(seed, k, 5) * (w - 28);
      const len = 10 + rnd(seed, k, 6) * 22;
      const sw = Math.sin(t * 1.6 + k + seed) * 3;
      const ry = y + 8 + Math.sin(((rx - x) / w) * Math.PI) * depth * 0.8;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + sw, ry + len * 0.6, rx + sw * 1.5, ry + len); ctx.stroke();
      if (rnd(seed, k, 7) < 0.4) ellipse(ctx, rx + sw * 1.5, ry + len, 2.5, 2, tone(st.roots, 0.15));
    }
  }
  // topo arredondado
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 2);
  ctx.lineTo(x + w - 4, y - 2);
  ctx.quadraticCurveTo(x + w + 4, y - 1, x + w + 2, y + 5);
  for (let k = w; k >= 0; k -= 8) ctx.quadraticCurveTo(x + k + 4, y + TOP_H + 2, x + k, y + TOP_H - 2);
  ctx.quadraticCurveTo(x - 4, y - 1, x + 4, y - 2);
  ctx.closePath();
  ctx.fillStyle = st.top;
  ctx.fill();
  ctx.strokeStyle = OL;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = tone(st.top, 0.2);
  ctx.fillRect(x + 4, y - 1, w - 8, 2.5);
  decorTop(ctx, p.x0 + 6, p.x1 - 6, y, st, camX, t, seed);
}

/** Tufos de grama, flores, brilhos de neve no topo. */
function decorTop(ctx: Ctx, wx0: number, wx1: number, y: number, st: GroundStyle, camX: number, t: number, seed: number): void {
  const start = Math.max(wx0, camX - 20), end = Math.min(wx1, camX + VIEW_W + 20);
  for (let wx = Math.ceil(start / 18) * 18; wx < end; wx += 18) {
    const k = wx / 18;
    const r = rnd(seed, k, 9);
    const x = wx - camX;
    if (st.tuft && r < 0.55) {
      const sw = Math.sin(t * 2 + k) * 1;
      ctx.strokeStyle = st.tuft;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 2, y); ctx.lineTo(x - 3 + sw, y - 5);
      ctx.moveTo(x, y); ctx.lineTo(x + sw, y - 7);
      ctx.moveTo(x + 2, y); ctx.lineTo(x + 4 + sw, y - 5);
      ctx.stroke();
    } else if (st.flowers.length && r < 0.68) {
      const c = st.flowers[Math.floor(rnd(seed, k, 10) * st.flowers.length)];
      ctx.strokeStyle = tone(st.tuft ?? '#5aa83a', -0.1);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 6); ctx.stroke();
      ellipse(ctx, x, y - 7, 2.2, 2.2, c);
      ellipse(ctx, x, y - 7, 0.8, 0.8, '#ffe08a');
    } else if (!st.tuft && st.top === '#f4f8fc' && r < 0.4) {
      const tw = 0.5 + 0.5 * Math.sin(t * 3 + k);
      ctx.fillStyle = `rgba(160,200,255,${tw})`;
      ctx.fillRect(x, y + 2, 1.6, 1.6);
    }
  }
}

function lavaCracks(ctx: Ctx, x: number, y: number, w: number, t: number, seed: number): void {
  const pulse = 0.6 + Math.sin(t * 2.5 + seed) * 0.3;
  ctx.strokeStyle = `rgba(255,120,50,${pulse})`;
  ctx.lineWidth = 1.6;
  for (let k = 0; k < w / 60; k++) {
    const cx = x + 20 + rnd(seed, k, 11) * (w - 40), cy = y + 18 + rnd(seed, k, 12) * 40;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 3, cy - 6); ctx.lineTo(cx + 4, cy + 2); ctx.lineTo(cx + 12, cy - 4);
    ctx.stroke();
    glow(ctx, cx, cy, 16, '#ff6a2a', 0.15 * pulse);
  }
}
