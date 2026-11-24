// Personagem em camadas ("layered sprites"), como na prancha de camadas: corpo base sem equipamento
// e cada peça vestida por cima, no lugar certo do corpo (a anatomia de cada quadro vem de
// tools/anatomy.py → src/data/paperdoll.json). Ordem: aura, asas traseiras, capa, corpo, calças,
// botas, armadura, braços, capacete, arma na mão e asas frontais.
import { getItem } from '../../data';
import { PREFERRED, RARITY_COLORS, RARITY_KEYS, SET_OF } from '../../data/gear';
import PD from '../../data/paperdoll.json';
import RIG from '../../data/rig.json';
import { drawFit, frameCount, frameRect, hasSprite } from '../../engine/sprites';
import type { Slot } from '../../types';
import type { Progress } from '../progress';
import { glow } from './scene3d';

interface Anatomy {
  W: number; H: number; head: number[]; neck: number; hips: number[]; feet: number[]; hands: number[]; hand_y: number;
  /** oval do rosto (cx, cy, rx, ry) e pescoço do quadro 0 */
  oval: number[]; neck0: number;
}
const ANAT = PD as unknown as Record<string, Anatomy[]>;

/** Altura do personagem no jogo (px lógicos). */
export const DOLL_H = 56;
const HALO_FPS = 5;
/** Caixa de todos os halos (px da tela) e o espaço entre o halo e o topo do cabelo. */
const HALO_BOX = { w: 34, h: 24, gap: -0.5 };
/** Auras em formato (passe): tamanho na tela (px) e altura do centro (fração do corpo, a partir do topo). */
const AURA_SHAPED: Record<string, { size: number; y: number }> = { gau_skull: { size: 72, y: 0.22 }, gau_horns: { size: 58, y: 0.2 } };
/** Asas maiores que o padrão (as "Asas Pretas Grandes" do passe). */
const WINGS_SCALE: Record<string, number> = { gwb_blackbig: 1.3 };
/** Tamanhos padrão na tela (px), iguais para todas as classes e raridades. */
const SIZE = {
  /** comprimento da arma (diagonal do desenho): espada, machado, lança e cajado; adaga */
  weapon: 42, dagger: 30,
  /** asas traseiras e frontais (caixa) */
  wingsW: 48, wingsH: 26, frontW: 30, frontH: 11,
  /** aura no chão */
  auraW: 52, auraH: 20,
};

/** Caixa do halo no quadro do corpo (px do quadro) e o quadro de animação do halo.
 * Todos os halos cabem na mesma caixa (HALO_BOX, px da tela) e ficam logo acima do topo do cabelo, centrados
 * no rosto — iguais nas 3 classes e nas 8 raridades. `g` = px do quadro por px da tela. */
export function haloBox(A: { head: number[]; oval?: number[] }, name: string, time: number, g = 1): [number, number, number, number, number] {
  const hf = Math.floor(time * HALO_FPS) % Math.max(1, frameCount(name));
  const f = frameRect(name, hf);
  const [hx0, hy0, hx1] = A.head;
  const bw = HALO_BOX.w * g, bh = HALO_BOX.h * g;
  const k = f ? Math.min(bw / f[0], bh / f[1]) : 1;
  const w = f ? f[0] * k : bw, h = f ? f[1] * k : bh * 0.5;
  const cx = A.oval ? A.oval[0] : (hx0 + hx1) / 2;
  const bottom = hy0 - HALO_BOX.gap * g + Math.sin(time * 2.4) * 0.8;
  return [cx - w / 2, bottom - h, cx + w / 2, bottom, hf];
}

export interface DollLook {
  body: string; cls: string;
  /** halo (auréola) no espaço da cabeça */
  helmet?: string; haloColor: string; armor?: string; arms?: string; pants?: string; cape?: string; boots?: string;
  wings?: string; wingsFront?: string; aura?: string; auraColor: string; wingsGlow: boolean;
  weapon: string; weaponKind: string; weaponColor: string; weaponRarity: number; weaponUp: number;
}

export interface DollPose {
  frame: number;
  /** inclinação do corpo (rad), deslocamento e achatamento */
  rot?: number; ox?: number; oy?: number; sy?: number;
  /** deslocamento do rig, em px da prancha (antes da escala) */
  dx?: number; dy?: number;
  /** ângulo da arma (rad, 0 = como no desenho) */
  weapon?: number;
  /** estocada da arma para frente (px) */
  thrust?: number;
  alpha?: number; flash?: boolean;
  /** brilho na ponta da arma (poderes) */
  charge?: number;
}

const rarityOf = (p: Progress, slot: Slot) => { const id = p.equipped[slot]; return id ? getItem(id).rarity ?? 0 : -1; };

/** Nome da peça desenhada para o espaço (itens antigos usam a peça do set da classe na mesma raridade). */
function piece(p: Progress, slot: Slot, setCls: string, part: string): string | undefined {
  const id = p.equipped[slot];
  if (!id) return undefined;
  const e = getItem(id);
  const ic = e.icon ?? '';
  if (ic.startsWith('gs_') && hasSprite(ic)) return ic;
  const name = `gs_${setCls}_${RARITY_KEYS[Math.min(7, e.rarity ?? 0)]}_${part}`;
  return hasSprite(name) ? name : undefined;
}
/** Halo do espaço da cabeça: halo_<raridade> (capacetes antigos viram o halo da mesma raridade). */
function halo(p: Progress): string | undefined {
  const id = p.equipped.helmet;
  if (!id) return undefined;
  const e = getItem(id);
  const name = e.icon?.startsWith('halo_') ? e.icon : `halo_${RARITY_KEYS[Math.min(7, e.rarity ?? 0)]}`;
  return hasSprite(name) ? name : undefined;
}

function generic(p: Progress, slot: Slot, prefix: string): string | undefined {
  const id = p.equipped[slot];
  if (!id) return undefined;
  const e = getItem(id);
  const ic = e.icon ?? '';
  if (ic.startsWith(prefix + '_') && hasSprite(ic)) return ic;
  if (slot === 'wings' && hasSprite(ic)) return ic; // asas antigas: o próprio desenho
  const name = `${prefix}_${RARITY_KEYS[Math.min(7, e.rarity ?? 0)]}`;
  return hasSprite(name) ? name : undefined;
}

export function dollLook(p: Progress): DollLook {
  const classId = p.classId ?? 'warrior';
  const cls = SET_OF[classId] ?? 'warrior';
  const wid = p.equipped.weapon;
  const we = wid ? getItem(wid) : null;
  const wr = Math.max(0, we?.rarity ?? 0);
  const kind = we?.weaponKind ?? (PREFERRED[classId] ?? ['sword'])[0];
  const weapon = we?.icon?.startsWith('gw_') && hasSprite(we.icon) ? we.icon : `gw_${kind}_${RARITY_KEYS[Math.min(7, wr)]}`;
  return {
    body: `pd_${cls}`, cls,
    helmet: halo(p), haloColor: RARITY_COLORS[Math.max(0, rarityOf(p, 'helmet'))], armor: piece(p, 'armor', cls, 'armor'), arms: piece(p, 'gloves', cls, 'arms'),
    pants: piece(p, 'pants', cls, 'pants'), cape: piece(p, 'cape', cls, 'cape'), boots: generic(p, 'boots', 'gb'),
    wings: generic(p, 'wings', 'gwb'), wingsFront: generic(p, 'wingsFront', 'gwf'), aura: generic(p, 'aura', 'gau'),
    auraColor: RARITY_COLORS[Math.max(0, rarityOf(p, 'aura'))],
    wingsGlow: p.equipped.wings === 'wings_angel' || p.equipped.wings === 'wings_white' || rarityOf(p, 'wings') >= 5,
    weapon, weaponKind: kind, weaponColor: RARITY_COLORS[wr], weaponRarity: wr,
    weaponUp: p.upgrades?.[wid ?? ''] ?? 0,
  };
}

/** Desenha o personagem com os pés em (x, y). `k` = escala extra (telas de menu). */
export function drawDoll(ctx: CanvasRenderingContext2D, L: DollLook, x: number, y: number, facing: number, k: number, pose: DollPose, time: number): void {
  const frames = ANAT[L.cls];
  if (!frames) return;
  const fi = Math.max(0, Math.floor(pose.frame)) % frames.length;
  const A = frames[fi];
  const fr = frameRect(L.body, fi);
  if (!fr) return;
  const s = (DOLL_H / frames[0].H) * k;
  const ax = fr[2], ay = fr[3];
  // coordenadas da anatomia (canto do quadro) → relativas aos pés
  const X = (v: number) => v - ax, Y = (v: number) => v - ay;
  const [hl, hr] = A.hands;
  // asas e aura com tamanho fixo (a largura entre as mãos muda a cada quadro da passada)
  const span0 = frames[0].hands[1] - frames[0].hands[0];
  // px do quadro por px da tela (antes do zoom k): tamanhos padrão iguais para todas as classes
  const g = frames[0].H / DOLL_H;
  const [hx0, hy0, hx1] = A.hips;
  const cx = X((hx0 + hx1) / 2);
  const neck = Y(A.neck);
  const [fx0, fy0, fx1, fy1] = A.feet;
  const handY = Y(A.hand_y);
  const fl = !!pose.flash;

  // brilho da arma aprimorada / rara e aura (no chão, sem girar com o corpo)
  if (L.weaponUp >= 4 || L.weaponRarity >= 3) {
    const up = L.weaponUp;
    const c = up >= 10 ? '#ff5fd0' : up >= 7 ? '#ffd36b' : L.weaponColor;
    glow(ctx, x, y - DOLL_H * 0.45 * k, (28 + up * 2 + Math.sin(time * 4) * 3) * k, c, 0.14 + up * 0.02);
  }
  ctx.save();
  ctx.translate(x + (pose.ox ?? 0) * facing * k, y + (pose.oy ?? 0) * k);
  if (pose.alpha !== undefined) ctx.globalAlpha *= pose.alpha;
  ctx.scale(facing * s, s);
  ctx.translate(pose.dx ?? 0, pose.dy ?? 0);
  ctx.imageSmoothingEnabled = s < 1;
  if (L.aura) {
    glow(ctx, cx, -A.H * 0.4, A.H * 0.8, L.auraColor, 0.16);
    const pulse = 1 + Math.sin(time * 3) * 0.06;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * (0.7 + Math.sin(time * 5) * 0.15);
    const shaped = AURA_SHAPED[L.aura];
    if (shaped) {
      // aura em formato (caveira, chifres): desenho atrás do corpo, na altura do peito/cabeça
      const sz = shaped.size * g * pulse, ay0 = Y(A.H * shaped.y);
      drawFit(ctx, L.aura, cx - sz / 2, ay0 - sz / 2, cx + sz / 2, ay0 + sz / 2, 'contain', 'mid');
    } else {
      drawFit(ctx, L.aura, cx - SIZE.auraW / 2 * g * pulse, Y(fy1) - SIZE.auraH * g * pulse, cx + SIZE.auraW / 2 * g * pulse, Y(fy1) + 3, 'contain', 'bottom');
    }
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = prev;
  }
  if (pose.rot) ctx.rotate(pose.rot);
  if (pose.sy && pose.sy !== 1) ctx.scale(1, pose.sy);
  // asas traseiras (batendo) e capa (balançando)
  if (L.wings) {
    const flap = 0.8 + Math.abs(Math.sin(time * 3)) * 0.25;
    const wc = cx - 3;
    if (L.wingsGlow) glow(ctx, wc, neck + 2, SIZE.wingsW * 0.6 * g, '#ffffff', 0.18);
    ctx.save();
    ctx.translate(wc, 0); ctx.scale(flap, 1); ctx.translate(-wc, 0);
    const wk = WINGS_SCALE[L.wings] ?? 1;
    drawFit(ctx, L.wings, wc - SIZE.wingsW / 2 * g * wk, neck + 2 - SIZE.wingsH / 2 * g * wk, wc + SIZE.wingsW / 2 * g * wk, neck + 2 + SIZE.wingsH / 2 * g * wk, 'contain', 'mid', 0, fl);
    ctx.restore();
  }
  if (L.cape) {
    const sway = 1 + Math.sin(time * 4) * 0.06;
    const c0 = cx - 3;
    ctx.save();
    ctx.translate(c0, neck); ctx.scale(sway, 1); ctx.translate(-c0, -neck);
    drawFit(ctx, L.cape, c0 - span0 * 0.46, neck - 1, c0 + span0 * 0.46, Y(fy0) - 1, 'fill', 'top', 0, fl);
    ctx.restore();
  }
  // corpo base; com capacete: cabelo cortado pela borda do capacete, rosto e pele, e o capacete por cima
  drawFit(ctx, L.body, -ax, -ay, fr[0] - ax, fr[1] - ay, 'fill', 'top', fi, fl);
  if (L.pants) drawFit(ctx, L.pants, X(hx0) - 3, Y(hy0) - 1, X(hx1) + 3, Y(fy0) + 1, 'fill', 'top', 0, fl);
  if (L.boots) drawFit(ctx, L.boots, X(fx0) - 1, Y(fy0) - 4, X(fx1) + 1, Y(fy1) + 1, 'fill', 'top', 0, fl);
  if (L.armor) drawFit(ctx, L.armor, cx - span0 * 0.5, neck - 2, cx + span0 * 0.5, Y(hy0) + 3, 'fill', 'top', 0, fl);
  if (L.arms) drawFit(ctx, L.arms, X(hl) - 1, handY - 6, X(hr) + 1, handY + 2, 'fill', 'top', 0, fl);
  // halo flutuando acima da cabeça (brilho por cima, sem esconder o cabelo)
  // (na queda da morte o halo some aos poucos, em vez de girar com o corpo)
  const haloA = Math.max(0, Math.cos(pose.rot ?? 0) * 1.6 - 0.6);
  if (L.helmet && haloA > 0) {
    const [h0, h1, h2, h3, hf] = haloBox(A, L.helmet, time, g);
    const bx = [X(h0), Y(h1), X(h2), Y(h3)];
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * haloA;
    glow(ctx, (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2, (bx[2] - bx[0]) * 0.55, L.haloColor, 0.22);
    drawFit(ctx, L.helmet, bx[0], bx[1], bx[2], bx[3], 'fill', 'top', hf, fl);
    ctx.globalAlpha = a0;
  }
  // arma na mão da frente (pivô no cabo, embaixo à esquerda do desenho)
  const wr = frameRect(L.weapon);
  if (wr) {
    // todas as armas com o mesmo comprimento na tela (diagonal do desenho, do cabo à ponta)
    const len = (L.weaponKind === 'dagger' ? SIZE.dagger : SIZE.weapon) * g;
    const sc = len / Math.hypot(wr[0], wr[1]);
    const ww = wr[0] * sc, wh = wr[1] * sc;
    ctx.save();
    ctx.translate(X(hr) - 2 + (pose.thrust ?? 0), handY + 1);
    ctx.rotate(pose.weapon ?? 0);
    drawFit(ctx, L.weapon, -ww * 0.14, -wh * 0.88, ww * 0.86, wh * 0.12, 'fill', 'top', 0, fl);
    if (pose.charge) glow(ctx, ww * 0.7, -wh * 0.75, 18 * pose.charge, L.weaponColor, 0.5 * pose.charge);
    ctx.restore();
  }
  if (L.wingsFront) {
    const flap = 0.85 + Math.abs(Math.sin(time * 3 + 1)) * 0.2;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * 0.85;
    ctx.save();
    ctx.translate(cx, 0); ctx.scale(flap, 1); ctx.translate(-cx, 0);
    drawFit(ctx, L.wingsFront, cx - 4 - SIZE.frontW / 2 * g, neck + 3.5 - SIZE.frontH / 2 * g, cx - 4 + SIZE.frontW / 2 * g, neck + 3.5 + SIZE.frontH / 2 * g, 'contain', 'mid', 0, fl);
    ctx.restore();
    ctx.globalAlpha = a;
  }
  ctx.restore();
}

// ── rig das animações (o mesmo das spritesheets em spritesheets/, gerado por tools/build_layered.py) ──
interface RigBody { f: number; dx: number; dy: number; sy: number; rot: number }
interface RigWeapon { w: number; t: number }
const R = RIG as unknown as {
  anims: [string, number][]; fps: Record<string, number>; loop: string[];
  body: Record<string, Record<string, RigBody[]>>; weapon: Record<string, Record<string, RigWeapon[]>>; styleOf: Record<string, string>;
};
export type RigAnim = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'atk1' | 'atk2' | 'atk3' | 'hurt' | 'death';
const RIG_COUNT: Record<string, number> = Object.fromEntries(R.anims);

/** Quantos quadros a animação tem e a velocidade (quadros por segundo). */
export function rigFrames(anim: RigAnim): number { return RIG_COUNT[anim] ?? 1; }
export function rigFps(anim: RigAnim): number { return R.fps[anim] ?? 10; }

/** Pose do quadro `i` da animação (corpo pela classe, arma pelo estilo da arma equipada). */
export function rigPose(L: DollLook, anim: RigAnim, i: number): DollPose {
  const B = R.body[L.cls];
  const body = B?.[anim] ?? B?.idle ?? R.body.warrior.idle;
  const n = body.length;
  const k = ((Math.floor(i) % n) + n) % n;
  const b = body[k];
  const style = R.styleOf[L.weaponKind] ?? 'slash';
  const ws = R.weapon[style] ?? R.weapon.slash;
  const w = ws[anim]?.[k] ?? ws.idle?.[k % 4] ?? { w: 0, t: 0 };
  return { frame: b.f, dx: b.dx, dy: b.dy, sy: b.sy, rot: (b.rot * Math.PI) / 180, weapon: (w.w * Math.PI) / 180, thrust: w.t };
}

/** Personagem parado com tudo o que está equipado (telas de equipamento e de eventos). */
export function drawDollIdle(ctx: CanvasRenderingContext2D, p: Progress, x: number, y: number, facing: number, k: number, time: number): void {
  const L = dollLook(p);
  drawDoll(ctx, L, x, y, facing, k, rigPose(L, 'idle', time * rigFps('idle')), time);
}
