// ai: walker | hopper | flyer | shooter | boss
// lunge: ataque com preparação (wind = frames de aviso, dur = duração, speed = multiplicador)
export const MONSTERS = {
  gotinha: {
    name: 'Gotinha', level: 1, hp: 30, atk: 7, def: 0, exp: 8, gold: [1, 4],
    w: 22, h: 18, speed: 0.6, aggro: 120, ai: 'walker', color: '#5ad16b',
    drops: [{ id: 'pocao_vida', chance: 0.07 }, { equip: true, chance: 0.04 }],
  },
  cogumelo: {
    name: 'Cogumelo Saltitante', level: 2, hp: 48, atk: 9, def: 1, exp: 13, gold: [2, 6],
    w: 24, h: 26, speed: 1.1, aggro: 150, ai: 'hopper', color: '#e05a4f',
    drops: [{ id: 'pocao_vida', chance: 0.08 }, { equip: true, chance: 0.05 }],
  },
  vespa: {
    name: 'Vespa de Cobre', level: 3, hp: 36, atk: 10, def: 1, exp: 15, gold: [2, 7],
    w: 22, h: 18, speed: 1.2, aggro: 170, ai: 'flyer', color: '#e0a23a',
    drops: [{ id: 'mel_dourado', chance: 0.5, quest: 'q_mel' }, { id: 'pocao_mana', chance: 0.06 }, { equip: true, chance: 0.05 }],
  },
  espinho: {
    name: 'Espinheira', level: 4, hp: 62, atk: 11, def: 2, exp: 20, gold: [3, 9],
    w: 24, h: 34, speed: 0, aggro: 260, ai: 'shooter', color: '#3f9e5a',
    drops: [{ id: 'pocao_mana', chance: 0.08 }, { equip: true, chance: 0.06 }],
  },
  lobo: {
    name: 'Lobo da Névoa', level: 5, hp: 85, atk: 14, def: 2, exp: 26, gold: [4, 11],
    w: 36, h: 24, speed: 1.4, aggro: 200, ai: 'walker', color: '#8b93a8', lunge: { wind: 22, dur: 16, speed: 3.4 },
    drops: [{ id: 'presa_lobo', chance: 1, quest: 'q_lobos' }, { id: 'pocao_vida', chance: 0.08 }, { equip: true, chance: 0.07 }],
  },
  javali: {
    name: 'Javali de Pedra', level: 6, hp: 120, atk: 16, def: 4, exp: 34, gold: [6, 14],
    w: 40, h: 28, speed: 0.9, aggro: 220, ai: 'walker', color: '#8a6347', lunge: { wind: 40, dur: 45, speed: 5.5 },
    drops: [{ id: 'pocao_vida', chance: 0.1 }, { equip: true, chance: 0.08 }],
  },
  morcego: {
    name: 'Morcego de Cristal', level: 7, hp: 70, atk: 16, def: 2, exp: 30, gold: [5, 12],
    w: 24, h: 16, speed: 1.6, aggro: 220, ai: 'flyer', color: '#7fb6d9',
    drops: [{ id: 'pocao_mana', chance: 0.08 }, { equip: true, chance: 0.06 }],
  },
  golem: {
    name: 'Golem de Cristal', level: 9, hp: 1500, atk: 22, def: 6, exp: 450, gold: [180, 240],
    w: 72, h: 84, speed: 0.7, aggro: 999, ai: 'boss', color: '#6fc3d9', boss: true,
    drops: [{ equip: true, chance: 1, rarity: 2 }, { id: 'pocao_vida', chance: 1, qty: 3 }],
  },
};
