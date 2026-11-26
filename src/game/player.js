import { CLASSES, DASH_STEP } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { moveBody, onPlatformOnly } from './physics.js';
import { sfx } from '../engine/audio.js';
import { cx, cy, rand } from '../engine/util.js';

const BUSY = new Set(['attack', 'skill', 'dash', 'dashSkill', 'cast', 'hurt', 'dead']);

export class Player {
  constructor(game) {
    this.game = game;
    this.w = 20; this.h = 34;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.face = 1; this.onGround = false; this.jumps = 0;
    this.state = 'idle'; this.t = 0; this.anim = 0;
    this.step = null; this.combo = 0; this.comboQueued = false;
    this.hitSet = new Set();
    this.inv = 0; this.dashCd = 0; this.cds = [0, 0, 0];
    this.buffs = []; this.shield = 0; this.dropTimer = 0;
    this.skill = null;
  }

  get cls() { return CLASSES[this.game.save.cls]; }
  get busy() { return BUSY.has(this.state); }

  place(x) { this.x = x; this.y = 200; this.vx = 0; this.vy = 0; this.state = 'idle'; }

  update(inp) {
    const g = this.game, s = g.stats, save = g.save;
    this.anim++;
    if (this.inv > 0) this.inv--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.dropTimer > 0) this.dropTimer--;
    for (let i = 0; i < 3; i++) if (this.cds[i] > 0) this.cds[i]--;

    let expired = false;
    this.buffs = this.buffs.filter((b) => { b.t--; if (b.t <= 0) { expired = true; if (b.shield) this.shield = 0; return false; } return true; });
    if (expired) g.recalc();

    if (this.anim % 60 === 0 && this.state !== 'dead') {
      save.mp = Math.min(s.maxMp, save.mp + 1 + s.maxMp * 0.02);
      if (g.map.safe) { save.hp = Math.min(s.maxHp, save.hp + s.maxHp * 0.06); save.mp = Math.min(s.maxMp, save.mp + s.maxMp * 0.06); }
    }

    if (this.state === 'dead') { this.vx *= 0.9; moveBody(this, g.map); return; }

    // --- Entrada ---
    if (inp.wasPressed('attack')) this.tryAttack();
    if (inp.wasPressed('dash')) this.tryDash();
    for (let i = 0; i < 3; i++) if (inp.wasPressed('skill' + (i + 1))) this.trySkill(i);
    if (inp.wasPressed('jump')) this.tryJump(inp.isDown('down'));
    if (inp.wasPressed('potion')) g.usePotion('pocao_vida');
    if (inp.wasPressed('potion2')) g.usePotion('pocao_mana');

    const dir = (inp.isDown('right') ? 1 : 0) - (inp.isDown('left') ? 1 : 0);
    let gravity = true;

    switch (this.state) {
      case 'hurt':
        this.t--; this.vx *= 0.88;
        if (this.t <= 0) this.state = 'idle';
        break;
      case 'dash':
        this.t--; this.vx = this.face * 7; this.vy = 0; gravity = false;
        if (this.anim % 2 === 0) g.fx.afterimage(this);
        if (this.t <= 0) { this.state = 'idle'; this.vx = this.face * 2; }
        break;
      case 'attack': this.updateAttack(); break;
      case 'skill': this.updateSkillMelee(); break;
      case 'dashSkill': gravity = this.updateDashSkill(); break;
      case 'cast':
        this.t--; this.vx *= 0.8;
        if (this.t <= 0) this.state = 'idle';
        break;
      default: {
        const sp = s.speed;
        const accel = this.onGround ? 0.6 : 0.35;
        if (dir) { this.vx += dir * accel; this.face = dir; }
        else this.vx *= this.onGround ? 0.7 : 0.95;
        this.vx = Math.max(-sp, Math.min(sp, this.vx));
        this.state = this.onGround ? (Math.abs(this.vx) > 0.3 ? 'run' : 'idle') : 'air';
      }
    }
    // Pulo variável: soltar o botão corta a subida.
    if (!inp.isDown('jump') && this.vy < -3 && this.state === 'air') this.vy *= 0.85;

    moveBody(this, g.map, gravity);
    if (this.onGround) this.jumps = 0;

    if (this.y > 420) { // caiu do mapa
      this.place(g.map.spawnX);
      this.hurt(Math.round(s.maxHp * 0.1), 0, true);
    }
  }

  // ---------- Ações ----------
  tryJump(down) {
    if (['hurt', 'skill', 'dashSkill', 'cast'].includes(this.state)) return;
    if (this.state === 'attack' && this.t < this.step.active[1]) return;
    if (down && this.onGround && onPlatformOnly(this, this.game.map)) {
      this.dropTimer = 14; this.y += 2; this.onGround = false; this.state = 'air';
      return;
    }
    if (this.onGround || this.jumps < 2) {
      const first = this.onGround;
      this.vy = first ? -8.2 : -7.2;
      this.jumps = first ? 1 : 2;
      if (this.state === 'attack') this.state = 'air';
      this.onGround = false;
      sfx('jump');
      if (!first) this.game.fx.ring(cx(this), this.y + this.h, 18, 'rgba(255,255,255,0.7)', 14);
    }
  }

  tryDash() {
    if (this.dashCd > 0) return;
    if (this.state === 'attack' && this.t < this.step.active[1]) return;
    if (['hurt', 'skill', 'dashSkill', 'cast', 'dash'].includes(this.state)) return;
    this.state = 'dash'; this.t = 12; this.dashCd = 36; this.inv = Math.max(this.inv, 12);
    sfx('dash');
  }

  tryAttack() {
    if (this.state === 'dash') {
      this.game.save.stats.dashAttacks++;
      this.startAttack(DASH_STEP);
      return;
    }
    if (this.state === 'attack') { this.comboQueued = true; return; }
    if (this.busy) return;
    this.combo = 0;
    this.startAttack(this.cls.combo[0]);
  }

  startAttack(step) {
    this.state = 'attack'; this.step = step; this.t = 0;
    this.hitSet.clear(); this.comboQueued = false;
    sfx(step.proj ? 'magic' : 'swing');
  }

  updateAttack() {
    const st = this.step, g = this.game;
    this.t++;
    if (this.onGround) this.vx *= 0.75; else this.vx *= 0.96;
    if (this.t === 2 && this.onGround) this.vx = this.face * (st.lunge ?? 1.4);
    if (this.t === st.active[0]) {
      if (st.proj) {
        g.spawnProjectile({
          x: cx(this) + this.face * 14, y: this.y + 12, vx: this.face * st.proj.speed, vy: 0,
          r: st.proj.r, color: st.proj.color, life: st.proj.life, owner: 'player',
          mult: st.mult, knock: st.proj.knock ?? 2, stun: 14, pierce: st.proj.pierce,
        });
      } else {
        g.fx.slash(this, st.range, st.dash ? '#ffffff' : this.cls.accent, this.combo);
      }
    }
    if (!st.proj && this.t >= st.active[0] && this.t <= st.active[1]) {
      g.meleeHit(this.attackBox(st.range), st, this.hitSet);
    }
    if (this.t >= st.dur) {
      if (this.comboQueued && !st.dash && this.combo < this.cls.combo.length - 1) {
        this.combo++;
        this.startAttack(this.cls.combo[this.combo]);
      } else if (this.comboQueued && st.dash) {
        this.combo = 0; this.startAttack(this.cls.combo[0]);
      } else {
        this.state = 'idle'; this.combo = 0;
      }
    }
  }

  attackBox(range, h = this.h + 12) {
    return { x: this.face > 0 ? this.x + this.w - 4 : this.x - range + 4, y: this.y - 6, w: range, h };
  }

  trySkill(i) {
    const g = this.game, save = g.save;
    const id = this.cls.skills[i];
    const sk = SKILLS[id];
    if (!sk) return;
    if (save.level < sk.unlock) { g.toast(`${sk.name}: desbloqueia no Nv. ${sk.unlock}`, '#ffb3b3'); return; }
    if (this.cds[i] > 0 || this.busy && this.state !== 'attack' && this.state !== 'dash') return;
    if (save.mp < sk.mp) { g.toast('MP insuficiente', '#9cc9ff'); return; }
    save.mp -= sk.mp;
    this.cds[i] = sk.cd;
    this.skill = sk; this.t = 0; this.hitSet.clear();
    const s = g.stats;

    if (sk.type === 'melee') {
      this.state = 'skill'; sfx('swing');
    } else if (sk.type === 'dash') {
      this.state = 'dashSkill'; this.inv = Math.max(this.inv, sk.dur + 6); sfx('dash');
    } else if (sk.type === 'projectile') {
      this.state = 'cast'; this.t = 16; sfx('magic');
      const n = sk.count;
      for (let k = 0; k < n; k++) {
        const a = (k - (n - 1) / 2) * sk.spread || 0;
        g.spawnProjectile({
          x: cx(this) + this.face * 12, y: this.y + 12,
          vx: Math.cos(a) * sk.speed * this.face, vy: Math.sin(a) * sk.speed,
          r: sk.r, color: sk.color, life: sk.life, owner: 'player', mult: sk.mult, skill: true,
          knock: 3, stun: 20, pierce: sk.pierce, explode: sk.explode, glyph: id === 'chuva_facas' ? 'knife' : null,
        });
      }
    } else if (sk.type === 'aoe') {
      this.state = 'cast'; this.t = 24; sfx('magic');
      g.fx.ring(cx(this), cy(this), sk.r, sk.color, 30, 4);
      g.fx.burst(cx(this), cy(this), sk.color, 30, 4);
      g.aoeHit(cx(this), cy(this), sk.r, { mult: sk.mult, knock: 2, stun: sk.stun, freeze: sk.freeze, skill: true });
    } else if (sk.type === 'buff') {
      this.state = 'cast'; this.t = 20; sfx('level');
      this.buffs = this.buffs.filter((b) => b.id !== id);
      this.buffs.push({ id, t: sk.dur, mult: sk.buff, shield: !!sk.shield, color: sk.color });
      if (sk.shield) this.shield = Math.round(s.maxHp * sk.shield);
      g.fx.ring(cx(this), cy(this), 40, sk.color, 30, 3);
      g.recalc();
      g.toast(sk.name + '!', sk.color);
    }
  }

  updateSkillMelee() {
    const sk = this.skill, g = this.game;
    this.t++;
    this.vx *= 0.7;
    if (this.t === sk.active[0]) {
      if (sk.fx === 'quake') { g.shake(sk.shake); g.fx.quake(cx(this), this.y + this.h, sk.box.w, sk.color); sfx('boom'); }
    }
    if (this.t >= sk.active[0] && this.t <= sk.active[1]) {
      if (sk.hitEvery && (this.t - sk.active[0]) % sk.hitEvery === 0) {
        this.hitSet.clear();
        g.fx.spin(this, sk.box.w / 2, sk.color);
        sfx('swing');
      }
      const b = sk.box;
      const box = b.center
        ? { x: cx(this) - b.w / 2, y: this.y + this.h - b.h, w: b.w, h: b.h }
        : this.attackBox(b.w, b.h);
      g.meleeHit(box, { ...sk, skill: true }, this.hitSet);
    }
    if (this.t >= sk.dur) this.state = 'idle';
  }

  updateDashSkill() {
    const sk = this.skill, g = this.game;
    this.t++;
    this.vx = this.face * sk.speed;
    this.vy = 0;
    if (this.anim % 2 === 0) g.fx.afterimage(this, sk.ghost ? 'rgba(150,120,255,0.5)' : null);
    g.meleeHit({ x: this.x - 8, y: this.y - 4, w: this.w + 16, h: this.h + 8 }, { ...sk, skill: true }, this.hitSet);
    if (this.t >= sk.dur || this.hitWall) { this.state = 'idle'; this.vx = this.face * 1.5; }
    return false;
  }

  hurt(dmg, dir, ignoreInv = false) {
    const g = this.game, save = g.save;
    if (this.state === 'dead') return;
    if (!ignoreInv && this.inv > 0) return;
    let d = ignoreInv ? dmg : Math.max(1, Math.round(dmg * rand(0.9, 1.1) - g.stats.def * 0.5));
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, d);
      this.shield -= absorbed; d -= absorbed;
      g.fx.number(cx(this), this.y - 6, absorbed ? `-${absorbed}` : '', '#b98cff');
      if (this.shield <= 0) this.buffs = this.buffs.filter((b) => !b.shield);
    }
    if (d > 0) {
      save.hp -= d;
      g.fx.number(cx(this), this.y - 4, `${d}`, '#ff5a5a', true);
    }
    this.inv = 60;
    if (!ignoreInv) {
      this.state = 'hurt'; this.t = 16;
      this.vx = (dir || -this.face) * 3; this.vy = -3;
    }
    g.shake(4);
    g.resetCombo();
    sfx('hurt');
    if (save.hp <= 0) { save.hp = 0; this.state = 'dead'; this.t = 0; g.onPlayerDeath(); }
  }
}
