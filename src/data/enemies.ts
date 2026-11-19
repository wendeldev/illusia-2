import type { EnemyDef } from '../types';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'moss_slime', name: 'Lodo de Musgo', shape: 'blob',
    hp: 30, atk: 6, def: 1, speed: 50, exp: 8, gold: 4, radius: 14, color: '#6fbf4a',
    attackRange: 22, windup: 0.5, attackCooldown: 1.6,
    drops: [{ itemId: 'cloth_hood', chance: 0.04 }],
  },
  {
    id: 'shadow_wolf', name: 'Lobo Sombrio', shape: 'beast',
    hp: 45, atk: 10, def: 2, speed: 100, exp: 14, gold: 7, radius: 15, color: '#4a4f6b',
    attackRange: 26, windup: 0.4, attackCooldown: 1.3,
    drops: [{ itemId: 'leather_vest', chance: 0.05 }],
  },
  {
    id: 'rust_golem', name: 'Golem Enferrujado', shape: 'golem',
    hp: 140, atk: 18, def: 8, speed: 38, exp: 42, gold: 22, radius: 22, color: '#a0603a',
    attackRange: 34, windup: 0.7, attackCooldown: 2.0,
    drops: [{ itemId: 'iron_helm', chance: 0.06 }, { itemId: 'chainmail', chance: 0.03 }],
  },
  {
    id: 'cave_bat', name: 'Morcego Cinzento', shape: 'flyer',
    hp: 38, atk: 13, def: 2, speed: 125, exp: 20, gold: 9, radius: 12, color: '#8a8396',
    attackRange: 24, windup: 0.35, attackCooldown: 1.2,
    drops: [{ itemId: 'sapphire_ring', chance: 0.04 }],
  },
  {
    id: 'fungus_king', name: 'Rei Fungo', shape: 'mushroom', boss: true,
    hp: 700, atk: 26, def: 7, speed: 55, exp: 320, gold: 250, radius: 36, color: '#c4466b',
    attackRange: 52, windup: 0.8, attackCooldown: 1.8,
    drops: [{ itemId: 'falcon_amulet', chance: 0.5 }, { itemId: 'moon_blade', chance: 0.3 }],
  },
];
