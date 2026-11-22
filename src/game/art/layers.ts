// Personagem em camadas ("layered sprites"), como na prancha de camadas: corpo base sem equipamento
// e cada peça vestida por cima, no lugar certo do corpo (a anatomia de cada quadro vem de
// tools/anatomy.py → src/data/paperdoll.json). Ordem: aura, asas traseiras, capa, corpo, calças,
// botas, armadura, braços, capacete, arma na mão e asas frontais.
import { getItem } from '../../data';
import { PREFERRED, RARITY_COLORS, RARITY_KEYS, SET_OF } from '../../data/gear';
import PD from '../../data/paperdoll.json';
import RIG from '../../data/rig.json';
import HERO2 from '../../data/hero2.json';
import { drawFit, drawSprite, frameRect, hasSprite } from '../../engine/sprites';
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
/** Até onde o capacete desce na cabeça (fração da altura da cabeça, cabelo incluído). */
/**
 * Halo (auréola) no espaço da cabeça: flutua logo acima do topo da cabeça de cada quadro, centrado nela.
 * Largura total do desenho em relação à largura da cabeça (o anel simples é estreito; com asas abre mais).
 * Mesma regra de tools/build_layered.py.
 */
const HALO_W: Record<string, number> = { comum: 0.72, incomum: 0.95, raro: 1.05, epico: 1.05, lendario: 1.05, mitico: 1.05, divino: 1.12, celestial: 1.12 };
const HALO_FPS = 5;

/** Caixa do halo no quadro do corpo (px do quadro) e o quadro de animação do halo. */
export function haloBox(A: { head: number[] }, name: string, time: number): [number, number, number, number, number] {
  const rar = name.replace('halo_', '');
  const f = frameRect(name, 0);
  const [hx0, hy0, hx1] = A.head;
  const w = (hx1 - hx0) * (HALO_W[rar] ?? 1.05);
  const h = f ? (w * f[1]) / f[0] : w * 0.6;
  const cx = (hx0 + hx1) / 2;
  // a parte de baixo do desenho fica logo acima do topo do cabelo, balançando de leve
  const bottom = hy0 + 4 + Math.sin(time * 2.4) * 1.2;
  return [cx - w / 2, bottom - h, cx + w / 2, bottom, Math.floor(time * HALO_FPS) % 4];
}

const WALK: Record<string, number[]> = { warrior: [1, 2, 3, 4], assassin: [1, 2, 3, 4], mage: [0, 1, 2, 1], archer: [0, 1, 2, 1] };

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

/** Quadro do corpo andando (t = distância/tempo acumulado). */
export function walkFrame(look: DollLook, t: number): number {
  const w = WALK[look.cls] ?? [0];
  return w[Math.floor(t) % w.length];
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
  const [hl, hr] = A.hands, span = hr - hl;
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
    drawFit(ctx, L.aura, cx - span * 1.1 * pulse, Y(fy1) - span * 0.75 * pulse, cx + span * 1.1 * pulse, Y(fy1) + 3, 'contain', 'bottom');
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = prev;
  }
  if (pose.rot) ctx.rotate(pose.rot);
  if (pose.sy && pose.sy !== 1) ctx.scale(1, pose.sy);
  // asas traseiras (batendo) e capa (balançando)
  if (L.wings) {
    const flap = 0.8 + Math.abs(Math.sin(time * 3)) * 0.25;
    const wc = cx - 3;
    if (L.wingsGlow) glow(ctx, wc, neck + 2, span * 1.2, '#ffffff', 0.18);
    ctx.save();
    ctx.translate(wc, 0); ctx.scale(flap, 1); ctx.translate(-wc, 0);
    drawFit(ctx, L.wings, wc - span * 1.1, neck - 12, wc + span * 1.1, neck + 16, 'contain', 'mid', 0, fl);
    ctx.restore();
  }
  if (L.cape) {
    const sway = 1 + Math.sin(time * 4) * 0.06;
    const c0 = cx - 3;
    ctx.save();
    ctx.translate(c0, neck); ctx.scale(sway, 1); ctx.translate(-c0, -neck);
    drawFit(ctx, L.cape, c0 - span * 0.46, neck - 1, c0 + span * 0.46, Y(fy0) - 1, 'fill', 'top', 0, fl);
    ctx.restore();
  }
  // corpo base; com capacete: cabelo cortado pela borda do capacete, rosto e pele, e o capacete por cima
  drawFit(ctx, L.body, -ax, -ay, fr[0] - ax, fr[1] - ay, 'fill', 'top', fi, fl);
  if (L.pants) drawFit(ctx, L.pants, X(hx0) - 3, Y(hy0) - 1, X(hx1) + 3, Y(fy0) + 1, 'fill', 'top', 0, fl);
  if (L.boots) drawFit(ctx, L.boots, X(fx0) - 1, Y(fy0) - 4, X(fx1) + 1, Y(fy1) + 1, 'fill', 'top', 0, fl);
  if (L.armor) drawFit(ctx, L.armor, cx - span * 0.5, neck - 2, cx + span * 0.5, Y(hy0) + 3, 'fill', 'top', 0, fl);
  if (L.arms) drawFit(ctx, L.arms, X(hl) - 1, handY - 6, X(hr) + 1, handY + 2, 'fill', 'top', 0, fl);
  // halo flutuando acima da cabeça (brilho por cima, sem esconder o cabelo)
  if (L.helmet) {
    const [h0, h1, h2, h3, hf] = haloBox(A, L.helmet, time);
    const bx = [X(h0), Y(h1), X(h2), Y(h3)];
    glow(ctx, (bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2, (bx[2] - bx[0]) * 0.55, L.haloColor, 0.22);
    drawFit(ctx, L.helmet, bx[0], bx[1], bx[2], bx[3], 'fill', 'top', hf, fl);
  }
  // arma na mão da frente (pivô no cabo, embaixo à esquerda do desenho)
  const wr = frameRect(L.weapon);
  if (wr) {
    const wh = A.H * (L.weaponKind === 'dagger' ? 0.38 : L.weaponKind === 'bow' ? 0.46 : 0.5) * (frames[0].H / A.H);
    const ww = (wr[0] / wr[1]) * wh;
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
    drawFit(ctx, L.wingsFront, cx - 4 - span * 0.62, neck - 2, cx - 4 + span * 0.62, neck + 9, 'contain', 'mid', 0, fl);
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
export type RigAnim = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'atk1' | 'atk2' | 'atk3' | 'hurt' | 'death';
const RIG_COUNT: Record<string, number> = Object.fromEntries(R.anims);

/** Quantos quadros a animação tem e a velocidade (quadros por segundo). */
export function rigFrames(anim: RigAnim): number { return RIG_COUNT[anim] ?? 1; }
export function rigFps(anim: RigAnim): number { return R.fps[anim] ?? 10; }

/** Pose do quadro `i` da animação (corpo pela classe, arma pelo estilo da arma equipada). */
export function rigPose(L: DollLook, anim: RigAnim, i: number): DollPose {
  const body = R.body[L.cls]?.[anim] ?? R.body.warrior[anim];
  const n = body.length;
  const k = ((Math.floor(i) % n) + n) % n;
  const b = body[k];
  const style = R.styleOf[L.weaponKind] ?? 'slash';
  const w = (R.weapon[style] ?? R.weapon.slash)[anim]?.[k] ?? { w: 0, t: 0 };
  return { frame: b.f, dx: b.dx, dy: b.dy, sy: b.sy, rot: (b.rot * Math.PI) / 180, weapon: (w.w * Math.PI) / 180, thrust: w.t };
}

// ── personagem novo (prancha sheet-hero-b): quadros prontos de parado, correr e pular, sem e com armadura ──
interface Hero2Frame { head: number[]; hand: number[]; h: number }
const H2 = HERO2 as unknown as Record<string, Hero2Frame[]>;
/** Altura do personagem novo no jogo (px lógicos). */
const HERO2_H = 60;

/** Guerreiro, Lutador e Lanceiro usam o personagem novo. */
export function usesHero2(L: DollLook): boolean {
  return L.cls === 'warrior' && hasSprite('hn_bare_idle');
}

/**
 * Desenha o personagem novo. A armadura (com botas, luvas e asas) já vem desenhada nos quadros "armor";
 * por cima entram a aura, a arma na mão, o halo e (sem armadura) a capa e as asas equipadas.
 */
export function drawHero2(ctx: CanvasRenderingContext2D, L: DollLook, x: number, y: number, facing: number, k: number, anim: RigAnim, i: number, pose: DollPose, time: number): void {
  const v = L.armor ? 'armor' : 'bare';
  let seq = 'idle', fi = Math.floor(i) % 8;
  let rot = 0, dx = 0;
  switch (anim) {
    case 'walk': case 'run': seq = 'run'; fi = Math.floor(i) % 8; break;
    case 'jump': seq = 'jump'; fi = [2, 2, 3, 4][Math.min(3, Math.floor(i))]; break;
    case 'fall': seq = 'jump'; fi = 5; break;
    case 'atk1': seq = 'run'; fi = 1; dx = pose.dx ?? 0; break;
    case 'atk2': seq = 'run'; fi = 5; dx = pose.dx ?? 0; break;
    case 'atk3': seq = 'run'; fi = 2; dx = pose.dx ?? 0; break;
    case 'hurt': fi = 0; rot = -0.15; dx = -2; break;
    case 'death': fi = 0; rot = pose.rot ?? 0; break;
    default: fi = Math.floor(i) % 8;
  }
  const name = `hn_${v}_${seq}`;
  const F = H2[`${v}_${seq}`]?.[fi];
  const H0 = H2[`${v}_idle`]?.[0]?.h ?? 108;
  const s = (HERO2_H / H0) * k;
  const fl = !!pose.flash;
  // aura no chão
  if (L.aura) {
    const w = HERO2_H * 1.3 * k, pulse = 1 + Math.sin(time * 3) * 0.06;
    glow(ctx, x, y - HERO2_H * 0.4 * k, HERO2_H * 0.8 * k, L.auraColor, 0.16);
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    drawFit(ctx, L.aura, x - (w * pulse) / 2, y - w * 0.55 * pulse, x + (w * pulse) / 2, y + 3 * k, 'contain', 'bottom');
    ctx.globalCompositeOperation = prev;
  }
  if (L.weaponUp >= 4 || L.weaponRarity >= 3) {
    const c = L.weaponUp >= 10 ? '#ff5fd0' : L.weaponUp >= 7 ? '#ffd36b' : L.weaponColor;
    glow(ctx, x, y - HERO2_H * 0.45 * k, (28 + L.weaponUp * 2 + Math.sin(time * 4) * 3) * k, c, 0.14 + L.weaponUp * 0.02);
  }
  ctx.save();
  ctx.translate(x + dx * facing * k, y);
  if (pose.alpha !== undefined) ctx.globalAlpha *= pose.alpha;
  if (rot) ctx.rotate(rot * facing);
  ctx.scale(facing, 1);
  // sem armadura: capa e asas equipadas atrás do corpo (com armadura, as asas já vêm no desenho)
  if (v === 'bare' && L.wings) {
    const flap = 0.8 + Math.abs(Math.sin(time * 3)) * 0.25;
    ctx.save(); ctx.translate(-6 * s, 0); ctx.scale(flap, 1);
    drawFit(ctx, L.wings, -HERO2_H * 0.5 * k, -HERO2_H * 0.72 * k, HERO2_H * 0.5 * k, -HERO2_H * 0.3 * k, 'contain', 'mid');
    ctx.restore();
  }
  if (v === 'bare' && L.cape) drawFit(ctx, L.cape, -HERO2_H * 0.3 * k, -HERO2_H * 0.6 * k, HERO2_H * 0.18 * k, -HERO2_H * 0.06 * k, 'fill', 'top');
  drawSprite(ctx, name, fi, 0, 0, 1, { scale: s, flash: fl });
  // arma na mão da frente
  const wr = frameRect(L.weapon);
  if (wr && F && anim !== 'death') {
    const wh = HERO2_H * k * (L.weaponKind === 'dagger' ? 0.32 : L.weaponKind === 'bow' ? 0.48 : 0.46);
    const ww = (wr[0] / wr[1]) * wh;
    ctx.save();
    ctx.translate(F.hand[0] * s + (pose.thrust ?? 0) * k, F.hand[1] * s);
    ctx.rotate(pose.weapon ?? 0);
    drawFit(ctx, L.weapon, -ww * 0.14, -wh * 0.88, ww * 0.86, wh * 0.12, 'fill', 'top', 0, fl);
    if (pose.charge) glow(ctx, ww * 0.7, -wh * 0.75, 18 * pose.charge * k, L.weaponColor, 0.5 * pose.charge);
    ctx.restore();
  }
  // halo acima da cabeça
  if (L.helmet && F) {
    const [h0, ht, h1] = F.head;
    const f = frameRect(L.helmet, 0);
    const rar = L.helmet.replace('halo_', '');
    const HW: Record<string, number> = { comum: 0.72, incomum: 0.95, divino: 1.12, celestial: 1.12 };
    const W = (h1 - h0) * s * 0.92 * (HW[rar] ?? 1.05);
    const H = f ? (W * f[1]) / f[0] : W * 0.6;
    const cx = ((h0 + h1) / 2) * s, bottom = ht * s + 4 * k + Math.sin(time * 2.4) * 1.2 * k;
    glow(ctx, cx, bottom - H / 2, W * 0.55, L.haloColor, 0.22);
    drawFit(ctx, L.helmet, cx - W / 2, bottom - H, cx + W / 2, bottom, 'fill', 'top', Math.floor(time * 5) % 4, fl);
  }
  ctx.restore();
}

/** Personagem com a animação do rig: o novo (Guerreiro) ou o boneco em camadas (outras classes). */
export function drawCharacter(ctx: CanvasRenderingContext2D, L: DollLook, x: number, y: number, facing: number, k: number, anim: RigAnim, i: number, pose: DollPose, time: number): void {
  if (usesHero2(L)) drawHero2(ctx, L, x, y, facing, k, anim, i, pose, time);
  else drawDoll(ctx, L, x, y, facing, k, pose, time);
}

/** Personagem parado com tudo o que está equipado (telas de equipamento e de eventos). */
export function drawDollIdle(ctx: CanvasRenderingContext2D, p: Progress, x: number, y: number, facing: number, k: number, time: number): void {
  const L = dollLook(p);
  const i = time * rigFps('idle');
  drawCharacter(ctx, L, x, y, facing, k, 'idle', i, rigPose(L, 'idle', i), time);
}
