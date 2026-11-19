// Tipos de conteúdo. Fases, poderes, equipamentos, inimigos e NPCs são DADOS (src/data/),
// então dá para criar conteúdo novo sem mexer no motor.

export type Slot = 'weapon' | 'armor' | 'helmet' | 'accessory';

export interface StatBonus {
  atk?: number;
  def?: number;
  hp?: number;
  mp?: number;
  /** chance de crítico extra (0.05 = +5%) */
  crit?: number;
}

export interface EquipmentDef extends StatBonus {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  description: string;
}

export type SkillKind = 'melee' | 'projectile' | 'aoe';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  kind: SkillKind;
  mpCost: number;
  /** segundos */
  cooldown: number;
  /** multiplicador sobre o ATK do jogador */
  damageMul: number;
  /** alcance (melee/projétil) */
  range: number;
  /** raio (área/projétil) */
  radius: number;
  speed?: number;
  pierce?: boolean;
  knockback: number;
  unlockLevel: number;
  color: string;
}

export interface DropDef {
  itemId: string;
  chance: number;
}

export type EnemyShape = 'blob' | 'beast' | 'humanoid' | 'flyer';

export interface EnemyDef {
  id: string;
  name: string;
  shape: EnemyShape;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  exp: number;
  gold: number;
  radius: number;
  color: string;
  attackRange: number;
  /** tempo de preparo antes do golpe (o jogador pode fugir) */
  windup: number;
  attackCooldown: number;
  boss?: boolean;
  drops?: DropDef[];
}

export type NpcAction = 'talk' | 'shop' | 'heal';

export interface NpcDef {
  id: string;
  name: string;
  color: string;
  action: NpcAction;
  dialog: string[];
  /** ids de equipamentos à venda (action = 'shop') */
  shop?: string[];
}

export interface PortalDef {
  x: number;
  y: number;
  to: string;
  label: string;
  /** só abre depois de derrotar todas as ondas desta fase */
  requiresClear?: boolean;
  /** só abre depois de concluir outra fase */
  requiresStage?: string;
}

export interface WaveDef {
  /** a onda começa quando o jogador passa deste X */
  triggerX: number;
  enemies: { enemyId: string; count: number }[];
}

export interface StageDef {
  id: string;
  name: string;
  /** largura do mapa em px */
  width: number;
  /** profundidade do chão (movimento vertical) em px */
  depth: number;
  sky: string;
  far: string;
  ground: string;
  spawn: { x: number; y: number };
  npcs: { npcId: string; x: number; y: number }[];
  portals: PortalDef[];
  waves: WaveDef[];
}
