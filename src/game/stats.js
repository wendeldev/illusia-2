import { CLASSES } from '../data/classes.js';

export const expToNext = (l) => Math.round(25 * Math.pow(l, 1.7));

// Atributos distribuíveis: FOR (ataque), VIT (vida/defesa), INT (MP/poder de habilidade), AGI (crítico/velocidade)
export const ATTRS = {
  for: { name: 'Força', desc: '+2 ATQ' },
  vit: { name: 'Vitalidade', desc: '+12 HP, +0.5 DEF' },
  int: { name: 'Inteligência', desc: '+6 MP, +3% poder de habilidade' },
  agi: { name: 'Agilidade', desc: '+0.6% crítico, +0.4% velocidade' },
};

export function computeStats(save, buffs = []) {
  const c = CLASSES[save.cls];
  const L = save.level - 1, a = save.alloc;
  const s = {
    maxHp: c.base.hp + c.perLevel.hp * L + a.vit * 12,
    maxMp: c.base.mp + c.perLevel.mp * L + a.int * 6,
    atk: c.base.atk + c.perLevel.atk * L + a.for * 2,
    def: c.base.def + c.perLevel.def * L + a.vit * 0.5,
    crit: c.base.crit + a.agi * 0.006,
    skillPower: 1 + a.int * 0.03,
    speed: c.base.speed * (1 + a.agi * 0.004),
  };
  for (const slot of ['weapon', 'armor', 'acc']) {
    const it = save.equip[slot];
    if (!it) continue;
    for (const k in it.stats) s[k] = (s[k] || 0) + it.stats[k];
  }
  for (const b of buffs) if (b.mult) for (const k in b.mult) s[k] *= b.mult[k];
  s.maxHp = Math.round(s.maxHp); s.maxMp = Math.round(s.maxMp);
  s.atk = Math.round(s.atk); s.def = Math.round(s.def * 10) / 10;
  s.crit = Math.min(0.75, s.crit);
  return s;
}
