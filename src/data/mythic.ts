// Eventos de chefes Lendários e Míticos: cada chefe tem cenário próprio (pano_my_*), horda própria
// (mye_<chefe>_N), 8 fases e 40 minutos para vencer. Entrada com tíquete.
export interface MythicBoss {
  key: string;
  name: string;
  tier: 'legend' | 'myth';
  theme: 'volcano' | 'castle' | 'cave' | 'sky' | 'swamp' | 'snow';
  color: string;
  /** sufixo dos nomes da horda */
  suffix: string;
}

export const MYTHIC_BOSSES: MythicBoss[] = [
  { key: 'crystal_titan', name: 'Titã de Cristal', tier: 'legend', theme: 'cave', color: '#8ff0ff', suffix: 'de Cristal' },
  { key: 'valkyrie', name: 'Valquíria', tier: 'legend', theme: 'sky', color: '#ffe08a', suffix: 'Celeste' },
  { key: 'deep_hydra', name: 'Hidra Abissal', tier: 'legend', theme: 'swamp', color: '#5fd0c0', suffix: 'Abissal' },
  { key: 'infernal_dragon', name: 'Dragão Infernal', tier: 'myth', theme: 'volcano', color: '#ff6a2a', suffix: 'Infernal' },
  { key: 'lich_king', name: 'Rei Lich', tier: 'myth', theme: 'snow', color: '#9fd8ff', suffix: 'do Lich' },
  { key: 'abyss_demon', name: 'Demônio do Abismo', tier: 'myth', theme: 'castle', color: '#c060ff', suffix: 'do Abismo' },
  { key: 'fallen_archangel', name: 'Arcanjo Caído', tier: 'myth', theme: 'sky', color: '#ff5f8a', suffix: 'Caído' },
];

export const EVENT_PHASES = 8;
export const EVENT_TIME = 40 * 60;
export const DIFFICULTIES = [
  { name: 'Difícil', levelAdd: 2, hpMul: 1.15, atkMul: 1.0 },
  { name: 'Épico', levelAdd: 5, hpMul: 1.45, atkMul: 1.2 },
];
export const TICKET_OF = { legend: 'tk_legend', myth: 'tk_myth' } as const;
/** Raridade do set de recompensa: Lendário → Lendário/Divino; Mítico → Divino/Celestial. */
export function rewardRarity(tier: 'legend' | 'myth', diff: number): number {
  return tier === 'legend' ? (diff ? 6 : 4) : diff ? 7 : 6;
}
export const MINION_NAMES = ['Cria', 'Sentinela', 'Colosso', 'Caçador', 'Espectro', 'Arauto', 'Guardião'];
export const minionId = (boss: string, i: number) => `my_${boss}_m${i}`;
export const bossId = (boss: string) => `my_${boss}`;
