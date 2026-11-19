import { getEnemy, getItem, getNpc, SKILLS } from '../data';
import type { Input } from '../engine/input';
import { VIEW_W, VIEW_H } from '../engine/view';
import type { EnemyDef, NpcDef, PortalDef, SkillDef, StageDef } from '../types';
import { bar, circle, humanoid, monster, shade, text } from './draw';
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
  swing: number;
  comboStep: number;
  comboWindow: number;
  cooldowns: Record<string, number>;
  invuln: number;
  dead: boolean;
  deadTimer: number;
  walk: number;
}

export interface Enemy extends Body {
  def: EnemyDef;
  state: 'chase' | 'windup' | 'recover';
  timer: number;
  dead: boolean;
  deadTimer: number;
  seed: number;
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
  npcs: { def: NpcDef; x: number; y: number }[];
  enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private texts: FloatText[] = [];
  private effects: Effect[] = [];
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
    this.npcs = stage.npcs.map((n) => ({ def: getNpc(n.npcId), x: n.x, y: n.y }));
    this.player = {
      x: stage.spawn.x, y: stage.spawn.y, vx: 0, facing: 1, radius: 14,
      hp: Math.min(keep?.hp ?? this.stats.maxHp, this.stats.maxHp), maxHp: this.stats.maxHp,
      mp: Math.min(keep?.mp ?? this.stats.maxMp, this.stats.maxMp), maxMp: this.stats.maxMp,
      hitStun: 0, flash: 0, attackTimer: 0, swing: 0, comboStep: 0, comboWindow: 0,
      cooldowns: {}, invuln: 0, dead: false, deadTimer: 0, walk: 0,
    };
    this.camX = this.cameraTarget();
  }

  /** Recalcula atributos depois de trocar equipamento ou subir de nível. */
  refreshStats(fullHeal = false): void {
    const old = this.stats;
    this.stats = computeStats(this.progress);
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

  get boss(): Enemy | undefined {
    return this.enemies.find((e) => e.def.boss && !e.dead);
  }

  // ───────────────────────── atualização ─────────────────────────

  update(dt: number, input: Input, active: boolean): void {
    this.time += dt;
    const p = this.player;
    p.mp = Math.min(p.maxMp, p.mp + dt * 2.5);
    for (const id in p.cooldowns) p.cooldowns[id] = Math.max(0, p.cooldowns[id] - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.invuln = Math.max(0, p.invuln - dt);

    if (p.dead) {
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
      if (ax.x !== 0 || ax.y !== 0) p.walk += dt * 10;
    }
    p.x += p.vx * dt;
    p.vx *= Math.pow(0.002, dt);
    p.swing = Math.max(0, p.swing - dt);

    const minX = this.waveActive ? this.camX + 16 : 16;
    const maxX = this.waveActive ? this.camX + VIEW_W - 16 : this.stage.width - 16;
    p.x = Math.max(minX, Math.min(maxX, p.x));
    p.y = Math.max(0, Math.min(this.stage.depth, p.y));

    const canAct = p.hitStun <= 0 && p.attackTimer <= 0;
    if (input.consume('attack') && canAct) this.basicAttack();
    SKILLS.forEach((skill, i) => {
      if (input.consume(`skill${i + 1}` as 'skill1') && p.hitStun <= 0 && p.attackTimer <= 0) this.useSkill(skill);
    });
    if (input.consume('interact')) this.interact();
  }

  private basicAttack(): void {
    const p = this.player;
    const step = COMBO[p.comboStep % COMBO.length];
    p.comboStep = (p.comboStep + 1) % COMBO.length;
    p.comboWindow = 0.55;
    p.attackTimer = step.time;
    p.swing = step.time;
    p.vx = p.facing * 40;
    this.hitFront(step.range, step.mul, step.knock);
    this.effects.push({ kind: 'swing', x: p.x, y: p.y, dir: p.facing, radius: step.range, color: '#ffffff', life: 0.15, maxLife: 0.15 });
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
      return;
    }
    p.mp -= skill.mpCost;
    p.cooldowns[skill.id] = skill.cooldown;
    p.attackTimer = 0.3;
    p.swing = 0.3;
    switch (skill.kind) {
      case 'projectile':
        this.projectiles.push({ x: p.x + p.facing * 20, y: p.y, dir: p.facing, dist: 0, skill, hit: new Set() });
        break;
      case 'aoe':
        for (const e of this.enemies) {
          if (e.dead) continue;
          const dx = e.x - p.x, dy = (e.y - p.y) * 2;
          if (dx * dx + dy * dy <= (skill.radius + e.radius) ** 2) {
            this.damageEnemy(e, skill.damageMul, skill.knockback * (Math.sign(dx) || p.facing));
          }
        }
        this.effects.push({ kind: 'ring', x: p.x, y: p.y, dir: 1, radius: skill.radius, color: skill.color, life: 0.35, maxLife: 0.35 });
        break;
      case 'melee':
        this.hitFront(skill.range, skill.damageMul, skill.knockback, skill.radius);
        this.effects.push({ kind: 'swing', x: p.x, y: p.y, dir: p.facing, radius: skill.range, color: skill.color, life: 0.3, maxLife: 0.3 });
        break;
    }
  }

  private hitFront(range: number, mul: number, knock: number, depth = 22): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx > -12 && dx < range + e.radius && Math.abs(e.y - p.y) < depth + e.radius * 0.5) {
        this.damageEnemy(e, mul, knock * p.facing);
      }
    }
  }

  private damageEnemy(e: Enemy, mul: number, knock: number): void {
    const crit = Math.random() < this.stats.crit;
    const dmg = calcDamage(this.stats.atk, e.def.def, mul) * (crit ? 2 : 1);
    e.hp -= dmg;
    e.flash = 0.1;
    const resist = e.def.boss ? 0.15 : 1;
    e.hitStun = e.def.boss ? 0.06 : 0.28;
    e.vx = knock * resist;
    if (!e.def.boss && e.state === 'windup') { e.state = 'recover'; e.timer = 0.4; }
    this.texts.push({ x: e.x, y: GROUND_TOP + e.y - e.radius * 2.6, text: crit ? `${dmg}!` : `${dmg}`, color: crit ? '#ffd36b' : '#fff', life: 0.7 });
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    e.dead = true;
    e.deadTimer = 0.5;
    const pr = this.progress;
    pr.exp += e.def.exp;
    pr.gold += e.def.gold;
    this.texts.push({ x: e.x, y: GROUND_TOP + e.y - 10, text: `+${e.def.exp} EXP  +${e.def.gold} G`, color: '#9ff0a0', life: 1 });
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
      const unlocked = SKILLS.find((s) => s.unlockLevel === pr.level);
      if (unlocked) this.hooks.toast(`Novo poder: ${unlocked.name}`);
    }
    this.hooks.save();
  }

  private updateEnemy(e: Enemy, dt: number): void {
    e.flash = Math.max(0, e.flash - dt);
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
    this.texts.push({ x: p.x, y: GROUND_TOP + p.y - 44, text: `-${dmg}`, color: '#ff6b6b', life: 0.8 });
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
          state: 'chase', timer: 0, dead: false, deadTimer: 0, seed: Math.random() * 10,
        });
      }
    }
    if (wave.enemies.some((g) => getEnemy(g.enemyId).boss)) this.hooks.toast('Um chefe apareceu!');
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
    ctx.fillStyle = s.sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // fundo com paralaxe
    const farX = this.camX * 0.35;
    ctx.fillStyle = s.far;
    for (let k = Math.floor(farX / 160) - 1; k < Math.floor((farX + VIEW_W) / 160) + 2; k++) {
      const h = 50 + (((k * 37) % 5) + 5) % 5 * 14;
      const x = k * 160 - farX;
      ctx.beginPath();
      ctx.moveTo(x - 40, GROUND_TOP - 8);
      ctx.lineTo(x + 80, GROUND_TOP - 8 - h);
      ctx.lineTo(x + 200, GROUND_TOP - 8);
      ctx.fill();
    }
    ctx.fillStyle = shade(s.ground, -0.12);
    ctx.fillRect(0, GROUND_TOP - 14, VIEW_W, 14);
    ctx.fillStyle = s.ground;
    ctx.fillRect(0, GROUND_TOP - 6, VIEW_W, VIEW_H);
    ctx.fillStyle = shade(s.ground, 0.06);
    for (let k = Math.floor(this.camX / 90); k < Math.floor((this.camX + VIEW_W) / 90) + 1; k++) {
      const x = k * 90 - this.camX;
      ctx.fillRect(x, GROUND_TOP + ((k * 53) % s.depth), 26, 4);
    }

    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);

    for (const portal of s.portals) this.drawPortal(ctx, portal);

    // ordena por profundidade
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const n of this.npcs) list.push({ y: n.y, draw: () => this.drawNpc(ctx, n) });
    for (const e of this.enemies) list.push({ y: e.y, draw: () => this.drawEnemy(ctx, e) });
    list.push({ y: this.player.y, draw: () => this.drawPlayer(ctx) });
    list.sort((a, b) => a.y - b.y).forEach((d) => d.draw());

    for (const pr of this.projectiles) {
      const y = GROUND_TOP + pr.y - 22;
      ctx.fillStyle = pr.skill.color;
      ctx.beginPath();
      ctx.ellipse(pr.x, y, pr.skill.radius * 1.4, pr.skill.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
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

    const near = this.nearby();
    if (near && !this.player.dead) {
      const label = near.kind === 'npc' ? `Falar com ${near.npc.name}` : (this.portalLock(near.portal) ? '🔒 ' : '→ ') + near.portal.label;
      text(ctx, label, near.x, GROUND_TOP + near.y - 58, { size: 11, align: 'center', color: '#ffe9a8' });
    }
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      text(ctx, t.text, t.x, t.y, { size: 13, align: 'center', color: t.color });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawPortal(ctx: CanvasRenderingContext2D, portal: PortalDef): void {
    const locked = !!this.portalLock(portal);
    const y = GROUND_TOP + portal.y;
    const pulse = 0.8 + Math.sin(this.time * 3) * 0.2;
    ctx.globalAlpha = locked ? 0.35 : 0.8;
    ctx.fillStyle = locked ? '#666' : '#8fd8ff';
    ctx.beginPath();
    ctx.ellipse(portal.x, y - 24, 14 * pulse, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = locked ? '#999' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private drawNpc(ctx: CanvasRenderingContext2D, n: { def: NpcDef; x: number; y: number }): void {
    const gy = GROUND_TOP + n.y;
    const facing = this.player.x < n.x ? -1 : 1;
    humanoid(ctx, n.x, gy, 14, n.def.color, '#f1c9a5', facing, false, Math.sin(this.time * 2 + n.x) * 0.8);
    text(ctx, n.def.name, n.x, gy - 46, { size: 10, align: 'center' });
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    const gy = GROUND_TOP + e.y;
    if (e.dead) ctx.globalAlpha = Math.max(0, e.deadTimer / 0.5);
    monster(ctx, e.def.shape, e.x, gy, e.radius, e.def.color, e.facing, e.flash > 0, this.time + e.seed);
    ctx.globalAlpha = 1;
    if (e.dead) return;
    if (e.state === 'windup') text(ctx, '!', e.x, gy - e.radius * 3 - 6, { size: 16, align: 'center', color: '#ff5050' });
    if (!e.def.boss && e.hp < e.def.hp) bar(ctx, e.x - 16, gy + 6, 32, 4, e.hp / e.def.hp, '#ff5f5f');
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const gy = GROUND_TOP + p.y;
    const blink = p.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
    if (p.dead) ctx.globalAlpha = 0.5;
    if (!blink) {
      const bob = p.dead ? 0 : Math.abs(Math.sin(p.walk)) * -1.5;
      humanoid(ctx, p.x, gy, p.radius, '#3d6fd6', '#f1c9a5', p.facing, p.flash > 0, bob);
      // espada
      const ang = p.swing > 0 ? (-1.4 + (1 - p.swing / 0.3) * 2.4) : 0.9;
      const hx = p.x + p.facing * 9, hy = gy - 20;
      ctx.strokeStyle = '#dfe8f5';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + p.facing * Math.cos(ang) * 22, hy + Math.sin(ang) * 22);
      ctx.stroke();
      circle(ctx, hx, hy, 2.5, '#c99a3c');
    }
    ctx.globalAlpha = 1;
  }
}
