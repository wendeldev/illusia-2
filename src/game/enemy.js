import { MONSTERS } from '../data/monsters.js';
import { moveBody, groundAt, groundYBelow } from './physics.js';
import { cx, cy, sign, randi, pick, overlap } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

export class Enemy {
  constructor(game, type, x, spawner = null) {
    const d = MONSTERS[type];
    this.game = game; this.type = type; this.d = d; this.spawner = spawner;
    this.w = d.w; this.h = d.h;
    this.x = x; this.homeX = x;
    this.y = groundYBelow(game.map, x + d.w / 2) - d.h;
    if (d.ai === 'flyer') { this.y -= 70 + randi(0, 40); this.homeY = this.y; }
    this.vx = 0; this.vy = 0; this.face = -1;
    this.hp = d.hp; this.maxHp = d.hp; this.atk = d.atk;
    this.state = 'idle'; this.t = randi(20, 80); this.cool = randi(30, 90);
    this.stun = 0; this.frozen = 0; this.flash = 0; this.anim = randi(0, 100);
    this.alive = true; this.dead = 0;
    this.phase = 1; this.summoned = 0;
  }

  // Alvo: o jogador, ou o Cristal no modo Defesa quando ele estiver mais perto.
  get player() {
    const g = this.game, p = g.player, c = g.arena?.crystal;
    if (!c || !c.alive || !this.arena) return p;
    return Math.abs(cx(c) - cx(this)) < Math.abs(cx(p) - cx(this)) || p.state === 'dead' ? c : p;
  }

  update() {
    const g = this.game, p = this.player, d = this.d;
    this.anim++;
    if (this.flash > 0) this.flash--;
    if (!this.alive) { this.dead++; return; }

    if (this.stun > 0) {
      this.stun--;
      if (this.frozen > 0) this.frozen--;
      this.vx *= 0.85;
      moveBody(this, g.map, d.ai !== 'flyer');
      if (d.ai === 'flyer') this.vy *= 0.85;
      return;
    }
    if (this.cool > 0) this.cool--;

    const dx = cx(p) - cx(this), dy = cy(p) - cy(this);
    const adx = Math.abs(dx), ady = Math.abs(dy);
    const aggro = p.state !== 'dead' && ((adx < d.aggro && ady < 90) || this.arena);

    switch (d.ai) {
      case 'walker': this.walker(dx, adx, ady, aggro); break;
      case 'hopper': this.hopper(dx, aggro); break;
      case 'flyer': this.flyer(dx, dy, adx, aggro); break;
      case 'shooter': this.shooter(dx, dy, adx, aggro); break;
      case 'boss': this.boss(dx, adx); break;
    }

    if (d.ai !== 'flyer') moveBody(this, g.map);
    else { this.x += this.vx; this.y += this.vy; this.x = Math.max(0, Math.min(g.map.width - this.w, this.x)); }

    if (this.y > 420) this.alive = false;

    // dano por contato
    const mult = this.state === 'lunge' || this.state === 'charge' ? 1.3 : 1;
    const hero = g.player, crystal = g.arena?.crystal;
    if (hero.state !== 'dead' && overlap(this, hero)) hero.hurt(this.atk * mult, sign(cx(hero) - cx(this)));
    if (crystal && crystal.alive && this.arena && overlap(this, crystal)) crystal.hurt(this.atk * mult);
  }

  turnAtEdges() {
    const map = this.game.map;
    if (!this.onGround) return;
    const ahead = this.face > 0 ? this.x + this.w + 4 : this.x - 4;
    if (this.hitWall || !groundAt(map, ahead, this.y + this.h + 1)) {
      this.face = -this.face;
      this.vx = this.face * Math.abs(this.vx);
      return true;
    }
    return false;
  }

  walker(dx, adx, ady, aggro) {
    const d = this.d;
    if (this.state === 'windup') {
      this.t--; this.vx = 0;
      if (this.t <= 0) { this.state = 'lunge'; this.t = d.lunge.dur; this.vx = this.face * d.speed * d.lunge.speed; sfx('dash'); }
      return;
    }
    if (this.state === 'lunge') {
      this.t--;
      if (this.t <= 0 || this.hitWall) { this.state = 'walk'; this.cool = randi(70, 120); this.vx = 0; }
      return;
    }
    if (aggro) {
      this.face = sign(dx);
      this.vx = adx > 6 ? this.face * d.speed * 1.4 : 0;
      if (d.lunge && this.cool <= 0 && adx < (d.lunge.speed > 4 ? 200 : 70) && ady < 30) {
        this.state = 'windup'; this.t = d.lunge.wind; this.vx = 0;
      }
    } else {
      if (--this.t <= 0) {
        this.t = randi(60, 160);
        const m = pick([-1, 0, 1]);
        if (m) this.face = m;
        this.vx = m * d.speed;
        if (Math.abs(this.x - this.homeX) > 180) { this.face = sign(this.homeX - this.x); this.vx = this.face * d.speed; }
      }
    }
    if (this.turnAtEdges() && aggro) this.vx = 0;
  }

  hopper(dx, aggro) {
    const d = this.d;
    if (this.onGround) {
      this.vx *= 0.6;
      if (this.cool <= 0) {
        this.face = aggro ? sign(dx) : (Math.abs(this.x - this.homeX) > 150 ? sign(this.homeX - this.x) : pick([-1, 1]));
        this.vy = aggro ? -6.8 : -5;
        this.vx = this.face * d.speed * (aggro ? 2.2 : 1.4);
        this.cool = aggro ? randi(40, 70) : randi(70, 130);
      }
    }
    if (this.hitWall) this.vx = -this.vx;
  }

  flyer(dx, dy, adx, aggro) {
    const d = this.d;
    if (this.state === 'swoop') {
      this.t--;
      if (this.t <= 0) this.state = 'return';
    } else if (this.state === 'return') {
      const tx = this.homeX - this.x, ty = this.homeY - this.y;
      const dist = Math.hypot(tx, ty);
      this.vx = (tx / (dist || 1)) * d.speed * 1.4;
      this.vy = (ty / (dist || 1)) * d.speed * 1.4;
      if (dist < 10) { this.state = 'idle'; this.cool = randi(60, 110); }
    } else {
      if (this.arena) this.homeX += sign(dx) * 0.8;
      const tx = this.homeX + Math.sin(this.anim * 0.02) * 60 - this.x;
      const ty = this.homeY + Math.sin(this.anim * 0.07) * 14 - this.y;
      this.vx = tx * 0.03; this.vy = ty * 0.06;
      if (aggro && this.cool <= 0 && adx < d.aggro * 0.8) {
        this.state = 'swoop'; this.t = 46;
        const dist = Math.hypot(dx, dy) || 1;
        this.vx = (dx / dist) * d.speed * 2.6; this.vy = (dy / dist) * d.speed * 2.6;
      }
    }
    if (Math.abs(this.vx) > 0.1) this.face = sign(this.vx);
    if (this.y + this.h > 300) { this.y = 300 - this.h; this.vy = Math.min(0, this.vy); }
  }

  shooter(dx, dy, adx, aggro) {
    this.vx = 0;
    if (aggro) this.face = sign(dx);
    if (this.state === 'windup') {
      if (--this.t <= 0) {
        this.state = 'idle'; this.cool = randi(100, 140);
        const sp = 3.4;
        this.game.spawnProjectile({
          x: cx(this) + this.face * 10, y: this.y + 8, vx: this.face * sp, vy: Math.max(-1.5, Math.min(1.5, dy / 60)),
          r: 5, color: '#9be36a', life: 120, owner: 'enemy', dmg: this.atk, kind: 'seed',
        });
        sfx('magic');
      }
    } else if (aggro && this.cool <= 0) { this.state = 'windup'; this.t = 24; }
  }

  boss(dx, adx) {
    const g = this.game, d = this.d;
    if (this.hp < this.maxHp * 0.5 && this.phase === 1) {
      this.phase = 2; g.toast('O Golem enfurece!', '#ff9a6b'); g.shake(8); this.cool = 30;
    }
    const enraged = this.phase === 2;
    switch (this.state) {
      case 'idle': case 'walk': {
        this.face = sign(dx);
        this.vx = adx > 60 ? this.face * d.speed * (enraged ? 1.4 : 1) : 0;
        this.state = 'walk';
        if (this.cool <= 0) {
          const options = ['slam', 'shards'];
          if (enraged) options.push('charge', 'charge');
          if (enraged && this.summoned <= 0) options.push('summon');
          this.state = pick(options);
          this.t = { slam: 46, shards: 34, charge: 36, summon: 40 }[this.state];
          this.wind = this.t;
          this.vx = 0;
        }
        break;
      }
      case 'slam':
        this.vx = 0;
        if (--this.t <= 0) {
          g.shake(10); sfx('boom');
          g.fx.quake(cx(this), this.y + this.h, 120, '#9fe6ff');
          for (const dir of [-1, 1]) {
            g.spawnProjectile({ x: cx(this) + dir * 30, y: this.y + this.h - 18, vx: dir * 4.2, vy: 0, r: 9, color: '#9fe6ff', life: 90, owner: 'enemy', dmg: this.atk, kind: 'wave' });
          }
          this.endAttack(enraged);
        }
        break;
      case 'shards':
        this.vx = 0;
        if (--this.t <= 0) {
          sfx('magic');
          const n = enraged ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const tvx = (dx / 60) * (0.7 + i * 0.18);
            g.spawnProjectile({ x: cx(this), y: this.y + 10, vx: Math.max(-6, Math.min(6, tvx)), vy: -6 - i * 0.4, r: 6, color: '#c9f2ff', life: 140, owner: 'enemy', dmg: this.atk * 0.8, gravity: 0.22, kind: 'shard' });
          }
          this.endAttack(enraged);
        }
        break;
      case 'charge':
        if (this.t > 0) { this.t--; this.vx = 0; if (this.t === 0) { this.chargeT = 50; sfx('dash'); } }
        else {
          this.vx = this.face * 6.2;
          if (--this.chargeT <= 0 || this.hitWall) { if (this.hitWall) { g.shake(6); sfx('boom'); } this.endAttack(enraged); }
        }
        break;
      case 'summon':
        this.vx = 0;
        if (--this.t <= 0) {
          for (const off of [-140, 140]) {
            const bat = new Enemy(g, 'morcego', Math.max(40, Math.min(g.map.width - 60, this.x + off)));
            bat.minion = true; g.enemies.push(bat);
            g.fx.burst(cx(bat), cy(bat), '#7fb6d9', 16, 3);
          }
          this.summoned = 900;
          this.endAttack(enraged);
        }
        break;
    }
    if (this.summoned > 0) this.summoned--;
  }

  endAttack(enraged) { this.state = 'walk'; this.cool = enraged ? randi(50, 80) : randi(80, 120); this.vx = 0; }

  get telegraph() {
    // true quando o inimigo está preparando um ataque (pisca para avisar o jogador)
    return this.state === 'windup' || (this.d.boss && ['slam', 'shards', 'summon'].includes(this.state)) || (this.state === 'charge' && this.t > 0);
  }

  hurt(dmg, dir, knock, stun, freeze) {
    if (!this.alive) return;
    this.hp -= dmg;
    this.flash = 8;
    if (this.d.boss) {
      // chefes não são empurrados nem atordoados por golpes comuns
      if (freeze) { this.stun = 30; this.frozen = 30; }
    } else {
      this.vx = dir * knock;
      if (knock >= 5 && this.d.ai !== 'flyer') this.vy = -3;
      if (this.d.ai === 'flyer') this.vy = -1;
      this.stun = Math.max(this.stun, stun);
      if (freeze) this.frozen = stun;
      if (this.state === 'windup' || this.state === 'lunge' || this.state === 'swoop') { this.state = this.d.ai === 'flyer' ? 'return' : 'walk'; this.cool = 50; }
    }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.dead = 0; this.game.onEnemyKilled(this); }
  }
}
