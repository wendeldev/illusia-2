// Classes jogáveis. Todos os números ficam aqui para facilitar o balanceamento.
export const CLASSES = {
  guardiao: {
    name: 'Guardião',
    role: 'Corpo a corpo • Resistente',
    desc: 'Cavaleiro de espada e escudo. Muita vida e defesa, golpes largos que derrubam inimigos.',
    weapon: 'espada',
    color: '#3f7fd1', dark: '#2a5596', hair: '#6b4a2b', accent: '#f2c14e',
    base: { hp: 130, mp: 30, atk: 12, def: 6, crit: 0.05, speed: 2.1 },
    perLevel: { hp: 20, mp: 4, atk: 2.2, def: 1.3 },
    combo: [
      { mult: 1.0, dur: 20, active: [6, 11], range: 36, knock: 2 },
      { mult: 1.1, dur: 20, active: [6, 11], range: 36, knock: 2 },
      { mult: 1.7, dur: 28, active: [9, 15], range: 44, knock: 6, stun: 30, shake: 3 },
    ],
    skills: ['impacto', 'investida', 'baluarte'],
  },
  sombra: {
    name: 'Sombra',
    role: 'Corpo a corpo • Veloz',
    desc: 'Ladina ágil com adagas gêmeas. Combos longos, alta chance de crítico e muita mobilidade.',
    weapon: 'adagas',
    color: '#5b4a8a', dark: '#3b2f5e', hair: '#1e1e2a', accent: '#7de3c8',
    base: { hp: 100, mp: 35, atk: 10, def: 4, crit: 0.12, speed: 2.5 },
    perLevel: { hp: 15, mp: 5, atk: 2.1, def: 0.9 },
    combo: [
      { mult: 0.7, dur: 12, active: [3, 7], range: 28, knock: 1 },
      { mult: 0.7, dur: 12, active: [3, 7], range: 28, knock: 1 },
      { mult: 0.8, dur: 14, active: [4, 8], range: 30, knock: 1 },
      { mult: 1.4, dur: 22, active: [6, 12], range: 34, knock: 5, stun: 24, shake: 2 },
    ],
    skills: ['lamina_dupla', 'passo_sombrio', 'chuva_facas'],
  },
  arcanista: {
    name: 'Arcanista',
    role: 'À distância • Magia',
    desc: 'Maga que conjura orbes e controla o campo com gelo e fogo. Frágil, mas devastadora.',
    weapon: 'cajado',
    color: '#b0443f', dark: '#7a2b29', hair: '#e8d9b0', accent: '#7fd0ff',
    base: { hp: 90, mp: 60, atk: 11, def: 3, crit: 0.06, speed: 2.2 },
    perLevel: { hp: 13, mp: 9, atk: 2.4, def: 0.7 },
    combo: [
      { mult: 0.9, dur: 18, active: [6, 6], proj: { speed: 6, life: 50, r: 5, color: '#7fd0ff' } },
      { mult: 0.9, dur: 18, active: [6, 6], proj: { speed: 6, life: 50, r: 5, color: '#7fd0ff' } },
      { mult: 1.5, dur: 26, active: [10, 10], proj: { speed: 5, life: 60, r: 8, color: '#b98cff', pierce: true, knock: 5 } },
    ],
    skills: ['orbe_flamejante', 'geada', 'escudo_arcano'],
  },
};

// Ataque executado ao apertar "atacar" durante o dash.
export const DASH_STEP = { mult: 1.4, dur: 20, active: [3, 10], range: 40, knock: 5, stun: 20, lunge: 4, dash: true };
