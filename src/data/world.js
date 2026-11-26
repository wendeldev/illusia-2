// Mapas, NPCs, missões e conquistas.
// solids: [x, y, w, h] blocos sólidos | platforms: [x, y, w] plataformas atravessáveis por baixo
export const FLOOR = 300;

export const MAPS = {
  vila: {
    name: 'Vila Aurora', theme: 'vila', width: 1400, safe: true, spawnX: 200,
    solids: [[0, FLOOR, 1400, 60]],
    platforms: [[470, 236, 110], [640, 196, 130]],
    portals: [{ x: 1350, to: 'campos', toX: 70, label: 'Campos Dourados' }],
    npcs: [{ id: 'mirela', x: 330 }, { id: 'tobias', x: 760 }, { id: 'brina', x: 1010 }, { id: 'davi', x: 1200 }],
    spawns: [],
  },
  campos: {
    name: 'Campos Dourados', theme: 'campos', width: 2700, levels: 'Nv. 1–4', spawnX: 70,
    solids: [[0, FLOOR, 2700, 60], [920, 262, 220, 40], [1750, 250, 180, 50]],
    platforms: [[400, 232, 140], [610, 182, 120], [1230, 222, 160], [1470, 172, 140], [2080, 222, 180], [2320, 172, 120]],
    portals: [
      { x: 30, to: 'vila', toX: 1300, label: 'Vila Aurora' },
      { x: 2660, to: 'bosque', toX: 70, label: 'Bosque Sussurrante' },
    ],
    spawns: [
      { type: 'gotinha', x: 520 }, { type: 'gotinha', x: 760 }, { type: 'gotinha', x: 1320 },
      { type: 'gotinha', x: 2200 }, { type: 'gotinha', x: 1600 }, { type: 'cogumelo', x: 1520 },
      { type: 'cogumelo', x: 1980 }, { type: 'cogumelo', x: 2450 }, { type: 'vespa', x: 1100 },
      { type: 'vespa', x: 2000 }, { type: 'vespa', x: 2400 },
    ],
  },
  bosque: {
    name: 'Bosque Sussurrante', theme: 'bosque', width: 3100, levels: 'Nv. 4–7', spawnX: 70,
    solids: [[0, FLOOR, 3100, 60], [700, 255, 160, 45], [1500, 240, 260, 60], [2400, 262, 200, 40]],
    platforms: [[380, 226, 140], [980, 210, 150], [1220, 160, 130], [1850, 220, 170], [2100, 170, 140], [2750, 220, 150]],
    portals: [
      { x: 30, to: 'campos', toX: 2600, label: 'Campos Dourados' },
      { x: 3060, to: 'ruinas', toX: 70, label: 'Ruínas de Cristal', minLevel: 6 },
    ],
    spawns: [
      { type: 'lobo', x: 600 }, { type: 'lobo', x: 1300 }, { type: 'lobo', x: 2200 }, { type: 'lobo', x: 2800 },
      { type: 'espinho', x: 1010 }, { type: 'espinho', x: 1620 }, { type: 'espinho', x: 2500 },
      { type: 'javali', x: 1900 }, { type: 'javali', x: 2650 }, { type: 'vespa', x: 900 }, { type: 'vespa', x: 2000 },
    ],
  },
  arena: {
    name: 'Coliseu do Crepúsculo', theme: 'arena', width: 960, levels: 'Modo desafio', spawnX: 480, noSave: true,
    solids: [[0, FLOOR, 960, 60]],
    platforms: [[150, 226, 150], [660, 226, 150], [405, 166, 150]],
    portals: [{ x: 30, to: 'vila', toX: 1150, label: 'Sair para a Vila' }],
    spawns: [],
  },
  ruinas: {
    name: 'Ruínas de Cristal', theme: 'ruinas', width: 1700, levels: 'Chefe • Nv. 8+', spawnX: 70,
    solids: [[0, FLOOR, 1700, 60], [420, 250, 60, 50]],
    platforms: [[200, 230, 120], [800, 210, 140], [1150, 210, 140]],
    portals: [{ x: 30, to: 'bosque', toX: 3000, label: 'Bosque Sussurrante' }],
    spawns: [{ type: 'morcego', x: 500 }, { type: 'morcego', x: 650 }, { type: 'golem', x: 1350, boss: true }],
  },
};

export const NPCS = {
  mirela: { name: 'Anciã Mirela', color: '#8e6fc1', hair: '#e6e6e6', role: 'quest', idle: 'A aurora sempre volta. Basta alguém ter coragem de esperar por ela.' },
  tobias: { name: 'Padeiro Tobias', color: '#d9893b', hair: '#3a2615', role: 'quest', idle: 'Pão quentinho para quem protege a vila!' },
  davi: { name: 'Capitão Davi', color: '#a33b3b', hair: '#d9d9d9', role: 'arena', idle: 'O Coliseu testa a coragem de quem quer ficar mais forte.' },
  brina: { name: 'Brina, a Mercadora', color: '#3fa37a', hair: '#c2412f', role: 'shop', idle: 'Poções fresquinhas! Também compro o que você não usa.' },
};

export const QUESTS = {
  q_gotinhas: {
    title: 'Praga de Gotinhas', giver: 'mirela', type: 'kill', target: 'gotinha', count: 8, minLevel: 1, req: null,
    text: 'As Gotinhas estão invadindo as plantações dos Campos Dourados. Pode afastar algumas delas?',
    doneText: 'Os campos já respiram melhor. Leve estas poções, vão ser úteis.',
    reward: { exp: 60, gold: 40, items: [['pocao_vida', 3]] },
  },
  q_mel: {
    title: 'Mel para o Forno', giver: 'tobias', type: 'collect', target: 'mel_dourado', count: 5, minLevel: 2, req: 'q_gotinhas',
    text: 'Meu bolo de mel é famoso, mas as Vespas de Cobre não deixam ninguém chegar perto das colmeias. Traz 5 Mel Dourado?',
    doneText: 'Que cheiro! Toma, um aventureiro de verdade merece equipamento de verdade.',
    reward: { exp: 140, gold: 80, equip: 1 },
  },
  q_lobos: {
    title: 'Uivos na Névoa', giver: 'mirela', type: 'collect', target: 'presa_lobo', count: 6, minLevel: 4, req: 'q_mel',
    text: 'Lobos da Névoa desceram do Bosque Sussurrante. Traga 6 presas como prova de que o caminho está seguro.',
    doneText: 'Você é mais forte do que parece. Mas sinto algo pior nas Ruínas de Cristal...',
    reward: { exp: 380, gold: 160, items: [['pocao_mana', 3]] },
  },
  q_golem: {
    title: 'O Coração de Cristal', giver: 'mirela', type: 'kill', target: 'golem', count: 1, minLevel: 6, req: 'q_lobos',
    text: 'Um Golem despertou nas Ruínas de Cristal e está drenando a luz da aurora. Só você pode detê-lo.',
    doneText: 'A aurora brilha de novo! A vila inteira canta o seu nome.',
    reward: { exp: 900, gold: 500, equip: 2 },
  },
};

export const HONORS = [
  { id: 'kill50', name: 'Caçador Novato', desc: 'Derrote 50 monstros', check: (s) => s.stats.kills >= 50, gold: 50 },
  { id: 'kill300', name: 'Terror dos Campos', desc: 'Derrote 300 monstros', check: (s) => s.stats.kills >= 300, gold: 300 },
  { id: 'combo30', name: 'Ritmo de Batalha', desc: 'Faça um combo de 30', check: (s) => s.stats.maxCombo >= 30, gold: 60 },
  { id: 'combo100', name: 'Tempestade', desc: 'Faça um combo de 100', check: (s) => s.stats.maxCombo >= 100, gold: 250 },
  { id: 'dash50', name: 'Pés Ligeiros', desc: '50 ataques em dash', check: (s) => s.stats.dashAttacks >= 50, gold: 80 },
  { id: 'lvl5', name: 'Aventureiro', desc: 'Alcance o nível 5', check: (s) => s.level >= 5, gold: 100 },
  { id: 'lvl10', name: 'Herói da Aurora', desc: 'Alcance o nível 10', check: (s) => s.level >= 10, gold: 400 },
  { id: 'wave5', name: 'Gladiador', desc: 'Vença 5 ondas no Desafio das Ondas', check: (s) => (s.stats.bestWave || 0) >= 5, gold: 150 },
  { id: 'wave15', name: 'Lenda do Coliseu', desc: 'Vença 15 ondas no Desafio das Ondas', check: (s) => (s.stats.bestWave || 0) >= 15, gold: 600 },
  { id: 'def5', name: 'Guardião do Cristal', desc: 'Defenda o Cristal por 5 ondas', check: (s) => (s.stats.bestDefense || 0) >= 5, gold: 200 },
  { id: 'boss', name: 'Quebra-Cristais', desc: 'Derrote o Golem de Cristal', check: (s) => s.stats.bosses >= 1, gold: 300 },
];
