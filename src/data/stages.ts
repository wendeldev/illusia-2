import type { StageDef } from '../types';

export const START_STAGE = 'lumen';

export const STAGES: StageDef[] = [
  {
    id: 'lumen', name: 'Vila de Lumen', width: 960, depth: 140,
    sky: '#8fc7e8', far: '#6aa36f', ground: '#8db36a',
    spawn: { x: 480, y: 70 },
    npcs: [
      { npcId: 'brida', x: 220, y: 40 },
      { npcId: 'taro', x: 380, y: 100 },
      { npcId: 'ivy', x: 640, y: 50 },
    ],
    portals: [
      { x: 900, y: 30, to: 'whisper_woods', label: 'Bosque Sussurrante' },
      { x: 900, y: 75, to: 'iron_ruins', label: 'Ruínas de Ferro', requiresStage: 'whisper_woods' },
      { x: 900, y: 120, to: 'gray_cave', label: 'Caverna Cinzenta', requiresStage: 'iron_ruins' },
    ],
    waves: [],
  },
  {
    id: 'whisper_woods', name: 'Bosque Sussurrante', width: 2100, depth: 150,
    sky: '#9ed3c0', far: '#3f7a4f', ground: '#5f8f45',
    spawn: { x: 90, y: 75 },
    npcs: [],
    portals: [
      { x: 40, y: 75, to: 'lumen', label: 'Voltar à vila' },
      { x: 2040, y: 75, to: 'lumen', label: 'Vila de Lumen', requiresClear: true },
    ],
    waves: [
      { triggerX: 320, enemies: [{ enemyId: 'moss_slime', count: 3 }] },
      { triggerX: 900, enemies: [{ enemyId: 'moss_slime', count: 2 }, { enemyId: 'shadow_wolf', count: 2 }] },
      { triggerX: 1500, enemies: [{ enemyId: 'shadow_wolf', count: 4 }] },
    ],
  },
  {
    id: 'iron_ruins', name: 'Ruínas de Ferro', width: 2400, depth: 150,
    sky: '#d8c3a5', far: '#8a7560', ground: '#9a8b70',
    spawn: { x: 90, y: 75 },
    npcs: [],
    portals: [
      { x: 40, y: 75, to: 'lumen', label: 'Voltar à vila' },
      { x: 2340, y: 75, to: 'lumen', label: 'Vila de Lumen', requiresClear: true },
    ],
    waves: [
      { triggerX: 350, enemies: [{ enemyId: 'shadow_wolf', count: 3 }] },
      { triggerX: 950, enemies: [{ enemyId: 'rust_golem', count: 1 }, { enemyId: 'shadow_wolf', count: 2 }] },
      { triggerX: 1600, enemies: [{ enemyId: 'rust_golem', count: 2 }, { enemyId: 'moss_slime', count: 3 }] },
    ],
  },
  {
    id: 'gray_cave', name: 'Caverna Cinzenta', width: 2400, depth: 140,
    sky: '#2b2a3a', far: '#3d3b52', ground: '#55516a',
    spawn: { x: 90, y: 70 },
    npcs: [],
    portals: [
      { x: 40, y: 70, to: 'lumen', label: 'Voltar à vila' },
      { x: 2340, y: 70, to: 'lumen', label: 'Vila de Lumen', requiresClear: true },
    ],
    waves: [
      { triggerX: 350, enemies: [{ enemyId: 'cave_bat', count: 4 }] },
      { triggerX: 1000, enemies: [{ enemyId: 'cave_bat', count: 3 }, { enemyId: 'rust_golem', count: 1 }] },
      { triggerX: 1750, enemies: [{ enemyId: 'fungus_king', count: 1 }, { enemyId: 'moss_slime', count: 2 }] },
    ],
  },
];
