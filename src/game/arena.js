// Modos de desafio: "ondas" (sobreviva a ondas crescentes) e "defesa" (proteja o Cristal).
import { Enemy } from './enemy.js';
import { pick, randi, cx } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const POOLS = [
  { from: 1, types: ['gotinha', 'cogumelo'] },
  { from: 3, types: ['vespa', 'espinho'] },
  { from: 5, types: ['lobo', 'javali'] },
  { from: 7, types: ['morcego'] },
];

export class Crystal {
  constructor(x) {
    this.w = 30; this.h = 52; this.x = x - 15; this.y = 300 - 52;
    this.maxHp = 600; this.hp = 600; this.state = 'idle'; this.inv = 0; this.flash = 0; this.anim = 0;
    this.face = 1; this.isCrystal = true;
  }
  get alive() { return this.hp > 0; }
  update() { this.anim++; if (this.inv > 0) this.inv--; if (this.flash > 0) this.flash--; }
  hurt(dmg) {
    if (this.inv > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - Math.round(dmg));
    this.inv = 20; this.flash = 8;
    if (this.hp <= 0) this.state = 'dead';
  }
}

export class Arena {
  constructor(game, mode) {
    this.game = game; this.mode = mode;
    this.wave = 0; this.toSpawn = 0; this.spawnT = 0; this.breakT = 150;
    this.over = false; this.totalGold = 0;
    this.crystal = mode === 'defesa' ? new Crystal(game.map.width / 2) : null;
    if (this.crystal) game.player.place(game.map.width / 2 - 80);
  }

  get alive() { return this.game.enemies.filter((e) => e.alive && e.arena).length; }

  nextWave() {
    this.wave++;
    this.toSpawn = 3 + this.wave + (this.mode === 'defesa' ? 2 : 0);
    this.spawnT = 30;
    this.boss = this.wave % 5 === 0;
    this.game.banner = { text: `Onda ${this.wave}`, sub: this.boss ? 'Um chefe se aproxima!' : this.mode === 'defesa' ? 'Proteja o Cristal' : 'Sobreviva', t: 120, boss: this.boss };
    sfx('level');
  }

  spawnOne() {
    const g = this.game;
    const types = POOLS.filter((p) => this.wave >= p.from).flatMap((p) => p.types);
    const type = this.boss && this.toSpawn === 1 ? 'golem' : pick(types);
    const side = Math.random() < 0.5 ? 30 : g.map.width - 80;
    const e = new Enemy(g, type, side);
    const scale = 1 + (this.wave - 1) * 0.18;
    const hpScale = type === 'golem' ? 0.35 + this.wave * 0.05 : scale;
    e.maxHp = e.hp = Math.round(e.d.hp * hpScale);
    e.atk = Math.round(e.d.atk * (type === 'golem' ? 0.7 : 1) * (1 + (this.wave - 1) * 0.1));
    e.arena = true; e.face = side < 100 ? 1 : -1;
    e.cool = 40;
    if (type === 'golem') g.boss = e, g.bossIntro = true;
    g.enemies.push(e);
    g.fx.burst(cx(e), e.y + e.h / 2, '#ffffff', 14, 3);
  }

  update() {
    if (this.over) return;
    const g = this.game;
    if (this.crystal) {
      this.crystal.update();
      if (!this.crystal.alive) { this.finish('O Cristal foi destruído!'); return; }
    }
    if (this.breakT > 0) {
      if (--this.breakT === 0) this.nextWave();
      return;
    }
    if (this.toSpawn > 0 && --this.spawnT <= 0 && this.alive < 6) {
      this.spawnOne(); this.toSpawn--; this.spawnT = randi(35, 70);
    }
    if (this.toSpawn === 0 && this.alive === 0) {
      const gold = 15 * this.wave + (this.boss ? 100 : 0);
      g.save.gold += gold; this.totalGold += gold;
      g.gainExp(10 * this.wave);
      if (this.crystal) this.crystal.hp = Math.min(this.crystal.maxHp, this.crystal.hp + 100);
      g.toast(`Onda ${this.wave} vencida! +${gold} ouro`, '#7dff9a');
      this.record();
      this.breakT = 180;
    }
  }

  record() {
    const st = this.game.save.stats;
    const key = this.mode === 'defesa' ? 'bestDefense' : 'bestWave';
    st[key] = Math.max(st[key] || 0, this.wave);
    this.game.checkHonors();
  }

  finish(reason) {
    if (this.over) return;
    this.over = true;
    for (const e of this.game.enemies) if (e.arena && e.alive) { e.alive = false; e.dead = 0; this.game.fx.burst(cx(e), e.y + e.h / 2, '#ffffff', 10, 2); }
    const cleared = this.breakT > 0 ? this.wave : this.wave - 1;
    this.game.toast(`${reason} Ondas vencidas: ${Math.max(0, cleared)}`, '#ffd84a');
    this.game.persist();
  }
}
