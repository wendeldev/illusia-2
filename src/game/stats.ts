import { getItem } from '../data';
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

export function expToNext(level: number): number {
  return Math.floor(40 * Math.pow(level, 1.6));
}

export function computeStats(p: Progress): Stats {
  const lv = p.level - 1;
  const s: Stats = { maxHp: 100 + 22 * lv, maxMp: 40 + 8 * lv, atk: 10 + 3 * lv, def: 3 + lv, crit: 0.05 };
  for (const id of Object.values(p.equipped)) {
    if (!id) continue;
    const e = getItem(id);
    s.maxHp += e.hp ?? 0;
    s.maxMp += e.mp ?? 0;
    s.atk += e.atk ?? 0;
    s.def += e.def ?? 0;
    s.crit += e.crit ?? 0;
  }
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
