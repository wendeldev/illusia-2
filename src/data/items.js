import { pick, randi } from '../engine/util.js';

export const CONSUMABLES = {
  pocao_vida: { name: 'Poção de Vida', color: '#e0484f', price: 20, hp: 0.4, desc: 'Recupera 40% do HP.' },
  pocao_mana: { name: 'Poção de Mana', color: '#4f7fe0', price: 25, mp: 0.5, desc: 'Recupera 50% do MP.' },
};

export const QUEST_ITEMS = {
  mel_dourado: { name: 'Mel Dourado', color: '#f5b82e', desc: 'Mel espesso das Vespas de Cobre.' },
  presa_lobo: { name: 'Presa de Lobo', color: '#e8e8e8', desc: 'Prova de que você enfrentou a névoa.' },
};

export const SLOT_NAMES = { weapon: 'Arma', armor: 'Armadura', acc: 'Acessório' };

const NAMES = {
  weapon: {
    guardiao: ['Espada de Treino', 'Espada de Ferro', 'Lâmina Solar'],
    sombra: ['Adagas Gastas', 'Adagas Gêmeas', 'Presas Lunares'],
    arcanista: ['Cajado de Galho', 'Cajado de Quartzo', 'Cetro Estelar'],
  },
  armor: ['Túnica de Lã', 'Cota de Couro', 'Couraça Aurora'],
  acc: ['Anel de Cobre', 'Amuleto de Jade', 'Pingente Estelar'],
};
const SUFFIX = ['da Aurora', 'do Vento', 'da Brasa', 'Lunar', 'do Eco', 'da Maré'];

export const RARITY = [
  { name: 'Comum', color: '#cfd6e0', mult: 1, affixes: 0 },
  { name: 'Raro', color: '#4fa3ff', mult: 1.25, affixes: 1 },
  { name: 'Épico', color: '#c86bff', mult: 1.6, affixes: 2 },
];

let uidCounter = Date.now() % 100000;

export function rollEquipment(level, cls, forceRarity = null, forceSlot = null) {
  const tier = Math.min(2, Math.floor((level - 1) / 4));
  const slot = forceSlot || pick(['weapon', 'armor', 'acc']);
  const r = forceRarity ?? (Math.random() < 0.06 ? 2 : Math.random() < 0.25 ? 1 : 0);
  const m = RARITY[r].mult;
  const stats = {};
  if (slot === 'weapon') stats.atk = Math.round((4 + level * 2.2) * m);
  if (slot === 'armor') { stats.def = Math.round((2 + level * 1.1) * m); stats.maxHp = Math.round((10 + level * 6) * m); }
  if (slot === 'acc') { stats.maxMp = Math.round((5 + level * 3) * m); stats.crit = +(0.01 * (1 + tier) * m).toFixed(3); }
  const affixes = [
    () => ({ atk: Math.max(1, Math.round(level * 0.8)) }),
    () => ({ def: Math.max(1, Math.round(level * 0.5)) }),
    () => ({ maxHp: level * 5 }),
    () => ({ maxMp: level * 3 }),
    () => ({ crit: 0.015 }),
  ];
  for (let i = 0; i < RARITY[r].affixes; i++) {
    const a = pick(affixes)();
    for (const k in a) stats[k] = +((stats[k] || 0) + a[k]).toFixed(3);
  }
  const base = slot === 'weapon' ? NAMES.weapon[cls][tier] : NAMES[slot][tier];
  return {
    uid: ++uidCounter, kind: 'equip', slot, cls: slot === 'weapon' ? cls : null,
    name: r > 0 ? `${base} ${pick(SUFFIX)}` : base,
    rarity: r, level, stats,
    value: Math.round((8 + level * 6) * (1 + r * 1.5)) + randi(0, 5),
  };
}

export const STAT_LABEL = { atk: 'ATQ', def: 'DEF', maxHp: 'HP', maxMp: 'MP', crit: 'CRÍT' };
export function fmtStat(k, v) {
  return k === 'crit' ? `${STAT_LABEL[k]} +${(v * 100).toFixed(1)}%` : `${STAT_LABEL[k]} +${v}`;
}
