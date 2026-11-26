import { MAPS, QUESTS, HONORS } from '../data/world.js';
import { SKILLS } from '../data/skills.js';
import { CONSUMABLES, QUEST_ITEMS, rollEquipment } from '../data/items.js';
import { CLASSES } from '../data/classes.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Effects } from './effects.js';
import { moveBody } from './physics.js';
import { computeStats, expToNext } from './stats.js';
import { drawBackground, drawMap, drawFog, drawHero, drawNPC, drawEnemy, drawProjectile, drawDrop, VIEW_W, VIEW_H } from './render.js';
import { drawHUD } from './hud.js';
import { Arena } from './arena.js';
import { drawCrystal } from './render.js';
import { clamp, rand, randi, sign, overlap, cx, cy } from '../engine/util.js';
import { sfx } from '../engine/audio.js';

const SAVE_KEY = 'ecos-aurora-save-v1';
const MAX_INV = 30;

export function newSave(cls) {
  return {
    v: 1, cls, level: 1, exp: 0, gold: 30, points: 0,
    alloc: { for: 0, vit: 0, int: 0, agi: 0 },
    hp: 9999, mp: 9999,
    inventory: [{ kind: 'cons', id: 'pocao_vida', qty: 3 }, { kind: 'cons', id: 'pocao_mana', qty: 1 }],
    equip: { weapon: rollEquipment(1, cls, 0, 'weapon'), armor: null, acc: null },
    quests: {}, honors: [], map: 'vila',
    stats: { kills: 0, maxCombo: 0, dashAttacks: 0, deaths: 0, bosses: 0 },
  };
}
export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && CLASSES[s.cls] ? s : null; } catch { return null; }
}
export function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* sem storage */ } }

export class Game {
  constructor(canvas, input, ui) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.input = input; this.ui = ui;
    this.fx = new Effects();
    this.running = false; this.paused = false;
    this.frame = 0;
  }

  start(save) {
    this.save = save;
    this.player = new Player(this);
    this.recalc();
    save.hp = Math.min(save.hp, this.stats.maxHp);
    save.mp = Math.min(save.mp, this.stats.maxMp);
    this.toasts = []; this.combo = 0; this.comboTimer = 0;
    this.loadMap(save.map || 'vila');
    this.running = true;
    this.persist();
  }

  recalc() {
    this.stats = computeStats(this.save, this.player ? this.player.buffs : []);
    this.save.hp = Math.min(this.save.hp, this.stats.maxHp);
    this.save.mp = Math.min(this.save.mp, this.stats.maxMp);
  }

  // ---------- Mapas ----------
  loadMap(id, x = null) {
    const m = MAPS[id];
    this.mapId = id; this.save.map = m.noSave ? 'vila' : id;
    this.arena = null;
    this.map = {
      ...m,
      solids: m.solids.map(([x, y, w, h]) => ({ x, y, w, h })),
      platforms: m.platforms.map(([x, y, w]) => ({ x, y, w })),
    };
    this.enemies = []; this.projectiles = []; this.drops = [];
    this.fx.clear();
    this.boss = null; this.bossIntro = false;
    this.spawners = m.spawns.map((s) => ({ ...s, enemy: null, timer: 0 }));
    for (const sp of this.spawners) this.spawnFrom(sp);
    this.player.place(x ?? m.spawnX);
    this.camX = clamp(this.player.x - VIEW_W / 2, 0, this.map.width - VIEW_W);
    this.shakeT = 0; this.hitstop = 0;
    this.banner = { text: m.name, sub: m.levels || (m.safe ? 'Zona segura' : ''), t: 170 };
    this.updateNpcMarkers();
    this.persist();
  }

  startArena(mode) {
    this.loadMap('arena');
    this.arena = new Arena(this, mode);
  }

  spawnFrom(sp) {
    const e = new Enemy(this, sp.type, sp.x, sp);
    sp.enemy = e;
    this.enemies.push(e);
    if (sp.boss) this.boss = e;
  }

  travel(portal) {
    if (portal.minLevel && this.save.level < portal.minLevel) {
      this.toast(`É perigoso demais. Volte no Nv. ${portal.minLevel}.`, '#ffb3b3');
      return;
    }
    sfx('ui');
    this.loadMap(portal.to, portal.toX);
  }

  // ---------- Loop ----------
  update() {
    if (!this.running) return;
    this.frame++;
    if (this.paused) {
      if (this.input.wasPressed('menu') && ['menu', 'dialog'].includes(this.ui.mode)) this.ui.hide();
      this.input.endFrame(); return;
    }
    if (this.input.wasPressed('menu')) { this.input.endFrame(); this.ui.openMenu(); return; }

    if (this.hitstop > 0) { this.hitstop--; this.fx.update(); return; } // mantém os toques pendentes

    const p = this.player;
    p.update(this.input);
    this.handleInteract();

    for (const e of this.enemies) e.update();
    this.enemies = this.enemies.filter((e) => e.alive || e.dead < 30);

    for (const sp of this.spawners) {
      if (sp.boss || (sp.enemy && sp.enemy.alive)) continue;
      if (++sp.timer > 600) { sp.timer = 0; this.spawnFrom(sp); }
    }

    if (this.arena) this.arena.update();
    this.updateProjectiles();
    this.updateDrops();
    this.fx.update();

    if (this.comboTimer > 0 && --this.comboTimer === 0) this.combo = 0;
    for (const t of this.toasts) t.t--;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.banner) { this.banner.t--; if (this.banner.t <= 0) this.banner = null; }
    if (this.shakeT > 0) this.shakeT--;

    if (this.boss && !this.bossIntro && this.boss.alive && Math.abs(cx(p) - cx(this.boss)) < 420) {
      this.bossIntro = true;
      this.banner = { text: this.boss.d.name, sub: 'Chefe', t: 150, boss: true };
    }

    if (p.state === 'dead' && ++p.t === 90) this.ui.showDeath();

    const target = clamp(cx(p) - VIEW_W / 2 + p.face * 40, 0, Math.max(0, this.map.width - VIEW_W));
    this.camX += (target - this.camX) * 0.1;

    if (this.frame % 1800 === 0) this.persist();
    this.input.endFrame();
  }

  handleInteract() {
    const p = this.player;
    this.nearNPC = null; this.nearPortal = null;
    for (const n of this.map.npcs || []) if (Math.abs(cx(p) - n.x) < 34) this.nearNPC = n;
    for (const pt of this.map.portals) if (Math.abs(cx(p) - pt.x) < 30) this.nearPortal = pt;
    if (!this.input.wasPressed('up') || p.busy) return;
    if (this.nearNPC) { this.input.clear(); this.ui.openDialog(this.nearNPC.id); }
    else if (this.nearPortal) this.travel(this.nearPortal);
  }

  draw() {
    const ctx = this.ctx;
    if (!this.running) return;
    const sx = this.shakeT > 0 ? rand(-1, 1) * this.shakeMag * (this.shakeT / 12) : 0;
    const sy = this.shakeT > 0 ? rand(-1, 1) * this.shakeMag * (this.shakeT / 12) : 0;
    const camX = Math.round(this.camX);
    drawBackground(ctx, this.map, camX, this.frame);
    ctx.save();
    ctx.translate(-camX + sx, sy);
    drawMap(ctx, this.map, this.frame);
    for (const n of this.map.npcs || []) drawNPC(ctx, n, this.frame, n === this.nearNPC);
    for (const d of this.drops) drawDrop(ctx, d, this.frame);
    if (this.arena?.crystal) drawCrystal(ctx, this.arena.crystal);
    for (const e of this.enemies) drawEnemy(ctx, e);
    drawHero(ctx, this.player, this.save.cls);
    for (const pr of this.projectiles) drawProjectile(ctx, pr);
    this.fx.draw(ctx);
    this.drawPrompts(ctx);
    ctx.restore();
    drawFog(ctx, this.map, camX, this.frame);
    drawHUD(ctx, this);
  }

  drawPrompts(ctx) {
    const p = this.player;
    let label = null, x = 0;
    if (this.nearNPC) { label = '↑ Conversar'; x = this.nearNPC.x; }
    else if (this.nearPortal) { label = `↑ ${this.nearPortal.label}`; x = this.nearPortal.x; }
    if (!label) return;
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(label).width + 14;
    const y = p.y - 26;
    ctx.fillStyle = 'rgba(10,14,30,0.75)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12, w, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, x, y + 1);
  }

  // ---------- Combate ----------
  meleeHit(box, spec, hitSet) {
    for (const e of this.enemies) {
      if (!e.alive || hitSet.has(e) || !overlap(box, e)) continue;
      hitSet.add(e);
      this.damageEnemy(e, spec, sign(cx(e) - cx(this.player)));
    }
  }

  aoeHit(x, y, r, spec) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = clamp(x, e.x, e.x + e.w) - x, dy = clamp(y, e.y, e.y + e.h) - y;
      if (dx * dx + dy * dy <= r * r) this.damageEnemy(e, spec, sign(cx(e) - x));
    }
  }

  damageEnemy(e, spec, dir) {
    const s = this.stats;
    const comboBonus = 1 + Math.min(0.2, Math.floor(this.combo / 10) * 0.02);
    let dmg = s.atk * spec.mult * (spec.skill ? s.skillPower : 1) * comboBonus * rand(0.9, 1.1) - e.d.def;
    dmg = Math.max(1, Math.round(dmg));
    const crit = Math.random() < s.crit;
    if (crit) dmg = Math.round(dmg * 1.6);
    e.hurt(dmg, dir, spec.knock ?? 2, spec.stun ?? 12, spec.freeze);
    this.fx.number(cx(e), e.y - 4, crit ? `${dmg}!` : `${dmg}`, crit ? '#ffd84a' : '#ffffff', crit);
    this.fx.sparks(cx(e), cy(e), dir, crit ? '#ffd84a' : '#ffffff');
    // pausa de impacto maior no golpe final do combo e em críticos
    this.hitstop = Math.max(this.hitstop, ((spec.knock ?? 0) >= 5 ? 6 : 3) + (crit ? 2 : 0));
    if (spec.shake) this.shake(spec.shake);
    this.combo++; this.comboTimer = 130;
    if (this.combo > this.save.stats.maxCombo) this.save.stats.maxCombo = this.combo;
    sfx(crit ? 'crit' : 'hit');
  }

  resetCombo() { this.combo = 0; this.comboTimer = 0; }

  shake(mag) { this.shakeMag = Math.max(mag, this.shakeT > 0 ? this.shakeMag : 0); this.shakeT = 12; }

  spawnProjectile(o) { this.projectiles.push({ gravity: 0, hitSet: new Set(), ...o }); }

  updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.x += pr.vx; pr.y += pr.vy; pr.vy += pr.gravity; pr.life--;
      const box = { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };
      if (pr.y > 300 + 10 || this.map.solids.some((s) => overlap(box, s) && pr.kind !== 'wave')) {
        if (pr.explode) this.explode(pr);
        else this.fx.burst(pr.x, pr.y, pr.color, 5, 1.5);
        pr.life = 0; continue;
      }
      if (pr.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || pr.hitSet.has(e) || !overlap(box, e)) continue;
          pr.hitSet.add(e);
          if (pr.explode) { this.explode(pr); pr.life = 0; break; }
          this.damageEnemy(e, pr, sign(pr.vx));
          if (!pr.pierce) { pr.life = 0; break; }
        }
      } else if (p.state !== 'dead' && overlap(box, p)) {
        p.hurt(pr.dmg, sign(pr.vx));
        if (pr.kind !== 'wave') pr.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  explode(pr) {
    const ex = pr.explode;
    this.fx.ring(pr.x, pr.y, ex.r, pr.color, 22, 4);
    this.fx.burst(pr.x, pr.y, pr.color, 24, 3.5);
    this.shake(5); sfx('boom');
    this.aoeHit(pr.x, pr.y, ex.r, { mult: pr.mult * ex.mult, knock: 5, stun: 30, skill: true });
  }

  // ---------- Recompensas ----------
  onEnemyKilled(e) {
    const d = e.d, save = this.save;
    this.fx.burst(cx(e), cy(e), d.color, d.boss ? 60 : 16, d.boss ? 5 : 3);
    if (e.minion) return; // invocações não dão recompensa
    save.stats.kills++;
    if (d.boss) { save.stats.bosses++; this.shake(14); sfx('boom'); this.toast(`${d.name} derrotado!`, '#ffd84a'); }
    this.gainExp(d.exp);
    const gold = randi(d.gold[0], d.gold[1]);
    for (let i = 0; i < Math.min(8, Math.ceil(gold / 3)); i++) this.spawnDrop(e, { kind: 'gold', amount: Math.ceil(gold / Math.min(8, Math.ceil(gold / 3))) });
    for (const dr of d.drops) {
      if (Math.random() > dr.chance) continue;
      if (dr.quest) {
        const q = QUESTS[dr.quest];
        if (this.questState(dr.quest) !== 'active' || this.countItem(dr.id) >= q.count) continue;
        this.spawnDrop(e, { kind: 'quest', id: dr.id });
      } else if (dr.equip) {
        this.spawnDrop(e, { kind: 'equip', item: rollEquipment(d.level, save.cls, dr.rarity ?? null) });
      } else {
        for (let i = 0; i < (dr.qty || 1); i++) this.spawnDrop(e, { kind: 'cons', id: dr.id });
      }
    }
    for (const [id, q] of Object.entries(QUESTS)) {
      const st = save.quests[id];
      if (st && st.state === 'active' && q.type === 'kill' && q.target === e.type && st.n < q.count) {
        st.n++;
        if (st.n >= q.count) this.toast(`Missão pronta: ${q.title}`, '#7dff9a');
      }
    }
    this.updateNpcMarkers();
    this.checkHonors();
  }

  spawnDrop(e, data) {
    this.drops.push({ ...data, x: cx(e) - 5, y: e.y + 4, w: 10, h: 10, vx: rand(-2.2, 2.2), vy: rand(-5, -3), age: 0, onGround: false });
  }

  updateDrops() {
    const p = this.player;
    for (const d of this.drops) {
      d.age++;
      const dist = Math.hypot(cx(p) - cx(d), cy(p) - cy(d));
      if (d.age > 30 && dist < 50 && p.state !== 'dead') {
        d.x += (cx(p) - cx(d)) * 0.18; d.y += (cy(p) - cy(d)) * 0.18; d.vy = 0;
      } else {
        moveBody(d, this.map);
        if (d.onGround) d.vx *= 0.8;
      }
      if (d.age > 30 && overlap(d, p) && p.state !== 'dead') this.collect(d);
      if (d.age > 3600) d.gone = true;
    }
    this.drops = this.drops.filter((d) => !d.gone);
  }

  collect(d) {
    if (d.kind === 'gold') { this.save.gold += d.amount; sfx('coin'); d.gone = true; return; }
    let ok, name;
    if (d.kind === 'equip') { ok = this.addItem(d.item); name = d.item.name; }
    else if (d.kind === 'cons') { ok = this.addItem({ kind: 'cons', id: d.id, qty: 1 }); name = CONSUMABLES[d.id].name; }
    else { ok = this.addItem({ kind: 'quest', id: d.id, qty: 1 }); name = QUEST_ITEMS[d.id].name; }
    if (!ok) { if (d.age % 120 === 31) this.toast('Inventário cheio!', '#ffb3b3'); return; }
    d.gone = true; sfx('item');
    this.toast(`+ ${name}`, d.kind === 'equip' ? undefined : '#e8f4ff', d.kind === 'equip' ? d.item.rarity : undefined);
    if (d.kind === 'quest') {
      for (const [id, q] of Object.entries(QUESTS)) {
        if (q.target === d.id && this.questState(id) === 'active' && this.countItem(d.id) === q.count) this.toast(`Missão pronta: ${q.title}`, '#7dff9a');
      }
      this.updateNpcMarkers();
    }
  }

  addItem(entry) {
    const inv = this.save.inventory;
    if (entry.kind !== 'equip') {
      const stack = inv.find((i) => i.kind === entry.kind && i.id === entry.id);
      if (stack) { stack.qty += entry.qty; return true; }
    }
    if (inv.length >= MAX_INV) return false;
    inv.push(entry);
    return true;
  }

  countItem(id) { const it = this.save.inventory.find((i) => i.id === id); return it ? it.qty : 0; }
  removeItem(id, qty) {
    const inv = this.save.inventory;
    const it = inv.find((i) => i.id === id);
    if (!it) return;
    it.qty -= qty;
    if (it.qty <= 0) inv.splice(inv.indexOf(it), 1);
  }

  usePotion(id) {
    const c = CONSUMABLES[id], save = this.save, s = this.stats;
    if (this.player.state === 'dead') return;
    if (this.countItem(id) <= 0) { this.toast(`Sem ${c.name}`, '#ffb3b3'); return; }
    if ((c.hp && save.hp >= s.maxHp) || (c.mp && save.mp >= s.maxMp)) return;
    this.removeItem(id, 1);
    if (c.hp) { const v = Math.round(s.maxHp * c.hp); save.hp = Math.min(s.maxHp, save.hp + v); this.fx.number(cx(this.player), this.player.y - 6, `+${v}`, '#7dff9a'); }
    if (c.mp) { const v = Math.round(s.maxMp * c.mp); save.mp = Math.min(s.maxMp, save.mp + v); this.fx.number(cx(this.player), this.player.y - 6, `+${v}`, '#9cc9ff'); }
    this.fx.burst(cx(this.player), cy(this.player), c.color, 12, 2);
    sfx('item');
  }

  gainExp(n) {
    const save = this.save;
    save.exp += n;
    this.fx.number(cx(this.player), this.player.y - 18, `+${n} EXP`, '#c9b6ff');
    while (save.exp >= expToNext(save.level)) {
      save.exp -= expToNext(save.level);
      save.level++;
      save.points += 3;
      this.recalc();
      save.hp = this.stats.maxHp; save.mp = this.stats.maxMp;
      this.banner = { text: `Nível ${save.level}!`, sub: '+3 pontos de atributo', t: 150, level: true };
      this.fx.ring(cx(this.player), cy(this.player), 60, '#ffd84a', 40, 4);
      this.fx.burst(cx(this.player), cy(this.player), '#ffd84a', 40, 4);
      sfx('level');
      const cls = CLASSES[save.cls];
      for (const id of cls.skills) {
        const sk = this.skillDef(id);
        if (sk.unlock === save.level) this.toast(`Nova habilidade: ${sk.name}`, sk.color);
      }
      this.updateNpcMarkers();
    }
    this.checkHonors();
  }

  skillDef(id) { return SKILLS[id]; }

  // ---------- Missões ----------
  questState(id) {
    const st = this.save.quests[id];
    if (st) return st.state;
    const q = QUESTS[id];
    if ((q.req && this.questState(q.req) !== 'done') || this.save.level < q.minLevel) return 'locked';
    return 'available';
  }
  questProgress(id) {
    const q = QUESTS[id], st = this.save.quests[id];
    if (!st) return 0;
    if (st.state === 'done') return q.count;
    return q.type === 'collect' ? Math.min(q.count, this.countItem(q.target)) : st.n;
  }
  questReady(id) { return this.questState(id) === 'active' && this.questProgress(id) >= QUESTS[id].count; }
  acceptQuest(id) {
    this.save.quests[id] = { state: 'active', n: 0 };
    this.toast(`Nova missão: ${QUESTS[id].title}`, '#ffd84a');
    sfx('ui'); this.updateNpcMarkers(); this.persist();
  }
  completeQuest(id) {
    const q = QUESTS[id];
    if (!this.questReady(id)) return false;
    if (q.type === 'collect') this.removeItem(q.target, q.count);
    this.save.quests[id] = { state: 'done' };
    const r = q.reward;
    this.save.gold += r.gold || 0;
    for (const [iid, qty] of r.items || []) this.addItem({ kind: 'cons', id: iid, qty });
    if (r.equip != null) {
      const it = rollEquipment(Math.max(this.save.level, 2), this.save.cls, r.equip);
      if (this.addItem(it)) this.toast(`+ ${it.name}`, undefined, it.rarity);
    }
    this.toast(`Missão concluída! +${r.gold} ouro`, '#7dff9a');
    if (r.exp) this.gainExp(r.exp);
    this.updateNpcMarkers(); this.persist();
    return true;
  }
  npcQuests(npcId) { return Object.keys(QUESTS).filter((id) => QUESTS[id].giver === npcId); }
  updateNpcMarkers() {
    if (!this.map?.npcs) return;
    for (const n of this.map.npcs) {
      const qs = this.npcQuests(n.id);
      n.marker = qs.some((id) => this.questReady(id)) ? '?' : qs.some((id) => this.questState(id) === 'available') ? '!' : null;
    }
  }

  checkHonors() {
    for (const h of HONORS) {
      if (this.save.honors.includes(h.id) || !h.check(this.save)) continue;
      this.save.honors.push(h.id);
      this.save.gold += h.gold;
      this.toast(`🏅 Conquista: ${h.name} (+${h.gold} ouro)`, '#ffd84a');
    }
  }

  // ---------- Morte ----------
  onPlayerDeath() {
    if (this.arena) this.arena.finish('Você caiu!');
    this.save.stats.deaths++;
    this.resetCombo();
  }
  respawn() {
    const lost = Math.floor(this.save.gold * 0.1);
    this.save.gold -= lost;
    this.recalc();
    this.save.hp = this.stats.maxHp; this.save.mp = this.stats.maxMp;
    this.player.buffs = []; this.player.shield = 0; this.player.inv = 90;
    this.recalc();
    this.loadMap('vila');
    if (lost) this.toast(`Você perdeu ${lost} de ouro`, '#ffb3b3');
  }

  toast(text, color = '#fff', rarity) {
    this.toasts.push({ text, color, rarity, t: 200 });
    if (this.toasts.length > 5) this.toasts.shift();
  }

  persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* sem storage */ }
  }
}
