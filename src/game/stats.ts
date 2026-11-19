import { getClass, getItem } from '../data';
import type { EquipmentDef, Slot } from '../types';
import type { Progress } from './progress';

export interface Stats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  crit: number;
}

export const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'Arma',
  armor: 'Armadura',
  helmet: 'Elmo',
  accessory: 'Acessório',
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

export function computeStats(p: Progress): Stats {
  const lv = p.level - 1;
  const s: Stats = {
    maxHp: Math.round(100 + 11 * lv), maxMp: Math.round(40 + 4 * lv),
    atk: Math.round(10 + 1.5 * lv), def: Math.round(3 + 0.5 * lv), crit: 0.05,
  };
  const m = getClass(p.classId).mods;
  s.maxHp *= m.hp; s.maxMp *= m.mp; s.atk *= m.atk; s.def *= m.def; s.crit *= m.crit;
  for (const id of Object.values(p.equipped)) {
    if (!id) continue;
    const e = getItem(id);
    s.maxHp += e.hp ?? 0;
    s.maxMp += e.mp ?? 0;
    s.atk += e.atk ?? 0;
    s.def += e.def ?? 0;
    s.crit += e.crit ?? 0;
  }
  s.maxHp = Math.round(s.maxHp); s.maxMp = Math.round(s.maxMp); s.atk = Math.round(s.atk); s.def = Math.round(s.def);
  return s;
}

export function describeBonus(e: EquipmentDef): string {
  const parts: string[] = [];
  if (e.atk) parts.push(`ATQ +${e.atk}`);
  if (e.def) parts.push(`DEF +${e.def}`);
  if (e.hp) parts.push(`HP +${e.hp}`);
  if (e.mp) parts.push(`MP +${e.mp}`);
  if (e.crit) parts.push(`CRÍT +${Math.round(e.crit * 100)}%`);
  return parts.join('  ');
}

export function calcDamage(atk: number, def: number, mul: number): number {
  const base = Math.max(1, atk * mul - def * 0.6);
  return Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2)));
}
