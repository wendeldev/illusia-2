import { getClass, getItem } from '../data';
import { affinity, BAG_ITEMS } from '../data/items';
import type { EquipmentDef, Slot } from '../types';
import { PREFERRED, SET_OF } from '../data/gear';
import type { Progress } from './progress';

export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  crit: number;
  /** multiplicador do dano dos poderes */
  skillMul: number;
  /** multiplicador da recarga dos poderes */
  cdMul: number;
  /** multiplicador do dano recebido */
  dmgTaken: number;
  /** regeneração por segundo (fração do máximo) */
  regenHp: number;
  regenMp: number;
  /** multiplicadores de ouro e EXP */
  goldMul: number;
  expMul: number;
}

/** Aprimoramento: +10% dos atributos do item por nível. */
export function upgradeMul(p: Progress, itemId: string): number {
  return 1 + 0.1 * (p.upgrades?.[itemId] ?? 0);
}

/** Quantos coletáveis/itens de evento diferentes o jogador tem. */
export function collectionCount(p: Progress): { normal: number; event: number } {
  let normal = 0, event = 0;
  for (const b of BAG_ITEMS) {
    if (!(p.bag?.[b.id] > 0)) continue;
    if (b.kind === 'collectible') normal++;
    if (b.kind === 'event') event++;
  }
  return { normal, event };
}

export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  helmet: 'Halo',
  accessory: 'Acessório',
  gloves: 'Braços',
  boots: 'Botas',
  wings: 'Asas traseiras',
  pants: 'Calças',
  cape: 'Capa',
  wingsFront: 'Asas frontais',
  aura: 'Aura',
};

/** EXP para passar do nível `level` para o seguinte (curva pensada para o jogador acompanhar o nível dos monstros). */
export function expToNext(level: number): number {
  return Math.floor(34 * Math.pow(level, 1.27));
}

/** Curva da versão anterior (só para converter saves antigos). */
export function legacyExpToNext(level: number): number {
  return Math.floor(40 * Math.pow(level, 1.6));
}

/** Nível do monstro → multiplicador de força (vida, ataque, recompensa). */
export function levelPower(level: number): number {
  return 1 + (level - 1) * 0.105;
}

/** Curvas de crescimento dos monstros (ajustadas pela simulação tools/sim/balance.ts). */
export const ENEMY_CURVE = { hp: 1.42, atk: 1.32, exp: 1.15, gold: 1.0, commonAtk: 1.7 };

/** Atributos de um monstro no nível dado (mesma conta no jogo e na simulação). */
export function enemyScale(def: { hp: number; atk: number; def: number; exp: number; gold: number; boss?: boolean }, level: number) {
  const pw = levelPower(level);
  return {
    hp: def.hp * Math.pow(pw, ENEMY_CURVE.hp),
    // comuns batem mais forte (em grupo precisam ser uma ameaça); entra aos poucos até o nível 10 para o começo
    // continuar tranquilo. Chefes já têm poderes e fúria.
    atk: def.atk * Math.pow(pw, ENEMY_CURVE.atk) * (def.boss ? 1 : 1 + (ENEMY_CURVE.commonAtk - 1) * Math.min(1, (level - 1) / 9)),
    armor: def.def * Math.sqrt(pw),
    exp: def.exp * Math.pow(pw, ENEMY_CURVE.exp) * 1.2,
    gold: def.gold * Math.pow(pw, ENEMY_CURVE.gold),
  };
}

/** Bônus de set: 3 peças do mesmo set = +6%; 4 peças (completo) = +15% (ATQ, DEF, HP). Set da própria classe vale 1,5×.
 *  A raridade do set é a menor entre as peças contadas. */
export function setBonus(p: Progress): { cls: string; pieces: number; rarity: number; mul: number; label: string } | null {
  const by: Record<string, number[]> = {};
  for (const id of Object.values(p.equipped)) {
    if (!id) continue;
    const e = getItem(id);
    if (e.setClass) (by[e.setClass] ??= []).push(e.rarity ?? 0);
  }
  let best: { cls: string; pieces: number; rarity: number; mul: number; label: string } | null = null;
  for (const [cls, rs] of Object.entries(by)) {
    if (rs.length < 3) continue;
    const own = SET_OF[p.classId ?? 'warrior'] === cls ? 1.5 : 1;
    const rarity = Math.min(...rs);
    const base = (rs.length >= 4 ? 0.15 : 0.06) + rarity * 0.01;
    const mul = base * own;
    if (!best || mul > best.mul) best = { cls, pieces: rs.length, rarity, mul, label: `ATQ/DEF/HP +${Math.round(mul * 100)}%${own > 1 ? ' (sua classe)' : ''}` };
  }
  return best;
}

export function computeStats(p: Progress): Stats {
  const lv = p.level - 1;
  const s: Stats = {
    maxHp: 100 + 11 * lv, maxMp: 40 + 4 * lv, atk: 10 + 1.5 * lv, def: 3 + 0.5 * lv, crit: 0.05,
    skillMul: 1, cdMul: 1, dmgTaken: 1, regenHp: 0, regenMp: 0, goldMul: 1, expMul: 1,
  };
  const cls = p.classId;
  const m = getClass(cls).mods;
  s.maxHp *= m.hp; s.maxMp *= m.mp; s.atk *= m.atk; s.def *= m.def; s.crit *= m.crit;
  for (const id of Object.values(p.equipped)) {
    if (!id) continue;
    const e = getItem(id);
    const u = upgradeMul(p, id);
    s.maxHp += (e.hp ?? 0) * u;
    s.maxMp += (e.mp ?? 0) * u;
    s.atk += (e.atk ?? 0) * u;
    s.def += (e.def ?? 0) * u;
    s.crit += (e.crit ?? 0) * u;
    // arma preferida da classe: +25% no ataque da arma
    if (e.weaponKind && (PREFERRED[cls ?? 'warrior'] ?? []).includes(e.weaponKind)) s.atk += (e.atk ?? 0) * u * 0.25;
  }
  const sb = setBonus(p);
  if (sb) { s.atk *= 1 + sb.mul; s.def *= 1 + sb.mul; s.maxHp *= 1 + sb.mul; }
  // orbes de habilidade (permanentes; cada classe aproveita diferente)
  const bag = p.bag ?? {};
  const orb = (id: string) => (bag[id] ?? 0) * affinity(cls, id);
  s.atk += orb('orb_fire') + orb('orb_thunder') + orb('orb_prism') * 0.5;
  s.maxMp += orb('orb_water') * 4 + orb('orb_prism') * 2;
  s.crit += orb('orb_wind') * 0.003 + orb('orb_prism') * 0.001;
  s.skillMul += orb('orb_arcane') * 0.02;
  s.def += orb('orb_star') + orb('orb_prism') * 0.5;
  s.maxHp += orb('orb_star') * 6 + orb('orb_prism') * 4;
  // cartas e runa
  for (const c of [...(p.cards ?? []), p.rune]) {
    if (!c) continue;
    const a = affinity(cls, c);
    switch (c) {
      case 'card_blade': s.atk *= 1 + 0.1 * a; break;
      case 'card_guard': s.def *= 1 + 0.12 * a; s.maxHp *= 1 + 0.06 * a; break;
      case 'card_life': s.maxHp *= 1 + 0.12 * a; s.regenMp += 0.01 * a; break;
      case 'card_star': s.crit += 0.06 * a; break;
      case 'card_death': s.skillMul += 0.15 * a; break;
      case 'rune_silver': s.dmgTaken *= 1 - 0.08 * a; break;
      case 'rune_green': s.regenHp += 0.004 * a; s.regenMp += 0.006 * a; break;
      case 'rune_purple': s.cdMul *= 1 - 0.12 * a; break;
      case 'rune_gold': s.goldMul += 0.2 * a; s.expMul += 0.2 * a; break;
    }
  }
  // álbum: cada 4 coletáveis diferentes +2%; cada item de evento +3%
  const col = collectionCount(p);
  const bonus = 1 + Math.floor(col.normal / 4) * 0.02 + col.event * 0.03;
  s.atk *= bonus;
  s.maxHp *= bonus;
  s.maxHp = Math.round(s.maxHp); s.maxMp = Math.round(s.maxMp); s.atk = Math.round(s.atk); s.def = Math.round(s.def);
  return s;
}

export function describeBonus(e: EquipmentDef): string {
  const parts: string[] = [];
  if (e.atk) parts.push(`ATQ +${e.atk}`);
  if (e.def) parts.push(`DEF +${e.def}`);
  if (e.hp) parts.push(`HP +${e.hp}`);
  if (e.mp) parts.push(`MP +${e.mp}`);
  if (e.crit) parts.push(`CRÍT +${Math.round(e.crit * 1000) / 10}%`);
  return parts.join('  ');
}

/**
 * Dano médio de um golpe. A defesa reduz o dano em proporção (A² / (A + D)): defesa igual ao ataque corta pela metade,
 * e o golpe nunca vira 1 só porque a defesa passou do ataque (antes era A − 0,6·D, que zerava os monstros comuns).
 */
export function baseDamage(atk: number, def: number, mul: number): number {
  const a = atk * mul;
  return Math.max(1, (a * a) / (a + Math.max(0, def) * DEF_WEIGHT));
}
/** peso da defesa na fórmula do dano */
export const DEF_WEIGHT = 0.9;

export function calcDamage(atk: number, def: number, mul: number): number {
  return Math.max(1, Math.round(baseDamage(atk, def, mul) * (0.9 + Math.random() * 0.2)));
}
