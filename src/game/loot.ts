// Tabelas de recompensa: drops de inimigos e chefes, conteúdo dos baús e escolha de equipamento.
import { EQUIPMENT, getItem, QUESTS } from '../data';
import { chestForLevel, keyForLevel } from '../data/items';
import { COSTUMES, STARTER_WEAPONS, usableBy } from '../data/gear';
import type { EnemyDef, EquipmentDef } from '../types';
import type { Progress } from './progress';
import { upgradeMul } from './stats';

export type Drop =
  | { kind: 'gold'; amount: number }
  | { kind: 'gems'; amount: number; icon: string }
  | { kind: 'bag'; id: string; n: number }
  | { kind: 'gear'; id: string };

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const MATERIALS_BY_TIER = [
  ['m_ore', 'm_herb', 'm_wood', 'm_leather', 'm_bone'],
  ['m_ore', 'm_iron', 'm_leather', 'm_bone', 'm_herb'],
  ['m_iron', 'm_sapphire', 'm_bone', 'm_wood'],
  ['m_iron', 'm_ruby', 'm_amethyst', 'm_gold'],
  ['m_gold', 'm_ruby', 'm_amethyst', 'm_essence'],
  ['m_gold', 'm_essence', 'm_sapphire', 'm_amethyst'],
];
const COLLECTIBLES = ['d_orb_blue', 'd_orb_fire', 'd_orb_purple', 'd_orb_green', 'd_amber', 'd_moon', 'd_feather', 'd_eye', 'd_spike', 'd_fang',
  'd_horn', 'd_batwing', 'd_redfeather', 'd_flame', 'd_icecrystal', 'd_void', 'o_clover', 'o_star', 'o_star_blue'];
const SOULS = ['s_blue', 's_red', 's_green', 's_gold', 's_purple', 's_white', 's_pink', 's_void'];
const ORBS = ['orb_fire', 'orb_water', 'orb_wind', 'orb_thunder', 'orb_arcane', 'orb_star', 'orb_prism'];
const CARDS = ['card_blade', 'card_guard', 'card_life', 'card_star', 'card_death'];
const RUNES = ['rune_silver', 'rune_green', 'rune_purple', 'rune_gold'];
const GEMS = ['gem_blue', 'gem_red', 'gem_purple', 'gem_gold'];
const CRYSTALS = ['cry_blue', 'cry_red', 'cry_green', 'cry_gold', 'cry_purple', 'cry_white'];
const EVOLUTION = ['ev_green', 'ev_blue', 'ev_purple', 'ev_gold', 'ev_red'];
export const EVENT_ITEMS = ['e_wings', 'e_crown', 'e_rose', 'e_ring', 'e_tome', 'e_hourglass', 'e_snowflake', 'e_pumpkin'];
const FOOD = ['f_drumstick', 'f_steak', 'f_bread', 'f_apple', 'f_grapes', 'f_cheese', 'f_juice', 'f_honey', 'f_fish'];

/** "Força" de um equipamento, para comparar e escolher drops. */
export function gearScore(e: EquipmentDef, mul = 1): number {
  return ((e.atk ?? 0) * 1.2 + (e.def ?? 0) + (e.hp ?? 0) / 8 + (e.mp ?? 0) / 10 + (e.crit ?? 0) * 200) * mul;
}

/** Equipamento aleatório adequado ao nível (bônus = chefes: mais forte e raro). */
export function rollGear(level: number, bonus = 0, auraChance = 0, classId?: string): string | null {
  if (Math.random() < auraChance) {
    const auras = EQUIPMENT.filter((e) => e.slot === 'aura' && !e.passOnly && (e.rarity ?? 0) <= 2 + bonus);
    return auras.length ? pick(auras).id : null;
  }
  const target = 5 + level * 0.9 * (1 + bonus * 0.25);
  const pool = EQUIPMENT.filter((e) => e.slot !== 'aura' && e.slot !== 'costume' && (e.rarity ?? 0) < 7
    && !e.passOnly && !STARTER_WEAPONS.has(e.id) && usableBy(e, classId) && gearScore(e) <= target * 1.25 && gearScore(e) >= target * 0.35);
  return pool.length ? pick(pool).id : null;
}

/** O que um inimigo derrotado deixa cair. `luck` multiplica as chances. */
export function rollEnemyDrops(def: EnemyDef, level: number, luck: number, event: boolean, p: Progress, region: number | undefined): Drop[] {
  const out: Drop[] = [];
  const tier = Math.min(5, Math.floor(level / 16));
  const L = luck * (event ? 1.5 : 1);
  const chance = (c: number) => Math.random() < c * L;
  const isFinal = !!def.boss && def.hp >= 600;
  const isElite = !!def.boss && !isFinal;
  if (!def.boss) {
    if (chance(0.09)) out.push({ kind: 'bag', id: 'pot_hp', n: 1 });
    if (chance(0.07)) out.push({ kind: 'bag', id: 'pot_mp', n: 1 });
    if (level >= 25 && chance(0.03)) out.push({ kind: 'bag', id: Math.random() < 0.5 ? 'pot_hp2' : 'pot_mp2', n: 1 });
    if (chance(0.05)) out.push({ kind: 'bag', id: chestForLevel(level), n: 1 });
    if (chance(0.04)) out.push({ kind: 'bag', id: keyForLevel(level), n: 1 });
    if (chance(0.06)) out.push({ kind: 'bag', id: pick(MATERIALS_BY_TIER[tier]), n: 1 });
    if (chance(0.04)) out.push({ kind: 'bag', id: pick(COLLECTIBLES), n: 1 });
    if (chance(0.015)) out.push({ kind: 'bag', id: pick(SOULS), n: 1 });
    if (chance(0.03)) out.push({ kind: 'bag', id: pick(ORBS), n: 1 });
    if (chance(0.04)) out.push({ kind: 'bag', id: pick(FOOD), n: 1 });
    if (chance(0.012)) { const g = rollGear(level, 0, 0, p.classId); if (g) out.push({ kind: 'gear', id: g }); }
  } else {
    const n = isFinal ? 5 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
    out.push({ kind: 'gems', amount: n, icon: pick(GEMS) });
    out.push({ kind: 'bag', id: 'pot_mp3', n: isFinal ? 2 : 1 });
    if (isFinal) out.push({ kind: 'bag', id: 'pot_elixir', n: 1 });
    out.push({ kind: 'bag', id: chestForLevel(level + 16), n: 1 });
    out.push({ kind: 'bag', id: keyForLevel(level + 16), n: 1 });
    out.push({ kind: 'bag', id: pick(isFinal ? EVOLUTION : CRYSTALS), n: isFinal ? 2 : 2 });
    out.push({ kind: 'bag', id: pick(ORBS), n: isFinal ? 3 : 2 });
    out.push({ kind: 'bag', id: pick(SOULS), n: 1 });
    if (chance(isFinal ? 0.5 : 0.3)) out.push({ kind: 'bag', id: pick(CARDS), n: 1 });
    if (isFinal && chance(0.3)) out.push({ kind: 'bag', id: pick(RUNES), n: 1 });
    if (isFinal && chance(0.08)) out.push({ kind: 'bag', id: 'chest_angel', n: 1 });
    // tíquetes dos eventos de chefes Lendários/Míticos
    if (isFinal && chance(0.15)) out.push({ kind: 'bag', id: 'tk_legend', n: 1 });
    if (isFinal && chance(0.05)) out.push({ kind: 'bag', id: 'tk_myth', n: 1 });
    if (isElite && chance(0.05)) out.push({ kind: 'bag', id: 'tk_legend', n: 1 });
    if (chance(isFinal ? 0.6 : 0.35)) { const g = rollGear(level, isFinal ? 2 : 1, isFinal ? 0.2 : 0.08, p.classId); if (g) out.push({ kind: 'gear', id: g }); }
    if (isElite || isFinal) out.push({ kind: 'bag', id: 'gem_rainbow', n: chance(0.04) ? 1 : 0 });
    // traje do Guerreiro: todo chefe solta um, sorteado entre os que ainda não tem (depois de ter todos, repetidos)
    const all = Object.keys(COSTUMES).map((t) => `cs_${t}`);
    const missing = all.filter((id) => !p.owned.includes(id));
    out.push({ kind: 'gear', id: pick(missing.length ? missing : all) });
  }
  if (event && Math.random() < 0.07 * luck) out.push({ kind: 'bag', id: pick(EVENT_ITEMS), n: 1 });
  // itens de missão: só enquanto a missão está ativa (e na região certa)
  for (const q of QUESTS) {
    const st = p.quests[q.id];
    if (st?.status !== 'active' || q.goal.kind !== 'collect') continue;
    if (q.goal.region !== undefined && q.goal.region !== region) continue;
    if ((p.bag[q.goal.itemId] ?? 0) >= q.goal.count) continue;
    if (Math.random() < (def.boss ? 1 : 0.3)) out.push({ kind: 'bag', id: q.goal.itemId, n: 1 });
  }
  return out.filter((d) => d.kind !== 'bag' || d.n > 0);
}

/** Conteúdo de um baú (tier 0 madeira ... 6 angelical). */
export function rollChest(tier: number, level: number, classId?: string): Drop[] {
  const out: Drop[] = [];
  out.push({ kind: 'gold', amount: Math.round((60 + level * 12) * (1 + tier * 0.8)) });
  out.push({ kind: 'bag', id: pick(MATERIALS_BY_TIER[Math.min(5, tier)]), n: 2 + tier });
  out.push({ kind: 'bag', id: Math.random() < 0.5 ? 'pot_hp' : 'pot_mp', n: 1 + Math.floor(tier / 2) });
  if (tier >= 2) out.push({ kind: 'bag', id: pick(CRYSTALS), n: 1 + Math.floor(tier / 3) });
  if (tier >= 3) out.push({ kind: 'gems', amount: tier - 1, icon: pick(GEMS) });
  if (tier >= 4) out.push({ kind: 'bag', id: pick(EVOLUTION), n: 1 });
  if (Math.random() < 0.2 + tier * 0.1) out.push({ kind: 'bag', id: pick(ORBS), n: 1 + Math.floor(tier / 2) });
  if (Math.random() < 0.1 + tier * 0.08) out.push({ kind: 'bag', id: pick(CARDS), n: 1 });
  if (tier >= 5 && Math.random() < 0.4) out.push({ kind: 'bag', id: pick(RUNES), n: 1 });
  if (Math.random() < 0.35 + tier * 0.1) { const g = rollGear(level, Math.floor(tier / 2), tier >= 5 ? 0.25 : tier >= 3 ? 0.06 : 0, classId); if (g) out.push({ kind: 'gear', id: g }); }
  if (tier === 6) {
    out.push({ kind: 'gems', amount: 10, icon: 'gem_rainbow' });
    out.push({ kind: 'bag', id: pick(EVENT_ITEMS), n: 1 });
    const w = rollGear(level, 3, 1);
    if (w) out.push({ kind: 'gear', id: w });
  }
  return out;
}

/** Equipa o item se for melhor que o atual no mesmo espaço. Retorna true se equipou. */
export function autoEquip(p: Progress, id: string): boolean {
  const e = getItem(id);
  if (!usableBy(e, p.classId)) return false;
  const cur = p.equipped[e.slot];
  if (cur && gearScore(getItem(cur), upgradeMul(p, cur)) >= gearScore(e)) return false;
  p.equipped[e.slot] = id;
  return true;
}
