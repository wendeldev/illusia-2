import { getClass, getEnemy, getItem, getNpc, MAP_PORTAL, type ClassDef } from '../data';
import { slotSkills } from './skillslots';
import { EVENT_ITEMS, rollEnemyDrops, type Drop } from './loot';
import { bagItem } from '../data/items';
import type { SoundName } from '../engine/audio';
import type { Input } from '../engine/input';
import { VIEW_W, VIEW_H } from '../engine/view';
import type { EnemyDef, HumanLook, NpcDef, PortalDef, SkillDef, StageDef } from '../types';
import { drawHuman, OUTLINE } from './art/human';
import { drawMonster } from './art/monsters';
import { glow } from './art/scene3d';
import { dollLook, drawDoll, rigFps, rigFrames, rigPose, type DollPose, type RigAnim } from './art/layers';
import { drawTerrain } from './art/ground';
import { drawSprite, drawSpriteH, frameCount, hasSprite, spriteHeight, spritesReady } from '../engine/sprites';
import { Scenery } from './art/scenery';
import { npcLook, npcPose, playerLook, playerPose, type ActionAnim } from './art/poses';
import { bar, text } from './draw';
import type { Progress } from './progress';
import { DAMAGE_LIMIT, type StageResult } from './stars';
import { calcDamage, computeStats, expToNext, levelPower, type Stats } from './stats';
import { BASE_GROUND, JUMP_SPEED, moveBody, Terrain, WORLD_H, type PhysBody } from './terrain';

const PLAYER_SPEED = 140;
/** altura do corpo do jogador (para acertos) */
const PLAYER_H = 44;

// Combo do ataque básico: 3 golpes
const COMBO = [
  { mul: 1.0, range: 46, time: 0.22, knock: 60 },
  { mul: 1.1, range: 46, time: 0.22, knock: 60 },
  { mul: 1.7, range: 58, time: 0.36, knock: 200 },
];

export interface WorldHooks {
  openNpc(npc: NpcDef): void;
  changeStage(to: string): void;
  playerDied(): void;
  toast(msg: string): void;
  openMap(): void;
  /** um inimigo foi derrotado (missões) */
  killed(def: EnemyDef): void;
  /** a fase foi vencida (missões) */
  stageCleared(stageId: string): void;
  /** marca sobre o NPC: '!' tem missão nova, '?' missão pronta para entregar */
  questMark(npcId: string): '!' | '?' | null;
  /** resultado da fase (estrelas) */
  stageResult(r: Pick<StageResult, 'stageId' | 'time' | 'par' | 'damage' | 'stars'>): void;
  /** um item foi pego do chão (o jogo guarda no progresso) */
  pickup(d: Drop): void;
  save(): void;
  sound(name: SoundName): void;
  vibrate(ms: number): void;
}

interface Body extends PhysBody {
  facing: number;
  radius: number;
  hp: number;
  hitStun: number;
  flash: number;
}

export interface Player extends Body {
  maxHp: number;
  mp: number;
  maxMp: number;
  attackTimer: number;
  /** animação da ação atual (golpe/poder) */
  anim: ActionAnim | null;
  animT: number;
  animDur: number;
  moving: boolean;
  deadAnim: number;
  /** ação agendada (ex.: o Golpe Trovão acerta ao aterrissar) */
  pending: { t: number; run: () => void } | null;
  comboStep: number;
  comboWindow: number;
  cooldowns: Record<string, number>;
  invuln: number;
  dead: boolean;
  deadTimer: number;
  walk: number;
  /** comando apertado durante uma ação, executado assim que possível (deixa o combo fluido) */
  buffered: { kind: 'attack'; count: number } | { kind: 'skill'; skill: SkillDef } | null;
  bufferT: number;
  /** pulo "guardado" e tempo extra para pular logo após sair da beirada */
  jumpBuffer: number;
  coyote: number;
  /** subindo/descendo uma escada */
  climbing: boolean;
  /** animação do poder sendo lançado (atlas) */
  castAnim: string | null;
  castT: number;
  castDur: number;
  /** escudo (reduz dano) e fúria das sombras (mais dano), em segundos */
  shieldT: number;
  empowerT: number;
  /** retomada (pouso) depois de um pulo, em segundos */
  landT: number;
  /** investida/teleporte em andamento */
  dash: { vx: number; t: number; hit: Set<Enemy>; skill: SkillDef } | null;
}

/** Item caído no chão esperando ser pego. */
interface Pickup {
  drop: Drop;
  icon: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  landed: boolean;
}

/** Bônus temporários ganhos com sequência de abates. */
export const BUFFS: Record<string, { name: string; icon: string; color: string }> = {
  atk: { name: 'Fúria (+30% dano)', icon: 'it_buff_atk', color: '#ff6b6b' },
  def: { name: 'Proteção (-30% dano recebido)', icon: 'it_buff_def', color: '#7fc8ff' },
  regen: { name: 'Regeneração', icon: 'it_buff_regen', color: '#8fe07a' },
  speed: { name: 'Velocidade (+30%)', icon: 'it_buff_speed', color: '#ffd36b' },
  crit: { name: 'Precisão (+20% crítico)', icon: 'it_buff_crit', color: '#ffb060' },
  exp: { name: 'Sabedoria (+50% EXP)', icon: 'it_buff_exp', color: '#c49bff' },
  luck: { name: 'Sorte (+50% drops)', icon: 'it_buff_luck', color: '#9ff07a' },
};
const BUFF_TIME = 15;

/** Efeito de poder no mundo: explosão, espinhos, raio, meteoro, nuvem... */
interface Spell {
  name: string;
  x: number;
  /** pés do efeito (chão) */
  y: number;
  ground: number;
  dir: number;
  /** negativo = ainda vai começar (atraso) */
  t: number;
  dur: number;
  hits: number[];
  hitIdx: number;
  radius: number;
  mul: number;
  knock: number;
  color: string;
  /** cai do céu até o chão (meteoro, adaga) */
  falling: boolean;
  landed: boolean;
  /** dano contínuo (nuvem) */
  tick: number;
  tickT: number;
  scale?: number;
}

export interface Enemy extends Body {
  def: EnemyDef;
  state: 'chase' | 'windup' | 'recover' | 'ability' | 'charging';
  /** nível do monstro (define a força) */
  level: number;
  /** atributos já multiplicados pela força da fase */
  maxHp: number;
  atk: number;
  armor: number;
  exp: number;
  gold: number;
  speed: number;
  /** recarga de cada ataque especial */
  abilityCd: number[];
  /** ataque especial em preparo (índice em def.abilities) */
  ability: number;
  enraged: boolean;
  /** alvo marcado no chão (investida, disparo) */
  target: { x: number; y: number } | null;
  chargeVx: number;
  chargeVy: number;
  chargeHit: boolean;
  timer: number;
  dead: boolean;
  deadTimer: number;
  seed: number;
  /** 1→0 logo após golpear (animação de bote) */
  strike: number;
  moving: boolean;
  jumpCd: number;
  /** alterna ataque 1 / ataque 2 dos chefes animados */
  atkAlt: number;
}

interface Projectile {
  x: number;
  y: number;
  dir: number;
  dist: number;
  skill: SkillDef;
  hit: Set<Enemy>;
}

interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dist: number;
  range: number;
  atk: number;
  color: string;
  r: number;
  /** desenho do disparo (efeito do chefe) */
  fx?: string;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface Particle {
  x: number;
  y: number;
  /** altura acima do chão */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface Effect {
  kind: 'swing' | 'ring';
  x: number;
  y: number;
  dir: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

/** Cor do nível do monstro comparado ao do jogador: cinza = fácil, branco = parelho, laranja/vermelho = perigoso. */
export function levelColor(monster: number, player: number): string {
  const d = monster - player;
  if (d <= -3) return '#a8b0c0';
  if (d <= 1) return '#ffffff';
  if (d <= 4) return '#ffb060';
  return '#ff5f5f';
}

/** Caixa vertical do corpo do monstro (topo/base), para acertos. */
function enemyBox(e: { y: number; radius: number; def: EnemyDef }): { top: number; bottom: number } {
  const r = e.radius;
  if (hasSprite(e.def.sprite)) {
    // com sprite: a caixa acompanha o tamanho do desenho
    const h = spriteHeight(e.def.sprite, e.def.spriteScale) * (e.def.bossAnim ? 0.8 : 0.9);
    const bottom = e.def.shape === 'flyer' ? e.y - 1.8 * r : e.y;
    return { top: bottom - h, bottom };
  }
  switch (e.def.shape) {
    case 'flyer': return { top: e.y - 3.4 * r, bottom: e.y - 1.8 * r };
    case 'golem': return { top: e.y - 2.3 * r, bottom: e.y };
    case 'mushroom': return { top: e.y - 2.6 * r, bottom: e.y };
    case 'beast': return { top: e.y - 1.7 * r, bottom: e.y };
    default: return { top: e.y - 1.8 * r, bottom: e.y };
  }
}

/** Efeito do chefe animado para cada tipo de ataque especial (índice em bfx_<nome>_N). */
const BOSS_FX: Record<string, { shot: number; slam: number; summon: number }> = {
  dragon: { shot: 1, slam: 2, summon: 3 }, red_dragon2: { shot: 1, slam: 2, summon: 3 },
  skeleton_king: { shot: 0, slam: 1, summon: 2 }, golem_elder: { shot: 0, slam: 1, summon: 3 },
  crystal_golem: { shot: 2, slam: 1, summon: 3 }, demoness: { shot: 0, slam: 3, summon: 2 },
  dark_knight: { shot: 1, slam: 3, summon: 2 }, hydra: { shot: 0, slam: 1, summon: 3 }, dark_god: { shot: 0, slam: 3, summon: 1 },
};
/** Chefes básicos/intermediários: efeito de cada ataque (nome completo no atlas). */
const MINI_FX: Record<string, Partial<Record<'shot' | 'slam' | 'summon', string>>> = {
  troll: { slam: 'fxspecial' }, wolf_alpha: { summon: 'fxspecial' }, stone_golem: { slam: 'fxatk3', summon: 'fxspecial' },
  spider: { shot: 'fxspecial', slam: 'fxspecial' }, plant: { shot: 'fxatk3', slam: 'fxspecial' },
  minotaur: { slam: 'fxspecial' }, orc: { slam: 'fxspecial', shot: 'fxspecial' }, serpent: { shot: 'fxatk3', slam: 'fxspecial' },
  fallen_knight: { slam: 'fxspecial' }, dark_mage: { shot: 'fxspecial', slam: 'fxspecial' },
};

function bossFx(def: EnemyDef, kind: 'shot' | 'slam' | 'summon'): string | undefined {
  const mini = def.bossAnim && MINI_FX[def.bossAnim]?.[kind];
  if (mini) return `boss_${def.bossAnim}_${mini}`;
  const m = def.bossAnim && BOSS_FX[def.bossAnim];
  const name = m ? `bfx_${def.bossAnim}_${m[kind]}` : '';
  return name && hasSprite(name) ? name : undefined;
}

export class World {
  player: Player;
  stats: Stats;
  scenery: Scenery;
  terrain: Terrain;
  camY = 0;
  private prevUp = false;
  npcs: { def: NpcDef; x: number; y: number; look: HumanLook; seed: number }[];
  playerLook: HumanLook;
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  /** bônus ativos: nome -> segundos restantes */
  buffs: Record<string, number> = {};
  private streak = 0;
  private streakT = 0;
  /** evento de tesouro ativo nesta fase (nome do item-tema) */
  event: string | null = null;
  private spells: Spell[] = [];
  private enemyShots: EnemyShot[] = [];
  private texts: FloatText[] = [];
  private effects: Effect[] = [];
  private particles: Particle[] = [];
  /** congela o mundo por instantes no impacto (sensação de peso) */
  private hitStop = 0;
  private shakeT = 0;
  private shakeDur = 1;
  private shakeMag = 0;
  private hurtFlash = 0;
  /** tempo de jogo nesta fase (estrela de rapidez) */
  elapsed = 0;
  /** dano total recebido nesta fase (estrela de pouco dano) */
  damageTaken = 0;
  private soundsThisFrame = new Set<SoundName>();
  camX = 0;
  waveIndex = 0;
  waveActive = false;
  cleared: boolean;
  time = 0;

  constructor(
    public stage: StageDef,
    private progress: Progress,
    private hooks: WorldHooks,
    keep?: { hp: number; mp: number },
  ) {
    this.stats = computeStats(progress);
    this.cleared = stage.waves.length === 0;
    this.terrain = new Terrain(stage.terrain, stage.width);
    this.scenery = new Scenery(stage, this.terrain);
    this.npcs = stage.npcs.map((n, i) => {
      const def = getNpc(n.npcId);
      return { def, x: n.x, y: this.terrain.groundAt(n.x), look: npcLook(def.look), seed: i * 1.7 };
    });
    this.playerLook = playerLook(progress);
    this.player = {
      x: stage.spawn.x, y: this.terrain.groundAt(stage.spawn.x), vx: 0, vy: 0, onGround: true, dropT: 0, facing: 1, radius: 14,
      hp: Math.min(keep?.hp ?? this.stats.maxHp, this.stats.maxHp), maxHp: this.stats.maxHp,
      mp: Math.min(keep?.mp ?? this.stats.maxMp, this.stats.maxMp), maxMp: this.stats.maxMp,
      hitStun: 0, flash: 0, attackTimer: 0, comboStep: 0, comboWindow: 0,
      anim: null, animT: 0, animDur: 1, moving: false, deadAnim: 0, pending: null,
      cooldowns: {}, invuln: 0, dead: false, deadTimer: 0, walk: 0, buffered: null, bufferT: 0, jumpBuffer: 0, coyote: 0, climbing: false, castAnim: null, castT: 0, castDur: 1, shieldT: 0, empowerT: 0, landT: 0, dash: null,
    };
    this.camX = this.cameraTarget();
    this.camY = this.cameraTargetY();
    // eventos de tesouro: chance em fases da campanha (ou garantido pelo Passe de Evento)
    if (stage.index && (progress.eventPass || Math.random() < 0.18)) {
      progress.eventPass = false;
      this.event = EVENT_ITEMS[Math.floor(Math.random() * EVENT_ITEMS.length)];
    }
  }

  /** Posição de um portal (em cima do chão). */
  portalY(portal: PortalDef): number {
    return this.terrain.groundAt(portal.x);
  }

  /** Recalcula atributos depois de trocar equipamento ou subir de nível. */
  refreshStats(fullHeal = false): void {
    const old = this.stats;
    this.stats = computeStats(this.progress);
    this.playerLook = playerLook(this.progress);
    const p = this.player;
    p.maxHp = this.stats.maxHp;
    p.maxMp = this.stats.maxMp;
    if (fullHeal) {
      p.hp = p.maxHp;
      p.mp = p.maxMp;
    } else {
      p.hp = Math.max(1, Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - old.maxHp)));
      p.mp = Math.min(p.maxMp, p.mp + Math.max(0, p.maxMp - old.maxMp));
    }
  }

  heal(): void {
    this.player.hp = this.player.maxHp;
    this.player.mp = this.player.maxMp;
  }

  private sound(name: SoundName): void {
    if (this.soundsThisFrame.has(name)) return; // evita somar 5 sons iguais num golpe em área
    this.soundsThisFrame.add(name);
    this.hooks.sound(name);
  }

  private shake(mag: number, dur: number): void {
    if (mag >= this.shakeMag * (this.shakeT / this.shakeDur)) {
      this.shakeMag = mag;
      this.shakeT = dur;
      this.shakeDur = dur;
    }
  }

  private freeze(t: number): void {
    this.hitStop = Math.max(this.hitStop, t);
  }

  private burst(x: number, y: number, z: number, count: number, color: string, speed: number, size = 2.5, gravity = 300): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const life = 0.25 + Math.random() * 0.3;
      this.particles.push({
        x, y, z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.3, vz: Math.random() * speed * 0.9,
        life, maxLife: life, size: size * (0.6 + Math.random() * 0.8), color, gravity,
      });
    }
  }

  private floatText(x: number, y: number, str: string, color: string, size = 13, life = 0.7): void {
    this.texts.push({ x: x + (Math.random() - 0.5) * 10, y, text: str, color, life, maxLife: life, size });
  }

  /** poderes nos 4 botões */
  get slots(): (SkillDef | null)[] {
    return slotSkills(this.progress);
  }

  /** classe do jogador */
  get cls(): ClassDef {
    return getClass(this.progress.classId);
  }

  get boss(): Enemy | undefined {
    return this.enemies.find((e) => e.def.boss && !e.dead);
  }

  // ───────────────────────── atualização ─────────────────────────

  update(dt: number, input: Input, active: boolean): void {
    this.soundsThisFrame.clear();
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      if (active && !this.player.dead) this.readCommands(input);
      return;
    }
    this.time += dt;
    const p = this.player;
    if (active && !this.cleared && !p.dead) this.elapsed += dt;
    p.mp = Math.min(p.maxMp, p.mp + dt * 2.5 + p.maxMp * this.stats.regenMp * dt);
    if (!p.dead) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (this.stats.regenHp + (this.buffs.regen ? 0.02 : 0)) * dt);
    for (const k in this.buffs) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) delete this.buffs[k]; }
    this.streakT -= dt;
    if (this.streakT <= 0) this.streak = 0;
    this.updatePickups(dt);
    for (const id in p.cooldowns) p.cooldowns[id] = Math.max(0, p.cooldowns[id] - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.empowerT = Math.max(0, p.empowerT - dt);
    p.landT = Math.max(0, p.landT - dt);
    if (p.castAnim) { p.castT += dt; if (p.castT >= p.castDur) p.castAnim = null; }

    if (p.dead) {
      moveBody(p, p.vx * dt, dt, this.terrain, 0, this.stage.width);
      p.vx *= Math.pow(0.01, dt);
      p.deadAnim += dt;
      p.deadTimer -= dt;
      if (p.deadTimer <= 0 && p.deadTimer > -1) {
        p.deadTimer = -1;
        this.hooks.playerDied();
      }
    } else if (active) {
      this.updatePlayer(dt, input);
    }

    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => !e.dead || e.deadTimer > 0);
    this.separateEnemies();
    this.updateProjectiles(dt);
    this.updateEnemyShots(dt);
    this.updateSpells(dt);

    for (const t of this.texts) { t.life -= dt; t.y -= 28 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vz -= pt.gravity * dt;
      pt.z = Math.max(0, pt.z + pt.vz * dt);
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((fx) => fx.life > 0);

    this.updateWaves();
    if (!this.waveActive) this.camX += (this.cameraTarget() - this.camX) * Math.min(1, dt * 8);
    this.camY += (this.cameraTargetY() - this.camY) * Math.min(1, dt * 5);
  }

  private cameraTarget(): number {
    return Math.max(0, Math.min(this.stage.width - VIEW_W, this.player.x - VIEW_W / 2));
  }

  private cameraTargetY(): number {
    // o chão base fica sempre à vista, mesmo em cima das plataformas mais altas
    return Math.max(BASE_GROUND - VIEW_H + 10, Math.min(WORLD_H - VIEW_H, this.player.y - Math.round(VIEW_H * 0.69)));
  }

  private updatePlayer(dt: number, input: Input): void {
    const p = this.player;
    p.comboWindow -= dt;
    if (p.comboWindow <= 0) p.comboStep = 0;

    const ax = input.axis;
    const free = p.hitStun <= 0 && p.attackTimer <= 0;
    if (p.hitStun > 0) p.hitStun -= dt;
    else if (p.attackTimer > 0) p.attackTimer -= dt;
    const move = free ? ax.x : 0;
    if (free && Math.abs(ax.x) > 0.15) p.facing = Math.sign(ax.x);

    // pulo (com um pouco de tolerância: apertar pouco antes de pousar ou logo após sair da beirada)
    p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
    const up = ax.y < -0.75;
    const upEdge = up && !this.prevUp;
    this.prevUp = up;
    if (this.updateClimb(dt, input, free)) return;
    let jump = input.consume('jump');
    if (upEdge) {
      if (this.nearby()) this.interact();
      else jump = true;
    }
    if (jump) p.jumpBuffer = 0.14;
    p.jumpBuffer -= dt;
    if (p.jumpBuffer > 0 && p.coyote > 0 && p.hitStun <= 0) {
      p.jumpBuffer = 0;
      p.coyote = 0;
      if (ax.y > 0.6 && this.terrain.platformAt(p.x, p.y)) {
        p.dropT = 0.3; // baixo + pulo: desce da plataforma
      } else {
        p.vy = -JUMP_SPEED;
        this.sound('jump');
      }
      p.onGround = false;
    }

    const minX = this.waveActive ? this.camX + 16 : 16;
    const maxX = this.waveActive ? this.camX + VIEW_W - 16 : this.stage.width - 16;
    const wasAir = !p.onGround;
    const dashVx = p.dash ? p.dash.vx : 0;
    moveBody(p, (move * PLAYER_SPEED * (this.buffs.speed ? 1.3 : 1) + p.vx + dashVx) * dt, dt, this.terrain, minX, maxX);
    if (p.dash) this.updateDash(dt);
    if (wasAir && p.onGround) { this.sound('land'); p.landT = 0.2; }
    p.vx *= Math.pow(0.002, dt);
    p.moving = move !== 0 && p.onGround;
    if (p.moving) p.walk += dt * 11;
    if (p.anim) {
      p.animT += dt;
      if (p.animT >= p.animDur) p.anim = null;
    }
    if (p.pending) {
      p.pending.t -= dt;
      if (p.pending.t <= 0) {
        const run = p.pending.run;
        p.pending = null;
        if (!p.dead && p.hitStun <= 0) run();
      }
    }


    this.readCommands(input);
    p.bufferT -= dt;
    if (p.bufferT <= 0) p.buffered = null;
    // o golpe seguinte pode sair um pouco antes do anterior terminar (cancelamento)
    const canAct = p.hitStun <= 0 && p.attackTimer <= 0.06;
    if (canAct && p.buffered) {
      const cmd = p.buffered;
      p.buffered = null;
      if (cmd.kind === 'attack') {
        this.basicAttack();
        // apertos rápidos seguidos viram o combo inteiro
        if (cmd.count > 1) { p.buffered = { kind: 'attack', count: cmd.count - 1 }; p.bufferT = 0.35; }
      }
      else this.useSkill(cmd.skill);
    }
    if (input.consume('interact')) this.interact();
  }

  /** Escada perto dos pés do jogador (ou null). */
  private ladderHere(): { x: number; top: number; bottom: number } | null {
    const p = this.player;
    return this.terrain.ladders.find((l) => Math.abs(p.x - l.x) < 14 && p.y >= l.top - 3 && p.y <= l.bottom + 3) ?? null;
  }

  /** Subir/descer escada: ↑/↓ perto de uma escada. Pulo solta. Retorna true enquanto estiver na escada. */
  private updateClimb(dt: number, input: Input, free: boolean): boolean {
    const p = this.player;
    const ay = input.axis.y;
    const l = this.ladderHere();
    if (!p.climbing) {
      if (!l || !free) return false;
      const wantUp = ay < -0.6 && p.y > l.top + 2;
      const wantDown = ay > 0.6 && p.y <= l.top + 2;
      if (!wantUp && !wantDown) return false;
      p.climbing = true;
      p.x = l.x;
      p.vx = 0;
      p.vy = 0;
    }
    if (!l || p.hitStun > 0) { p.climbing = false; return false; }
    if (input.consume('jump')) {
      p.climbing = false;
      p.vy = -JUMP_SPEED * 0.6;
      p.onGround = false;
      this.sound('jump');
      return false;
    }
    p.x = l.x;
    p.vy = 0;
    p.y = Math.max(l.top, Math.min(l.bottom, p.y + ay * 110 * dt));
    if (Math.abs(ay) > 0.2) p.walk += dt * 8;
    p.moving = false;
    // chegou ao topo subindo, ou ao chão descendo: solta da escada
    if ((p.y <= l.top && ay < -0.2) || (p.y >= l.bottom && ay > 0.2)) {
      p.climbing = false;
      p.onGround = true;
    }
    p.onGround = !p.climbing;
    // ataques não saem na escada, mas os comandos não ficam presos
    input.consume('attack');
    return true;
  }

  private readCommands(input: Input): void {
    const p = this.player;
    if (input.consume('attack')) {
      const queued = p.buffered?.kind === 'attack' ? p.buffered.count : 0;
      p.buffered = { kind: 'attack', count: Math.min(2, queued + 1) };
      p.bufferT = 0.35;
    }
    this.slots.forEach((skill, i) => {
      if (skill && input.consume(`skill${i + 1}` as 'skill1')) { p.buffered = { kind: 'skill', skill }; p.bufferT = 0.35; }
    });
  }

  private basicAttack(): void {
    const p = this.player;
    const step = COMBO[p.comboStep % COMBO.length];
    p.comboStep = (p.comboStep + 1) % COMBO.length;
    p.comboWindow = 0.55;
    const basic = this.cls.basic;
    const time = step.time * basic.speed;
    p.attackTimer = time;
    this.startAnim((['combo0', 'combo1', 'combo2'] as const)[COMBO.indexOf(step)], time + 0.06);
    const finisher = step === COMBO[COMBO.length - 1];
    this.sound('swing');
    if (basic.kind === 'shot') {
      // classes de longe: cada golpe do combo é um disparo (o 3º mais forte)
      this.projectiles.push({
        x: p.x + p.facing * 18, y: p.y - 24, dir: p.facing, dist: 0, hit: new Set(),
        skill: {
          id: 'basic', name: '', description: '', kind: 'projectile', mpCost: 0, cooldown: 0, unlockLevel: 1,
          damageMul: step.mul * 0.9, range: basic.range, radius: finisher ? 12 : 9, speed: basic.speed,
          pierce: finisher, knockback: step.knock * 0.6, color: basic.color, fx: basic.fx,
        },
      });
      return;
    }
    p.vx = p.facing * 40;
    const hits = this.hitFront(step.range * basic.range, step.mul, step.knock, 22, finisher);
    if (hits > 0) {
      this.freeze(finisher ? 0.09 : 0.045);
      if (finisher) { this.shake(4, 0.18); this.sound('heavy'); }
    }
  }

  private useSkill(skill: SkillDef): void {
    const p = this.player;
    if (this.progress.level < skill.unlockLevel) {
      this.hooks.toast(`${skill.name} desbloqueia no nível ${skill.unlockLevel}`);
      return;
    }
    if ((p.cooldowns[skill.id] ?? 0) > 0) return;
    if (p.mp < skill.mpCost) {
      this.hooks.toast('MP insuficiente');
      this.sound('nomp');
      return;
    }
    p.mp -= skill.mpCost;
    p.cooldowns[skill.id] = skill.cooldown * this.stats.cdMul;
    // cartas/orbes/runas aumentam o dano dos poderes
    skill = { ...skill, damageMul: skill.damageMul * this.stats.skillMul };
    if (skill.anim) return this.castPower(skill);
    p.attackTimer = 0.3;
    switch (skill.kind) {
      case 'projectile':
        this.startAnim('wind', 0.3);
        this.sound('wind');
        this.projectiles.push({ x: p.x + p.facing * 20, y: p.y - 22, dir: p.facing, dist: 0, skill, hit: new Set() });
        break;
      case 'aoe':
        this.startAnim('whirl', 0.4);
        p.attackTimer = 0.4;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const b = enemyBox(e);
          const dx = e.x - p.x, dy = (b.top + b.bottom) / 2 - (p.y - PLAYER_H / 2);
          if (dx * dx + dy * dy <= (skill.radius + e.radius) ** 2) {
            this.damageEnemy(e, skill.damageMul, skill.knockback * (Math.sign(dx) || p.facing), true);
          }
        }
        this.sound('whirl');
        this.shake(3, 0.2);
        this.freeze(0.06);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          this.particles.push({
            x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 10, z: 12, vx: Math.cos(a) * 260, vy: Math.sin(a) * 90, vz: 40,
            life: 0.35, maxLife: 0.35, size: 3, color: skill.color, gravity: 100,
          });
        }
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, dir: 1, radius: skill.radius, color: skill.color, life: 0.35, maxLife: 0.35 });
        break;
      case 'melee':
        // pula e o golpe acerta ao aterrissar
        this.startAnim('thunder', 0.55);
        p.attackTimer = 0.55;
        if (p.onGround) { p.vy = -380; p.onGround = false; }
        p.invuln = Math.max(p.invuln, 0.4);
        this.sound('swing');
        p.pending = {
          t: 0.27,
          run: () => {
            this.sound('thunder');
            this.hitFront(skill.range, skill.damageMul, skill.knockback, skill.radius, true);
            this.shake(8, 0.35);
            this.freeze(0.12);
            this.hooks.vibrate(60);
            this.burst(p.x + p.facing * skill.range * 0.6, p.y, 30, 22, skill.color, 260, 3, 200);
            this.effects.push({ kind: 'swing', x: p.x, y: p.y, dir: p.facing, radius: skill.range, color: skill.color, life: 0.3, maxLife: 0.3 });
          },
        };
        break;
    }
  }

  // ───────────────────────── poderes (prancha de poderes) ─────────────────────────

  private castPower(skill: SkillDef): void {
    const p = this.player;
    const n = Math.max(2, frameCount(skill.anim!));
    const dur = Math.min(0.6, Math.max(0.32, n * 0.1));
    p.castAnim = skill.anim!;
    p.castT = 0;
    p.castDur = dur;
    p.attackTimer = dur * 0.8;
    p.climbing = false;
    const fx = hasSprite(skill.fx) ? skill.fx! : '';
    const later = (k: number, run: () => void) => { p.pending = { t: dur * k, run }; };
    const groundAt = (x: number) => this.terrain.surfacesAt(x).find((y) => y >= p.y - 2) ?? this.terrain.groundAt(x);
    const spell = (o: Partial<Spell> & Pick<Spell, 'x' | 'dur'>): void => {
      const g = o.ground ?? groundAt(o.x);
      this.spells.push({
        name: fx, y: g, ground: g, dir: p.facing, t: 0, hits: [0.1], hitIdx: 0, radius: skill.radius, mul: skill.damageMul,
        knock: skill.knockback, color: skill.color, falling: false, landed: false, tick: 0, tickT: 0, ...o,
      });
    };
    this.sound(skill.color === '#ff9a3c' || skill.color === '#ff7a2a' ? 'wind' : skill.kind === 'melee' ? 'swing' : 'whirl');
    switch (skill.kind) {
      case 'melee':
        later(0.45, () => {
          const hits = this.hitFront(skill.range, skill.damageMul, skill.knockback, skill.radius, true);
          this.burst(p.x + p.facing * skill.range * 0.6, p.y, 26, 10, skill.color, 200, 2.5);
          if (hits) { this.freeze(0.07); this.shake(4, 0.15); }
        });
        break;
      case 'projectile': {
        const count = skill.count ?? 1;
        later(0.5, () => {
          for (let k = 0; k < count; k++) {
            const dy = (k - (count - 1) / 2) * 13;
            const low = skill.id === 'w_shock' || skill.id === 'm_icestorm';
            this.projectiles.push({ x: p.x + p.facing * 22, y: p.y - (low ? 22 : 26) + dy, dir: p.facing, dist: 0, skill, hit: new Set() });
          }
        });
        break;
      }
      case 'aoe':
        later(0.5, () => {
          for (const e of this.enemies) {
            if (e.dead) continue;
            const b = enemyBox(e);
            const dx = e.x - p.x, dy = (b.top + b.bottom) / 2 - (p.y - PLAYER_H / 2);
            if (dx * dx + dy * dy <= (skill.radius + e.radius) ** 2) this.damageEnemy(e, skill.damageMul, skill.knockback * (Math.sign(dx) || p.facing), true);
          }
          if (fx) spell({ x: p.x, ground: p.y, dur: 0.55, hits: [] });
          else this.effects.push({ kind: 'ring', x: p.x, y: p.y, dir: 1, radius: skill.radius, color: skill.color, life: 0.35, maxLife: 0.35 });
          this.shake(4, 0.2);
          this.freeze(0.06);
          this.burst(p.x, p.y, 20, 18, skill.color, 260, 3, 100);
        });
        break;
      case 'dash':
        p.dash = { vx: (p.facing * skill.range) / 0.24, t: 0.24, hit: new Set(), skill };
        p.invuln = Math.max(p.invuln, 0.4);
        p.attackTimer = 0.3;
        break;
      case 'blast':
        later(0.45, () => spell({ x: p.x + p.facing * skill.range, dur: 0.5, hits: [0.12] }));
        break;
      case 'erupt':
        later(0.4, () => {
          for (let k = 0; k < 3; k++) spell({ x: p.x + p.facing * skill.range * (0.35 + k * 0.32), dur: 0.45, t: -k * 0.13, hits: [0.1] });
        });
        break;
      case 'strike': {
        let best: Enemy | null = null;
        for (const e of this.enemies) {
          if (e.dead || Math.abs(e.x - p.x) > skill.range) continue;
          if (!best || Math.abs(e.x - p.x) < Math.abs(best.x - p.x)) best = e;
        }
        const tx = best ? best.x : p.x + p.facing * 120;
        later(0.5, () => { spell({ x: tx, ground: best ? best.y : groundAt(tx), dur: 0.5, hits: [0.1] }); this.shake(5, 0.2); this.sound('thunder'); });
        break;
      }
      case 'rain': {
        const count = skill.count ?? 5;
        later(0.5, () => {
          for (let k = 0; k < count; k++) {
            const x = p.x + p.facing * (40 + ((skill.range - 40) * k) / Math.max(1, count - 1)) + (Math.random() - 0.5) * 24;
            const g = groundAt(x);
            spell({ x, ground: g, y: g - 230 - Math.random() * 40, dur: 0.4, t: -k * 0.12, hits: [0], falling: true });
          }
        });
        break;
      }
      case 'cloud':
        later(0.5, () => spell({ x: p.x + p.facing * skill.range, dur: skill.duration ?? 5, hits: [], tick: 0.5, tickT: 0.1 }));
        break;
      case 'heal': {
        const amount = Math.round(p.maxHp * 0.4);
        later(0.5, () => {
          p.hp = Math.min(p.maxHp, p.hp + amount);
          this.floatText(p.x, p.y - 56, `+${amount}`, '#8fe07a', 16, 1);
          this.burst(p.x, p.y, 10, 26, '#8fe07a', 120, 3, -60);
          this.sound('levelup');
        });
        break;
      }
      case 'shield':
        later(0.6, () => { p.shieldT = skill.duration ?? 8; this.sound('levelup'); });
        break;
      case 'empower':
        later(0.6, () => { p.empowerT = skill.duration ?? 8; this.sound('wave'); });
        break;
    }
  }

  /** Efeito visual de chefe parado num ponto (sem dano: o dano é do ataque). */
  private bossEffect(name: string, x: number, y: number, dur: number, dir: number, scale = 1): void {
    this.spells.push({
      name, x, y, ground: y, dir, t: 0, dur, hits: [], hitIdx: 0, radius: 0, mul: 0, knock: 0, color: '#c49bff',
      falling: false, landed: false, tick: 0, tickT: 0, scale,
    });
  }

  private updateDash(dt: number): void {
    const p = this.player, d = p.dash!;
    d.t -= dt;
    for (const e of this.enemies) {
      if (e.dead || d.hit.has(e) || Math.abs(e.x - p.x) > e.radius + 18 || !this.overlapsPlayer(e, 6)) continue;
      d.hit.add(e);
      this.damageEnemy(e, d.skill.damageMul, d.skill.knockback * p.facing, true);
      this.freeze(0.03);
    }
    if (Math.random() < 0.8) this.burst(p.x - p.facing * 12, p.y, 20, 2, d.skill.color, 80, 3, 0);
    if (d.t <= 0) p.dash = null;
  }

  /** Dano em área num ponto (pés em y). */
  private hitArea(x: number, y: number, r: number, mul: number, knock: number, dir: number): number {
    let n = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const b = enemyBox(e);
      if (Math.abs(e.x - x) < r + e.radius && b.bottom > y - r * 1.6 && b.top < y + 10) {
        this.damageEnemy(e, mul, knock * (Math.sign(e.x - x) || dir), true);
        n++;
      }
    }
    return n;
  }

  private updateSpells(dt: number): void {
    for (const s of this.spells) {
      s.t += dt;
      if (s.t < 0) continue;
      if (s.falling && !s.landed) {
        s.y += 560 * dt;
        s.t = 0;
        if (s.y >= s.ground) {
          s.y = s.ground;
          s.landed = true;
          this.hitArea(s.x, s.y, s.radius, s.mul, s.knock, s.dir);
          this.burst(s.x, s.y, 4, 10, s.color, 200, 3, 300);
          this.shake(3, 0.1);
          this.sound('hit');
        }
        continue;
      }
      while (s.hitIdx < s.hits.length && s.t >= s.hits[s.hitIdx]) {
        s.hitIdx++;
        if (this.hitArea(s.x, s.y, s.radius, s.mul, s.knock, s.dir)) this.freeze(0.04);
        this.burst(s.x, s.y, 10, 8, s.color, 180, 2.5);
      }
      if (s.tick > 0) {
        s.tickT -= dt;
        if (s.tickT <= 0) { s.tickT = s.tick; this.hitArea(s.x, s.y, s.radius, s.mul, 0, s.dir); }
      }
    }
    this.spells = this.spells.filter((s) => s.t < s.dur || (s.falling && !s.landed));
  }

  private drawSpells(ctx: CanvasRenderingContext2D): void {
    for (const s of this.spells) {
      if (s.t < 0 && !s.falling) continue;
      if (!s.name) continue;
      const n = frameCount(s.name);
      const h = spriteHeight(s.name);
      let frame: number, alpha = 1, rot = 0, scale = s.scale ?? 1;
      if (s.falling && !s.landed) {
        if (s.t < 0 && s.y === s.ground - 0) continue;
        frame = 0;
        rot = n > 1 ? 0 : Math.PI / 2 * s.dir; // adaga: aponta para baixo
      } else if (s.falling) {
        frame = n - 1;
        alpha = 1 - s.t / s.dur;
        if (n === 1) { scale = 0.8; alpha *= 0.6; }
      } else if (s.tick > 0) {
        frame = n - 1;
        alpha = Math.min(1, s.t * 4, (s.dur - s.t) * 3);
        scale = 1 + Math.sin(this.time * 4) * 0.05;
      } else {
        frame = Math.min(n - 1, (s.t / s.dur) * n * 1.3);
        alpha = Math.min(1, (s.dur - s.t) * 6);
      }
      if (s.falling && !s.landed && s.t < 0) continue;
      glow(ctx, s.x, s.y - h * 0.4, h * 0.8, s.color, 0.25 * alpha);
      drawSprite(ctx, s.name, frame, s.x, s.y - (h * scale) / 2, s.dir, { alpha, rot, scale });
    }
  }

  private startAnim(kind: ActionAnim, dur: number): void {
    const p = this.player;
    p.anim = kind;
    p.animT = 0;
    p.animDur = dur;
  }

  /** Golpe à frente do jogador. Retorna quantos inimigos acertou. */
  private hitFront(range: number, mul: number, knock: number, reach = 22, heavy = false): number {
    const p = this.player;
    let hits = 0;
    const top = p.y - PLAYER_H - reach * 0.5, bottom = p.y + 8;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing;
      const b = enemyBox(e);
      if (dx > -12 && dx < range + e.radius && b.top < bottom && b.bottom > top) {
        this.damageEnemy(e, mul, knock * p.facing, heavy);
        hits++;
      }
    }
    return hits;
  }

  private damageEnemy(e: Enemy, mul: number, knock: number, heavy = false): void {
    const crit = Math.random() < this.stats.crit + (this.buffs.crit ? 0.2 : 0);
    const boost = (this.player.empowerT > 0 ? 1.6 : 1) * (this.buffs.atk ? 1.3 : 1);
    const dmg = calcDamage(this.stats.atk, e.armor, mul * boost) * (crit ? 2 : 1);
    e.hp -= dmg;
    e.flash = 0.1;
    const resist = e.def.boss ? 0.15 : 1;
    e.hitStun = e.def.boss ? 0.06 : 0.28;
    e.vx = knock * resist;
    // golpe interrompe o preparo de inimigos comuns (não de chefes)
    if (!e.def.boss && (e.state === 'windup' || e.state === 'ability')) { e.state = 'recover'; e.timer = 0.4; }
    const bodyZ = e.def.shape === 'flyer' ? e.radius * 2.6 : e.radius * 1.2;
    this.floatText(e.x, e.y - e.radius * 2.6, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd36b' : '#fff', crit ? 19 : heavy ? 16 : 13);
    this.burst(e.x - Math.sign(knock) * e.radius * 0.4, e.y, bodyZ, crit ? 12 : 6, crit ? '#ffd36b' : '#ffffff', crit ? 240 : 170, 2.2);
    if (crit) { this.sound('crit'); this.shake(3, 0.12); this.freeze(0.07); }
    else this.sound('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    e.deadTimer = e.def.bossAnim ? 1.1 : 0.5;
    const pr = this.progress;
    const gold = Math.round(e.gold * this.stats.goldMul * (this.event ? 1.5 : 1));
    const exp = Math.round(e.exp * this.stats.expMul * (this.buffs.exp ? 1.5 : 1));
    const recent = this.texts.filter((t) => t.color === '#9ff0a0' && t.life > 0.5).length;
    this.floatText(e.x, e.y - 10 + recent * 12, `+${exp} EXP`, '#9ff0a0', 10, 0.9);
    // moedas e itens saltam do inimigo; o personagem pega passando perto
    this.spawnPickup({ kind: 'gold', amount: gold }, e.x, e.y - 20);
    const luck = this.buffs.luck ? 1.5 : 1;
    for (const d of rollEnemyDrops(e.def, e.level, luck, !!this.event, pr, this.stage.region)) this.spawnPickup(d, e.x, e.y - 20);
    // sequência de abates: a cada 3 seguidos, um bônus temporário
    this.streak++;
    this.streakT = 4;
    if (this.streak % 3 === 0) {
      const keys = Object.keys(BUFFS);
      const k = keys[Math.floor(Math.random() * keys.length)];
      this.buffs[k] = BUFF_TIME;
      this.hooks.toast(`Sequência x${this.streak}! ${BUFFS[k].name}`);
      this.sound('levelup');
      this.burst(this.player.x, this.player.y, 30, 20, BUFFS[k].color, 160, 3, -40);
    }
    this.burst(e.x, e.y, e.radius, e.def.boss ? 60 : 16, e.def.color, e.def.boss ? 320 : 180, e.def.boss ? 4 : 3, 260);
    this.sound('kill');
    this.sound('coin');
    if (e.def.boss) {
      this.freeze(0.3);
      this.shake(12, 0.8);
      this.hooks.vibrate(200);
    }
    for (const d of e.def.drops ?? []) {
      if (Math.random() < d.chance && !pr.owned.includes(d.itemId)) {
        pr.owned.push(d.itemId);
        this.hooks.toast(`Obtido: ${getItem(d.itemId).name}`);
      }
    }
    this.gainExp(exp, false);
    this.hooks.killed(e.def);
    this.hooks.save();
  }

  private spawnPickup(drop: Drop, x: number, y: number): void {
    const icon = drop.kind === 'gold' ? (drop.amount > 200 ? 'it_coin_pile' : drop.amount > 40 ? 'it_coins' : 'it_coin')
      : drop.kind === 'gems' ? 'it_' + drop.icon
      : drop.kind === 'gear' ? (getItem(drop.id).icon ?? 'icon_' + drop.id) : 'it_' + drop.id;
    this.pickups.push({ drop, icon, x, y, vx: (Math.random() - 0.5) * 160, vy: -220 - Math.random() * 120, t: 0, landed: false });
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      const dx = p.x - k.x, dy = p.y - 18 - k.y;
      const d = Math.hypot(dx, dy);
      if (k.t > 0.5 && !p.dead && d < 90) {
        // ímã: vem até o personagem
        const sp = 260 + (90 - d) * 6;
        k.x += (dx / d) * sp * dt;
        k.y += (dy / d) * sp * dt;
        if (d < 16) { k.t = -1; this.collect(k); }
        continue;
      }
      if (!k.landed) {
        k.vy += 900 * dt;
        k.x += k.vx * dt;
        const g = this.terrain.surfacesAt(k.x).find((y) => y >= k.y - 2) ?? this.terrain.groundAt(k.x);
        k.y += k.vy * dt;
        if (k.vy > 0 && k.y >= g - 8) { k.y = g - 8; k.landed = true; }
      }
    }
    // some depois de 25 s (os valiosos ficam mais)
    this.pickups = this.pickups.filter((k) => k.t >= 0 && k.t < (k.drop.kind === 'gold' ? 25 : 60));
  }

  private collect(k: Pickup): void {
    const d = k.drop;
    if (d.kind === 'bag' && bagItem(d.id)?.kind === 'food') {
      const p = this.player;
      const heal = Math.round(p.maxHp * 0.12);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.floatText(p.x, p.y - 50, `+${heal}`, '#8fe07a', 12, 0.8);
      this.sound('coin');
      return;
    }
    this.hooks.pickup(d);
    this.sound('coin');
    const label = d.kind === 'gold' ? `+${d.amount} G` : d.kind === 'gems' ? `+${d.amount} 💎` : '';
    if (label) this.floatText(k.x, k.y - 10, label, d.kind === 'gems' ? '#9fd3ff' : '#ffd36b', 10, 0.8);
  }

  /** Usa uma poção da bolsa. Retorna true se usou. */
  usePotion(id: string): boolean {
    const p = this.player;
    if (p.dead || (this.progress.bag[id] ?? 0) <= 0) return false;
    switch (id) {
      case 'pot_hp': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4); break;
      case 'pot_hp2': p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.7); break;
      case 'pot_mp': p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.4); break;
      case 'pot_mp2': p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.7); break;
      case 'pot_mp3': p.mp = p.maxMp; p.cooldowns = {}; break;
      case 'pot_elixir': p.hp = p.maxHp; p.mp = p.maxMp; break;
      case 'pot_divine': p.hp = p.maxHp; p.mp = p.maxMp; p.invuln = 5; break;
      default: return false;
    }
    this.progress.bag[id]--;
    const c = id.includes('hp') || id === 'pot_elixir' || id === 'pot_divine' ? '#ff6b6b' : '#7fc8ff';
    this.burst(p.x, p.y, 20, 18, c, 120, 3, -60);
    this.sound('levelup');
    return true;
  }

  /** Soma experiência e trata a subida de nível (usado por inimigos e recompensas de missão). */
  gainExp(amount: number, save = true): void {
    const pr = this.progress;
    pr.exp += amount;
    let leveled = false;
    const startLevel = pr.level;
    while (pr.exp >= expToNext(pr.level)) {
      pr.exp -= expToNext(pr.level);
      pr.level++;
      leveled = true;
    }
    if (leveled) {
      this.refreshStats(true);
      this.hooks.toast(`Nível ${pr.level}!`);
      this.sound('levelup');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        this.particles.push({
          x: this.player.x + Math.cos(a) * 16, y: this.player.y + Math.sin(a) * 6, z: Math.random() * 10,
          vx: 0, vy: 0, vz: 60 + Math.random() * 60, life: 0.9, maxLife: 0.9, size: 2.5, color: '#ffe9a8', gravity: -40,
        });
      }
      const unlocked = this.cls.skills.find((s) => s.unlockLevel > startLevel && s.unlockLevel <= pr.level);
      if (unlocked) this.hooks.toast(`Novo poder: ${unlocked.name}`);
    }
    if (save) this.hooks.save();
  }

  private updateEnemy(e: Enemy, dt: number): void {
    e.flash = Math.max(0, e.flash - dt);
    e.strike = Math.max(0, e.strike - dt * 4);
    e.moving = false;
    e.vx *= Math.pow(0.003, dt);
    if (e.dead) { e.deadTimer -= dt; this.enemyPhysics(e, 0, dt); return; }
    for (let i = 0; i < e.abilityCd.length; i++) e.abilityCd[i] -= dt;
    if (e.def.enrage && !e.enraged && e.hp < e.maxHp / 2) {
      e.enraged = true;
      e.speed *= 1.35;
      this.hooks.toast(`${e.def.name} está furioso!`);
      this.shake(6, 0.5);
      this.sound('wave');
      this.burst(e.x, e.y, e.radius, 30, '#ff4040', 220, 3);
    }
    const walk = this.enemyBrain(e, dt);
    this.enemyPhysics(e, walk, dt);
  }

  /** Move o inimigo: andarilhos têm gravidade e pulam degraus; voadores voam livres. */
  private enemyPhysics(e: Enemy, walk: number, dt: number): void {
    e.jumpCd -= dt;
    if (e.def.shape === 'flyer') {
      e.x = Math.max(0, Math.min(this.stage.width, e.x + (walk + e.vx) * dt));
      e.y = Math.max(60, Math.min(this.terrain.groundAt(e.x) - 10, e.y + e.vy * dt));
      return;
    }
    const blocked = moveBody(e, (walk + e.vx) * dt, dt, this.terrain, 0, this.stage.width);
    if (blocked && e.onGround && walk !== 0 && e.jumpCd <= 0) {
      e.vy = -JUMP_SPEED * 0.85;
      e.onGround = false;
      e.jumpCd = 0.8;
    }
  }

  /** Decide o que o inimigo faz neste quadro. Retorna a velocidade horizontal desejada. */
  private enemyBrain(e: Enemy, dt: number): number {
    if (e.def.shape === 'flyer') e.vy = 0;
    if (e.hitStun > 0) { e.hitStun -= dt; return 0; }
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = e.def;
    const locked = e.state === 'windup' || e.state === 'ability' || e.state === 'charging';
    if (!locked) e.facing = Math.sign(dx) || e.facing;
    const sameLevel = this.overlapsPlayer(e, 6);

    if (e.state === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) {
        const reach = d.attackRange + p.radius;
        if (!p.dead && Math.abs(dx) < reach && Math.sign(dx) === e.facing && this.overlapsPlayer(e, 10)) {
          this.hitPlayer(e);
        }
        e.state = 'recover';
        e.timer = d.attackCooldown * (e.enraged ? 0.6 : 1);
        e.strike = 1;
        e.atkAlt++;
      }
      return 0;
    }
    if (e.state === 'ability') {
      e.timer -= dt;
      if (e.timer <= 0) this.executeAbility(e);
      return 0;
    }
    if (e.state === 'charging') return this.updateCharge(e, dt);
    if (e.state === 'recover') {
      e.timer -= dt;
      if (e.timer <= 0) e.state = 'chase';
    }
    if (p.dead) return 0;
    if (e.state === 'chase' && this.tryAbility(e, dx, dy)) return 0;

    const speed = e.speed * (e.state === 'recover' ? 0.35 : 1);
    const reach = d.attackRange * 0.7 + p.radius;
    if (d.shape === 'flyer') {
      // voa até ficar ao lado do jogador, na altura do peito
      const side = Math.sign(dx || 1);
      const tx = p.x - side * reach, ty = p.y + e.radius * 2.6 - 26 + Math.sin(this.time * 2 + e.seed) * 8;
      const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my);
      if (ml > 3) {
        e.vy = (my / ml) * speed * 0.8;
        e.moving = true;
        if (e.state === 'chase' && Math.abs(dx) < d.attackRange + p.radius && sameLevel) { e.state = 'windup'; e.timer = d.windup * (e.enraged ? 0.75 : 1); }
        return (mx / ml) * speed;
      }
    } else {
      let walk = Math.abs(dx) > reach ? Math.sign(dx) * speed : 0;
      const plat = this.terrain.platformAt(e.x, e.y);
      // não cai da plataforma à toa (só se o jogador estiver mais embaixo)
      if (plat && walk !== 0 && dy <= 20) {
        const nx = e.x + Math.sign(walk) * e.radius;
        if (nx < plat.x0 || nx > plat.x1) walk = 0;
      }
      // jogador mais alto e perto: pula atrás dele
      if (e.onGround && dy < -40 && Math.abs(dx) < 130 && e.jumpCd <= 0) {
        e.vy = -JUMP_SPEED * (0.9 + Math.random() * 0.1);
        e.onGround = false;
        e.jumpCd = 1.3 + Math.random();
      }
      // jogador mais embaixo: desce da plataforma
      if (plat && dy > 40 && Math.abs(dx) < 70) e.dropT = 0.3;
      e.moving = walk !== 0 && e.onGround;
      if (e.state === 'chase' && Math.abs(dx) < d.attackRange + p.radius && sameLevel && e.onGround) {
        e.state = 'windup';
        e.timer = d.windup * (e.enraged ? 0.75 : 1);
        return 0;
      }
      return walk;
    }
    return 0;
  }

  /** O corpo do inimigo está na mesma altura que o do jogador? */
  private overlapsPlayer(e: Enemy, pad: number): boolean {
    const b = enemyBox(e), p = this.player;
    return b.top < p.y + pad && b.bottom > p.y - PLAYER_H - pad;
  }

  /** Começa um ataque especial se algum estiver pronto e fizer sentido agora. */
  private tryAbility(e: Enemy, dx: number, dy: number): boolean {
    const list = e.def.abilities;
    if (!list?.length) return false;
    const adx = Math.abs(dx);
    const start = Math.floor(Math.random() * list.length);
    for (let k = 0; k < list.length; k++) {
      const i = (start + k) % list.length;
      const a = list[i];
      if (e.abilityCd[i] > 0) continue;
      let ok = false;
      switch (a.kind) {
        case 'slam': ok = adx < a.radius * 0.8 && Math.abs(dy) < 50; break;
        case 'charge': ok = adx > 110 && adx < 460; break;
        case 'shoot': ok = adx > 70 && adx < a.range; break;
        case 'summon': ok = this.enemies.filter((o) => !o.dead && !o.def.boss).length < 5; break;
      }
      if (!ok) continue;
      const p = this.player;
      e.state = 'ability';
      e.ability = i;
      e.timer = a.windup * (e.enraged ? 0.75 : 1);
      e.abilityCd[i] = a.cooldown * (e.enraged ? 0.6 : 1);
      e.target = a.kind === 'slam' ? { x: e.x, y: e.y } : { x: p.x, y: p.y };
      if (a.kind === 'charge' || a.kind === 'shoot') e.facing = Math.sign(dx) || e.facing;
      return true;
    }
    return false;
  }

  private executeAbility(e: Enemy): void {
    const a = e.def.abilities![e.ability];
    const p = this.player;
    e.state = 'recover';
    e.timer = e.enraged ? 0.6 : 0.9;
    e.strike = 1;
    switch (a.kind) {
      case 'slam': {
        // onda de choque pelo chão: pega quem estiver perto e na mesma altura (pular desvia!)
        if (!p.dead && Math.abs(p.x - e.x) < a.radius + p.radius && Math.abs(p.y - e.y) < 24) this.hitPlayer(e, a.damageMul);
        this.shake(7, 0.3);
        this.sound('thunder');
        this.effects.push({ kind: 'ring', x: e.x, y: e.y, dir: 1, radius: a.radius, color: '#ff8060', life: 0.4, maxLife: 0.4 });
        this.burst(e.x, e.y, 4, 26, '#c8b090', 240, 3, 260);
        const sfx = bossFx(e.def, 'slam');
        if (sfx) for (const k of [-1, -0.45, 0.45, 1]) this.bossEffect(sfx, e.x + k * a.radius * 0.8, e.y, 0.55, e.facing, Math.abs(k) < 0.5 ? 0.9 : 0.7);
        break;
      }
      case 'charge': {
        const t = e.target ?? { x: p.x, y: p.y };
        const dir = Math.sign(t.x - e.x) || e.facing;
        const dist = Math.abs(t.x - e.x) + 140;
        e.facing = dir;
        e.chargeVx = dir * a.speed;
        e.chargeVy = 0;
        e.chargeHit = false;
        e.state = 'charging';
        e.timer = Math.min(1.5, dist / a.speed);
        this.sound('swing');
        break;
      }
      case 'shoot': {
        const b = enemyBox(e);
        const oy = (b.top + b.bottom) / 2;
        const base = Math.atan2(p.y - PLAYER_H / 2 - oy, p.x - e.x);
        for (let i = 0; i < a.count; i++) {
          const off = a.count > 1 ? (i / (a.count - 1) - 0.5) * a.spread * 2 : 0;
          const ang = base + off;
          this.enemyShots.push({
            x: e.x + e.facing * e.radius * 0.7, y: oy, vx: Math.cos(ang) * a.speed, vy: Math.sin(ang) * a.speed,
            dist: 0, range: a.range, atk: e.atk * a.damageMul, color: a.color, r: 6, fx: bossFx(e.def, 'shot'),
          });
        }
        this.sound('wind');
        break;
      }
      case 'summon': {
        const def = getEnemy(a.enemyId);
        for (let i = 0; i < a.count; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const m = this.spawnEnemy(def, e.x + side * (50 + Math.random() * 30), e.y - 30, -side, true);
          this.burst(m.x, m.y, 10, 14, '#c49bff', 140, 2.5);
          const zfx = bossFx(e.def, 'summon');
          if (zfx) this.bossEffect(zfx, m.x, m.y + 30, 0.7, -side, 0.6);
        }
        this.sound('wave');
        break;
      }
    }
  }

  private updateCharge(e: Enemy, dt: number): number {
    const p = this.player;
    const a = e.def.abilities![e.ability];
    e.moving = true;
    e.timer -= dt;
    if (Math.random() < 0.5) this.burst(e.x - e.facing * e.radius, e.y, 2, 1, '#c8b090', 60, 3, 100);
    if (!e.chargeHit && !p.dead && Math.abs(p.x - e.x) < e.radius + p.radius && this.overlapsPlayer(e, 4)) {
      e.chargeHit = true;
      this.hitPlayer(e, a.kind === 'charge' ? a.damageMul : 1);
    }
    const minX = this.waveActive ? this.camX - 20 : 0;
    const maxX = this.waveActive ? this.camX + VIEW_W + 20 : this.stage.width;
    if (e.timer <= 0 || e.x < minX || e.x > maxX) {
      e.x = Math.max(minX, Math.min(maxX, e.x));
      e.state = 'recover';
      e.timer = e.enraged ? 0.7 : 1.1;
      this.shake(3, 0.15);
      return 0;
    }
    return e.chargeVx;
  }

  private updateEnemyShots(dt: number): void {
    const p = this.player;
    for (const sh of this.enemyShots) {
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.dist += Math.hypot(sh.vx, sh.vy) * dt;
      if (!p.dead && Math.abs(sh.x - p.x) < sh.r + p.radius * 0.8 && sh.y > p.y - PLAYER_H - sh.r && sh.y < p.y + sh.r) {
        this.damagePlayer(sh.atk, Math.sign(sh.vx) || 1, false);
        this.burst(sh.x, sh.y, 16, 10, sh.color, 150, 2.5);
        sh.dist = Infinity;
      }
    }
    this.enemyShots = this.enemyShots.filter((sh) => sh.dist < sh.range && sh.y > -30 && sh.y < this.terrain.groundAt(sh.x) + 4);
  }

  /** Cria um inimigo com atributos ajustados à força da fase. */
  private spawnEnemy(def: EnemyDef, x: number, y: number, facing: number, summoned = false): Enemy {
    // nível: o da fase, às vezes +1; chefe intermediário +2; chefe da região +3
    const base = this.stage.level ?? 1;
    const level = def.boss ? base + (def.hp >= 600 ? 3 : 2) : base + (!summoned && Math.random() < 0.35 ? 1 : 0);
    const pw = levelPower(level);
    // a vida e o ataque crescem um pouco mais rápido que a força, para acompanhar o nível do jogador
    const hp = Math.round(def.hp * Math.pow(pw, 1.4) * (this.stage.hpMul ?? 1));
    const e: Enemy = {
      def, level, x, y, vx: 0, vy: 0, onGround: false, dropT: 0, jumpCd: 0, atkAlt: 0, facing, radius: def.radius, hp, maxHp: hp,
      atk: def.atk * Math.pow(pw, 1.3) * (this.stage.atkMul ?? 1), armor: def.def * Math.sqrt(pw),
      exp: Math.round(def.exp * pw * 1.2), gold: Math.round(def.gold * pw),
      speed: def.speed * (1 + Math.min(0.3, (pw - 1) * 0.03)),
      hitStun: 0, flash: 0, state: 'chase', timer: 0, dead: false, deadTimer: 0, seed: Math.random() * 10, strike: 0, moving: false,
      abilityCd: (def.abilities ?? []).map((a) => a.cooldown * (0.3 + Math.random() * 0.5)),
      ability: -1, enraged: false, target: null, chargeVx: 0, chargeVy: 0, chargeHit: false,
    };
    this.enemies.push(e);
    return e;
  }

  private hitPlayer(e: Enemy, mul = 1): void {
    this.damagePlayer(e.atk * mul, e.facing, !!e.def.boss);
  }

  private damagePlayer(atk: number, dir: number, heavy: boolean): void {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    let dmg = calcDamage(atk, this.stats.def, 1);
    if (p.shieldT > 0) dmg = Math.max(1, Math.ceil(dmg * 0.3));
    dmg = Math.max(1, Math.round(dmg * this.stats.dmgTaken * (this.buffs.def ? 0.7 : 1)));
    this.damageTaken += Math.min(dmg, Math.max(0, p.hp));
    p.hp -= dmg;
    p.flash = 0.12;
    p.hitStun = 0.3;
    p.attackTimer = 0;
    p.invuln = 0.6;
    p.vx = dir * (heavy ? 260 : 150);
    if (p.onGround) { p.vy = heavy ? -260 : -160; p.onGround = false; }
    this.floatText(p.x, p.y - 44, `-${dmg}`, '#ff6b6b', 15, 0.8);
    this.burst(p.x, p.y, 18, 8, '#ff6b6b', 160, 2.5);
    this.sound('hurt');
    this.hooks.vibrate(heavy ? 90 : 40);
    this.shake(heavy ? 9 : 5, 0.22);
    this.freeze(0.06);
    this.hurtFlash = 0.35;
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      p.deadTimer = 1.2;
    }
  }

  private separateEnemies(): void {
    const list = this.enemies.filter((e) => !e.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (Math.abs(b.y - a.y) > 20) continue;
        const dx = b.x - a.x;
        const min = (a.radius + b.radius) * 0.7;
        if (Math.abs(dx) < min) {
          const push = (min - Math.abs(dx)) / 2 * (Math.sign(dx) || 1);
          a.x -= push; b.x += push;
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const pr of this.projectiles) {
      const step = (pr.skill.speed ?? 400) * dt;
      pr.x += pr.dir * step;
      pr.dist += step;
      for (const e of this.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        const b = enemyBox(e);
        if (Math.abs(e.x - pr.x) < pr.skill.radius + e.radius && pr.y > b.top - 10 && pr.y < b.bottom + 10) {
          pr.hit.add(e);
          this.damageEnemy(e, pr.skill.damageMul, pr.skill.knockback * pr.dir);
          this.freeze(0.03);
          if (!pr.skill.pierce) pr.dist = Infinity;
        }
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.dist < pr.skill.range);
  }

  private updateWaves(): void {
    if (this.cleared) return;
    if (this.waveActive) {
      if (this.enemies.some((e) => !e.dead)) return;
      this.waveActive = false;
      this.waveIndex++;
      if (this.waveIndex >= this.stage.waves.length) {
        this.cleared = true;
        if (!this.progress.cleared.includes(this.stage.id)) this.progress.cleared.push(this.stage.id);
        this.hooks.stageCleared(this.stage.id);
        const par = this.stage.parTime;
        if (par) {
          const damage = this.damageTaken / this.player.maxHp;
          this.hooks.stageResult({
            stageId: this.stage.id, time: this.elapsed, par, damage,
            stars: [true, this.elapsed <= par, damage <= DAMAGE_LIMIT],
          });
        }
        this.hooks.save();
        this.hooks.toast('Fase concluída! Siga até o portal.');
        // fôlego: recupera parte da vida para seguir direto para a próxima fase
        const p = this.player;
        if (!p.dead) {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
          p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.5);
        }
      } else {
        this.hooks.toast('Avance →');
      }
      return;
    }
    const wave = this.stage.waves[this.waveIndex];
    if (!wave || this.player.x < wave.triggerX) return;
    this.waveActive = true;
    let n = 0;
    for (const group of wave.enemies) {
      const def = getEnemy(group.enemyId);
      for (let i = 0; i < group.count; i++, n++) {
        const fromLeft = n % 3 === 2 && this.camX > 60;
        const x = fromLeft ? this.camX - 30 - Math.random() * 40 : this.camX + VIEW_W + 30 + Math.random() * 60;
        // aparece no chão ou em cima de uma plataforma; voadores no ar
        const tops = this.terrain.surfacesAt(x);
        let y = Math.random() < 0.3 ? tops[Math.floor(Math.random() * tops.length)] : tops[tops.length - 1];
        if (def.shape === 'flyer') y = this.terrain.groundAt(x) - 70 - Math.random() * 60;
        this.spawnEnemy(def, x, y, fromLeft ? 1 : -1);
      }
    }
    this.sound('wave');
    if (wave.enemies.some((g) => getEnemy(g.enemyId).boss)) {
      this.hooks.toast('Um chefe apareceu!');
      this.shake(5, 0.7);
      this.hooks.vibrate(120);
    }
  }

  // ───────────────────────── interação ─────────────────────────

  /** O que está perto o bastante para interagir (NPC ou portal). */
  nearby(): { kind: 'npc'; npc: NpcDef; x: number; y: number } | { kind: 'portal'; portal: PortalDef; x: number; y: number } | null {
    const p = this.player;
    const close = (x: number, y: number) => Math.abs(x - p.x) < 40 && Math.abs(y - p.y) < 40;
    for (const n of this.npcs) if (close(n.x, n.y)) return { kind: 'npc', npc: n.def, x: n.x, y: n.y };
    for (const portal of this.stage.portals) {
      const py = this.portalY(portal);
      if (close(portal.x, py)) return { kind: 'portal', portal, x: portal.x, y: py };
    }
    return null;
  }

  portalLock(portal: PortalDef): string | null {
    if (portal.requiresClear && !this.cleared) return 'Derrote todos os inimigos primeiro';
    if (portal.requiresStage && !this.progress.cleared.includes(portal.requiresStage)) return 'Conclua a fase anterior primeiro';
    return null;
  }

  private interact(): void {
    const target = this.nearby();
    if (!target) return;
    if (target.kind === 'npc') {
      this.player.facing = Math.sign(target.x - this.player.x) || 1;
      this.hooks.openNpc(target.npc);
      return;
    }
    const lock = this.portalLock(target.portal);
    if (lock) this.hooks.toast(lock);
    else if (target.portal.to === MAP_PORTAL) this.hooks.openMap();
    else this.hooks.changeStage(target.portal.to);
  }

  // ───────────────────────── desenho ─────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const s = this.stage;
    const camX = Math.round(this.camX);
    ctx.save();
    if (this.shakeT > 0) {
      const m = this.shakeMag * (this.shakeT / this.shakeDur);
      ctx.translate((Math.random() * 2 - 1) * m, (Math.random() * 2 - 1) * m);
    }
    const camY = Math.round(this.camY);
    this.scenery.drawBackground(ctx, camX, camY, this.time);
    this.scenery.drawLandmarks(ctx, camX, camY, this.time);
    drawTerrain(ctx, this.terrain, s.theme, camX, camY, this.time, this.scenery.props.length + s.width);
    this.scenery.drawFixtures(ctx, camX, camY, this.time);

    ctx.save();
    ctx.translate(-camX, -camY);

    for (const portal of s.portals) this.drawPortal(ctx, portal);
    for (const e of this.enemies) if (!e.dead && (e.state === 'ability' || e.state === 'charging')) this.drawTelegraph(ctx, e);

    // objetos do cenário, NPCs, inimigos e por último o jogador
    ctx.save();
    ctx.translate(camX, camY);
    for (const prop of this.scenery.props) this.scenery.drawProp(ctx, prop, camX, camY, this.time);
    ctx.restore();
    for (const n of this.npcs) this.drawNpc(ctx, n);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    this.drawPlayer(ctx);
    this.drawSpells(ctx);
    for (const k of this.pickups) {
      const bob = k.landed ? Math.sin(this.time * 4 + k.x) * 2 : 0;
      const rare = k.drop.kind !== 'gold' && k.drop.kind !== 'bag' || (k.drop.kind === 'bag' && /^(chest|key|card|rune|orb|e_|gem|ev_|pot_mp3|pot_elixir)/.test(k.drop.id));
      if (rare) glow(ctx, k.x, k.y - 6, 22 + Math.sin(this.time * 5) * 3, k.drop.kind === 'gear' ? '#ffd36b' : '#c49bff', 0.45);
      const blink = k.t > 20 && Math.floor(this.time * 8) % 2 === 0;
      if (!blink) drawSpriteH(ctx, k.icon, k.x, k.y + 4 + bob, k.drop.kind === 'gold' ? 14 : 18);
    }

    for (const pr of this.projectiles) {
      const y = pr.y;
      if (Math.random() < 0.6) {
        this.particles.push({ x: pr.x - pr.dir * 8, y: pr.y, z: 0, vx: -pr.dir * 40, vy: 0, vz: (Math.random() - 0.5) * 60,
          life: 0.2, maxLife: 0.2, size: 2.5, color: pr.skill.color, gravity: 0 });
      }
      if (spritesReady()) {
        const fx = pr.skill.fx ?? 'fx_slash';
        if (fx === 'fx_slash') drawSprite(ctx, fx, 0, pr.x, y + 11, pr.dir);
        else if (pr.skill.anim) {
          const n = frameCount(fx);
          // efeitos da prancha de poderes: crescem (bola de fogo) ou giram em loop (tornado, onda)
          const fr = pr.skill.pierce ? (pr.dist / 30) % n : Math.min(n - 1, pr.dist / 40);
          glow(ctx, pr.x, y, 26, pr.skill.color, 0.3);
          drawSprite(ctx, fx, fr, pr.x, y, pr.dir, { scale: pr.skill.count && pr.skill.count > 1 ? 0.6 : 1 });
        }
        else drawSprite(ctx, fx, 0, pr.x, y, pr.dir, { scale: pr.skill.radius >= 14 ? 1.4 : 1 });
      } else {
        ctx.fillStyle = pr.skill.color;
        ctx.beginPath();
        ctx.ellipse(pr.x, y, pr.skill.radius * 1.4, pr.skill.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const sh of this.enemyShots) {
      const sy = sh.y + 16;
      if (sh.fx && spritesReady()) {
        glow(ctx, sh.x, sh.y, 26, sh.color, 0.45);
        drawSprite(ctx, sh.fx, 0, sh.x, sh.y, Math.sign(sh.vx) || 1, { scale: 0.55, rot: Math.atan2(sh.vy, Math.abs(sh.vx)) * (Math.sign(sh.vx) || 1) });
        continue;
      }
      glow(ctx, sh.x, sy - 16, sh.r * 3, sh.color, 0.5);
      ctx.fillStyle = sh.color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sh.x, sy - 16, sh.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sh.x - 2, sy - 18, sh.r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.min(1, (pt.life / pt.maxLife) * 1.5);
      ctx.fillStyle = pt.color;
      const sz = pt.size * (0.5 + 0.5 * pt.life / pt.maxLife);
      ctx.fillRect(pt.x - sz / 2, pt.y - pt.z - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    for (const fx of this.effects) {
      const a = fx.life / fx.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.kind === 'ring' ? 5 : 4;
      ctx.beginPath();
      if (fx.kind === 'ring') {
        ctx.ellipse(fx.x, fx.y, fx.radius * (1.2 - a * 0.4), fx.radius * 0.35 * (1.2 - a * 0.4), 0, 0, Math.PI * 2);
      } else {
        const cy = fx.y - 22;
        const start = fx.dir > 0 ? -1.2 : Math.PI - 0.6;
        ctx.arc(fx.x, cy, fx.radius * 0.8, start, start + 1.8);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // primeiro plano, luz e atmosfera (por cima dos personagens, por baixo dos textos)
    this.scenery.drawForeground(ctx, camX, this.time, { x: this.player.x - camX, y: this.player.y - camY });

    ctx.save();
    ctx.translate(-camX, -camY);
    const near = this.nearby();
    if (near && !this.player.dead) {
      const label = near.kind === 'npc' ? `Falar com ${near.npc.name}` : (this.portalLock(near.portal) ? '🔒 ' : '→ ') + near.portal.label;
      text(ctx, label, near.x, near.y - 58, { size: 11, align: 'center', color: '#ffe9a8' });
    }
    for (const t of this.texts) {
      const age = t.maxLife - t.life;
      const pop = age < 0.1 ? 1 + (1 - age / 0.1) * 0.6 : 1; // número "salta" ao aparecer
      ctx.globalAlpha = Math.min(1, t.life * 2.5);
      text(ctx, t.text, t.x, t.y, { size: Math.round(t.size * pop), align: 'center', color: t.color });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.restore();

    if (this.hurtFlash > 0) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.65);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(220,20,20,${(this.hurtFlash / 0.35) * 0.55})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawPortal(ctx: CanvasRenderingContext2D, portal: PortalDef): void {
    const locked = !!this.portalLock(portal);
    const x = portal.x, y = this.portalY(portal);
    const c = locked ? '#8a8a9a' : '#8fd8ff';
    // base de pedra
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a8478';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!locked) glow(ctx, x, y - 26, 46, c, 0.35 + Math.sin(this.time * 3) * 0.08);
    // anéis girando
    for (let k = 0; k < 3; k++) {
      const ph = this.time * (1.5 + k * 0.5) + k * 2;
      ctx.globalAlpha = locked ? 0.35 : 0.85 - k * 0.2;
      ctx.strokeStyle = k === 0 ? '#ffffff' : c;
      ctx.lineWidth = 2.5 - k * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y - 26, 12 + k * 3 + Math.sin(ph) * 1.5, 24 - k * 2, 0, ph, ph + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.globalAlpha = locked ? 0.3 : 0.55;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y - 26, 10, 21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (!locked) {
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        const ph = (this.time * 0.8 + k / 4) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.fillRect(x + Math.sin(k * 2 + this.time) * 8, y - 6 - ph * 44, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawNpc(ctx: CanvasRenderingContext2D, n: World['npcs'][number]): void {
    const gy = n.y;
    const p = this.player;
    const near = Math.abs(p.x - n.x) < 90 && Math.abs(p.y - n.y) < 50;
    const working = n.def.idle === 'hammer' && !near;
    const facing = working ? 1 : p.x < n.x ? -1 : 1;
    if (n.def.idle === 'hammer') {
      // bigorna
      const ax = n.x + 20, ay = gy + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ax, ay, 11, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a4f5a';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ax - 4, ay); ctx.lineTo(ax - 2, ay - 6); ctx.lineTo(ax - 9, ay - 9); ctx.lineTo(ax - 9, ay - 12);
      ctx.lineTo(ax + 10, ay - 12); ctx.lineTo(ax + 6, ay - 7); ctx.lineTo(ax + 3, ay - 6); ctx.lineTo(ax + 5, ay);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // faíscas da batida
      const c = (this.time * 1.3 + n.seed) % 1;
      if (working && c > 0.62 && c < 0.72) {
        ctx.fillStyle = '#ffd36b';
        for (let k = 0; k < 5; k++) ctx.fillRect(ax - 2 + Math.cos(k * 1.3) * (c - 0.6) * 90, ay - 13 - Math.abs(Math.sin(k * 2.1)) * (c - 0.6) * 70, 1.6, 1.6);
      }
    }
    if (spritesReady() && hasSprite(n.def.sprite)) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(n.x, gy, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const bob = 1 + Math.sin(this.time * 2.5 + n.seed) * 0.02;
      drawSprite(ctx, n.def.sprite, 0, n.x, gy + 1, facing, { sy: bob });
    } else {
      drawHuman(ctx, n.x, gy, facing, n.look, npcPose(working ? 'hammer' : n.def.idle === 'hammer' ? 'still' : n.def.idle, this.time, n.seed));
    }
    text(ctx, n.def.name, n.x, gy - 58, { size: 10, align: 'center' });
    const mark = this.hooks.questMark(n.def.id);
    if (mark) {
      const bob = Math.sin(this.time * 4) * 2;
      ctx.fillStyle = mark === '?' ? '#8fe07a' : '#ffd36b';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, gy - 76 + bob, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text(ctx, mark, n.x, gy - 75 + bob, { size: 12, align: 'center', color: '#1d1a24', outline: false });
    }
  }

  /** Jogador em pixel art: escolhe a animação pelo estado. */
  private drawPlayerSprite(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const L = dollLook(this.progress);
    const kind = L.weaponKind;
    // animação do rig (as mesmas 10 animações das spritesheets em camadas)
    const frameOf = (t: number, anim: RigAnim) => Math.min(rigFrames(anim) - 1, Math.floor(Math.max(0, t) * rigFrames(anim)));
    let anim: RigAnim = 'idle', i = this.time * rigFps('idle'), charge = 0;
    if (p.dead) { anim = 'death'; i = Math.min(7, p.deadAnim * rigFps('death')); }
    else if (p.castAnim && p.hitStun <= 0) { anim = 'atk3'; const t = p.castT / p.castDur; i = frameOf(t, anim); charge = Math.sin(Math.min(1, t) * Math.PI); }
    else if (p.anim) {
      anim = p.anim === 'combo0' ? 'atk1' : p.anim === 'combo1' ? 'atk2' : 'atk3';
      const t = p.animT / p.animDur;
      i = frameOf(t, anim);
      if (anim === 'atk3' && p.anim !== 'combo2') charge = Math.sin(Math.min(1, t) * Math.PI) * 0.6;
    } else if (p.hitStun > 0) { anim = 'hurt'; i = this.time * rigFps('hurt'); }
    else if (p.climbing) { anim = 'walk'; i = p.walk; }
    else if (!p.onGround) {
      if (p.vy < 0) { anim = 'jump'; i = p.vy < -260 ? 1 : p.vy < -120 ? 2 : 3; }
      else { anim = 'fall'; i = this.time * rigFps('fall'); }
    } else if (p.moving) { anim = p.dash ? 'run' : 'walk'; i = p.walk; }
    else if (p.landT > 0) { anim = 'land'; i = (1 - p.landT / 0.2) * 4; }
    const pose: DollPose = { ...rigPose(L, anim, i), charge };
    // sombra na superfície embaixo (mesmo pulando)
    const below = this.terrain.surfacesAt(p.x).find((y) => y >= p.y - 1) ?? p.y;
    const lift = below - p.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, below, 13 * Math.max(0.35, 1 - lift / 160), 4 * Math.max(0.35, 1 - lift / 160), 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.shieldT > 0) {
      const a = Math.min(1, p.shieldT) * (0.55 + Math.sin(this.time * 6) * 0.1);
      glow(ctx, p.x, p.y - 24, 46, '#ffe08a', a * 0.6);
      ctx.strokeStyle = `rgba(255,232,140,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 24, 26, 32, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // na escada: vira de um lado para o outro ao subir (mão por mão)
    const face = p.climbing ? (Math.floor(p.walk * 0.6) % 2 ? 1 : -1) : p.facing;
    if (p.empowerT > 0) {
      // sombras repetindo o movimento atrás do personagem
      for (let k = 1; k <= 2; k++) drawDoll(ctx, L, p.x - p.facing * k * 14, p.y + 1, face, 1, { ...pose, alpha: 0.3 / k, flash: true }, this.time);
      glow(ctx, p.x, p.y - 22, 40, '#a06bff', 0.3);
    }
    // rastro da arma no golpe
    if (p.anim && !p.dead && kind !== 'bow') {
      const t = p.animT / p.animDur;
      if (t > 0.15 && t < 0.75) {
        ctx.strokeStyle = L.weaponColor;
        ctx.globalAlpha = 0.45 * Math.sin(((t - 0.15) / 0.6) * Math.PI);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x + p.facing * 6, p.y - 24, 24, p.facing > 0 ? -1.6 : Math.PI + 1.6, p.facing > 0 ? 0.9 : Math.PI - 0.9, p.facing < 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    drawDoll(ctx, L, p.x, p.y + 1, face, 1, { ...pose, flash: p.flash > 0 }, this.time);
  }

  /** Inimigo em pixel art: um quadro só, animado com quique, preparo, bote e queda. */
  /** Chefe com animação completa: parado, andar/avançar, ataque 1/2/3, dano e morte. */
  private drawBossSprite(ctx: CanvasRenderingContext2D, e: Enemy, windup: number): void {
    const pre = `boss_${e.def.bossAnim}_`;
    const t = this.time + e.seed;
    let anim = 'idle', frame = t * 2, sy = 1 + Math.sin(t * 2.5) * 0.015, ox = 0, alpha = 1;
    if (e.dead) {
      anim = 'death';
      const k = 1 - Math.max(0, e.deadTimer) / 1.1;
      frame = Math.min(frameCount(pre + anim) - 1e-3, k * frameCount(pre + anim) * 1.4);
      alpha = Math.min(1, (1 - k) * 2.5);
    } else if (e.hitStun > 0 || e.flash > 0.05) {
      anim = 'hit'; frame = 0;
    } else if (e.state === 'ability' || e.strike > 0.5 && e.state === 'recover' && e.ability >= 0 && e.timer > 0.5) {
      anim = 'atk3';
      frame = Math.min(frameCount(pre + anim) - 1e-3, windup * frameCount(pre + anim));
    } else if (e.state === 'charging') {
      anim = 'walk'; frame = t * 12; ox = e.facing * 3;
    } else if (e.state === 'windup' || e.strike > 0) {
      anim = e.atkAlt % 2 ? 'atk2' : 'atk1';
      const n = frameCount(pre + anim);
      frame = e.state === 'windup' ? Math.min(n - 1, windup * n * 0.6) : n - 1e-3;
      if (e.strike > 0) ox = e.facing * e.strike * 8;
    } else if (e.moving) {
      anim = 'walk'; frame = t * 4;
    }
    const name = pre + anim;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.radius * 1.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    drawSprite(ctx, hasSprite(name) ? name : pre + 'idle', frame, e.x + ox, e.y + 2, e.facing, { sy, alpha, flash: e.flash > 0 && !e.dead });
  }

  private drawEnemySprite(ctx: CanvasRenderingContext2D, e: Enemy, windup: number): void {
    const d = e.def;
    const name = d.sprite!;
    const t = this.time + e.seed;
    let sx = 1, sy = 1, ox = 0, oy = 0, rot = 0;
    if (d.shape === 'blob') {
      if (e.moving) { const ph = (t * 2.6) % 1; oy = -Math.sin(ph * Math.PI) * 7; sy = ph < 0.12 || ph > 0.9 ? 0.85 : 1.08; sx = 2 - sy; }
      else { sy = 1 + Math.sin(t * 4) * 0.04; sx = 2 - sy; }
    } else if (d.shape === 'flyer') {
      oy = -e.radius * 1.8 + Math.sin(t * 5) * 4;
      rot = Math.sin(t * 9) * 0.06;
    } else if (e.moving) {
      oy = -Math.abs(Math.sin(t * 10)) * 2.5;
      rot = Math.sin(t * 10) * 0.04;
    } else {
      sy = 1 + Math.sin(t * 2.5) * 0.02;
    }
    if (windup > 0) { sx *= 1 + windup * 0.12; sy *= 1 - windup * 0.12; ox += Math.sin(t * 70) * windup * 1.5; }
    if (e.strike > 0) { ox += e.facing * e.strike * e.radius * 0.7; rot += e.facing * 0.12 * e.strike; }
    let alpha = 1;
    if (e.dead) {
      const k = 1 - Math.max(0, e.deadTimer) / 0.5;
      alpha = 1 - k;
      rot += -e.facing * k * 0.8;
      sy *= 1 - k * 0.3;
    }
    if (d.shape !== 'flyer') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.radius * 1.1 * (d.spriteScale ?? 1) ** 0.5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawSprite(ctx, name, 0, e.x + ox, e.y + oy + 1, e.facing, { scale: d.spriteScale, sx, sy, rot, alpha, flash: e.flash > 0 });
  }

  /** Aviso no chão antes de um ataque especial: dá tempo de fugir. */
  private drawTelegraph(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const a = e.def.abilities?.[e.ability];
    if (!a) return;
    const k = e.state === 'ability' ? Math.min(1, 1 - Math.max(0, e.timer) / a.windup) : 1;
    const gy = e.y;
    ctx.save();
    switch (a.kind) {
      case 'slam': {
        ctx.fillStyle = `rgba(255,60,40,${0.12 + 0.18 * k})`;
        ctx.strokeStyle = 'rgba(255,80,60,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(e.x, gy, a.radius, a.radius * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,60,40,0.3)';
        ctx.beginPath();
        ctx.ellipse(e.x, gy, a.radius * k, a.radius * 0.22 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'charge': {
        if (e.state !== 'ability' || !e.target) break;
        const dir = Math.sign(e.target.x - e.x) || e.facing;
        const ex = e.target.x + dir * 140, ey = gy;
        ctx.fillStyle = `rgba(255,60,40,${0.1 + 0.2 * k})`;
        ctx.strokeStyle = 'rgba(255,80,60,0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(e.x, gy - 26); ctx.lineTo(ex, ey - 26); ctx.lineTo(ex, ey + 2); ctx.lineTo(e.x, gy + 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // setas
        ctx.fillStyle = 'rgba(255,90,70,0.8)';
        for (let i = 1; i <= 3; i++) {
          const t = ((i / 4 + this.time * 1.5) % 1);
          const ax = e.x + (ex - e.x) * t, ay = gy - 12;
          ctx.beginPath();
          ctx.moveTo(ax + dir * 8, ay); ctx.lineTo(ax - dir * 4, ay - 6); ctx.lineTo(ax - dir * 4, ay + 6);
          ctx.fill();
        }
        break;
      }
      case 'shoot': {
        const lift = e.def.shape === 'flyer' ? e.radius * 2.6 : e.radius * 1.2;
        glow(ctx, e.x + e.facing * e.radius * 0.7, gy - lift, 14 + 20 * k, a.color, 0.6);
        break;
      }
      case 'summon': {
        ctx.strokeStyle = `rgba(196,155,255,${0.4 + 0.5 * k})`;
        ctx.lineWidth = 2;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(e.x + side * 60, gy, 16 * k + 4, (16 * k + 4) * 0.4, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const gy = e.y;
    if (!e.dead && e.def.aura) {
      const pulse = 0.8 + Math.sin(this.time * 3 + e.seed) * 0.2;
      const lift = e.def.shape === 'flyer' ? e.radius * 2.6 : e.radius;
      glow(ctx, e.x, gy - lift, e.radius * 2.4 * pulse, e.enraged ? '#ff3030' : e.def.aura, e.enraged ? 0.45 : 0.3);
    }
    const abilityK = e.state === 'ability' && e.ability >= 0 ? 1 - Math.max(0, e.timer) / e.def.abilities![e.ability].windup : 0;
    const windupK = e.state === 'windup' ? 1 - Math.max(0, e.timer) / e.def.windup : Math.min(1, abilityK);
    if (spritesReady() && e.def.bossAnim && hasSprite(`boss_${e.def.bossAnim}_idle`)) this.drawBossSprite(ctx, e, windupK);
    else if (spritesReady() && hasSprite(e.def.sprite)) this.drawEnemySprite(ctx, e, windupK);
    else drawMonster(ctx, e.def.shape, e.x, gy, e.radius, e.def.color, e.facing, {
      t: this.time + e.seed,
      windup: windupK,
      moving: e.moving,
      strike: e.strike,
      hurt: e.hitStun > 0,
      dying: e.dead ? 1 - Math.max(0, e.deadTimer) / 0.5 : 0,
      flash: e.flash > 0,
    });
    if (e.dead) return;
    const top = gy - enemyBox(e).top + 6;
    if (e.state === 'windup') text(ctx, '!', e.x, gy - top - 6, { size: 16, align: 'center', color: '#ff5050' });
    if (e.state === 'ability') text(ctx, '!!', e.x, gy - top - 8, { size: 20, align: 'center', color: '#ff3030' });
    if (!e.def.boss && e.hp < e.maxHp) bar(ctx, e.x - 16, gy + 6, 32, 4, e.hp / e.maxHp, '#ff5f5f');
    if (!e.def.boss) text(ctx, `Nv ${e.level}`, e.x, gy + 16, { size: 8, align: 'center', color: levelColor(e.level, this.progress.level) });
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const blink = !p.dead && p.invuln > 0 && p.anim !== 'thunder' && Math.floor(this.time * 20) % 2 === 0;
    if (blink) return;
    if (spritesReady()) return this.drawPlayerSprite(ctx);
    const pose = playerPose({
      action: p.anim, actionT: p.animT, actionDur: p.animDur, moving: p.moving, walk: p.walk, air: !p.onGround && !p.dead, vy: p.vy,
      hurt: p.hitStun > 0, dead: p.dead, deadAnim: p.deadAnim,
    }, this.time);
    // sombra na superfície embaixo do jogador (mesmo pulando)
    const below = this.terrain.surfacesAt(p.x).find((y) => y >= p.y - 1) ?? p.y;
    pose.bodyY += p.y - below;
    drawHuman(ctx, p.x, below, p.facing, this.playerLook, pose, p.flash > 0);
  }
}
