// Tipos de conteúdo. Fases, poderes, equipamentos, inimigos e NPCs são DADOS (src/data/),
// então dá para criar conteúdo novo sem mexer no motor.

export type Slot = 'weapon' | 'armor' | 'helmet' | 'gloves' | 'pants' | 'boots' | 'cape' | 'accessory' | 'wings' | 'wingsFront' | 'aura';

export interface StatBonus {
  atk?: number;
  def?: number;
  hp?: number;
  mp?: number;
  /** chance de crítico extra (0.05 = +5%) */
  crit?: number;
}

/** Aparência visual de um personagem humano (jogador e NPCs). */
export interface HumanLook {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'spiky';
  outfit: string;
  trim: string;
  pants: string;
  boots: string;
  armor: 'cloth' | 'leather' | 'mail' | 'plate';
  helmet?: { style: 'hood' | 'helm' | 'captain'; color: string };
  weapon?: WeaponLook;
  prop?: 'hammer' | 'staff' | 'spear';
  apron?: string;
  pendant?: string;
}

export interface WeaponLook {
  blade: string;
  hilt: string;
  length: number;
  width: number;
  curve?: boolean;
  /** brilho da lâmina (runas, magia) */
  glow?: string;
}

/** Como o equipamento aparece no personagem. */
export interface EquipmentLook {
  weapon?: WeaponLook;
  /** armaduras: cor do tronco, detalhe e tipo */
  outfit?: string;
  trim?: string;
  armor?: HumanLook['armor'];
  helmet?: HumanLook['helmet'];
  /** acessórios: pingente no pescoço */
  pendant?: string;
}

export interface EquipmentDef extends StatBonus {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  description: string;
  look?: EquipmentLook;
  /** ícone no atlas (sem isso: icon_<id>) */
  icon?: string;
  /** só cai de baús/chefes (não aparece na loja) */
  dropOnly?: boolean;
  /** 0 comum · 1 incomum · 2 raro · 3 épico · 4 lendário · 5 mítico · 6 divino · 7 celestial */
  rarity?: number;
  /** preço em gemas (raridades altas) */
  priceGems?: number;
  /** tipo de arma (espada, machado, lança, adaga, arco, cajado) */
  weaponKind?: string;
  /** peça de set: classe do set (warrior/assassin/mage) */
  setClass?: string;
  /** categoria na loja */
  category?: string;
  /** só vem do passe de batalha (fora da loja e dos drops) */
  passOnly?: boolean;
}

export type SkillKind =
  | 'melee' | 'projectile' | 'aoe'
  /** avança atravessando os inimigos */
  | 'dash'
  /** explosão num ponto à frente */
  | 'blast'
  /** sequência de explosões saindo do chão à frente */
  | 'erupt'
  /** cai no inimigo mais próximo */
  | 'strike'
  /** vários objetos caindo do céu à frente */
  | 'rain'
  /** nuvem que fica causando dano */
  | 'cloud'
  | 'heal' | 'shield' | 'empower';

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
  /** desenho do projétil/efeito (atlas) */
  fx?: string;
  /** tempo para lançar o poder (s) e ícone do botão */
  castTime?: number;
  icon?: string;
  /** quantidade (projéteis, meteoros...) */
  count?: number;
  /** duração (nuvem, escudo, fúria) em segundos */
  duration?: number;
}

export interface DropDef {
  itemId: string;
  chance: number;
}

export type EnemyShape = 'blob' | 'beast' | 'golem' | 'flyer' | 'mushroom';

/** Ataques especiais de inimigos. Todos têm aviso (windup) antes de acontecer. */
export type AbilityDef =
  /** pancada no chão: onda de choque em volta do inimigo */
  | { kind: 'slam'; radius: number; damageMul: number; windup: number; cooldown: number }
  /** investida em linha reta */
  | { kind: 'charge'; speed: number; damageMul: number; windup: number; cooldown: number }
  /** disparos (esporos, pedras, bolas de fogo...) */
  | { kind: 'shoot'; count: number; spread: number; speed: number; damageMul: number; windup: number; cooldown: number; color: string; range: number }
  /** chama ajudantes */
  | { kind: 'summon'; enemyId: string; count: number; windup: number; cooldown: number };

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
  /** ataques especiais (chefes e alguns inimigos) */
  abilities?: AbilityDef[];
  /** abaixo de 50% de vida fica mais rápido e ataca mais vezes */
  enrage?: boolean;
  /** brilho em volta (chefes) */
  aura?: string;
  /** desenho em pixel art (nome no atlas) e escala extra */
  sprite?: string;
  spriteScale?: number;
  /** chefe com animação completa da prancha de chefes */
  bossAnim?: string;
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
  look: Partial<HumanLook>;
  /** desenho em pixel art (nome no atlas) */
  sprite?: string;
  /** animação de espera: martelar, apoiar no cajado... */
  idle?: 'hammer' | 'still';
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

export type SceneryTheme =
  | 'village' | 'forest' | 'ruins' | 'cave'
  | 'swamp' | 'desert' | 'snow' | 'volcano' | 'castle' | 'sky';

/** Clima/hora do dia: muda a luz do cenário. */
export type Mood = 'day' | 'dusk' | 'night';

export type LandmarkKind = 'house' | 'clinic' | 'forge' | 'tower' | 'gate';

export interface LandmarkDef {
  kind: LandmarkKind;
  /** posição no mapa (borda esquerda da construção) */
  x: number;
  /** muda cores/tamanho de casas */
  variant?: number;
}

/** Trecho de chão ou plataforma: de x0 a x1, com o topo na altura y. */
export interface TerrainSeg {
  x0: number;
  x1: number;
  y: number;
}

export interface TerrainDef {
  /** chão contínuo (degraus = trechos com alturas diferentes) */
  ground: TerrainSeg[];
  /** plataformas flutuantes (sobe-se por baixo, pousa-se em cima) */
  platforms: TerrainSeg[];
  /** escadas: x e topo/base (y) */
  ladders?: { x: number; top: number; bottom: number }[];
}

export interface StageDef {
  id: string;
  name: string;
  /** largura do mapa em px */
  width: number;
  /** profundidade do chão (movimento vertical) em px */
  depth: number;
  /** visual do cenário */
  theme: SceneryTheme;
  /** construções fixas no fundo (vila: casas, forja...) */
  landmarks?: LandmarkDef[];
  spawn: { x: number; y: number };
  npcs: { npcId: string; x: number; y: number }[];
  portals: PortalDef[];
  waves: WaveDef[];
  mood?: Mood;
  /** multiplicador de força dos inimigos (fases mais avançadas = mais fortes) */
  power?: number;
  /** região e número da fase (mapa do mundo) */
  region?: number;
  index?: number;
  /** chão e plataformas (sem isso, chão plano) */
  terrain?: TerrainDef;
  /** nível base dos monstros desta fase */
  level?: number;
  /** tempo-limite (segundos) para a estrela de rapidez */
  parTime?: number;
  /** panorama de fundo próprio (eventos) */
  pano?: string;
  /** multiplicadores de vida/ataque dos inimigos (dificuldade dos eventos) */
  hpMul?: number;
  atkMul?: number;
}
