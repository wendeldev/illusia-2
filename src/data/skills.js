// Habilidades. type: melee | dash | projectile | aoe | buff
// cd e dur em frames (60 = 1 segundo).
export const SKILLS = {
  // Guardião
  impacto: {
    name: 'Impacto Sísmico', glyph: '✸', color: '#f2c14e', type: 'melee', unlock: 1, mp: 8, cd: 150,
    mult: 2.4, dur: 30, active: [12, 16], box: { w: 96, h: 44, center: true }, knock: 7, stun: 50, shake: 6, fx: 'quake',
    desc: 'Golpeia o chão e atordoa todos os inimigos próximos.',
  },
  investida: {
    name: 'Investida', glyph: '»', color: '#9cc9ff', type: 'dash', unlock: 3, mp: 10, cd: 240,
    mult: 1.8, dur: 22, speed: 7.5, knock: 8, stun: 40,
    desc: 'Avança com o escudo, atravessando e derrubando inimigos.',
  },
  baluarte: {
    name: 'Baluarte', glyph: '◆', color: '#f2c14e', type: 'buff', unlock: 6, mp: 18, cd: 1200,
    dur: 600, buff: { def: 1.6, atk: 1.2 },
    desc: 'Por 10 s: +60% de defesa e +20% de ataque.',
  },
  // Sombra
  lamina_dupla: {
    name: 'Redemoinho de Lâminas', glyph: '✕', color: '#7de3c8', type: 'melee', unlock: 1, mp: 7, cd: 120,
    mult: 0.6, dur: 34, active: [4, 30], hitEvery: 6, box: { w: 56, h: 44, center: true }, knock: 1, stun: 10,
    desc: 'Gira as adagas acertando várias vezes ao redor.',
  },
  passo_sombrio: {
    name: 'Passo Sombrio', glyph: '☾', color: '#b49cff', type: 'dash', unlock: 3, mp: 8, cd: 180,
    mult: 1.5, dur: 16, speed: 9, knock: 3, stun: 30, ghost: true,
    desc: 'Atravessa as sombras, invulnerável, cortando quem estiver no caminho.',
  },
  chuva_facas: {
    name: 'Leque de Facas', glyph: '✧', color: '#7de3c8', type: 'projectile', unlock: 6, mp: 14, cd: 300,
    mult: 1.0, count: 5, spread: 0.22, speed: 7, life: 45, r: 4, pierce: true,
    desc: 'Arremessa cinco facas em leque que atravessam inimigos.',
  },
  // Arcanista
  orbe_flamejante: {
    name: 'Orbe Flamejante', glyph: '●', color: '#ff7a2e', type: 'projectile', unlock: 1, mp: 10, cd: 120,
    mult: 2.4, count: 1, speed: 4.5, life: 70, r: 10, explode: { r: 56, mult: 1.2 },
    desc: 'Lança uma esfera de fogo que explode ao tocar o inimigo.',
  },
  geada: {
    name: 'Geada', glyph: '❄', color: '#9fe6ff', type: 'aoe', unlock: 3, mp: 14, cd: 300,
    mult: 1.6, r: 95, stun: 120, freeze: true,
    desc: 'Congela inimigos ao redor por 2 segundos.',
  },
  escudo_arcano: {
    name: 'Escudo Arcano', glyph: '◎', color: '#b98cff', type: 'buff', unlock: 6, mp: 20, cd: 900,
    dur: 600, shield: 0.5, buff: { atk: 1.15 },
    desc: 'Barreira que absorve dano igual a 50% do HP máximo e aumenta o ataque.',
  },
};
