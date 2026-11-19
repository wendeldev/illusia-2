// Cenário em camadas com profundidade (2.5D):
//   céu → montanhas distantes (neblina) → camada intermediária → fileira de construções
//   → chão em perspectiva → objetos no caminho (ordenados com os personagens)
//   → primeiro plano + luz/atmosfera.
// Tudo é gerado de forma determinística a partir do id da fase.
import { VIEW_H, VIEW_W } from '../../engine/view';
import type { LandmarkDef, StageDef } from '../../types';
import {
  alpha, BACK_ROW_Y, ellipse, glow, HORIZON, mix, poly, rnd, seedOf, tone, type Ctx, type Pt,
} from './scene3d';
import {
  archRuin, barrel, bush, column, crate, crystal, drum, fence, forge, gate, house, lampPost, log,
  mushrooms, pine, rock, roundTree, ruinWall, stalactite, stalagmite, stump, torch, tower, vase, well,
} from './structures';

const GROUND_TOP = 200;

export type PropKind =
  | 'barrel' | 'crate' | 'lamp' | 'well' | 'stump' | 'log' | 'mushrooms' | 'rock'
  | 'drum' | 'vase' | 'stub' | 'stalagmite' | 'crystal';

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

const PROPS_BY_THEME: Record<StageDef['theme'], PropKind[]> = {
  village: ['barrel', 'crate', 'lamp', 'barrel', 'well'],
  forest: ['stump', 'log', 'mushrooms', 'rock', 'mushrooms'],
  ruins: ['drum', 'vase', 'rock', 'stub', 'vase'],
  cave: ['stalagmite', 'crystal', 'rock', 'crystal'],
};

export class Scenery {
  props: SceneProp[] = [];
  private seed: number;
  private lights: Light[] = [];

  constructor(private stage: StageDef) {
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
      // fica nas bordas do caminho (perto do fundo ou da frente) para não atrapalhar a luta
      const edge = rnd(this.seed, i, 3) < 0.6;
      const y = edge ? 4 + rnd(this.seed, i, 4) * 14 : s.depth - 6 - rnd(this.seed, i, 4) * 10;
      this.props.push({ x, y, kind: kinds[Math.floor(rnd(this.seed, i, 5) * kinds.length)], seed: i });
    }
  }

  // ───────────────────────── fundo ─────────────────────────

  drawBackground(ctx: Ctx, camX: number, t: number): void {
    this.lights = [];
    switch (this.stage.theme) {
      case 'village': return this.village(ctx, camX, t);
      case 'forest': return this.forest(ctx, camX, t);
      case 'ruins': return this.ruins(ctx, camX, t);
      case 'cave': return this.cave(ctx, camX, t);
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
    ctx.fillRect(-20, -20, VIEW_W + 40, HORIZON + 40);
  }

  private sun(ctx: Ctx, x: number, y: number, r: number, color: string): void {
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

  private landmarks(ctx: Ctx, camX: number, t: number): void {
    for (const lm of this.stage.landmarks ?? []) {
      const sx = lm.x - camX;
      if (sx > VIEW_W + 40 || sx + LANDMARK_W[lm.kind] < -40) continue;
      switch (lm.kind) {
        case 'house': house(ctx, sx, BACK_ROW_Y, lm.variant ?? 0, t); break;
        case 'clinic': house(ctx, sx, BACK_ROW_Y, 1, t, true); break;
        case 'forge': forge(ctx, sx, BACK_ROW_Y, t); break;
        case 'tower': tower(ctx, sx, BACK_ROW_Y, t); break;
        case 'gate': gate(ctx, sx, BACK_ROW_Y, t); break;
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
    this.path(ctx, camX, '#c9a878', 48, 98);
    // cerca, árvores e arbustos entre as construções
    this.each(camX, 1, 70, 120, (i, sx) => {
      const wx = sx + camX;
      if (wx < 0 || wx > this.stage.width || this.nearLandmark(wx, 30)) return;
      const r = rnd(this.seed, i, 30);
      if (r < 0.45) roundTree(ctx, sx + 20, BACK_ROW_Y - 2, 0.9 + rnd(this.seed, i, 31) * 0.3, { trunk: '#8a5a3a', leaves: '#5f9a48' }, i, t);
      else if (r < 0.75) bush(ctx, sx + 20, BACK_ROW_Y, 1, '#6aa84f', i);
      else fence(ctx, sx, BACK_ROW_Y + 2, 48);
    });
    this.landmarks(ctx, camX, t);
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
      if (r < 0.5) pine(ctx, x, BACK_ROW_Y - 2, s, { trunk: '#6b4a32', leaves: '#2f6a42' }, i, t);
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
      if (r < 0.3) archRuin(ctx, x, BACK_ROW_Y, base, i);
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
    ctx.fillRect(-20, -20, VIEW_W + 40, HORIZON + 50);
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
        this.lights.push({ x, y: BACK_ROW_Y - 14, r: 70, color: c });
      } else {
        rockWall(ctx, x - 30, BACK_ROW_Y, 80, i, this.seed);
        torch(ctx, x + 10, BACK_ROW_Y - 46, t, i);
        this.lights.push({ x: x + 10, y: BACK_ROW_Y - 50, r: 120 + Math.sin(t * 12 + i) * 6, color: '#ff9a3c' });
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

  /** Faixa de caminho de terra no meio da área jogável. */
  private path(ctx: Ctx, camX: number, color: string, y0: number, y1: number): void {
    // bordas irregulares presas ao mundo: um ponto a cada 16px do mapa
    const top: Pt[] = [], bot: Pt[] = [];
    for (let wx = Math.floor((camX - 32) / 16) * 16; wx <= camX + VIEW_W + 32; wx += 16) {
      const k = wx / 16;
      top.push([wx - camX, GROUND_TOP + y0 + (rnd(this.seed, k, 50) - 0.5) * 6]);
      bot.push([wx - camX, GROUND_TOP + y1 + (rnd(this.seed, k, 51) - 0.5) * 6]);
    }
    poly(ctx, [...top, ...bot.reverse()], alpha(color, 0.85), null);
    this.each(camX, 1, 22, 20, (i, sx) => {
      const y = GROUND_TOP + y0 + 6 + rnd(this.seed, i, 52) * (y1 - y0 - 12);
      ellipse(ctx, sx + rnd(this.seed, i, 53) * 20, y, 2.4, 1.4, tone(color, -0.2));
    });
  }

  /** Piso de pedra em perspectiva (linhas convergem para o ponto de fuga). */
  private tiles(ctx: Ctx, camX: number): void {
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
        poly(ctx, [[xAt(a, ya), ya], [xAt(b, ya), ya], [xAt(b, yb), yb], [xAt(a, yb), yb]], mix('#c8b490', '#b09a76', shadeT), 'rgba(90,70,50,0.35)', 1);
      }
    });
  }

  // ───────────────────────── objetos do caminho ─────────────────────────

  /** Desenha um objeto do caminho em coordenadas de tela. */
  drawProp(ctx: Ctx, p: SceneProp, camX: number, t: number): void {
    const x = p.x - camX, y = GROUND_TOP + p.y;
    if (x < -60 || x > VIEW_W + 60) return;
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
      case 'crystal': {
        const c = rnd(this.seed, p.seed, 83) < 0.5 ? '#5ff0e0' : '#c49bff';
        crystal(ctx, x, y, 0.8, c, t, p.seed);
        this.lights.push({ x, y: y - 10, r: 55, color: c });
        break;
      }
    }
  }

  // ───────────────────────── primeiro plano e luz ─────────────────────────

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
        const px = player.x - camX, py = GROUND_TOP + player.y - 20;
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
    }
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
