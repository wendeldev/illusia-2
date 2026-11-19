// Classes jogáveis. Cada uma tem atributos, ataque básico e 3 poderes próprios.
// O desenho vem do atlas: `${sprite}_idle`, `${sprite}_walk`, `${sprite}_atk0`...
import type { SkillDef } from '../types';

export interface ClassDef {
  id: string;
  name: string;
  description: string;
  /** prefixo das animações no atlas */
  sprite: string;
  /** multiplicadores de atributos */
  mods: { hp: number; mp: number; atk: number; def: number; crit: number };
  /** ataque básico: corpo a corpo (alcance) ou disparo (projétil) */
  basic: { kind: 'melee'; range: number; speed: number } | { kind: 'shot'; fx: string; speed: number; range: number; color: string; pierce?: boolean };
  skills: SkillDef[];
}

const sk = (s: Partial<SkillDef> & Pick<SkillDef, 'id' | 'name' | 'description' | 'kind'>): SkillDef => ({
  mpCost: 10, cooldown: 3, damageMul: 2, range: 80, radius: 30, knockback: 150, unlockLevel: 1, color: '#ffffff', ...s,
});

/** Atalho para os poderes da prancha de poderes: animação `pw_<id>`, efeito `fx_<id>`, ícone `ic_<id>`. */
const pw = (id: string, s: Partial<SkillDef> & Pick<SkillDef, 'name' | 'description' | 'kind'>): SkillDef =>
  sk({ id, anim: `pw_${id}`, icon: `ic_${id}`, fx: `fx_${id}`, ...s });

const WARRIOR: SkillDef[] = [
  pw('w_slash_h', { name: 'Corte Horizontal', description: 'Um corte largo à frente.', kind: 'melee', mpCost: 6, cooldown: 1.2, damageMul: 1.8, range: 70, radius: 26, knockback: 140, unlockLevel: 1, color: '#7fc8ff' }),
  pw('w_slash_v', { name: 'Corte Vertical', description: 'Corte de baixo para cima: acerta quem está no alto.', kind: 'melee', mpCost: 8, cooldown: 1.8, damageMul: 2.1, range: 82, radius: 60, knockback: 120, unlockLevel: 2, color: '#7fc8ff' }),
  pw('w_dash', { name: 'Investida', description: 'Avança atravessando os inimigos.', kind: 'dash', mpCost: 10, cooldown: 3, damageMul: 2, range: 170, radius: 26, knockback: 200, unlockLevel: 4, color: '#7fc8ff' }),
  pw('w_whirl', { name: 'Redemoinho', description: 'Gira a espada atingindo todos ao redor.', kind: 'aoe', mpCost: 14, cooldown: 4, damageMul: 2.4, radius: 85, knockback: 230, unlockLevel: 6, color: '#7fc8ff' }),
  pw('w_shock', { name: 'Onda de Choque', description: 'Uma onda corre pelo chão atravessando tudo.', kind: 'projectile', mpCost: 14, cooldown: 3.5, damageMul: 2.4, range: 340, radius: 18, speed: 380, pierce: true, knockback: 180, unlockLevel: 9, color: '#7fc8ff' }),
  pw('w_flame', { name: 'Espada Flamejante', description: 'Golpe em chamas, muito forte.', kind: 'melee', mpCost: 18, cooldown: 4.5, damageMul: 3.6, range: 80, radius: 34, knockback: 260, unlockLevel: 12, color: '#ff9a3c' }),
  pw('w_quake', { name: 'Explosão Terrestre', description: 'Espinhos de pedra saem do chão à frente.', kind: 'erupt', mpCost: 22, cooldown: 6, damageMul: 3, range: 190, radius: 40, knockback: 280, unlockLevel: 16, color: '#e0b04f' }),
  pw('w_shield', { name: 'Escudo de Proteção', description: 'Reduz em 70% o dano recebido por 8 s.', kind: 'shield', mpCost: 20, cooldown: 18, duration: 8, unlockLevel: 20, color: '#ffe08a' }),
];

const MAGE: SkillDef[] = [
  pw('m_fireball', { name: 'Bola de Fogo', description: 'Dispara uma bola de fogo.', kind: 'projectile', mpCost: 7, cooldown: 1.1, damageMul: 2.1, range: 360, radius: 14, speed: 380, knockback: 160, unlockLevel: 1, color: '#ff9a3c' }),
  pw('m_fireburst', { name: 'Explosão de Fogo', description: 'Uma explosão de chamas à frente.', kind: 'blast', mpCost: 12, cooldown: 2.8, damageMul: 2.8, range: 110, radius: 48, knockback: 240, unlockLevel: 2, color: '#ff9a3c' }),
  pw('m_icespear', { name: 'Lança de Gelo', description: 'Cristais de gelo brotam do chão em sequência.', kind: 'erupt', mpCost: 14, cooldown: 3.5, damageMul: 2.4, range: 200, radius: 34, knockback: 150, unlockLevel: 4, color: '#9fd3ff' }),
  pw('m_icestorm', { name: 'Tempestade de Gelo', description: 'Um tornado de gelo lento que atravessa tudo.', kind: 'projectile', mpCost: 18, cooldown: 5, damageMul: 1.4, range: 300, radius: 26, speed: 130, pierce: true, knockback: 60, unlockLevel: 6, color: '#9fd3ff' }),
  pw('m_arcane', { name: 'Raio Arcano', description: 'Um raio cai no inimigo mais próximo.', kind: 'strike', mpCost: 16, cooldown: 3, damageMul: 3.4, range: 320, radius: 36, knockback: 120, unlockLevel: 9, color: '#c49bff' }),
  pw('m_meteor', { name: 'Chuva de Meteoros', description: 'Meteoros caem do céu à frente.', kind: 'rain', mpCost: 30, cooldown: 8, damageMul: 2.6, range: 260, radius: 42, count: 5, knockback: 200, unlockLevel: 12, color: '#ff7a2a' }),
  pw('m_circle', { name: 'Círculo Arcano', description: 'Um círculo mágico explode ao redor.', kind: 'aoe', mpCost: 24, cooldown: 6, damageMul: 3.4, radius: 105, knockback: 280, unlockLevel: 16, color: '#c49bff' }),
  pw('m_heal', { name: 'Cura', description: 'Recupera 40% da vida.', kind: 'heal', mpCost: 26, cooldown: 14, unlockLevel: 20, color: '#8fe07a' }),
];

const ASSASSIN: SkillDef[] = [
  pw('a_quick', { name: 'Corte Rápido', description: 'Golpe veloz com as adagas.', kind: 'melee', mpCost: 5, cooldown: 0.8, damageMul: 1.6, range: 82, radius: 24, knockback: 90, unlockLevel: 1, color: '#c49bff' }),
  pw('a_blades', { name: 'Lâminas Múltiplas', description: 'Arremessa três adagas.', kind: 'projectile', mpCost: 9, cooldown: 1.8, damageMul: 1.3, range: 320, radius: 10, speed: 560, count: 3, knockback: 70, unlockLevel: 2, color: '#c49bff' }),
  pw('a_teleport', { name: 'Teleporte', description: 'Some e reaparece à frente, ferindo quem estiver no caminho.', kind: 'dash', mpCost: 10, cooldown: 2.6, damageMul: 1.8, range: 190, radius: 26, knockback: 60, unlockLevel: 4, color: '#c49bff' }),
  pw('a_thrust', { name: 'Estocada Sombria', description: 'Uma estocada longa de energia sombria.', kind: 'melee', mpCost: 12, cooldown: 2.6, damageMul: 2.8, range: 120, radius: 26, knockback: 200, unlockLevel: 6, color: '#c49bff' }),
  pw('a_shadowburst', { name: 'Explosão Sombria', description: 'Explode em sombras ao redor.', kind: 'aoe', mpCost: 18, cooldown: 5, damageMul: 3, radius: 90, knockback: 240, unlockLevel: 9, color: '#a06bff' }),
  pw('a_daggers', { name: 'Chuva de Adagas', description: 'Adagas caem do céu à frente.', kind: 'rain', mpCost: 22, cooldown: 6, damageMul: 1.8, range: 220, radius: 30, count: 7, knockback: 80, unlockLevel: 12, color: '#c49bff' }),
  pw('a_poison', { name: 'Veneno', description: 'Uma nuvem venenosa que fere por 5 s.', kind: 'cloud', mpCost: 20, cooldown: 9, damageMul: 0.7, range: 80, radius: 60, duration: 5, knockback: 0, unlockLevel: 16, color: '#8fe07a' }),
  pw('a_clone', { name: 'Clone das Sombras', description: 'Sombras repetem seus golpes: +60% de dano por 8 s.', kind: 'empower', mpCost: 24, cooldown: 18, duration: 8, unlockLevel: 20, color: '#a06bff' }),
];

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior', name: 'Guerreiro', sprite: 'hero',
    description: 'Equilibrado. Cortes de espada, investida, redemoinho, ondas de choque e escudo.',
    mods: { hp: 1, mp: 1, atk: 1, def: 1, crit: 1 },
    basic: { kind: 'melee', range: 1, speed: 1 },
    skills: WARRIOR,
  },
  {
    id: 'archer', name: 'Arqueiro', sprite: 'archer',
    description: 'Ataca de longe com flechas. Pouca vida: mantenha distância.',
    mods: { hp: 0.8, mp: 1.1, atk: 0.9, def: 0.8, crit: 2 },
    basic: { kind: 'shot', fx: 'fx_arrow', speed: 560, range: 340, color: '#9ff07a' },
    skills: [
      sk({ id: 'pierce_arrow', name: 'Flecha Perfurante', description: 'Uma flecha que atravessa todos à frente.', kind: 'projectile', mpCost: 8, cooldown: 1.6, damageMul: 2, range: 420, radius: 12, speed: 640, pierce: true, knockback: 80, color: '#9ff07a', fx: 'fx_arrow' }),
      sk({ id: 'leaf_storm', name: 'Tempestade de Folhas', description: 'Folhas cortantes ao redor.', kind: 'aoe', mpCost: 14, cooldown: 4, damageMul: 2, radius: 90, knockback: 200, unlockLevel: 3, color: '#b0f07a' }),
      sk({ id: 'great_arrow', name: 'Flecha Gigante', description: 'Disparo carregado e devastador.', kind: 'projectile', mpCost: 22, cooldown: 6, damageMul: 4.5, range: 500, radius: 18, speed: 520, pierce: true, knockback: 300, unlockLevel: 5, color: '#e0ff9a', fx: 'fx_arrow' }),
    ],
  },
  {
    id: 'mage', name: 'Maga', sprite: 'priest',
    description: 'Magias de longe e muito MP: fogo, gelo, raios, meteoros, círculos mágicos e cura. Frágil.',
    mods: { hp: 0.8, mp: 1.8, atk: 1.05, def: 0.75, crit: 1 },
    basic: { kind: 'shot', fx: 'fx_orb', speed: 380, range: 280, color: '#9fd3ff' },
    skills: MAGE,
  },
  {
    id: 'assassin', name: 'Assassino', sprite: 'assassin',
    description: 'Golpes rapidíssimos, adagas, teleporte, veneno e clones sombrios. Crítico altíssimo.',
    mods: { hp: 0.9, mp: 1.1, atk: 1.1, def: 0.85, crit: 2.4 },
    basic: { kind: 'melee', range: 0.9, speed: 0.6 },
    skills: ASSASSIN,
  },
  {
    id: 'monk', name: 'Lutador', sprite: 'monk',
    description: 'Socos rapidíssimos e muita vida. Alcance curto: lute colado.',
    mods: { hp: 1.3, mp: 0.8, atk: 0.85, def: 1.2, crit: 1.5 },
    basic: { kind: 'melee', range: 0.75, speed: 0.65 },
    skills: [
      sk({ id: 'fire_fist', name: 'Punho de Fogo', description: 'Uma bola de fogo curta e forte.', kind: 'projectile', mpCost: 8, cooldown: 1.4, damageMul: 2.2, range: 200, radius: 16, speed: 460, knockback: 200, color: '#ff9a3c', fx: 'fx_fireball' }),
      sk({ id: 'fire_spin', name: 'Giro Flamejante', description: 'Chute giratório em chamas.', kind: 'aoe', mpCost: 14, cooldown: 3.5, damageMul: 2.4, radius: 80, knockback: 260, unlockLevel: 3, color: '#ffb040' }),
      sk({ id: 'dragon_kick', name: 'Chute do Dragão', description: 'Salta e chuta com toda a força.', kind: 'melee', mpCost: 20, cooldown: 5, damageMul: 4.2, range: 90, radius: 34, knockback: 380, unlockLevel: 5, color: '#ff7a2a' }),
    ],
  },
  {
    id: 'lancer', name: 'Lanceiro', sprite: 'lancer',
    description: 'Lança de longo alcance e boa defesa. Mantém os inimigos longe.',
    mods: { hp: 1.1, mp: 0.9, atk: 1, def: 1.15, crit: 1 },
    basic: { kind: 'melee', range: 1.45, speed: 1.15 },
    skills: [
      sk({ id: 'wave_thrust', name: 'Estocada Onda', description: 'Uma onda de água à frente.', kind: 'projectile', mpCost: 9, cooldown: 1.6, damageMul: 1.9, range: 300, radius: 16, speed: 420, pierce: true, knockback: 160, color: '#7fc8ff', fx: 'fx_slash' }),
      sk({ id: 'whirl_spear', name: 'Lança Giratória', description: 'Gira a lança atingindo todos ao redor.', kind: 'aoe', mpCost: 14, cooldown: 4, damageMul: 2.3, radius: 95, knockback: 240, unlockLevel: 3, color: '#7fc8ff' }),
      sk({ id: 'tidal_strike', name: 'Golpe Maré', description: 'Salta e crava a lança, levantando uma onda.', kind: 'melee', mpCost: 22, cooldown: 6, damageMul: 3.8, range: 120, radius: 40, knockback: 340, unlockLevel: 5, color: '#5fb0ff' }),
    ],
  },
];

export const DEFAULT_CLASS = 'warrior';

export function getClass(id: string | undefined): ClassDef {
  return CLASSES.find((c) => c.id === id) ?? CLASSES[0];
}
