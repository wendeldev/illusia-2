// Classes jogáveis. Cada uma tem atributos, ataque básico e 3 poderes próprios.
// O desenho vem do atlas: `${sprite}_idle`, `${sprite}_walk`, `${sprite}_atk0`...
import type { SkillDef } from '../types';
import { SKILLS } from './skills';

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

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior', name: 'Guerreiro', sprite: 'hero',
    description: 'Equilibrado. Combo de espada, corte de vento, giro e golpe trovão.',
    mods: { hp: 1, mp: 1, atk: 1, def: 1, crit: 1 },
    basic: { kind: 'melee', range: 1, speed: 1 },
    skills: SKILLS,
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
    id: 'mage', name: 'Maga', sprite: 'mage',
    description: 'Orbes mágicos de longe e muito MP. Frágil, mas os poderes são fortíssimos.',
    mods: { hp: 0.75, mp: 1.8, atk: 1.05, def: 0.7, crit: 1 },
    basic: { kind: 'shot', fx: 'fx_orb', speed: 380, range: 280, color: '#c49bff' },
    skills: [
      sk({ id: 'arcane_orb', name: 'Orbe Arcano', description: 'Um orbe que atravessa os inimigos.', kind: 'projectile', mpCost: 10, cooldown: 1.4, damageMul: 2.2, range: 380, radius: 16, speed: 360, pierce: true, knockback: 120, color: '#c49bff', fx: 'fx_orb' }),
      sk({ id: 'nova', name: 'Explosão Arcana', description: 'Uma explosão de energia ao redor.', kind: 'aoe', mpCost: 18, cooldown: 4, damageMul: 3, radius: 100, knockback: 260, unlockLevel: 3, color: '#c49bff' }),
      sk({ id: 'meteor', name: 'Meteoro', description: 'Um meteoro de fogo que esmaga tudo à frente.', kind: 'melee', mpCost: 28, cooldown: 7, damageMul: 5, range: 130, radius: 50, knockback: 360, unlockLevel: 5, color: '#ff9a3c' }),
    ],
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
