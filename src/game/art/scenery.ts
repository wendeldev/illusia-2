// Cenário em camadas com profundidade (2.5D):
//   céu → montanhas distantes (neblina) → camada intermediária → fileira de construções
//   → chão em perspectiva → objetos no caminho (ordenados com os personagens)
//   → primeiro plano + luz/atmosfera.
// Tudo é gerado de forma determinística a partir do id da fase.
import { VIEW_H, VIEW_W } from '../../engine/view';
import type { LandmarkDef, StageDef } from '../../types';
import { BASE_GROUND, type Terrain } from '../terrain';
import { drawSpriteH, drawSub, frameSize, panoSky, sceneryReady, spritesReady } from '../../engine/sprites';
import type { SceneryTheme } from '../../types';
import {
  alpha, BACK_ROW_Y, ellipse, glow, HORIZON, mix, poly, rnd, seedOf, tone, type Ctx, type Pt,
} from './scene3d';
import {
  archRuin, barrel, basalt, bones, brazier, bush, cactus, castleTower, castleWall, cloudPuff, column, crate,
  crystal, deadTree, drum, dune, fence, floatingIsland, forge, gate, house, iceRock, lampPost, lavaRock, log,
  mushrooms, palm, pine, reeds, rock, roundTree, ruinWall, snowman, snowPine, stalactite, stalagmite, stump,
  torch, tower, vase, volcanoCone, well,
} from './structures';

const GROUND_TOP = 200;
/** posição vertical da câmera em que o fundo fica na altura original */
const CAM_REST = 160;

export type PropKind =
  | 'barrel' | 'crate' | 'lamp' | 'well' | 'stump' | 'log' | 'mushrooms' | 'rock'
  | 'drum' | 'vase' | 'stub' | 'stalagmite' | 'crystal'
  | 'reeds' | 'cactus' | 'bones' | 'snowman' | 'iceRock' | 'lavaRock' | 'obsidian' | 'brazier' | 'cloud' | 'goldCrystal';

export interface SceneProp {
  x: number;
  y: number;
  kind: PropKind;
  seed: number;
}

interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
}

const LANDMARK_W: Record<LandmarkDef['kind'], number> = { house: 100, clinic: 92, forge: 112, tower: 50, gate: 96 };

const PANO: Record<SceneryTheme, string> = {
  village: 'pano_forest', forest: 'pano_forest', swamp: 'pano_haunted', ruins: 'pano_ruins', desert: 'pano_desert',
  cave: 'pano_cave', snow: 'pano_snow', volcano: 'pano_volcano', castle: 'pano_castle', sky: 'pano_sky',
};
const CLOUDY = new Set<SceneryTheme>(['village', 'forest', 'ruins', 'desert', 'snow', 'sky']);
const FOGGY = new Set<SceneryTheme>(['swamp', 'cave', 'castle']);
/** fileira intermediária: [desenho, altura] */
const BACK_ROW: Partial<Record<SceneryTheme, [string, number][]>> = {
  forest: [['o_tree1', 90], ['o_tree2', 85], ['o_tree_orange', 85], ['o_tree_yellow', 85], ['o_bush_big', 40], ['o_bush_g', 26], ['o_flowers1', 20]],
  swamp: [['o_dead1', 80], ['o_dead2', 92], ['o_mushroom', 30], ['o_plant', 26], ['o_crystal_purple', 30], ['o_mush_small', 22]],
  ruins: [['o_arch_bridge', 62], ['o_column', 62], ['o_ruin_wall', 50], ['o_arch_small', 46], ['o_column_broken', 64], ['o_plant', 24]],
  desert: [['o_palm', 88], ['o_column_broken', 56], ['o_arch2', 56], ['o_rock2', 30], ['o_rock3', 26]],
  cave: [['o_crystal_blue', 46], ['o_crystal_purple', 46], ['o_rock1', 30], ['o_mushroom_s', 22], ['o_rock4', 26]],
  snow: [['o_pine_snow', 88], ['o_tree_snow', 86], ['o_snow_bush', 26], ['o_rock4', 26]],
  volcano: [['o_dead1', 72], ['o_rock2', 30], ['o_brazier', 50], ['o_rock3', 28], ['o_dead2', 80]],
  castle: [['o_banner_red', 60], ['o_banner_blue', 60], ['o_lantern2', 46], ['o_cage', 46], ['o_fence_iron', 36], ['o_column', 62], ['o_brazier2', 46]],
  sky: [['o_tree1', 82], ['o_tree_pink', 82], ['o_column', 62], ['o_arch2', 56], ['o_bush_g', 26], ['o_flowers3', 24]],
};

const PROPS_BY_THEME: Record<StageDef['theme'], PropKind[]> = {
  village: ['barrel', 'crate', 'lamp', 'barrel', 'well'],
  forest: ['stump', 'log', 'mushrooms', 'rock', 'mushrooms'],
  ruins: ['drum', 'vase', 'rock', 'stub', 'vase'],
  cave: ['stalagmite', 'crystal', 'rock', 'crystal'],
  swamp: ['reeds', 'stump', 'mushrooms', 'reeds', 'rock'],
  desert: ['cactus', 'bones', 'rock', 'vase', 'cactus'],
  snow: ['snowman', 'iceRock', 'iceRock', 'stump'],
  volcano: ['lavaRock', 'obsidian', 'lavaRock', 'bones'],
  castle: ['brazier', 'barrel', 'crate', 'brazier'],
  sky: ['goldCrystal', 'cloud', 'vase', 'cloud'],
};

export class Scenery {
  props: SceneProp[] = [];
  private seed: number;
  private lights: Light[] = [];

  /** deslocamento vertical do fundo (paralaxe vertical quando a câmera sobe) */
  private bgOff = 0;

  constructor(private stage: StageDef, private terrain: Terrain) {
    this.seed = seedOf(stage.id);
    this.makeProps();
  }

  private makeProps(): void {
    const s = this.stage;
    const spacing = s.theme === 'village' ? 170 : 130;
    const kinds = PROPS_BY_THEME[s.theme];
    const blocked = (x: number) =>
      x < 40 || x > s.width - 40 ||
      Math.abs(x - s.spawn.x) < 50 ||
      s.npcs.some((n) => Math.abs(x - n.x) < 55) ||
      s.portals.some((p) => Math.abs(x - p.x) < 60);
    for (let i = 0; i * spacing < s.width; i++) {
      const x = i * spacing + rnd(this.seed, i, 1) * spacing * 0.7;
      if (blocked(x) || rnd(this.seed, i, 2) < 0.25) continue;
      // em cima do chão ou de uma plataforma que passe por ali
      const tops = this.terrain.surfacesAt(x);
      const y = tops.length > 1 && rnd(this.seed, i, 3) < 0.45 ? tops[0] : tops[tops.length - 1];
      this.props.push({ x, y, kind: kinds[Math.floor(rnd(this.seed, i, 5) * kinds.length)], seed: i });
    }
  }

  /** Desenha um objeto em pixel art (se os sprites já carregaram). Retorna false para usar o vetorial. */
  private px(ctx: Ctx, name: string, x: number, yb: number, h: number, i = 0): boolean {
    if (!spritesReady()) return false;
    return drawSpriteH(ctx, name, x, yb, h, rnd(this.seed, i, 77) < 0.5 ? 1 : -1);
  }

  // ───────────────────────── fundo ─────────────────────────

  drawBackground(ctx: Ctx, camX: number, camY: number, t: number): void {
    this.lights = [];
    // o fundo desce um pouco quando a câmera sobe (paralaxe vertical)
    this.bgOff = -(camY - CAM_REST) * 0.35;
    if (sceneryReady()) {
      this.pixelBackground(ctx, camX, camY, t);
      this.moodLight(ctx, t);
      return;
    }
    ctx.save();
    ctx.translate(0, this.bgOff);
    switch (this.stage.theme) {
      case 'village': this.village(ctx, camX, t); break;
      case 'forest': this.forest(ctx, camX, t); break;
      case 'ruins': this.ruins(ctx, camX, t); break;
      case 'cave': this.cave(ctx, camX, t); break;
      case 'swamp': this.swamp(ctx, camX, t); break;
      case 'desert': this.desert(ctx, camX, t); break;
      case 'snow': this.snow(ctx, camX, t); break;
      case 'volcano': this.volcano(ctx, camX, t); break;
      case 'castle': this.castle(ctx, camX, t); break;
      case 'sky': this.skyIslands(ctx, camX, t); break;
    }
    ctx.restore();
    this.moodLight(ctx, t);
  }

  // ───────────────────────── fundo em pixel art (prancha de cenários) ─────────────────────────

  private panoName(): string {
    const st = this.stage;
    // última fase da Cidadela e das Ilhas: o céu do vazio
    if (st.index === 80 || st.index === 90) return 'pano_void';
    return PANO[st.theme];
  }

  /**
   * Camadas, de trás para frente:
   * céu (topo do panorama esticado) → lua/sol → panorama (paralaxe 0.2) → nuvens andando
   * → fileira intermediária de árvores/ruínas (paralaxe 0.6, menores = mais longe) → névoa andando.
   */
  private pixelBackground(ctx: Ctx, camX: number, camY: number, t: number): void {
    const pano = this.panoName();
    const [pw, ph] = frameSize(pano);
    const groundS = BASE_GROUND - camY;
    const bottom = 276 + (groundS - 260) * 0.4;
    const sc = Math.min(2.6, 235 / ph);
    const top = bottom - ph * sc;
    const W = pw * sc;
    // céu acima do panorama: a 1ª linha esticada
    if (top > -20) {
      const [c0, c1] = panoSky(pano);
      const g = ctx.createLinearGradient(0, -20, 0, top + 2);
      g.addColorStop(0, tone(c0, -0.08));
      g.addColorStop(0.7, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, VIEW_W + 40, top + 24);
    }
    // lua / pôr do sol (os panoramas que não têm um)
    const mood = this.stage.mood;
    const own = pano === 'pano_haunted' || pano === 'pano_castle' || pano === 'pano_void' || pano === 'pano_cave';
    if (!own && (mood === 'night' || mood === 'dusk')) {
      const name = mood === 'night' ? (this.stage.theme === 'volcano' ? 'moon_red' : 'moon_blue') : 'sunset';
      drawSpriteH(ctx, name, VIEW_W * 0.78 - camX * 0.01, top + ph * sc * 0.42, mood === 'night' ? 46 : 54);
    }
    // panorama repetido; cópias alternadas espelhadas para não aparecer a emenda
    const off = camX * 0.2;
    const k0 = Math.floor(off / W) - 1;
    for (let k = k0; k * W - off < VIEW_W + W; k++) {
      const x = k * W - off;
      if (x + W < -2) continue;
      if (k % 2 === 0) drawSub(ctx, pano, 0, 0, pw, ph, Math.floor(x), top, Math.ceil(W) + 1, ph * sc);
      else {
        ctx.save();
        ctx.translate(Math.floor(x + W), 0);
        ctx.scale(-1, 1);
        drawSub(ctx, pano, 0, 0, pw, ph, 0, top, Math.ceil(W) + 1, ph * sc);
        ctx.restore();
      }
    }
    const theme = this.stage.theme;
    // nuvens andando com o vento
    if (CLOUDY.has(theme) && pano !== 'pano_void') {
      const [cw, ch] = frameSize('layer_clouds');
      const s2 = 1.6, w2 = cw * s2;
      const o2 = (camX * 0.08 - t * 8) % w2;
      ctx.globalAlpha = 0.9;
      for (let x = -o2 - w2; x < VIEW_W + w2; x += w2) drawSub(ctx, 'layer_clouds', 0, 0, cw, ch, Math.floor(x), top + 4, Math.ceil(w2) + 1, ch * s2);
      ctx.globalAlpha = 1;
    }
    // fileira intermediária (dá profundidade: anda mais devagar que o chão)
    const row = BACK_ROW[theme];
    if (row && theme !== 'village') {
      const f = 0.6, step = 70;
      const rowY = bottom - 10;
      this.each(camX, f, step, 140, (i, sx) => {
        if (rnd(this.seed, i, 200) < 0.3) return;
        const [name, h] = row[Math.floor(rnd(this.seed, i, 201) * row.length)];
        const x = sx + rnd(this.seed, i, 202) * 40;
        drawSpriteH(ctx, name, x, rowY + rnd(this.seed, i, 203) * 6, h * (0.75 + rnd(this.seed, i, 204) * 0.2), rnd(this.seed, i, 205) < 0.5 ? 1 : -1);
        if (name.includes('crystal')) this.lights.push({ x, y: rowY - h * 0.4, r: 60, color: name.includes('purple') ? '#c49bff' : '#5ff0e0' });
        if (name.includes('brazier') || name.includes('lantern')) glow(ctx, x, rowY - h * 0.75, 30, '#ffb060', 0.35 + Math.sin(t * 9 + i) * 0.05);
      });
    } else if (theme === 'village') {
      this.each(camX, 0.6, 90, 140, (i, sx) => {
        if (rnd(this.seed, i, 200) < 0.4) return;
        const name = ['o_tree1', 'o_tree_pink', 'o_tree2', 'o_bush_y'][Math.floor(rnd(this.seed, i, 201) * 4)];
        drawSpriteH(ctx, name, sx, bottom - 12, name.startsWith('o_bush') ? 22 : 70, 1);
      });
    }
    // névoa andando (lugares sombrios)
    if (FOGGY.has(theme) || pano === 'pano_void') {
      const [fw, fh] = frameSize('layer_fog');
      const s3 = 1.8, w3 = fw * s3;
      for (const [speed, a, dy, name] of [[10, 0.35, -30, 'layer_fog'], [22, 0.25, -6, 'layer_fog2']] as const) {
        const o3 = ((camX * 0.7 + t * speed) % w3 + w3) % w3;
        ctx.globalAlpha = a;
        for (let x = -o3 - w3; x < VIEW_W + w3; x += w3) drawSub(ctx, name, 0, 0, fw, fh, Math.floor(x), bottom + dy - fh * s3 * 0.5, Math.ceil(w3) + 1, fh * s3);
        ctx.globalAlpha = 1;
      }
    }
  }

  /** Construções fixas (vila) em pé no chão de verdade. */
  drawLandmarks(ctx: Ctx, camX: number, camY: number, t: number): void {
    this.landmarks(ctx, camX, t, BASE_GROUND - camY + 4);
  }

  /** Entardecer e noite: tingem o fundo (os personagens continuam bem visíveis). */
  private moodLight(ctx: Ctx, t: number): void {
    const m = this.stage.mood;
    const th = this.stage.theme;
    if (!m || m === 'day' || th === 'cave' || th === 'village') return;
    if (m === 'dusk') {
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, 'rgba(120,60,140,0.22)');
      g.addColorStop(0.5, 'rgba(255,130,60,0.18)');
      g.addColorStop(1, 'rgba(255,150,80,0.08)');
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
      return;
    }
    if (th !== 'castle') {
      ctx.fillStyle = sceneryReady() ? 'rgba(16,24,70,0.3)' : 'rgba(16,24,70,0.4)';
      ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
      if (sceneryReady()) return;
      ctx.fillStyle = 'rgba(16,24,70,0.0)';
      ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
      this.stars(ctx, t);
      ellipse(ctx, VIEW_W * 0.78, 38, 13, 13, '#f4f0d8');
      glow(ctx, VIEW_W * 0.78, 38, 60, '#f4f0d8', 0.2);
    }
  }

  private stars(ctx: Ctx, t: number): void {
    for (let i = 0; i < 45; i++) {
      const x = rnd(this.seed, i, 140) * VIEW_W, y = rnd(this.seed, i, 141) * 62;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 3);
      ctx.fillStyle = `rgba(255,255,240,${0.4 + tw * 0.5})`;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
  }

  /** Percorre posições visíveis de uma camada com paralaxe `f`. */
  private each(camX: number, f: number, spacing: number, margin: number, fn: (i: number, sx: number) => void): void {
    const off = camX * f;
    const i0 = Math.floor((off - margin) / spacing);
    const i1 = Math.ceil((off + VIEW_W + margin) / spacing);
    for (let i = i0; i <= i1; i++) fn(i, i * spacing - off);
  }

  private sky(ctx: Ctx, stops: [number, string][]): void {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 10);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -240, VIEW_W + 40, HORIZON + 260);
  }

  private sun(ctx: Ctx, x: number, y: number, r: number, color: string): void {
    if (this.stage.mood === 'night') return; // à noite aparece a lua
    glow(ctx, x, y, r * 6, color, 0.35);
    glow(ctx, x, y, r * 2.2, '#ffffff', 0.35);
    ellipse(ctx, x, y, r, r, tone(color, 0.5));
  }

  private clouds(ctx: Ctx, camX: number, t: number, color: string, count = 6): void {
    const total = VIEW_W + 360;
    for (let i = 0; i < count; i++) {
      const base = rnd(this.seed, i, 40) * total;
      const x = ((base - camX * 0.06 + t * (4 + i)) % total + total) % total - 180;
      const y = 26 + rnd(this.seed, i, 41) * 70;
      const s = 0.7 + rnd(this.seed, i, 42) * 0.7;
      ctx.globalAlpha = 0.9;
      ellipse(ctx, x + 6 * s, y + 6 * s, 40 * s, 9 * s, tone(color, -0.1));
      for (let k = 0; k < 4; k++) ellipse(ctx, x + (k - 1.5) * 16 * s, y - (k % 2) * 6 * s, 16 * s, 12 * s, color);
      ellipse(ctx, x - 6 * s, y - 8 * s, 12 * s, 9 * s, tone(color, 0.3));
      ctx.globalAlpha = 1;
    }
  }

  /** Cadeia de montanhas com face iluminada (esquerda) e face na sombra. */
  private mountains(ctx: Ctx, camX: number, f: number, spacing: number, hMin: number, hMax: number, color: string, snow: string | null, baseY: number, k: number): void {
    this.each(camX, f, spacing, spacing * 2, (i, sx) => {
      const w = spacing * (1.3 + rnd(this.seed, i, k) * 0.6);
      const h = hMin + rnd(this.seed, i, k + 1) * (hMax - hMin);
      const px = sx + rnd(this.seed, i, k + 2) * spacing * 0.4;
      const peak: Pt = [px, baseY - h];
      const left: Pt = [px - w / 2, baseY], right: Pt = [px + w / 2, baseY];
      const mid: Pt = [px + w * 0.08, baseY];
      poly(ctx, [left, peak, mid], color, null);
      poly(ctx, [mid, peak, right], tone(color, -0.14), null);
      if (snow && h > (hMin + hMax) / 2) {
        const sh = h * 0.28;
        const sl: Pt = [px - w * 0.5 * (sh / h), baseY - h + sh], sr: Pt = [px + w * 0.5 * (sh / h), baseY - h + sh];
        poly(ctx, [sl, peak, [px + 2, baseY - h + sh * 0.7], [px - 4, baseY - h + sh * 1.1]], snow, null);
        poly(ctx, [[px + 2, baseY - h + sh * 0.7], peak, sr], tone(snow, -0.12), null);
      }
    });
  }

  /** Colinas suaves contínuas. */
  private hills(ctx: Ctx, camX: number, f: number, baseY: number, amp: number, color: string, k: number): void {
    const off = camX * f;
    ctx.beginPath();
    ctx.moveTo(-20, VIEW_H);
    for (let x = -20; x <= VIEW_W + 20; x += 10) {
      const wx = x + off;
      const y = baseY - amp * (0.5 + 0.3 * Math.sin(wx * 0.009 + k) + 0.2 * Math.sin(wx * 0.023 + k * 2));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW_W + 20, VIEW_H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  private fog(ctx: Ctx, color: string, a: number, from = 0, to = HORIZON + 30): void {
    const g = ctx.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, alpha(color, 0));
    g.addColorStop(1, alpha(color, a));
    ctx.fillStyle = g;
    ctx.fillRect(-20, from, VIEW_W + 40, to - from);
  }

  private groundBase(ctx: Ctx, far: string, near: string): void {
    const g = ctx.createLinearGradient(0, HORIZON, 0, VIEW_H);
    g.addColorStop(0, far);
    g.addColorStop(0.25, mix(far, near, 0.5));
    g.addColorStop(1, near);
    ctx.fillStyle = g;
    ctx.fillRect(-20, HORIZON, VIEW_W + 40, VIEW_H - HORIZON + 20);
  }

  /** Itens pequenos espalhados no chão (grama, flores, folhas...). */
  private decals(camX: number, spacing: number, fn: (sx: number, sy: number, r: (k: number) => number, scale: number) => void): void {
    this.each(camX, 1, spacing, 40, (i, sx) => {
      for (let n = 0; n < 2; n++) {
        const r = (k: number) => rnd(this.seed, i * 3 + n, 60 + k);
        const far = r(0) < 0.18;
        const sy = far ? HORIZON + 6 + r(1) * (BACK_ROW_Y - HORIZON - 6) : GROUND_TOP + 2 + r(1) * (VIEW_H - GROUND_TOP);
        const scale = 0.45 + ((sy - HORIZON) / (VIEW_H - HORIZON)) * 0.75;
        fn(sx + r(2) * spacing, sy, r, scale);
      }
    });
  }

  // ── fileira de construções/objetos do fundo (paralaxe 1, base em BACK_ROW_Y) ──

  private landmarks(ctx: Ctx, camX: number, t: number, yb: number): void {
    for (const lm of this.stage.landmarks ?? []) {
      const sx = lm.x - camX;
      if (sx > VIEW_W + 40 || sx + LANDMARK_W[lm.kind] < -40) continue;
      switch (lm.kind) {
        case 'house': house(ctx, sx, yb, lm.variant ?? 0, t); break;
        case 'clinic': house(ctx, sx, yb, 1, t, true); break;
        case 'forge': forge(ctx, sx, yb, t); break;
        case 'tower': tower(ctx, sx, yb, t); break;
        case 'gate': gate(ctx, sx, yb, t); break;
      }
    }
  }

  private nearLandmark(wx: number, pad: number): boolean {
    return (this.stage.landmarks ?? []).some((lm) => wx > lm.x - pad && wx < lm.x + LANDMARK_W[lm.kind] + pad);
  }

  // ───────────────────────── temas ─────────────────────────

  private village(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#4f9fe0'], [0.6, '#8fc8f0'], [1, '#d8eef8']]);
    this.sun(ctx, VIEW_W * 0.82 - camX * 0.02, 46, 14, '#ffe9a8');
    this.clouds(ctx, camX, t, '#ffffff');
    this.mountains(ctx, camX, 0.06, 150, 50, 95, '#8fb0cc', '#f4f8fc', HORIZON + 4, 10);
    this.fog(ctx, '#d8eef8', 0.55, 60);
    this.hills(ctx, camX, 0.25, HORIZON + 6, 34, '#8cbf72', 1);
    // arvorezinhas nas colinas
    this.each(camX, 0.25, 34, 30, (i, sx) => {
      if (rnd(this.seed, i, 20) < 0.5) return;
      const wx = sx + camX * 0.25;
      const y = HORIZON + 6 - 34 * (0.5 + 0.3 * Math.sin(wx * 0.009 + 1) + 0.2 * Math.sin(wx * 0.023 + 2));
      ellipse(ctx, sx, y - 4, 4, 5, '#5f9450');
      ellipse(ctx, sx - 1, y - 5, 2, 2.5, '#7fb06a');
    });
    this.hills(ctx, camX, 0.5, HORIZON + 14, 18, '#7aae5e', 3);
    this.groundBase(ctx, '#8cbf6a', '#6aa048');
    // caminho de terra
    // cerca, árvores e arbustos entre as construções
    this.each(camX, 1, 70, 120, (i, sx) => {
      const wx = sx + camX;
      if (wx < 0 || wx > this.stage.width || this.nearLandmark(wx, 30)) return;
      const r = rnd(this.seed, i, 30);
      if (r < 0.45 && this.px(ctx, ['tree_green', 'tree_green', 'tree_orange', 'tree_pink'][Math.floor(rnd(this.seed, i, 70) * 4)], sx + 20, BACK_ROW_Y + 2, 82 + rnd(this.seed, i, 31) * 24, i)) { /* pixel art */ }
      else if (r < 0.75 && this.px(ctx, 'bush', sx + 20, BACK_ROW_Y + 2, 22, i)) { /* pixel art */ }
      else if (r < 0.45) roundTree(ctx, sx + 20, BACK_ROW_Y - 2, 0.9 + rnd(this.seed, i, 31) * 0.3, { trunk: '#8a5a3a', leaves: '#5f9a48' }, i, t);
      else if (r < 0.75) bush(ctx, sx + 20, BACK_ROW_Y, 1, '#6aa84f', i);
      else fence(ctx, sx, BACK_ROW_Y + 2, 48);
    });
    this.decals(camX, 30, (x, y, r, s) => {
      if (r(3) < 0.55) this.tuft(ctx, x, y, s, '#4f8a3a');
      else if (r(3) < 0.8) {
        ellipse(ctx, x, y, 1.8 * s, 1.8 * s, ['#ff7aa0', '#ffffff', '#ffd36b', '#c49bff'][Math.floor(r(4) * 4)]);
        ellipse(ctx, x, y, 0.7 * s, 0.7 * s, '#ffe08a');
      }
    });
  }

  private forest(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#5fb0a0'], [0.6, '#a8dcc4'], [1, '#e8f4d8']]);
    this.sun(ctx, VIEW_W * 0.25 - camX * 0.02, 40, 12, '#fff4c0');
    this.clouds(ctx, camX, t, '#f4fbf0', 4);
    this.mountains(ctx, camX, 0.05, 160, 45, 80, '#86b4a4', null, HORIZON + 4, 11);
    this.fog(ctx, '#e8f4d8', 0.5, 60);
    // silhuetas de floresta em camadas (mais longe = mais clara)
    const forestLayer = (f: number, spacing: number, s: number, color: string, k: number) => {
      this.each(camX, f, spacing, 60, (i, sx) => {
        const h = (40 + rnd(this.seed, i, k) * 30) * s;
        const x = sx + rnd(this.seed, i, k + 1) * spacing * 0.5;
        const by = HORIZON + 10 * s;
        if (rnd(this.seed, i, k + 2) < 0.5) {
          for (let j = 0; j < 3; j++) poly(ctx, [[x - (16 - j * 3) * s, by - j * 14 * s], [x, by - h * (0.55 + j * 0.22)], [x + (16 - j * 3) * s, by - j * 14 * s]], color, null);
        } else {
          ellipse(ctx, x, by - h * 0.6, 18 * s, h * 0.45, color);
          ellipse(ctx, x + 12 * s, by - h * 0.45, 14 * s, h * 0.35, color);
        }
        ctx.fillStyle = color;
        ctx.fillRect(x - 2 * s, by - h * 0.3, 4 * s, h * 0.3 + 10);
      });
    };
    forestLayer(0.2, 26, 0.75, '#7aa894', 20);
    this.fog(ctx, '#e8f4d8', 0.35, 100);
    forestLayer(0.45, 32, 1, '#4f8a6a', 24);
    this.groundBase(ctx, '#5f9a48', '#3f7a32');
    // árvores grandes do fundo
    this.each(camX, 1, 58, 120, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 24;
      const s = 1.1 + rnd(this.seed, i, 32) * 0.45;
      // pixel art: árvores mais espaçadas (os desenhos são largos)
      if (spritesReady() && r >= 0.45 && r < 0.75) { /* clareira */ }
      else if (r < 0.45 && this.px(ctx, r < 0.3 ? 'tree_green' : 'tree_orange', x, BACK_ROW_Y + 2, 80 * s, i)) { /* pixel art */ }
      else if (r >= 0.75 && this.px(ctx, 'bush2', x, BACK_ROW_Y + 2, 24, i)) { /* pixel art */ }
      else if (r < 0.5) pine(ctx, x, BACK_ROW_Y - 2, s, { trunk: '#6b4a32', leaves: '#2f6a42' }, i, t);
      else if (r < 0.85) roundTree(ctx, x, BACK_ROW_Y - 2, s, { trunk: '#6b4a32', leaves: '#3f8a45' }, i, t);
      else bush(ctx, x, BACK_ROW_Y, 1.1, '#4f9a48', i);
      if (rnd(this.seed, i, 33) < 0.3) rock(ctx, x + 26, BACK_ROW_Y + 3, 0.8, '#8a9488', i);
    });
    this.decals(camX, 24, (x, y, r, s) => {
      if (r(3) < 0.45) this.tuft(ctx, x, y, s, '#2f6a2a');
      else if (r(3) < 0.75) ellipse(ctx, x, y, 3 * s, 1.4 * s, ['#c47a2a', '#d9a03f', '#a8452a'][Math.floor(r(4) * 3)]);
      else ellipse(ctx, x, y, 9 * s, 2.5 * s, 'rgba(40,90,40,0.45)');
    });
  }

  private ruins(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#4a5a9a'], [0.45, '#c88a8a'], [0.8, '#f2a07b'], [1, '#ffd9a0']]);
    this.sun(ctx, VIEW_W * 0.3 - camX * 0.02, HORIZON - 30, 20, '#ffb070');
    this.clouds(ctx, camX, t, '#f7c4a8', 4);
    // mesas (morros de topo achatado com estratos)
    this.each(camX, 0.07, 170, 200, (i, sx) => {
      const w = 90 + rnd(this.seed, i, 10) * 80, h = 30 + rnd(this.seed, i, 11) * 45;
      const x = sx + rnd(this.seed, i, 12) * 60;
      const by = HORIZON + 4;
      const c = '#b0806e';
      poly(ctx, [[x - 14, by], [x, by - h], [x + w * 0.55, by - h], [x + w * 0.55, by]], c, null);
      poly(ctx, [[x + w * 0.55, by - h], [x + w, by - h + 4], [x + w + 18, by], [x + w * 0.55, by]], tone(c, -0.15), null);
      ctx.fillStyle = tone(c, -0.08);
      for (let k = 1; k < 4; k++) ctx.fillRect(x - 6 + k * 2, by - h + k * h * 0.25, w + 6, 1.5);
    });
    this.fog(ctx, '#ffd9a0', 0.5, 80);
    // silhuetas de colunas e arcos distantes
    this.each(camX, 0.35, 90, 90, (i, sx) => {
      if (rnd(this.seed, i, 20) < 0.35) return;
      const c = '#a8786a';
      const x = sx + rnd(this.seed, i, 21) * 30;
      const h = 30 + rnd(this.seed, i, 22) * 25;
      ctx.fillStyle = c;
      ctx.fillRect(x, HORIZON + 8 - h, 8, h);
      if (rnd(this.seed, i, 23) < 0.5) {
        ctx.fillRect(x + 34, HORIZON + 8 - h * 0.6, 8, h * 0.6);
        ctx.fillRect(x - 3, HORIZON + 8 - h - 5, 30, 6);
      }
    });
    this.groundBase(ctx, '#d9b98a', '#c4a070');
    // colunas, arcos e muros do fundo
    this.each(camX, 1, 90, 150, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 30;
      const base = '#d8c4a0';
      const ruinPx = ['arch', 'arch_vine', 'column', 'column_vine', 'ruin1', 'ruin2', 'ruin3', 'ruin4'][Math.floor(r * 8)];
      if (this.px(ctx, ruinPx, x + 20, BACK_ROW_Y + 3, ruinPx.startsWith('ruin') ? 60 : 84 + rnd(this.seed, i, 32) * 16, i)) { /* pixel art */ }
      else if (r < 0.3) archRuin(ctx, x, BACK_ROW_Y, base, i);
      else if (r < 0.7) column(ctx, x + 20, BACK_ROW_Y, 50 + rnd(this.seed, i, 32) * 50, 16, base, rnd(this.seed, i, 33) < 0.6, i);
      else ruinWall(ctx, x, BACK_ROW_Y, 60 + rnd(this.seed, i, 34) * 30, '#c8b08a', i);
    });
    this.tiles(ctx, camX);
    this.decals(camX, 34, (x, y, r, s) => {
      if (r(3) < 0.4) ellipse(ctx, x, y, 12 * s, 3 * s, 'rgba(232,206,160,0.6)');
      else if (r(3) < 0.7) {
        ctx.strokeStyle = 'rgba(80,60,40,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6 * s, y + 2 * s); ctx.lineTo(x + 9 * s, y - 1 * s); ctx.stroke();
      } else this.tuft(ctx, x, y, s * 0.8, '#9a9a52');
    });
  }

  private cave(ctx: Ctx, camX: number, t: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 20);
    g.addColorStop(0, '#0e0c16');
    g.addColorStop(1, '#2a2638');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -240, VIEW_W + 40, HORIZON + 270);
    // parede do fundo com formações e brilhos
    this.each(camX, 0.15, 60, 80, (i, sx) => {
      const h = 50 + rnd(this.seed, i, 10) * 70;
      stalagmite(ctx, sx, HORIZON + 6, 40 + rnd(this.seed, i, 11) * 30, h, '#2c2940', null);
      if (rnd(this.seed, i, 12) < 0.35) glow(ctx, sx + 6, HORIZON - h * 0.3, 10, '#5ff0e0', 0.35);
    });
    this.each(camX, 0.3, 46, 80, (i, sx) => {
      stalactite(ctx, sx, -4, 18 + rnd(this.seed, i, 14) * 18, 30 + rnd(this.seed, i, 15) * 50, '#24213a', null);
    });
    this.fog(ctx, '#3a3450', 0.5, 40);
    this.each(camX, 0.5, 70, 80, (i, sx) => {
      stalagmite(ctx, sx + 20, HORIZON + 12, 26 + rnd(this.seed, i, 16) * 20, 40 + rnd(this.seed, i, 17) * 40, '#3a3552', null);
    });
    this.each(camX, 0.7, 40, 80, (i, sx) => {
      stalactite(ctx, sx, -6, 16 + rnd(this.seed, i, 18) * 18, 24 + rnd(this.seed, i, 19) * 46, '#3c3756');
    });
    this.groundBase(ctx, '#3a3552', '#4a4562');
    // fileira do fundo: estalagmites grandes, cristais e tochas na parede
    this.each(camX, 1, 80, 120, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 30;
      if (r < 0.45) stalagmite(ctx, x, BACK_ROW_Y, 34 + rnd(this.seed, i, 32) * 20, 50 + rnd(this.seed, i, 33) * 50, '#5a5474');
      else if (r < 0.75) {
        const c = rnd(this.seed, i, 34) < 0.5 ? '#5ff0e0' : '#c49bff';
        crystal(ctx, x, BACK_ROW_Y, 1.3, c, t, i);
        this.lights.push({ x, y: BACK_ROW_Y - 14 + this.bgOff, r: 70, color: c });
      } else {
        rockWall(ctx, x - 30, BACK_ROW_Y, 80, i, this.seed);
        torch(ctx, x + 10, BACK_ROW_Y - 46, t, i);
        this.lights.push({ x: x + 10, y: BACK_ROW_Y - 50 + this.bgOff, r: 120 + Math.sin(t * 12 + i) * 6, color: '#ff9a3c' });
      }
    });
    // poças refletindo a luz
    this.decals(camX, 40, (x, y, r, s) => {
      if (r(3) < 0.25) {
        ellipse(ctx, x, y, 16 * s, 3.5 * s, '#2a3a52');
        ellipse(ctx, x - 3 * s, y - 0.5, 8 * s, 1.2 * s, 'rgba(95,240,224,0.35)');
      } else if (r(3) < 0.75) {
        ellipse(ctx, x, y, 2.5 * s, 1.6 * s, '#6a6484');
        ellipse(ctx, x - 0.6, y - 0.6, 1.2 * s, 0.7 * s, '#8a84a4');
      }
    });
  }

  // ── auxiliares de chão ──

  private tuft(ctx: Ctx, x: number, y: number, s: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y); ctx.lineTo(x - 4 * s, y - 5 * s);
    ctx.moveTo(x, y); ctx.lineTo(x, y - 7 * s);
    ctx.moveTo(x + 3 * s, y); ctx.lineTo(x + 5 * s, y - 5 * s);
    ctx.stroke();
  }

  /** Piso de pedra em perspectiva (linhas convergem para o ponto de fuga). */
  private tiles(ctx: Ctx, camX: number, colA = '#c8b490', colB = '#b09a76', line = 'rgba(90,70,50,0.35)'): void {
    const y0 = GROUND_TOP + 30, y1 = VIEW_H;
    const vx = VIEW_W / 2;
    const rows = [y0, y0 + 26, y0 + 56, y0 + 92, y0 + 134];
    const size = 64;
    const xAt = (xb: number, y: number) => vx + (xb - vx) * ((y - HORIZON) / (y1 - HORIZON));
    this.each(camX, 1, size, size * 2, (i, sx) => {
      for (let r = 0; r < rows.length - 1; r++) {
        const ya = rows[r], yb = Math.min(rows[r + 1], y1);
        const off = (r % 2) * size * 0.5;
        const a = sx + off, b = sx + off + size;
        const shadeT = rnd(this.seed, i * 7 + r, 70);
        if (shadeT < 0.15) continue; // pedra faltando: aparece a areia
        poly(ctx, [[xAt(a, ya), ya], [xAt(b, ya), ya], [xAt(b, yb), yb], [xAt(a, yb), yb]], mix(colA, colB, shadeT), line, 1);
      }
    });
  }

  // ───────────────────────── objetos do caminho ─────────────────────────

  /** Desenha um objeto do caminho em coordenadas de tela. */
  drawProp(ctx: Ctx, p: SceneProp, camX: number, camY: number, t: number): void {
    const x = p.x - camX, y = p.y - camY + 1;
    if (x < -60 || x > VIEW_W + 60) return;
    if (spritesReady()) {
      const r = rnd(this.seed, p.seed, 85);
      const rocks = ['o_rock1', 'o_rock2', 'o_rock3', 'o_rock4'];
      const pxProp: Partial<Record<PropKind, [string, number]>> = sceneryReady() ? {
        barrel: ['o_crate', 22], crate: [r < 0.5 ? 'o_crate3' : 'o_crate2', 22], lamp: ['o_lantern', 34],
        rock: [rocks[Math.floor(r * 4)], 22], mushrooms: [r < 0.5 ? 'o_mush_small' : 'o_mushroom', 22], log: ['o_log1', 18],
        stump: ['o_log2', 16], stub: ['o_column2', 32], drum: ['o_rock3', 20], vase: ['o_flowers5', 18],
        stalagmite: ['o_rock1', 24], crystal: [r < 0.5 ? 'o_crystal_blue' : 'o_crystal_purple', 28], reeds: ['o_plant', 24],
        bones: ['o_rock4', 18], iceRock: ['o_snow_bush', 18], lavaRock: ['o_rock2', 20], obsidian: ['o_rock3', 22],
        brazier: ['o_brazier2', 36], goldCrystal: ['o_crystal_blue', 26],
      } : {
        barrel: ['barrel_px', 24], rock: [['rock1', 'rock2', 'rock3', 'rock4', 'rock5', 'rock6'][Math.floor(r * 6)], 20],
        mushrooms: ['mushroom_deco', 18], stub: ['column_thin', 30], iceRock: ['rock_snow', 20], lavaRock: ['rock_lava', 20],
        brazier: ['brazier_px', 34], goldCrystal: ['crystal_gold', 24], stump: ['bush', 18],
        crystal: [r < 0.5 ? 'crystal_blue' : 'crystal_purple', 26], crate: [r < 0.5 ? 'chest' : 'barrel_px', 22],
        vase: ['flowers_y', 16], bones: ['rock6', 16],
      };
      const sp = pxProp[p.kind];
      if (sp && drawSpriteH(ctx, sp[0], x, y + 1, sp[1], r < 0.5 ? 1 : -1)) {
        if (p.kind === 'crystal' || p.kind === 'goldCrystal') {
          const c = p.kind === 'goldCrystal' ? '#ffe08a' : r < 0.5 ? '#5ff0e0' : '#c49bff';
          glow(ctx, x, y - 12, 40, c, 0.3);
          this.lights.push({ x, y: y - 10, r: 55, color: c });
        }
        if (p.kind === 'brazier') glow(ctx, x, y - 30, 36, '#ff9a3c', 0.35);
        return;
      }
    }
    switch (p.kind) {
      case 'barrel': barrel(ctx, x, y); break;
      case 'crate': crate(ctx, x - 9, y, 1 + rnd(this.seed, p.seed, 80) * 0.3); break;
      case 'lamp': lampPost(ctx, x, y, t); break;
      case 'well': well(ctx, x, y); break;
      case 'stump': stump(ctx, x, y, 1); break;
      case 'log': log(ctx, x - 22, y, 1); break;
      case 'mushrooms': mushrooms(ctx, x, y, 1.2, p.seed); break;
      case 'rock': rock(ctx, x, y, 0.8, this.stage.theme === 'cave' ? '#6a6484' : this.stage.theme === 'ruins' ? '#b8a080' : '#9aa094', p.seed); break;
      case 'drum': drum(ctx, x - 17, y, '#d8c4a0'); break;
      case 'vase': vase(ctx, x, y); break;
      case 'stub': column(ctx, x, y, 14 + rnd(this.seed, p.seed, 81) * 10, 14, '#d8c4a0', true, p.seed); break;
      case 'stalagmite': stalagmite(ctx, x, y, 18, 28 + rnd(this.seed, p.seed, 82) * 14, '#6a6484'); break;
      case 'reeds': reeds(ctx, x, y, 1, t, p.seed); break;
      case 'cactus': cactus(ctx, x, y, 0.6, p.seed); break;
      case 'bones': bones(ctx, x, y, 1); break;
      case 'snowman': snowman(ctx, x, y); break;
      case 'iceRock': iceRock(ctx, x, y, 0.8, p.seed); break;
      case 'lavaRock': lavaRock(ctx, x, y, 0.9, p.seed, t); break;
      case 'obsidian': stalagmite(ctx, x, y, 16, 26 + rnd(this.seed, p.seed, 84) * 12, '#2a2030'); break;
      case 'brazier': brazier(ctx, x, y, t, p.seed); break;
      case 'cloud': cloudPuff(ctx, x, y, 1); break;
      case 'goldCrystal': crystal(ctx, x, y, 0.8, '#ffe08a', t, p.seed); break;
      case 'crystal': {
        const c = rnd(this.seed, p.seed, 83) < 0.5 ? '#5ff0e0' : '#c49bff';
        crystal(ctx, x, y, 0.8, c, t, p.seed);
        this.lights.push({ x, y: y - 10, r: 55, color: c });
        break;
      }
    }
  }

  // ───────────────────────── primeiro plano e luz ─────────────────────────

  /** `player` em coordenadas de tela (pés). */
  drawForeground(ctx: Ctx, camX: number, t: number, player: { x: number; y: number }): void {
    switch (this.stage.theme) {
      case 'village': {
        this.butterflies(ctx, camX, t);
        this.fgLayer(camX, (x, i) => this.fgGrass(ctx, x, i, '#3f7a2f', '#ff7aa0'));
        break;
      }
      case 'forest': {
        // raios de sol entre as árvores
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        this.each(camX, 0.2, 170, 120, (i, sx) => {
          const a = 0.05 + Math.sin(t * 0.6 + i) * 0.02;
          ctx.fillStyle = `rgba(255,248,208,${a})`;
          ctx.beginPath();
          ctx.moveTo(sx, -10); ctx.lineTo(sx + 40, -10); ctx.lineTo(sx + 150, VIEW_H); ctx.lineTo(sx + 70, VIEW_H);
          ctx.fill();
        });
        ctx.restore();
        this.fireflies(ctx, camX, t, '#e8ff9a');
        this.fgLayer(camX, (x, i) => this.fern(ctx, x, i));
        break;
      }
      case 'ruins': {
        // luz quente do pôr do sol e poeira no ar
        const g = ctx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
        g.addColorStop(0, 'rgba(255,170,100,0.16)');
        g.addColorStop(1, 'rgba(120,60,90,0.12)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        this.fireflies(ctx, camX, t, '#fff0d0', 0.5);
        this.fgLayer(camX, (x, i) => {
          if (rnd(this.seed, i, 90) < 0.5) rock(ctx, x, VIEW_H + 6, 1.6, '#8a6a52', i);
          else this.fgGrass(ctx, x, i, '#8a7a3a', null);
        });
        break;
      }
      case 'cave': {
        // escuridão com a luz em volta do jogador, das tochas e dos cristais
        const px = player.x, py = player.y - 20;
        const g = ctx.createRadialGradient(px, py, 60, px, py, 380);
        g.addColorStop(0, 'rgba(6,5,14,0)');
        g.addColorStop(1, 'rgba(6,5,14,0.72)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        for (const l of this.lights) glow(ctx, l.x, l.y, l.r, l.color, 0.22);
        this.drips(ctx, camX, t);
        this.fireflies(ctx, camX, t, '#9ff0ff', 0.6);
        // estalactites enormes e escuras na frente
        this.each(camX, 1.35, 150, 120, (i, sx) => {
          if (rnd(this.seed, i, 95) < 0.4) return;
          stalactite(ctx, sx, -8, 40 + rnd(this.seed, i, 96) * 30, 50 + rnd(this.seed, i, 97) * 40, '#141220', null);
        });
        this.fgLayer(camX, (x, i) => stalagmite(ctx, x, VIEW_H + 8, 30, 26 + rnd(this.seed, i, 98) * 10, '#141220', null));
        break;
      }
      case 'swamp': {
        this.groundFog(ctx, camX, t, 'rgba(220,235,210,0.18)');
        this.fireflies(ctx, camX, t, '#d0ff8a');
        this.fgLayer(camX, (x, i) => reeds(ctx, x, VIEW_H + 4, 1.6, t, i));
        break;
      }
      case 'desert': {
        const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
        g.addColorStop(0, 'rgba(255,220,150,0.12)');
        g.addColorStop(1, 'rgba(255,170,90,0.08)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        this.fireflies(ctx, camX, t, '#fff0c0', 0.4);
        this.fgLayer(camX, (x, i) => (rnd(this.seed, i, 90) < 0.6 ? rock(ctx, x, VIEW_H + 6, 1.5, '#b07a4a', i) : this.fgGrass(ctx, x, i, '#a89a52', null)));
        break;
      }
      case 'snow': {
        this.snowfall(ctx, camX, t);
        this.fgLayer(camX, (x) => { ellipse(ctx, x, VIEW_H + 6, 40, 16, '#f4f8fc', 'rgba(120,150,180,0.5)'); ellipse(ctx, x - 10, VIEW_H, 16, 6, '#ffffff'); });
        break;
      }
      case 'volcano': {
        const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.4, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
        g.addColorStop(0, 'rgba(255,60,20,0)');
        g.addColorStop(1, 'rgba(120,20,10,0.35)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        this.embers(ctx, camX, t);
        this.fgLayer(camX, (x, i) => rock(ctx, x, VIEW_H + 6, 1.7, '#241c24', i));
        break;
      }
      case 'castle': {
        const px = player.x, py = player.y - 20;
        const g = ctx.createRadialGradient(px, py, 120, px, py, 520);
        g.addColorStop(0, 'rgba(10,8,24,0)');
        g.addColorStop(1, 'rgba(10,8,24,0.5)');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
        this.groundFog(ctx, camX, t, 'rgba(160,140,200,0.12)');
        this.fgLayer(camX, (x, i) => rock(ctx, x, VIEW_H + 6, 1.5, '#2a2638', i));
        break;
      }
      case 'sky': {
        this.fireflies(ctx, camX, t, '#fff4c0', 0.6);
        // nuvens passando na frente, embaixo
        this.each(camX, 1.4, 170, 120, (i, sx) => {
          if (rnd(this.seed, i, 150) < 0.4) return;
          ctx.globalAlpha = 0.85;
          cloudPuff(ctx, sx, VIEW_H + 14, 2.4);
          ctx.globalAlpha = 1;
        });
        break;
      }
    }
  }

  private groundFog(ctx: Ctx, camX: number, t: number, color: string): void {
    for (let i = 0; i < 7; i++) {
      const total = VIEW_W + 400;
      const x = ((rnd(this.seed, i, 160) * total - camX * 0.8 + t * (8 + i * 2)) % total + total) % total - 200;
      const y = GROUND_TOP + 20 + rnd(this.seed, i, 161) * 120;
      ellipse(ctx, x, y, 140, 16, color);
    }
  }

  private snowfall(ctx: Ctx, camX: number, t: number): void {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const W = VIEW_W + 40;
    for (let i = 0; i < 70; i++) {
      const sp = 20 + rnd(this.seed, i, 170) * 30;
      const x = ((rnd(this.seed, i, 171) * W - camX * (0.6 + rnd(this.seed, i, 172) * 0.6) + Math.sin(t + i) * 12) % W + W) % W - 20;
      const y = ((rnd(this.seed, i, 173) * VIEW_H + t * sp) % (VIEW_H + 10)) - 5;
      const r = 1 + rnd(this.seed, i, 174) * 1.8;
      ctx.fillRect(x, y, r, r);
    }
  }

  private embers(ctx: Ctx, camX: number, t: number): void {
    const W = VIEW_W + 40;
    for (let i = 0; i < 40; i++) {
      const sp = 20 + rnd(this.seed, i, 180) * 40;
      const x = ((rnd(this.seed, i, 181) * W - camX * 0.9 + Math.sin(t * 1.3 + i) * 15) % W + W) % W - 20;
      const y = VIEW_H - ((rnd(this.seed, i, 182) * VIEW_H + t * sp) % (VIEW_H + 10));
      const a = 0.5 + 0.5 * Math.sin(t * 5 + i);
      ctx.fillStyle = `rgba(255,${140 + Math.floor(a * 80)},60,${0.5 + a * 0.5})`;
      ctx.fillRect(x, y, 1.8, 1.8);
    }
  }

  // ───────────────────────── temas novos ─────────────────────────

  private swamp(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#5a7a70'], [0.6, '#9ab4a0'], [1, '#cddcc0']]);
    this.sun(ctx, VIEW_W * 0.7 - camX * 0.02, 50, 10, '#f0f4d0');
    this.mountains(ctx, camX, 0.05, 170, 35, 60, '#7a9488', null, HORIZON + 4, 12);
    this.fog(ctx, '#cddcc0', 0.6, 50);
    // silhuetas de árvores mortas
    const deadLayer = (f: number, spacing: number, color: string, s: number, k: number) => {
      this.each(camX, f, spacing, 60, (i, sx) => {
        const x = sx + rnd(this.seed, i, k) * spacing * 0.5;
        const h = (40 + rnd(this.seed, i, k + 1) * 30) * s;
        const by = HORIZON + 10 * s;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = 4 * s;
        ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + 3 * s, by - h); ctx.stroke();
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(x + 2 * s, by - h * 0.6); ctx.lineTo(x - 12 * s, by - h * 0.85);
        ctx.moveTo(x + 3 * s, by - h * 0.75); ctx.lineTo(x + 14 * s, by - h * 0.95);
        ctx.stroke();
        ellipse(ctx, x + 6 * s, by - h * 0.8, 16 * s, 10 * s, alpha(color, 0.6));
      });
    };
    deadLayer(0.2, 40, '#7a9088', 0.7, 20);
    this.fog(ctx, '#cddcc0', 0.4, 100);
    deadLayer(0.45, 55, '#4f6a58', 1, 24);
    this.groundBase(ctx, '#5f7a4a', '#3f5232');
    this.each(camX, 1, 75, 120, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 30;
      if (r < 0.5 && this.px(ctx, 'tree_dead_dark', x, BACK_ROW_Y + 2, 90 + rnd(this.seed, i, 32) * 20, i)) { /* pixel art */ }
      else if (r >= 0.5 && r < 0.75 && this.px(ctx, 'bush2', x, BACK_ROW_Y + 2, 22, i)) { /* pixel art */ }
      else if (r < 0.5) deadTree(ctx, x, BACK_ROW_Y, 1 + rnd(this.seed, i, 32) * 0.3, '#5a4a3a', i, t);
      else if (r < 0.75) bush(ctx, x, BACK_ROW_Y, 1, '#4f6a3a', i);
      else rock(ctx, x, BACK_ROW_Y + 2, 1, '#7a8478', i);
      if (rnd(this.seed, i, 33) < 0.6) reeds(ctx, x + 24, BACK_ROW_Y + 3, 1, t, i);
    });
    // poças de água parada com vitórias-régias
    this.decals(camX, 46, (x, y, r, s) => {
      if (r(3) < 0.35) {
        ellipse(ctx, x, y, 26 * s, 6 * s, '#3a4a40');
        ellipse(ctx, x - 6 * s, y - 1, 12 * s, 1.6 * s, 'rgba(200,230,210,0.35)');
        if (r(4) < 0.6) {
          ellipse(ctx, x + 8 * s, y, 4 * s, 1.6 * s, '#6aa048');
          if (r(5) < 0.5) ellipse(ctx, x + 8 * s, y - 1.5 * s, 1.4 * s, 1.4 * s, '#ff9ac8');
        }
      } else if (r(3) < 0.75) this.tuft(ctx, x, y, s, '#2f4a24');
      else ellipse(ctx, x, y, 8 * s, 2 * s, 'rgba(60,80,40,0.5)');
    });
  }

  private desert(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#3f8fd0'], [0.6, '#9fd0ec'], [1, '#f8e8c0']]);
    this.sun(ctx, VIEW_W * 0.75 - camX * 0.02, 44, 18, '#fff4c0');
    this.clouds(ctx, camX, t, '#ffffff', 3);
    this.each(camX, 0.07, 190, 200, (i, sx) => {
      const w = 80 + rnd(this.seed, i, 10) * 90, h = 25 + rnd(this.seed, i, 11) * 40;
      const x = sx + rnd(this.seed, i, 12) * 60, by = HORIZON + 4, c = '#c88a5a';
      poly(ctx, [[x - 12, by], [x, by - h], [x + w * 0.55, by - h], [x + w * 0.55, by]], c, null);
      poly(ctx, [[x + w * 0.55, by - h], [x + w, by - h + 4], [x + w + 16, by], [x + w * 0.55, by]], tone(c, -0.15), null);
    });
    this.fog(ctx, '#f8e8c0', 0.5, 80);
    this.each(camX, 0.25, 130, 140, (i, sx) => dune(ctx, sx, HORIZON + 8, 180 + rnd(this.seed, i, 20) * 80, 20 + rnd(this.seed, i, 21) * 16, '#ecc890'));
    this.each(camX, 0.5, 160, 160, (i, sx) => dune(ctx, sx + 40, HORIZON + 16, 220 + rnd(this.seed, i, 22) * 80, 22 + rnd(this.seed, i, 23) * 12, '#e0b478'));
    this.groundBase(ctx, '#ecca90', '#d4a868');
    this.each(camX, 1, 85, 140, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 30;
      if (r < 0.4) cactus(ctx, x, BACK_ROW_Y, 1 + rnd(this.seed, i, 32) * 0.3, i);
      else if (r < 0.55) palm(ctx, x, BACK_ROW_Y, 1.1, t, i);
      else if (r < 0.75 && this.px(ctx, 'rock3', x, BACK_ROW_Y + 3, 24, i)) { /* pixel art */ }
      else if (r < 0.75) rock(ctx, x, BACK_ROW_Y + 2, 1.4, '#c0805a', i);
      else if (r < 0.9) ruinWall(ctx, x - 20, BACK_ROW_Y, 60, '#d8b07a', i);
      else column(ctx, x, BACK_ROW_Y, 40 + rnd(this.seed, i, 33) * 30, 14, '#e0c090', true, i);
    });
    // ondulações na areia
    this.decals(camX, 30, (x, y, r, s) => {
      if (r(3) < 0.5) {
        ctx.strokeStyle = 'rgba(160,110,60,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 10 * s, y); ctx.quadraticCurveTo(x, y - 3 * s, x + 10 * s, y); ctx.stroke();
      } else if (r(3) < 0.75) ellipse(ctx, x, y, 2 * s, 1.3 * s, '#a87a4a');
      else this.tuft(ctx, x, y, s * 0.8, '#a89a52');
    });
  }

  private snow(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#5f9ad8'], [0.6, '#b0d4f0'], [1, '#eef6fc']]);
    this.sun(ctx, VIEW_W * 0.2 - camX * 0.02, 42, 11, '#ffffff');
    this.clouds(ctx, camX, t, '#ffffff', 4);
    this.mountains(ctx, camX, 0.05, 150, 70, 110, '#8aa8c4', '#f4f8fc', HORIZON + 4, 13);
    this.fog(ctx, '#eef6fc', 0.45, 60);
    this.mountains(ctx, camX, 0.15, 120, 40, 70, '#a8c0d8', '#ffffff', HORIZON + 6, 14);
    this.fog(ctx, '#eef6fc', 0.35, 100);
    // silhuetas de pinheiros nevados
    this.each(camX, 0.45, 30, 60, (i, sx) => {
      const x = sx + rnd(this.seed, i, 20) * 15, h = 30 + rnd(this.seed, i, 21) * 22, by = HORIZON + 12;
      poly(ctx, [[x - 12, by], [x, by - h], [x + 12, by]], '#5f7f90', null);
      poly(ctx, [[x - 6, by - h * 0.55], [x, by - h], [x + 6, by - h * 0.55]], '#eef6fc', null);
    });
    this.groundBase(ctx, '#e4eef8', '#cfdeee');
    this.each(camX, 1, 66, 120, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 24;
      if (r < 0.6 && this.px(ctx, 'tree_snow', x, BACK_ROW_Y + 2, 84 + rnd(this.seed, i, 32) * 26, i)) { /* pixel art */ }
      else if (r >= 0.6 && r < 0.8 && this.px(ctx, 'rock_snow', x, BACK_ROW_Y + 3, 26, i)) { /* pixel art */ }
      else if (r < 0.6) snowPine(ctx, x, BACK_ROW_Y - 2, 1.1 + rnd(this.seed, i, 32) * 0.4, i, t);
      else if (r < 0.8) iceRock(ctx, x, BACK_ROW_Y + 2, 1.3, i);
      else bush(ctx, x, BACK_ROW_Y, 1, '#dfe8f2', i);
    });
    this.decals(camX, 28, (x, y, r, s) => {
      if (r(3) < 0.4) { ellipse(ctx, x, y, 12 * s, 3 * s, '#f8fbff'); ellipse(ctx, x + 3 * s, y + 1.5 * s, 10 * s, 1.5 * s, 'rgba(120,150,190,0.3)'); }
      else if (r(3) < 0.7) {
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + x);
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      } else ellipse(ctx, x, y, 14 * s, 3 * s, 'rgba(160,210,240,0.45)');
    });
  }

  private volcano(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#1e0e14'], [0.5, '#5a2220'], [1, '#c0502a']]);
    volcanoCone(ctx, VIEW_W * 0.62 - camX * 0.04, HORIZON + 6, 280, 120, t);
    this.mountains(ctx, camX, 0.1, 130, 30, 60, '#4a2a2a', null, HORIZON + 6, 15);
    this.fog(ctx, '#c0502a', 0.35, 80);
    this.each(camX, 0.4, 50, 60, (i, sx) => {
      const h = 20 + rnd(this.seed, i, 20) * 40;
      ctx.fillStyle = '#3a2428';
      ctx.fillRect(sx, HORIZON + 12 - h, 12 + rnd(this.seed, i, 21) * 10, h);
    });
    this.groundBase(ctx, '#4a3434', '#2e2226');
    this.each(camX, 1, 70, 120, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 24;
      if (r < 0.5) {
        for (let k = 0; k < 3; k++) basalt(ctx, x + k * 13, BACK_ROW_Y, 14, 30 + rnd(this.seed, i * 3 + k, 32) * 45);
      } else if (r < 0.75) stalagmite(ctx, x, BACK_ROW_Y, 26, 44 + rnd(this.seed, i, 33) * 30, '#2a2030');
      else lavaRock(ctx, x, BACK_ROW_Y + 2, 1.5, i, t);
    });
    // poças e rachaduras de lava
    this.decals(camX, 40, (x, y, r, s) => {
      if (r(3) < 0.28) {
        const pulse = 0.8 + Math.sin(t * 2 + x * 0.1) * 0.2;
        ellipse(ctx, x, y, 22 * s, 5 * s, '#5a1a10');
        ellipse(ctx, x, y, 18 * s, 3.8 * s, '#ff6a2a');
        ellipse(ctx, x - 3 * s, y - 0.5, 9 * s * pulse, 1.6 * s, '#ffd060');
        glow(ctx, x, y, 34 * s, '#ff6a2a', 0.25);
      } else if (r(3) < 0.55) {
        ctx.strokeStyle = 'rgba(255,120,50,0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - 8 * s, y); ctx.lineTo(x - 2 * s, y - 2 * s); ctx.lineTo(x + 3 * s, y + 1 * s); ctx.lineTo(x + 9 * s, y - 1 * s); ctx.stroke();
      } else ellipse(ctx, x, y, 2.5 * s, 1.5 * s, '#1e1418');
    });
  }

  private castle(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#120f24'], [0.6, '#33264f'], [1, '#5f4472']]);
    this.stars(ctx, t);
    ellipse(ctx, VIEW_W * 0.75 - camX * 0.02, 46, 22, 22, '#f0e8d0');
    ellipse(ctx, VIEW_W * 0.75 - camX * 0.02 - 6, 42, 5, 4, '#d8d0b8');
    glow(ctx, VIEW_W * 0.75 - camX * 0.02, 46, 90, '#f0e8d0', 0.22);
    // silhueta do castelo distante
    this.each(camX, 0.08, 90, 100, (i, sx) => {
      const h = 40 + rnd(this.seed, i, 10) * 50, w = 22 + rnd(this.seed, i, 11) * 14, by = HORIZON + 4, c = '#2a2440';
      ctx.fillStyle = c;
      ctx.fillRect(sx, by - h, w, h);
      poly(ctx, [[sx - 4, by - h], [sx + w / 2, by - h - 26], [sx + w + 4, by - h]], c, null);
      ctx.fillRect(sx + w, by - h * 0.5, 70, h * 0.5);
      if (rnd(this.seed, i, 12) < 0.7) { ctx.fillStyle = '#ffc070'; ctx.fillRect(sx + w / 2 - 1.5, by - h * 0.7, 3, 5); }
    });
    this.fog(ctx, '#5f4472', 0.45, 90);
    this.each(camX, 0.35, 120, 120, (i, sx) => {
      const h = 30 + rnd(this.seed, i, 20) * 20, c = '#3a3454';
      ctx.fillStyle = c;
      ctx.fillRect(sx, HORIZON + 12 - h, 110, h);
      for (let k = 0; k < 8; k++) ctx.fillRect(sx + k * 14, HORIZON + 12 - h - 6, 8, 6);
    });
    this.groundBase(ctx, '#4a4660', '#3a3650');
    this.each(camX, 1, 150, 160, (i, sx) => {
      const x = sx + rnd(this.seed, i, 31) * 20;
      if (rnd(this.seed, i, 30) < 0.3) castleTower(ctx, x + 50, BACK_ROW_Y, 90 + rnd(this.seed, i, 32) * 30, t);
      else castleWall(ctx, x, BACK_ROW_Y, 130, 62 + rnd(this.seed, i, 33) * 20, t, i);
      brazier(ctx, x + 140, BACK_ROW_Y + 6, t, i);
    });
    this.tiles(ctx, camX, '#5a5670', '#46425c', 'rgba(20,18,30,0.4)');
  }

  private skyIslands(ctx: Ctx, camX: number, t: number): void {
    this.sky(ctx, [[0, '#2f7fd8'], [0.6, '#8cc8f4'], [1, '#e8f6ff']]);
    this.sun(ctx, VIEW_W * 0.3 - camX * 0.02, 40, 16, '#fff8e0');
    // mar de nuvens no horizonte
    this.each(camX, 0.05, 60, 80, (i, sx) => ellipse(ctx, sx, HORIZON - 2 + rnd(this.seed, i, 10) * 6, 46, 16, '#f4f8ff'));
    this.each(camX, 0.12, 170, 120, (i, sx) => {
      if (rnd(this.seed, i, 11) < 0.4) return;
      floatingIsland(ctx, sx, 80 + rnd(this.seed, i, 12) * 50, 40 + rnd(this.seed, i, 13) * 30, t, i, false);
    });
    this.fog(ctx, '#e8f6ff', 0.4, 60);
    this.each(camX, 0.35, 230, 160, (i, sx) => {
      if (rnd(this.seed, i, 14) < 0.35) return;
      floatingIsland(ctx, sx, 60 + rnd(this.seed, i, 15) * 70, 60 + rnd(this.seed, i, 16) * 40, t, i + 50);
    });
    this.clouds(ctx, camX, t, '#ffffff', 5);
    this.groundBase(ctx, '#9ad888', '#6ab05a');
    // borda da ilha (nuvens atrás do chão)
    this.each(camX, 1, 40, 40, (_i, sx) => ellipse(ctx, sx, HORIZON + 6, 34, 10, '#f4f8ff'));
    this.each(camX, 1, 95, 140, (i, sx) => {
      const r = rnd(this.seed, i, 30);
      const x = sx + rnd(this.seed, i, 31) * 30;
      if (r < 0.7 && this.px(ctx, ['column', 'arch', 'column_thin', 'arch'][Math.floor(r / 0.175)], x, BACK_ROW_Y + 3, 84 + rnd(this.seed, i, 32) * 20, i)) { /* pixel art */ }
      else if (r < 0.5) column(ctx, x, BACK_ROW_Y, 60 + rnd(this.seed, i, 32) * 40, 16, '#f2eee4', rnd(this.seed, i, 33) < 0.35, i);
      else if (r < 0.7) archRuin(ctx, x, BACK_ROW_Y, '#f2eee4', i);
      else if (r < 0.85) {
        crystal(ctx, x, BACK_ROW_Y - 20 + Math.sin(t + i) * 4, 1.3, '#ffe08a', t, i);
      } else bush(ctx, x, BACK_ROW_Y, 1, '#7fc06a', i);
    });
    this.decals(camX, 30, (x, y, r, s) => {
      if (r(3) < 0.5) this.tuft(ctx, x, y, s, '#4f9a48');
      else if (r(3) < 0.75) ellipse(ctx, x, y, 1.8 * s, 1.8 * s, ['#ffffff', '#ffe08a', '#9fd3ff'][Math.floor(r(4) * 3)]);
    });
  }

  private fgLayer(camX: number, fn: (sx: number, i: number) => void): void {
    this.each(camX, 1.35, 110, 80, (i, sx) => {
      if (rnd(this.seed, i, 91) < 0.45) return;
      fn(sx + rnd(this.seed, i, 92) * 40, i);
    });
  }

  private fgGrass(ctx: Ctx, x: number, i: number, color: string, flower: string | null): void {
    ctx.strokeStyle = tone(color, -0.25);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const bx = x + (k - 3) * 4;
      const h = 12 + rnd(this.seed, i * 9 + k, 93) * 10;
      ctx.moveTo(bx, VIEW_H + 4);
      ctx.quadraticCurveTo(bx + (k - 3) * 1.5, VIEW_H - h * 0.6, bx + (k - 3) * 2.5, VIEW_H - h);
    }
    ctx.stroke();
    if (flower && rnd(this.seed, i, 94) < 0.5) ellipse(ctx, x + 6, VIEW_H - 18, 3, 3, flower);
  }

  private fern(ctx: Ctx, x: number, i: number): void {
    const color = '#1f4a26';
    for (let k = 0; k < 5; k++) {
      const a = -1.2 + k * 0.6 + Math.sin(i + k) * 0.1;
      const len = 26 + rnd(this.seed, i * 5 + k, 95) * 10;
      const ex = x + Math.sin(a) * len, ey = VIEW_H + 6 - Math.cos(a) * len;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, VIEW_H + 6); ctx.quadraticCurveTo(x + Math.sin(a) * len * 0.3, ey + 6, ex, ey); ctx.stroke();
      for (let j = 1; j < 5; j++) {
        const fx = x + (ex - x) * (j / 5), fy = VIEW_H + 6 + (ey - VIEW_H - 6) * (j / 5);
        ellipse(ctx, fx - 3, fy, 4, 1.6, color);
        ellipse(ctx, fx + 3, fy, 4, 1.6, color);
      }
    }
  }

  private butterflies(ctx: Ctx, camX: number, t: number): void {
    for (let i = 0; i < 4; i++) {
      const wx = rnd(this.seed, i, 100) * this.stage.width;
      const x = wx - camX + Math.sin(t * 0.7 + i) * 40;
      if (x < -20 || x > VIEW_W + 20) continue;
      const y = GROUND_TOP + 10 + rnd(this.seed, i, 101) * 80 + Math.sin(t * 1.9 + i * 2) * 14;
      const flap = Math.abs(Math.sin(t * 14 + i)) * 4 + 1;
      const c = ['#ffd36b', '#ff9ac8', '#9fd3ff', '#ffffff'][i];
      ellipse(ctx, x - 2.5, y - 1, 3, flap, c);
      ellipse(ctx, x + 2.5, y - 1, 3, flap, c);
      ellipse(ctx, x, y, 0.8, 2.2, '#3a2a2a');
    }
  }

  private fireflies(ctx: Ctx, camX: number, t: number, color: string, a = 0.8): void {
    for (let i = 0; i < 14; i++) {
      const x = ((rnd(this.seed, i, 110) * (VIEW_W + 200) - camX * 0.9 + Math.sin(t * 0.5 + i) * 30) % (VIEW_W + 200) + (VIEW_W + 200)) % (VIEW_W + 200) - 100;
      const y = 120 + rnd(this.seed, i, 111) * 200 + Math.sin(t * 0.9 + i * 3) * 18;
      const blink = 0.5 + 0.5 * Math.sin(t * 2.5 + i * 7);
      glow(ctx, x, y, 7, color, a * blink * 0.6);
      ellipse(ctx, x, y, 1, 1, alpha(color, a * blink));
    }
  }

  private drips(ctx: Ctx, camX: number, t: number): void {
    this.each(camX, 0.7, 40, 40, (i, sx) => {
      if (rnd(this.seed, i, 120) < 0.7) return;
      const tipY = -6 + 24 + rnd(this.seed, i, 19) * 46;
      const ph = (t * 0.5 + rnd(this.seed, i, 121)) % 1;
      if (ph < 0.3) {
        ellipse(ctx, sx, tipY + ph * 4, 1.2, 1.6, '#9fd3f0');
      } else {
        const y = tipY + (ph - 0.3) * (ph - 0.3) * 900;
        if (y < VIEW_H) ellipse(ctx, sx, y, 1, 2, 'rgba(159,211,240,0.8)');
      }
    });
  }
}

/** Parede de rocha irregular (fundo da caverna), com faces de luz e sombra. */
function rockWall(ctx: Ctx, x: number, yb: number, w: number, i: number, seed: number): void {
  const h = 58 + rnd(seed, i, 130) * 20;
  const pts: Pt[] = [[x, yb]];
  for (let k = 0; k <= 5; k++) pts.push([x + (w * k) / 5, yb - h + rnd(seed, i * 6 + k, 131) * 22]);
  pts.push([x + w, yb]);
  poly(ctx, pts, '#4a4562');
  poly(ctx, [[x + w * 0.55, yb], [x + w * 0.6, yb - h * 0.7], [x + w, yb - h * 0.5], [x + w, yb]], '#3a3552', null);
}
