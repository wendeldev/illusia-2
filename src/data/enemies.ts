import type { AbilityDef, EnemyDef } from '../types';
import { bossId, MINION_NAMES, minionId, MYTHIC_BOSSES } from './mythic';

// Atributos na força base (região 1). Cada fase multiplica vida/ataque/recompensa
// pelo `power` da fase (ver campaign.ts).

const slam = (radius: number, damageMul = 1.6, windup = 0.9, cooldown = 6): AbilityDef =>
  ({ kind: 'slam', radius, damageMul, windup, cooldown });
const charge = (speed = 420, damageMul = 1.5, windup = 0.8, cooldown = 7): AbilityDef =>
  ({ kind: 'charge', speed, damageMul, windup, cooldown });
const shoot = (color: string, count = 3, spread = 0.35, damageMul = 0.8, cooldown = 4, speed = 190, range = 380, windup = 0.6): AbilityDef =>
  ({ kind: 'shoot', count, spread, speed, damageMul, windup, cooldown, color, range });
const summon = (enemyId: string, count = 2, cooldown = 12, windup = 1.0): AbilityDef =>
  ({ kind: 'summon', enemyId, count, windup, cooldown });

/** Inimigo comum: valores padrão por formato. */
function mob(id: string, name: string, shape: EnemyDef['shape'], color: string, extra: Partial<EnemyDef> = {}): EnemyDef {
  const base: Record<EnemyDef['shape'], Omit<EnemyDef, 'id' | 'name' | 'shape' | 'color'>> = {
    blob: { hp: 30, atk: 6, def: 1, speed: 50, exp: 8, gold: 4, radius: 14, attackRange: 22, windup: 0.5, attackCooldown: 1.6 },
    beast: { hp: 45, atk: 10, def: 2, speed: 100, exp: 14, gold: 7, radius: 15, attackRange: 26, windup: 0.4, attackCooldown: 1.3 },
    golem: { hp: 140, atk: 18, def: 8, speed: 38, exp: 42, gold: 22, radius: 22, attackRange: 34, windup: 0.7, attackCooldown: 2.0 },
    flyer: { hp: 38, atk: 13, def: 2, speed: 125, exp: 20, gold: 9, radius: 12, attackRange: 24, windup: 0.35, attackCooldown: 1.2 },
    mushroom: { hp: 90, atk: 14, def: 4, speed: 45, exp: 30, gold: 15, radius: 18, attackRange: 30, windup: 0.6, attackCooldown: 1.8 },
  };
  return { id, name, shape, color, ...base[shape], ...extra };
}

/** Chefe: muito mais vida, ataques especiais e aura. */
function boss(id: string, name: string, shape: EnemyDef['shape'], color: string, aura: string, abilities: AbilityDef[], extra: Partial<EnemyDef> = {}): EnemyDef {
  const radius = shape === 'flyer' ? 26 : shape === 'beast' ? 30 : 36;
  return {
    ...mob(id, name, shape, color),
    hp: 700, atk: 24, def: 6, speed: shape === 'beast' || shape === 'flyer' ? 85 : 55, exp: 320, gold: 250,
    radius, attackRange: radius + 18, windup: 0.8, attackCooldown: 1.8,
    boss: true, aura, abilities, ...extra,
  };
}

/** Chefe intermediário (fase 5 de cada região). */
function elite(id: string, name: string, shape: EnemyDef['shape'], color: string, aura: string, abilities: AbilityDef[]): EnemyDef {
  return boss(id, name, shape, color, aura, abilities, { hp: 380, atk: 18, exp: 150, gold: 110, radius: shape === 'flyer' ? 20 : 28, enrage: false });
}

export const ENEMIES: EnemyDef[] = [
  // ── 1. Bosque Sussurrante ──
  mob('moss_slime', 'Lodo de Musgo', 'blob', '#6fbf4a', { drops: [{ itemId: 'cloth_hood', chance: 0.04 }] }),
  mob('shadow_wolf', 'Lobo Sombrio', 'beast', '#4a4f6b', { drops: [{ itemId: 'leather_vest', chance: 0.05 }] }),
  mob('leaf_bat', 'Morcego-Folha', 'flyer', '#7a9a52'),
  elite('alpha_wolf', 'Lobo Alfa', 'beast', '#3a3f5b', '#9fd3ff', [charge(380), summon('shadow_wolf', 2, 14)]),
  boss('moss_guardian', 'Guardião Musgoso', 'golem', '#5f8f45', '#9ff0a0', [slam(95), summon('moss_slime', 3)], { drops: [{ itemId: 'bronze_sword', chance: 0.5 }] }),

  // ── 2. Pântano Nebuloso ──
  mob('bog_slime', 'Lodo do Brejo', 'blob', '#7a8a3a', { abilities: [shoot('#a8c060', 1, 0, 0.7, 5)] }),
  mob('marsh_bat', 'Morcego do Brejo', 'flyer', '#5a6a4a'),
  mob('swamp_shroom', 'Cogumelo Venenoso', 'mushroom', '#8a5ab0'),
  elite('toad_king', 'Sapo Rei', 'blob', '#4a7a3a', '#c0e060', [shoot('#a8c060', 5, 0.5), slam(80)]),
  boss('plague_shroom', 'Fungo Pestilento', 'mushroom', '#7a3ab0', '#c49bff', [shoot('#b08ae0', 6, 0.6), summon('swamp_shroom', 2)], { enrage: true }),

  // ── 3. Ruínas de Ferro ──
  mob('rust_golem', 'Golem Enferrujado', 'golem', '#a0603a', { drops: [{ itemId: 'iron_helm', chance: 0.06 }, { itemId: 'chainmail', chance: 0.03 }] }),
  mob('sand_jackal', 'Chacal das Ruínas', 'beast', '#b08a5a'),
  mob('stone_slime', 'Lodo de Pedra', 'blob', '#9a8a7a', { def: 4 }),
  elite('minotaur_warrior', 'Minotauro Guerreiro', 'golem', '#8a5a3a', '#ffb040', [slam(95), charge(380)]),
  elite('iron_sentinel', 'Sentinela de Ferro', 'golem', '#7a7f8a', '#ffd36b', [slam(90), charge(300)]),
  boss('iron_colossus', 'Colosso de Ferro', 'golem', '#8a5030', '#ff9a3c', [slam(120, 1.8), charge(360, 1.6), summon('rust_golem', 1, 16)], { enrage: true, drops: [{ itemId: 'moon_blade', chance: 0.4 }] }),

  // ── 4. Dunas Rubras ──
  mob('sand_slime', 'Lodo de Areia', 'blob', '#e0b060'),
  mob('dune_hound', 'Cão das Dunas', 'beast', '#c0703a'),
  mob('vulture', 'Abutre Rubro', 'flyer', '#a04a3a', { abilities: [shoot('#e0a060', 1, 0, 0.7, 4)] }),
  elite('scarab', 'Escaravelho Gigante', 'beast', '#3a6a8a', '#5ff0e0', [charge(420), shoot('#5ff0e0', 3, 0.4)]),
  boss('golden_jackal', 'Chacal Dourado', 'beast', '#e0b04f', '#ffe08a', [charge(480, 1.7), shoot('#ffd36b', 5, 0.5), summon('dune_hound', 2)], { enrage: true }),

  // ── 5. Caverna Cinzenta ──
  mob('cave_bat', 'Morcego Cinzento', 'flyer', '#8a8396', { drops: [{ itemId: 'sapphire_ring', chance: 0.04 }] }),
  mob('crystal_slime', 'Lodo de Cristal', 'blob', '#5fd0e0', { abilities: [shoot('#9ff0ff', 2, 0.3, 0.6, 5)] }),
  mob('cave_golem', 'Golem da Caverna', 'golem', '#6a6484'),
  elite('crystal_golem', 'Golem de Cristal', 'golem', '#4fb0c0', '#9ff0ff', [slam(90), shoot('#9ff0ff', 4, 0.5)]),
  boss('fungus_king', 'Rei Fungo', 'mushroom', '#c4466b', '#ff9ac8', [slam(100), shoot('#ff9ac8', 5, 0.55), summon('moss_slime', 3)], {
    enrage: true, drops: [{ itemId: 'falcon_amulet', chance: 0.5 }, { itemId: 'moon_blade', chance: 0.3 }],
  }),

  // ── 6. Picos Gelados ──
  mob('frost_slime', 'Lodo Gélido', 'blob', '#9fd3f0', { abilities: [shoot('#dff4ff', 1, 0, 0.7, 5)] }),
  mob('snow_wolf', 'Lobo da Neve', 'beast', '#e8eef4'),
  mob('ice_golem', 'Golem de Gelo', 'golem', '#7fb0d0', { def: 10 }),
  elite('yeti', 'Yeti', 'golem', '#f0f4f8', '#bfe4ff', [slam(100), charge(320)]),
  boss('frost_ancient', 'Golem Ancestral de Gelo', 'golem', '#5f90c0', '#bfe4ff', [slam(130, 1.8), shoot('#dff4ff', 7, 0.7), summon('frost_slime', 3)], { enrage: true, drops: [{ itemId: 'frost_fang', chance: 0.35 }] }),

  // ── 7. Vulcão Ardente ──
  mob('magma_slime', 'Lodo de Magma', 'blob', '#e0602a', { abilities: [shoot('#ffb040', 2, 0.3, 0.8, 4)] }),
  mob('fire_bat', 'Morcego de Fogo', 'flyer', '#c0402a'),
  mob('magma_golem', 'Golem de Magma', 'golem', '#5a2a2a', { def: 9 }),
  elite('salamander', 'Salamandra', 'beast', '#e0702a', '#ffb040', [charge(460), shoot('#ffb040', 3, 0.4)]),
  boss('lava_lord', 'Senhor da Lava', 'golem', '#4a1a1a', '#ff7a2a', [slam(140, 2.0), shoot('#ff9a3c', 8, 0.8), charge(380)], { enrage: true, drops: [{ itemId: 'ember_ring', chance: 0.5 }] }),

  // ── 8. Cidadela Sombria ──
  mob('shadow_slime', 'Lodo Sombrio', 'blob', '#4a3a6a'),
  mob('dread_wolf', 'Lobo do Pavor', 'beast', '#2a2438'),
  mob('gargoyle', 'Gárgula', 'flyer', '#6a6878', { def: 6, abilities: [shoot('#c49bff', 1, 0, 0.8, 4)] }),
  mob('dark_armor', 'Armadura Vazia', 'golem', '#3a3f58', { def: 12 }),
  elite('night_knight', 'Cavaleiro da Noite', 'golem', '#2a2f48', '#c49bff', [charge(400), slam(90)]),
  boss('shadow_beast', 'Fera das Trevas', 'beast', '#1a1428', '#c49bff', [charge(520, 1.8), summon('dread_wolf', 3), shoot('#c49bff', 6, 0.6)], { enrage: true, drops: [{ itemId: 'void_edge', chance: 0.25 }] }),

  // ── 9. Ilhas Celestes ──
  mob('cloud_slime', 'Lodo de Nuvem', 'blob', '#f4f8ff'),
  mob('storm_bat', 'Morcego da Tempestade', 'flyer', '#5a6aa0', { abilities: [shoot('#ffe08a', 2, 0.3, 0.8, 4)] }),
  mob('sky_golem', 'Golem Celeste', 'golem', '#c0c8e8', { def: 12 }),
  elite('griffin', 'Grifo', 'golem', '#d9a83f', '#ffe08a', [charge(460), shoot('#ffe08a', 4, 0.5)]),
  boss('storm_emperor', 'Imperador da Tempestade', 'flyer', '#3a4a90', '#ffe08a', [shoot('#ffe08a', 9, 0.9, 0.9, 3.5), charge(520, 1.8), summon('storm_bat', 3), slam(110)], {
    enrage: true, hp: 1100, drops: [{ itemId: 'star_pendant', chance: 0.6 }],
  }),
];

// Sprite de cada inimigo (atlas em public/sprites) e escala extra (chefes maiores).
const SPRITES: Record<string, [string, number?]> = {
  moss_slime: ['slime_green'], shadow_wolf: ['wolf'], leaf_bat: ['bat_green'], alpha_wolf: ['werewolf', 0.85], moss_guardian: ['treant', 1.7],
  bog_slime: ['slime_olive'], marsh_bat: ['bat_dark'], swamp_shroom: ['mushroom_purple'], toad_king: ['slime_olive', 2.6], plague_shroom: ['mushroom_purple', 2.6],
  stone_slime: ['slime_gray'], sand_jackal: ['wolf_sand'], rust_golem: ['golem_rust'], iron_sentinel: ['dark_knight', 0.8], iron_colossus: ['golem_big_rust'],
  sand_slime: ['slime_sand'], dune_hound: ['wolf_orange'], vulture: ['bat_brown'], scarab: ['boar_teal', 1.8], golden_jackal: ['werewolf_gold', 1.05],
  cave_bat: ['bat_gray'], crystal_slime: ['slime_blue'], cave_golem: ['golem_small'], crystal_golem: ['golem_big', 0.9], fungus_king: ['mushroom_red', 2.7],
  frost_slime: ['slime_ice'], snow_wolf: ['wolf_snow'], ice_golem: ['golem_ice'], yeti: ['ogre_white', 1.5], frost_ancient: ['ice_beast', 1.2],
  magma_slime: ['slime_magma'], fire_bat: ['bat'], magma_golem: ['golem_magma'], salamander: ['fire_wolf', 0.95], lava_lord: ['red_dragon'],
  shadow_slime: ['slime_shadow'], dread_wolf: ['wolf_dark'], gargoyle: ['bat_dark'], dark_armor: ['skeleton_dark', 1.1], night_knight: ['dark_knight', 0.9], shadow_beast: ['demon_lord'],
  cloud_slime: ['slime_cloud'], storm_bat: ['bee_storm'], sky_golem: ['golem_sky'], griffin: ['angel', 0.85], storm_emperor: ['blue_dragon', 1.1],
};
for (const e of ENEMIES) {
  const s = SPRITES[e.id];
  if (s) { e.sprite = s[0]; e.spriteScale = s[1] ?? 1; }
}

// Chefes da prancha de chefes: animação completa (boss_<nome>_idle/walk/atk1/atk2/atk3/hit/death) e efeitos (bfx_<nome>_N).
const BOSS_ANIMS: Record<string, [string, string]> = {
  moss_guardian: ['golem_elder', 'Golem Ancião'],
  plague_shroom: ['skeleton_king', 'Rei Esqueleto'],
  iron_colossus: ['dark_knight', 'Cavaleiro Sombrio'],
  golden_jackal: ['demoness', 'Demonessa Carmesim'],
  fungus_king: ['crystal_golem', 'Golem de Cristal'],
  frost_ancient: ['hydra', 'Hidra das Profundezas'],
  lava_lord: ['red_dragon2', 'Dragão Rubro'],
  shadow_beast: ['dragon', 'Dragão Negro'],
  storm_emperor: ['dark_god', 'Deus das Trevas'],
};
for (const e of ENEMIES) {
  const b = BOSS_ANIMS[e.id];
  if (b) { e.bossAnim = b[0]; e.name = b[1]; e.sprite = `boss_${b[0]}_idle`; e.spriteScale = 1; }
}

// Chefes básicos e intermediários (fase 5 de cada região; Minotauro na fase 8 das Ruínas).
const MINI_BOSSES: Record<string, [string, string]> = {
  alpha_wolf: ['wolf_alpha', 'Lobo Alfa'],
  toad_king: ['plant', 'Planta Carnívora'],
  iron_sentinel: ['stone_golem', 'Golem de Pedra'],
  scarab: ['serpent', 'Serpente Gigante'],
  crystal_golem: ['spider', 'Aranha Gigante'],
  yeti: ['troll', 'Troll Bruto'],
  salamander: ['orc', 'Orc Comandante'],
  night_knight: ['fallen_knight', 'Cavaleiro Caído'],
  griffin: ['dark_mage', 'Mago Sombrio'],
  minotaur_warrior: ['minotaur', 'Minotauro Guerreiro'],
};
for (const e of ENEMIES) {
  const b = MINI_BOSSES[e.id];
  if (b) { e.bossAnim = b[0]; e.name = b[1]; e.sprite = `boss_${b[0]}_idle`; e.spriteScale = 1; }
}

// ── Chefes Lendários e Míticos (eventos) e suas hordas ──
const MINION_SHAPES: EnemyDef['shape'][] = ['beast', 'flyer', 'golem', 'beast', 'flyer', 'mushroom'];
for (const b of MYTHIC_BOSSES) {
  const myth = b.tier === 'myth';
  MINION_SHAPES.forEach((shape, i) => {
    const m = mob(minionId(b.key, i), `${MINION_NAMES[i]} ${b.suffix}`, shape, b.color, {
      abilities: i === 1 || i === 4 ? [shoot(b.color, 2, 0.3, 0.8, 4.5)] : i === 2 ? [slam(70, 1.4, 0.9, 7)] : undefined,
    });
    m.hp = Math.round(m.hp * (myth ? 2.2 : 1.8)); m.atk = Math.round(m.atk * (myth ? 1.3 : 1.15)); m.def += 3;
    m.exp *= 3; m.gold *= 3;
    m.sprite = `mye_${b.key}_${i}`; m.spriteScale = i === 2 ? 0.55 : 0.62;
    ENEMIES.push(m);
  });
  const g = elite(minionId(b.key, 6), `${MINION_NAMES[6]} ${b.suffix}`, 'golem', b.color, b.color, [slam(100, 1.6), shoot(b.color, 5, 0.5), charge(420)]);
  g.hp = 520; g.atk = 26; g.sprite = `mye_${b.key}_6`; g.spriteScale = 0.7;
  ENEMIES.push(g);
  ENEMIES.push(boss(bossId(b.key), b.name, 'golem', b.color, b.color, [
    shoot(b.color, myth ? 9 : 7, 0.9, 0.95, 3.5), slam(myth ? 130 : 115, 1.8), charge(520, 1.7), summon(minionId(b.key, b.key.length % 6), 3, 14),
  ], { hp: myth ? 2400 : 1700, atk: myth ? 38 : 32, def: 10, exp: 2400, gold: 1800, enrage: true, bossAnim: `my_${b.key}`, sprite: `boss_my_${b.key}_idle`, spriteScale: 1 }));
}
