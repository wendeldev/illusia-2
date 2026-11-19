import type { StageDef } from '../types';
import { CAMPAIGN } from './campaign';

/** Portal especial: abre o mapa do mundo em vez de levar a uma fase. */
export const MAP_PORTAL = '@map';

export const START_STAGE = 'lumen';

export const STAGES: StageDef[] = [
  {
    id: 'lumen', name: 'Vila de Lumen', width: 960, depth: 140,
    theme: 'village',
    landmarks: [
      { kind: 'house', x: 20, variant: 1 },
      { kind: 'forge', x: 150 },
      { kind: 'clinic', x: 330 },
      { kind: 'house', x: 470, variant: 2 },
      { kind: 'tower', x: 610 },
      { kind: 'house', x: 720, variant: 0 },
      { kind: 'gate', x: 845 },
    ],
    spawn: { x: 480, y: 70 },
    npcs: [
      { npcId: 'brida', x: 220, y: 40 },
      { npcId: 'taro', x: 380, y: 100 },
      { npcId: 'ivy', x: 640, y: 50 },
    ],
    portals: [
      { x: 900, y: 75, to: MAP_PORTAL, label: 'Mapa do mundo' },
    ],
    waves: [],
  },
  ...CAMPAIGN,
];
