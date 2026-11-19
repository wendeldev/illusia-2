import { getEnemy, getItem, getNpc, SKILLS } from '../data';
import type { SoundName } from '../engine/audio';
import type { Input } from '../engine/input';
import { VIEW_W, VIEW_H } from '../engine/view';
import type { EnemyDef, HumanLook, NpcDef, PortalDef, SkillDef, StageDef } from '../types';
import { drawHuman, OUTLINE } from './art/human';
import { drawMonster } from './art/monsters';
import { glow } from './art/scene3d';
import { Scenery } from './art/scenery';
import { npcLook, npcPose, playerLook, playerPose, type ActionAnim } from './art/poses';
import { bar, text } from './draw';
import type { Progress } from './progress';
import { calcDamage, computeStats, expToNext, type Stats } from './stats';

/** Y da tela onde começa o chão; y do mundo (0..depth) é somado a isto. */
export const GROUND_TOP = 200;
const PLAYER_SPEED = 130;

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
  save(): void;
  sound(name: SoundName): void;
  vibrate(ms: number): void;
}

interface Body {
  x: number;
  y: number;
  vx: number;
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
}

export interface Enemy extends Body {
  def: EnemyDef;
  state: 'chase' | 'windup' | 'recover';
  timer: number;
  dead: boolean;
  deadTimer: number;
  seed: number;
  /** 1→0 logo após golpear (animação de bote) */
  strike: number;
  moving: boolean;
}

interface Projectile {
  x: number;
  y: number;
  dir: number;
  dist: number;
  skill: SkillDef;
  hit: Set<Enemy>;
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

export class World {
  player: Player;
  stats: Stats;
  scenery: Scenery;
  npcs: { def: NpcDef; x: number; y: number; look: HumanLook; seed: number }[];
  playerLook: HumanLook;
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private texts: FloatText[] = [];
  private effects: Effect[] = [];
  private particles: Particle[] = [];
  /** congela o mundo por instantes no impacto (sensação de peso) */
  private hitStop = 0;
  private shakeT = 0;
  private shakeDur = 1;
  private shakeMag = 0;
  private hurtFlash = 0;
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
    this.scenery = new Scenery(stage);
    this.npcs = stage.npcs.map((n, i) => {
      const def = getNpc(n.npcId);
      return { def, x: n.x, y: n.y, look: npcLook(def.look), seed: i * 1.7 };
    });
    this.playerLook = playerLook(progress);
    this.player = {
      x: stage.spawn.x, y: stage.spawn.y, vx: 0, facing: 1, radius: 14,
      hp: Math.min(keep?.hp ?? this.stats.maxHp, this.stats.maxHp), maxHp: this.stats.maxHp,
      mp: Math.min(keep?.mp ?? this.stats.maxMp, this.stats.maxMp), maxMp: this.stats.maxMp,
      hitStun: 0, flash: 0, attackTimer: 0, comboStep: 0, comboWindow: 0,
      anim: null, animT: 0, animDur: 1, moving: false, deadAnim: 0, pending: null,
      cooldowns: {}, invuln: 0, dead: false, deadTimer: 0, walk: 0, buffered: null, bufferT: 0,
    };
    this.camX = this.cameraTarget();
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
    p.mp = Math.min(p.maxMp, p.mp + dt * 2.5);
    for (const id in p.cooldowns) p.cooldowns[id] = Math.max(0, p.cooldowns[id] - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    if (p.dead) {
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
  }

  private cameraTarget(): number {
    return Math.max(0, Math.min(this.stage.width - VIEW_W, this.player.x - VIEW_W / 2));
  }

  private updatePlayer(dt: number, input: Input): void {
    const p = this.player;
    p.comboWindow -= dt;
    if (p.comboWindow <= 0) p.comboStep = 0;

    if (p.hitStun > 0) {
      p.hitStun -= dt;
    } else if (p.attackTimer > 0) {
      p.attackTimer -= dt;
    } else {
      const ax = input.axis;
      p.x += ax.x * PLAYER_SPEED * dt;
      p.y += ax.y * PLAYER_SPEED * 0.7 * dt;
      if (Math.abs(ax.x) > 0.15) p.facing = Math.sign(ax.x);
      p.moving = ax.x !== 0 || ax.y !== 0;
      if (p.moving) p.walk += dt * 11;
    }
    if (p.hitStun > 0 || p.attackTimer > 0) p.moving = false;
    p.x += p.vx * dt;
    p.vx *= Math.pow(0.002, dt);
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

    const minX = this.waveActive ? this.camX + 16 : 16;
    const maxX = this.waveActive ? this.camX + VIEW_W - 16 : this.stage.width - 16;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.y = Math.max(0, Math.min(this.stage.depth, p.y));

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

  private readCommands(input: Input): void {
    const p = this.player;
    if (input.consume('attack')) {
      const queued = p.buffered?.kind === 'attack' ? p.buffered.count : 0;
      p.buffered = { kind: 'attack', count: Math.min(2, queued + 1) };
      p.bufferT = 0.35;
    }
    SKILLS.forEach((skill, i) => {
      if (input.consume(`skill${i + 1}` as 'skill1')) { p.buffered = { kind: 'skill', skill }; p.bufferT = 0.35; }
    });
  }

  private basicAttack(): void {
    const p = this.player;
    const step = COMBO[p.comboStep % COMBO.length];
    p.comboStep = (p.comboStep + 1) % COMBO.length;
    p.comboWindow = 0.55;
    p.attackTimer = step.time;
    this.startAnim((['combo0', 'combo1', 'combo2'] as const)[COMBO.indexOf(step)], step.time + 0.06);
    p.vx = p.facing * 40;
    const finisher = step === COMBO[COMBO.length - 1];
    this.sound('swing');
    const hits = this.hitFront(step.range, step.mul, step.knock, 22, finisher);
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
    p.cooldowns[skill.id] = skill.cooldown;
    p.attackTimer = 0.3;
    switch (skill.kind) {
      case 'projectile':
        this.startAnim('wind', 0.3);
        this.sound('wind');
        this.projectiles.push({ x: p.x + p.facing * 20, y: p.y, dir: p.facing, dist: 0, skill, hit: new Set() });
        break;
      case 'aoe':
        this.startAnim('whirl', 0.4);
        p.attackTimer = 0.4;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = (e.y - p.y) * 2;
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

  private startAnim(kind: ActionAnim, dur: number): void {
    const p = this.player;
    p.anim = kind;
    p.animT = 0;
    p.animDur = dur;
  }

  /** Golpe à frente do jogador. Retorna quantos inimigos acertou. */
  private hitFront(range: number, mul: number, knock: number, depth = 22, heavy = false): number {
    const p = this.player;
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx > -12 && dx < range + e.radius && Math.abs(e.y - p.y) < depth + e.radius * 0.5) {
        this.damageEnemy(e, mul, knock * p.facing, heavy);
        hits++;
      }
    }
    return hits;
  }

  private damageEnemy(e: Enemy, mul: number, knock: number, heavy = false): void {
    const crit = Math.random() < this.stats.crit;
    const dmg = calcDamage(this.stats.atk, e.def.def, mul) * (crit ? 2 : 1);
    e.hp -= dmg;
    e.flash = 0.1;
    const resist = e.def.boss ? 0.15 : 1;
    e.hitStun = e.def.boss ? 0.06 : 0.28;
    e.vx = knock * resist;
    if (!e.def.boss && e.state === 'windup') { e.state = 'recover'; e.timer = 0.4; }
    const bodyZ = e.def.shape === 'flyer' ? e.radius * 2.6 : e.radius * 1.2;
    this.floatText(e.x, GROUND_TOP + e.y - e.radius * 2.6, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd36b' : '#fff', crit ? 19 : heavy ? 16 : 13);
    this.burst(e.x - Math.sign(knock) * e.radius * 0.4, e.y, bodyZ, crit ? 12 : 6, crit ? '#ffd36b' : '#ffffff', crit ? 240 : 170, 2.2);
    if (crit) { this.sound('crit'); this.shake(3, 0.12); this.freeze(0.07); }
    else this.sound('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    e.deadTimer = 0.5;
    const pr = this.progress;
    pr.exp += e.def.exp;
    pr.gold += e.def.gold;
    const recent = this.texts.filter((t) => t.color === '#9ff0a0' && t.life > 0.5).length;
    this.floatText(e.x, GROUND_TOP + e.y - 10 + recent * 12, `+${e.def.exp} EXP  +${e.def.gold} G`, '#9ff0a0', 10, 0.9);
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
    let leveled = false;
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
      const unlocked = SKILLS.find((s) => s.unlockLevel === pr.level);
      if (unlocked) this.hooks.toast(`Novo poder: ${unlocked.name}`);
    }
    this.hooks.save();
  }

  private updateEnemy(e: Enemy, dt: number): void {
    e.flash = Math.max(0, e.flash - dt);
    e.strike = Math.max(0, e.strike - dt * 4);
    e.moving = false;
    e.x += e.vx * dt;
    e.vx *= Math.pow(0.003, dt);
    e.x = Math.max(0, Math.min(this.stage.width, e.x));
    if (e.dead) { e.deadTimer -= dt; return; }
    if (e.hitStun > 0) { e.hitStun -= dt; return; }

    const p = this.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = e.def;
    if (e.state !== 'windup') e.facing = Math.sign(dx) || e.facing;

    if (e.state === 'windup') {
      e.timer -= dt;
      if (e.timer <= 0) {
        const reach = d.attackRange + p.radius;
        if (!p.dead && Math.abs(dx) < reach && Math.sign(dx) === e.facing && Math.abs(dy) < 18 + d.radius * 0.3) {
          this.hitPlayer(e);
        }
        e.state = 'recover';
        e.timer = d.attackCooldown;
        e.strike = 1;
      }
      return;
    }
    if (e.state === 'recover') {
      e.timer -= dt;
      if (e.timer <= 0) e.state = 'chase';
    }
    if (p.dead) return;

    // persegue: tenta ficar ao lado do jogador, na mesma "linha"
    const wobble = Math.sin(this.time * 1.5 + e.seed) * 10;
    const tx = p.x - Math.sign(dx || 1) * (d.attackRange * 0.7 + p.radius);
    const ty = p.y + wobble;
    const mx = tx - e.x, my = ty - e.y, ml = Math.hypot(mx, my);
    const speed = d.speed * (e.state === 'recover' ? 0.35 : 1);
    if (ml > 2) {
      e.x += (mx / ml) * speed * dt;
      e.y += (my / ml) * speed * 0.7 * dt;
      e.moving = true;
    }
    e.y = Math.max(0, Math.min(this.stage.depth, e.y));
    if (e.state === 'chase' && Math.abs(dx) < d.attackRange + p.radius && Math.abs(dy) < 14) {
      e.state = 'windup';
      e.timer = d.windup;
    }
  }

  private hitPlayer(e: Enemy): void {
    const p = this.player;
    if (p.invuln > 0) return;
    const dmg = calcDamage(e.def.atk, this.stats.def, 1);
    p.hp -= dmg;
    p.flash = 0.12;
    p.hitStun = 0.3;
    p.attackTimer = 0;
    p.invuln = 0.6;
    p.vx = e.facing * (e.def.boss ? 260 : 150);
    this.floatText(p.x, GROUND_TOP + p.y - 44, `-${dmg}`, '#ff6b6b', 15, 0.8);
    this.burst(p.x, p.y, 18, 8, '#ff6b6b', 160, 2.5);
    this.sound('hurt');
    this.hooks.vibrate(e.def.boss ? 90 : 40);
    this.shake(e.def.boss ? 9 : 5, 0.22);
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
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.5;
        const min = (a.radius + b.radius) * 0.8;
        const d = Math.hypot(dx, dy);
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          a.x -= (dx / d) * push; b.x += (dx / d) * push;
          a.y -= (dy / d) * push * 0.5; b.y += (dy / d) * push * 0.5;
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
        if (Math.abs(e.x - pr.x) < pr.skill.radius + e.radius && Math.abs(e.y - pr.y) < 20 + e.radius * 0.4) {
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
        this.hooks.save();
        this.hooks.toast('Fase concluída! Siga até o portal.');
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
        this.enemies.push({
          def, x, y: Math.random() * this.stage.depth, vx: 0, facing: fromLeft ? 1 : -1,
          radius: def.radius, hp: def.hp, hitStun: 0, flash: 0,
          state: 'chase', timer: 0, dead: false, deadTimer: 0, seed: Math.random() * 10, strike: 0, moving: false,
        });
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
    const close = (x: number, y: number) => Math.hypot(x - p.x, (y - p.y) * 1.6) < 44;
    for (const n of this.npcs) if (close(n.x, n.y)) return { kind: 'npc', npc: n.def, x: n.x, y: n.y };
    for (const portal of this.stage.portals) if (close(portal.x, portal.y)) return { kind: 'portal', portal, x: portal.x, y: portal.y };
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
    this.scenery.drawBackground(ctx, camX, this.time);

    ctx.save();
    ctx.translate(-camX, 0);

    for (const portal of s.portals) this.drawPortal(ctx, portal);

    // ordena por profundidade
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const n of this.npcs) list.push({ y: n.y, draw: () => this.drawNpc(ctx, n) });
    for (const prop of this.scenery.props) {
      list.push({ y: prop.y, draw: () => {
        ctx.save();
        ctx.translate(camX, 0);
        this.scenery.drawProp(ctx, prop, camX, this.time);
        ctx.restore();
      } });
    }
    for (const e of this.enemies) list.push({ y: e.y, draw: () => this.drawEnemy(ctx, e) });
    list.push({ y: this.player.y, draw: () => this.drawPlayer(ctx) });
    list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    for (const pr of this.projectiles) {
      const y = GROUND_TOP + pr.y - 22;
      if (Math.random() < 0.6) {
        this.particles.push({ x: pr.x - pr.dir * 8, y: pr.y, z: 22, vx: -pr.dir * 40, vy: 0, vz: (Math.random() - 0.5) * 60,
          life: 0.2, maxLife: 0.2, size: 2.5, color: pr.skill.color, gravity: 0 });
      }
      ctx.fillStyle = pr.skill.color;
      ctx.beginPath();
      ctx.ellipse(pr.x, y, pr.skill.radius * 1.4, pr.skill.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.min(1, (pt.life / pt.maxLife) * 1.5);
      ctx.fillStyle = pt.color;
      const sz = pt.size * (0.5 + 0.5 * pt.life / pt.maxLife);
      ctx.fillRect(pt.x - sz / 2, GROUND_TOP + pt.y - pt.z - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    for (const fx of this.effects) {
      const a = fx.life / fx.maxLife;
      ctx.globalAlpha = a;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth = fx.kind === 'ring' ? 5 : 4;
      ctx.beginPath();
      if (fx.kind === 'ring') {
        ctx.ellipse(fx.x, GROUND_TOP + fx.y, fx.radius * (1.2 - a * 0.4), fx.radius * 0.5 * (1.2 - a * 0.4), 0, 0, Math.PI * 2);
      } else {
        const cy = GROUND_TOP + fx.y - 22;
        const start = fx.dir > 0 ? -1.2 : Math.PI - 0.6;
        ctx.arc(fx.x, cy, fx.radius * 0.8, start, start + 1.8);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // primeiro plano, luz e atmosfera (por cima dos personagens, por baixo dos textos)
    this.scenery.drawForeground(ctx, camX, this.time, this.player);

    ctx.save();
    ctx.translate(-camX, 0);
    const near = this.nearby();
    if (near && !this.player.dead) {
      const label = near.kind === 'npc' ? `Falar com ${near.npc.name}` : (this.portalLock(near.portal) ? '🔒 ' : '→ ') + near.portal.label;
      text(ctx, label, near.x, GROUND_TOP + near.y - 58, { size: 11, align: 'center', color: '#ffe9a8' });
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
    const x = portal.x, y = GROUND_TOP + portal.y;
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
    const gy = GROUND_TOP + n.y;
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
    drawHuman(ctx, n.x, gy, facing, n.look, npcPose(working ? 'hammer' : n.def.idle === 'hammer' ? 'still' : n.def.idle, this.time, n.seed));
    text(ctx, n.def.name, n.x, gy - 58, { size: 10, align: 'center' });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const gy = GROUND_TOP + e.y;
    drawMonster(ctx, e.def.shape, e.x, gy, e.radius, e.def.color, e.facing, {
      t: this.time + e.seed,
      moving: e.moving,
      windup: e.state === 'windup' ? 1 - Math.max(0, e.timer) / e.def.windup : 0,
      strike: e.strike,
      hurt: e.hitStun > 0,
      dying: e.dead ? 1 - Math.max(0, e.deadTimer) / 0.5 : 0,
      flash: e.flash > 0,
    });
    if (e.dead) return;
    const top = e.def.shape === 'flyer' ? e.radius * 4 : e.def.shape === 'mushroom' ? e.radius * 2.9 : e.radius * 2.4;
    if (e.state === 'windup') text(ctx, '!', e.x, gy - top - 6, { size: 16, align: 'center', color: '#ff5050' });
    if (!e.def.boss && e.hp < e.def.hp) bar(ctx, e.x - 16, gy + 6, 32, 4, e.hp / e.def.hp, '#ff5f5f');
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const blink = !p.dead && p.invuln > 0 && p.anim !== 'thunder' && Math.floor(this.time * 20) % 2 === 0;
    if (blink) return;
    const pose = playerPose({
      action: p.anim, actionT: p.animT, actionDur: p.animDur, moving: p.moving, walk: p.walk,
      hurt: p.hitStun > 0, dead: p.dead, deadAnim: p.deadAnim,
    }, this.time);
    drawHuman(ctx, p.x, GROUND_TOP + p.y, p.facing, this.playerLook, pose, p.flash > 0);
  }
}
