import { ENEMIES, getClass, getEnemy, getItem, getStage, START_STAGE, type QuestDef } from '../data';
import { bagItem, keyFor } from '../data/items';
import { generateTerrain } from './terrain';
import { DIFFICULTIES, EVENT_PHASES, EVENT_TIME, MYTHIC_BOSSES, TICKET_OF, bossId, minionId, rewardRarity, type MythicBoss } from '../data/mythic';
import { RARITY_NAMES, SET_NAMES, SET_OF, STARTER_WEAPONS, WEAPON_KINDS, setFor, usableBy, weaponKindOf } from '../data/gear';
import { autoEquip, gearScore, rollChest, type Drop } from './loot';
import type { SceneryTheme, Slot, StageDef } from '../types';
import { TRACKS } from '../data/music';
import { Sfx, vibrate } from '../engine/audio';
import type { Input } from '../engine/input';
import { WORLD_ZOOM, worldView } from '../engine/view';
import { Music } from '../engine/music';
import { QuestBook, rewardText } from './quests';
import { starBits, type StageResult } from './stars';
import { fitWeapon, loadProgress, saveProgress, type Progress } from './progress';
import { PASS } from '../data/pass';
import { CLASS_WEAPON } from '../data/gear';
import { rollGear } from './loot';
import { Ui, type GameApi } from './ui';
import { World, type WorldHooks } from './world';

export class Game implements GameApi {
  progress: Progress = loadProgress();
  world: World;
  ui: Ui;
  sfx = new Sfx();
  music = new Music(this.sfx);
  quests = new QuestBook(this.progress);
  private pendingStage: { id: string; keep?: { hp: number; mp: number }; stage?: StageDef } | null = null;
  private arenaTier = -1;
  /** evento de chefe mítico/lendário em andamento */
  eventRun: { boss: MythicBoss; diff: number; phase: number; timeLeft: number; done: boolean } | null = null;

  private hooks: WorldHooks = {
    openNpc: (npc) => this.ui.openNpc(npc),
    changeStage: (id) => {
      if (id === '@evnext') { this.nextEventPhase(); return; }
      const p = this.world.player;
      this.pendingStage = { id, keep: { hp: p.hp, mp: p.mp } };
    },
    playerDied: () => {
      if (this.eventRun && !this.eventRun.done) { this.ui.toast(`Evento falhou: ${this.eventRun.boss.name} venceu.`); this.eventRun = null; }
      this.ui.showDead();
    },
    toast: (msg) => this.ui.toast(msg),
    openMap: () => this.ui.openMap(),
    save: () => saveProgress(this.progress),
    sound: (name) => this.sfx.play(name),
    vibrate: (ms) => { if (!this.sfx.muted) vibrate(ms); },
    killed: (def) => this.questsReady(this.quests.onKill(def, this.world.stage.region)),
    stageCleared: (id) => {
      if (id === 'arena') this.arenaReward();
      else if (id.startsWith('ev_')) this.eventPhaseCleared();
      else this.questsReady(this.quests.onClear(id));
    },
    questMark: (npcId) => this.quests.mark(npcId),
    stageResult: (r) => this.recordStars(r),
    pickup: (d) => { this.applyDrop(d, true); },
  };

  /** Guarda um drop no progresso. Retorna o texto para a tela de recompensa. */
  applyDrop(d: Drop, toast: boolean): { icon: string; label: string } {
    const p = this.progress;
    switch (d.kind) {
      case 'gold':
        p.gold += d.amount;
        return { icon: 'it_coins', label: `${d.amount} G` };
      case 'gems':
        p.gems += d.amount;
        if (toast) this.ui.toast(`+${d.amount} gemas`);
        return { icon: 'it_' + d.icon, label: `${d.amount} gemas` };
      case 'bag': {
        const it = bagItem(d.id);
        const before = p.bag[d.id] ?? 0;
        p.bag[d.id] = before + d.n;
        if (toast && it && it.kind !== 'material' && it.kind !== 'potion') {
          const nova = (it.kind === 'collectible' || it.kind === 'event') && before === 0 ? ' (novo no álbum!)' : '';
          this.ui.toast(`Obtido: ${it.name}${nova}`);
        }
        if (it?.kind === 'orb' || it?.kind === 'collectible' || it?.kind === 'event') this.world.refreshStats();
        if (it?.kind === 'quest') {
          for (const q of this.quests.active()) {
            if (q.goal.kind === 'collect' && q.goal.itemId === d.id && before < q.goal.count && this.quests.isReady(q)) this.questsReady([q]);
          }
        }
        return { icon: 'it_' + d.id, label: `${it?.name ?? d.id}${d.n > 1 ? ' x' + d.n : ''}` };
      }
      case 'gear': {
        const e = getItem(d.id);
        const icon = e.icon ?? 'icon_' + d.id;
        if (p.owned.includes(d.id)) {
          const g = Math.max(50, Math.round((e.price || 2000) / 3));
          p.gold += g;
          if (toast) this.ui.toast(`${e.name} repetido: +${g} G`);
          return { icon, label: `${e.name} (repetido: +${g} G)` };
        }
        p.owned.push(d.id);
        const equipped = autoEquip(p, d.id);
        this.world.refreshStats();
        if (toast) this.ui.toast(equipped ? `Equipado: ${e.name}!` : `Obtido: ${e.name}`);
        this.sfx.play('levelup');
        return { icon, label: `${e.name}${equipped ? ' (equipado)' : ''}` };
      }
    }
  }

  // ── bolsa ──

  /** Usa/abre/equipa um item da bolsa. */
  useBagItem(id: string): void {
    const p = this.progress;
    const it = bagItem(id);
    if (!it || (p.bag[id] ?? 0) <= 0) return;
    switch (it.kind) {
      case 'potion':
        if (this.world.usePotion(id)) this.ui.toast(`Usou ${it.name}`);
        break;
      case 'chest': {
        const key = keyFor(it.tier ?? 0, p.bag);
        if (!key) { this.ui.toast(`Precisa de chave: ${it.description.replace('Precisa de uma ', '')}`); this.sfx.play('nomp'); return; }
        p.bag[id]--;
        p.bag[key]--;
        const got = rollChest(it.tier ?? 0, p.level, p.classId).map((d) => this.applyDrop(d, false));
        this.sfx.play('levelup');
        this.ui.showReward(it.name, got);
        break;
      }
      case 'card': {
        const slot = p.cards[0] === null ? 0 : p.cards[1] === null ? 1 : p.cards[0] === id ? 0 : p.cards[1] === id ? 1 : 0;
        if (p.cards.includes(id)) { p.cards[p.cards.indexOf(id)] = null; this.ui.toast(`${it.name} removida`); }
        else { p.cards[slot] = id; this.ui.toast(`${it.name} equipada`); }
        this.world.refreshStats();
        break;
      }
      case 'rune':
        p.rune = p.rune === id ? null : id;
        this.ui.toast(p.rune ? `${it.name} equipada` : `${it.name} removida`);
        this.world.refreshStats();
        break;
      case 'ticket':
        if (id === 't_key') { p.bag[id]--; p.eventPass = true; this.ui.toast('A próxima fase terá um evento de tesouro!'); }
        else if (id === 't_vip') { p.bag[id]--; p.vipPass = true; this.ui.toast('A próxima arena terá recompensas dobradas!'); }
        else if (id === 'tk_legend' || id === 'tk_myth') this.ui.openEvents();
        else this.ui.toast('Use na Arena dos Chefes (mapa do mundo)');
        break;
      default:
        this.ui.toast(it.description);
    }
    this.sfx.play('ui');
    saveProgress(p);
  }

  /** Compra um item da aba Materiais. */
  buyGood(id: string): void {
    const it = bagItem(id);
    const p = this.progress;
    if (!it?.price) return;
    const { gold = 0, gems = 0 } = it.price;
    if (p.gold < gold || p.gems < gems) { this.ui.toast(gems ? 'Gemas insuficientes (só caem de chefes)' : 'Ouro insuficiente'); this.sfx.play('nomp'); return; }
    p.gold -= gold;
    p.gems -= gems;
    p.bag[id] = (p.bag[id] ?? 0) + 1;
    this.ui.toast(`Comprado: ${it.name}`);
    this.sfx.play('coin');
    saveProgress(p);
  }

  /** Custo do próximo aprimoramento de um item (+1 a +10). */
  upgradeCost(itemId: string): { level: number; gold: number; needs: [string, string[], number][] } | null {
    const lv = this.progress.upgrades[itemId] ?? 0;
    if (lv >= 10) return null;
    const base = Math.max(100, getItem(itemId).price || 1500);
    const gold = Math.round(base * 0.15 * (lv + 1) ** 1.4);
    const needs: [string, string[], number][] = [];
    if (lv < 3) needs.push(['Minério', ['m_ore'], lv + 1]);
    else if (lv < 6) { needs.push(['Barra de Ferro', ['m_iron'], lv - 1]); needs.push(['Cristal', ['cry_blue', 'cry_red', 'cry_green', 'cry_gold', 'cry_purple', 'cry_white'], 1]); }
    else {
      needs.push(['Barra de Ouro', ['m_gold', 'm_essence'], lv - 4]);
      needs.push(['Orbe de Evolução', ['ev_green', 'ev_blue', 'ev_purple', 'ev_gold', 'ev_red', 'ev_crest', 'ev_prism'], 1]);
      needs.push(['Gema', ['$gems'], lv - 4]);
    }
    return { level: lv, gold, needs };
  }

  have(ids: string[]): number {
    if (ids[0] === '$gems') return this.progress.gems;
    return ids.reduce((a, id) => a + (this.progress.bag[id] ?? 0), 0);
  }

  upgrade(itemId: string): void {
    const c = this.upgradeCost(itemId);
    const p = this.progress;
    if (!c) { this.ui.toast('Já está no máximo (+10)'); return; }
    if (p.gold < c.gold || c.needs.some(([, ids, n]) => this.have(ids) < n)) { this.ui.toast('Faltam materiais ou ouro'); this.sfx.play('nomp'); return; }
    p.gold -= c.gold;
    for (const [, ids, n] of c.needs) {
      let left = n;
      if (ids[0] === '$gems') { p.gems -= n; continue; }
      for (const id of ids) { const take = Math.min(left, p.bag[id] ?? 0); p.bag[id] = (p.bag[id] ?? 0) - take; left -= take; }
    }
    p.upgrades[itemId] = c.level + 1;
    this.world.refreshStats();
    this.ui.toast(`${getItem(itemId).name} +${c.level + 1}!`);
    this.sfx.play('levelup');
    saveProgress(p);
  }

  // ── arena dos chefes (tíquetes) ──

  startArena(tier: number): void {
    const ticket = ['t_bronze', 't_blue', 't_purple', 't_gold'][tier];
    const p = this.progress;
    if ((p.bag[ticket] ?? 0) <= 0) { this.ui.toast(`Precisa de ${bagItem(ticket)?.name} (loja da ferreira)`); this.sfx.play('nomp'); return; }
    const pool = ENEMIES.filter((e) => e.bossAnim && (tier <= 1 ? e.hp < 600 : e.hp >= 600));
    const boss = pool[Math.floor(Math.random() * pool.length)];
    p.bag[ticket]--;
    this.arenaTier = tier;
    const themes: SceneryTheme[] = ['castle', 'volcano', 'cave', 'ruins', 'sky'];
    const width = 1100;
    const stage: StageDef = {
      id: 'arena', name: `Arena dos Chefes · ${['Fácil', 'Normal', 'Difícil', 'Lendária'][tier]}`, width, depth: 150,
      theme: themes[Math.floor(Math.random() * themes.length)], terrain: generateTerrain(7 + tier, width, 0.6),
      level: p.level + tier * 3, power: 1, spawn: { x: 120, y: 75 }, npcs: [],
      portals: [{ x: width - 60, y: 75, to: 'lumen', label: 'Voltar à vila', requiresClear: true }],
      waves: [{ triggerX: 300, enemies: [{ enemyId: getEnemy(boss.id).id, count: 1 }] }],
    };
    this.ui.close();
    const pl = this.world.player;
    this.pendingStage = { id: 'arena', keep: { hp: pl.hp, mp: pl.mp }, stage };
    this.ui.toast(`Desafio: ${boss.name}!`);
  }

  // ── eventos dos chefes Lendários e Míticos ──

  startEvent(bossKey: string, diff: number): void {
    const boss = MYTHIC_BOSSES.find((b) => b.key === bossKey);
    if (!boss) return;
    const p = this.progress;
    if (this.eventRun) { this.ui.toast('Você já está num evento'); return; }
    const ticket = TICKET_OF[boss.tier];
    if ((p.bag[ticket] ?? 0) <= 0) { this.ui.toast(`Precisa de ${bagItem(ticket)?.name} (loja da ferreira ou chefes)`); this.sfx.play('nomp'); return; }
    p.bag[ticket]--;
    this.eventRun = { boss, diff, phase: 1, timeLeft: EVENT_TIME, done: false };
    this.ui.close();
    this.pendingStage = { id: 'ev', keep: { hp: this.world.player.maxHp, mp: this.world.player.maxMp }, stage: this.eventStage() };
    this.ui.toast(`${boss.name} · ${DIFFICULTIES[diff].name}: 8 fases em 40 minutos!`);
    this.sfx.play('levelup');
    saveProgress(p);
  }

  private eventStage(): StageDef {
    const run = this.eventRun!;
    const { boss, diff, phase } = run;
    const D = DIFFICULTIES[diff];
    const width = 1300 + phase * 90;
    const last = phase === EVENT_PHASES;
    const seed = 300 + MYTHIC_BOSSES.indexOf(boss) * 17 + phase * 5;
    const minion = (k: number) => minionId(boss.key, (phase + k) % 6);
    const nw = last ? 2 : 2 + Math.floor(phase / 3);
    const waves = [];
    for (let k = 0; k < nw; k++) {
      const n = Math.ceil((2 + phase) / 2);
      const enemies = [{ enemyId: minion(k), count: n }, { enemyId: minion(k + 2), count: Math.max(1, n - 1) }];
      if (!last && k === nw - 1 && (phase === 4 || phase === 7)) enemies.push({ enemyId: minionId(boss.key, 6), count: 1 });
      if (last && k === nw - 1) enemies.splice(0, enemies.length, { enemyId: bossId(boss.key), count: 1 }, { enemyId: minion(1), count: 2 });
      waves.push({ triggerX: 260 + Math.round((k * (width - 560)) / nw), enemies });
    }
    return {
      id: `ev_${boss.key}_${phase}`, name: `${boss.name} · Fase ${phase}/${EVENT_PHASES} · ${D.name}`, width, depth: 150,
      theme: boss.theme, pano: `pano_my_${boss.key}`, terrain: generateTerrain(seed, width, 0.8),
      level: this.progress.level + D.levelAdd + Math.floor(phase / 2), power: 1, hpMul: D.hpMul, atkMul: D.atkMul,
      mood: boss.tier === 'myth' ? 'night' : undefined,
      spawn: { x: 120, y: 75 }, npcs: [],
      portals: [last
        ? { x: width - 60, y: 75, to: START_STAGE, label: 'Voltar à vila', requiresClear: true }
        : { x: width - 60, y: 75, to: '@evnext', label: `Fase ${phase + 1}`, requiresClear: true }],
      waves,
    };
  }

  private nextEventPhase(): void {
    const run = this.eventRun;
    if (!run) return;
    run.phase++;
    const pl = this.world.player;
    this.pendingStage = { id: 'ev', keep: { hp: pl.hp, mp: pl.mp }, stage: this.eventStage() };
  }

  private eventPhaseCleared(): void {
    const run = this.eventRun;
    if (!run) return;
    if (run.phase < EVENT_PHASES) { this.ui.toast(`Fase ${run.phase}/${EVENT_PHASES} vencida! Siga para o portal.`); return; }
    run.done = true;
    const p = this.progress;
    const { boss, diff } = run;
    const r = rewardRarity(boss.tier, diff);
    const ids = setFor(p.classId, r);
    const got: { icon: string; label: string }[] = [];
    for (const id of ids) {
      const e = getItem(id);
      if (!p.owned.includes(id)) p.owned.push(id);
      p.equipped[e.slot] = id;
      got.push({ icon: e.icon ?? '', label: e.name });
    }
    const myth = boss.tier === 'myth' ? 2 : 1;
    got.push(this.applyDrop({ kind: 'gems', amount: (diff ? 40 : 20) * myth, icon: 'gem_rainbow' }, false));
    got.push(this.applyDrop({ kind: 'gold', amount: (3000 + p.level * 150) * myth * (diff + 1) }, false));
    p.eventsCleared = { ...(p.eventsCleared ?? {}), [boss.key]: (p.eventsCleared?.[boss.key] ?? 0) | (1 << diff) };
    this.world.refreshStats();
    const used = EVENT_TIME - run.timeLeft;
    this.ui.showReward(`${boss.name} derrotado em ${Math.floor(used / 60)} min! Set ${RARITY_NAMES[r]} do ${SET_NAMES[SET_OF[p.classId ?? 'warrior']]}`, got);
    this.sfx.play('levelup');
    saveProgress(p);
  }

  private arenaReward(): void {
    const tier = this.arenaTier;
    this.arenaTier = -1;
    const p = this.progress;
    const mul = p.vipPass ? 2 : 1;
    p.vipPass = false;
    const drops: Drop[] = [
      { kind: 'gems', amount: (tier + 1) * 3 * mul, icon: 'gem_purple' },
      { kind: 'gold', amount: (500 + p.level * 60) * (tier + 1) * mul },
      { kind: 'bag', id: ['chest_blue', 'chest_purple', 'chest_gold', 'chest_angel'][tier], n: mul },
      { kind: 'bag', id: ['key_silver', 'key_ruby', 'key_amethyst', 'key_angel'][tier], n: mul },
    ];
    const got = drops.map((d) => this.applyDrop(d, false));
    this.ui.showReward(`Arena vencida!${mul > 1 ? ' (VIP x2)' : ''}`, got);
    saveProgress(p);
  }

  /** Salva as estrelas (somando às que já tinha) e dá bônus pelas novas. */
  private recordStars(r: Pick<StageResult, 'stageId' | 'time' | 'par' | 'damage' | 'stars'>): void {
    const before = this.progress.stars[r.stageId] ?? 0;
    const now = starBits(r.stars);
    const newStars = r.stars.map((on, i) => on && !((before >> i) & 1)) as [boolean, boolean, boolean];
    const power = this.world.stage.power ?? 1;
    const bonusGold = newStars.filter(Boolean).length * Math.round(20 * power);
    this.progress.stars[r.stageId] = before | now;
    this.progress.gold += bonusGold;
    saveProgress(this.progress);
    this.ui.showResult({ ...r, newStars, bonusGold });
  }

  private questsReady(list: QuestDef[]): void {
    for (const q of list) {
      this.ui.toast(`Missão pronta: ${q.title} — volte a ${this.quests.giverName(q)}`);
      this.sfx.play('levelup');
    }
  }

  constructor(private input: Input) {
    this.ui = new Ui(this, input);
    this.world = this.makeWorld(START_STAGE);
    // primeiro jogo (ou save de antes das classes): escolher a classe
    if (!this.progress.classId) this.ui.openClasses(true);
  }

  save(): void {
    saveProgress(this.progress);
  }

  chooseClass(id: string): void {
    const changed = this.progress.classId !== id;
    this.progress.classId = id;
    // cada classe com a sua arma: troca para a melhor arma da nova classe (ou a inicial dela)
    fitWeapon(this.progress);
    this.world.refreshStats(true);
    saveProgress(this.progress);
    this.sfx.play('levelup');
    if (changed) this.ui.toast(`Classe: ${getClass(id).name}`);
  }

  private makeWorld(id: string, keep?: { hp: number; mp: number }, stage?: StageDef): World {
    return new World(stage ?? getStage(id), this.progress, this.hooks, keep);
  }

  update(dt: number): void {
    this.input.update();
    const paused = this.ui.update(dt);
    if (!paused) {
      for (const [act, kind] of [['potHp', 'hp'], ['potMp', 'mp']] as const) {
        if (!this.input.consume(act)) continue;
        const id = this.ui.bestPotion(kind);
        if (!id) { this.ui.toast(kind === 'hp' ? 'Sem poções de vida' : 'Sem poções de mana'); this.sfx.play('nomp'); }
        else this.world.usePotion(id);
      }
    }
    worldView(true);
    try { this.world.update(dt, this.input, !paused); } finally { worldView(false); }
    const run = this.eventRun;
    if (run && !run.done && !paused && this.world.stage.id.startsWith('ev_')) {
      run.timeLeft -= dt;
      if (run.timeLeft <= 0) {
        this.eventRun = null;
        this.ui.toast(`Tempo esgotado! ${run.boss.name} escapou.`);
        this.sfx.play('nomp');
        this.returnToTown();
      }
    }
    // saiu do evento (voltou à vila depois de vencer)
    if (run?.done && this.world.stage.id === START_STAGE) this.eventRun = null;
    // música da região; trilha de chefe enquanto houver um vivo
    this.music.play(this.world.boss ? TRACKS.boss : TRACKS[this.world.stage.theme]);
    if (this.pendingStage) {
      this.world = this.makeWorld(this.pendingStage.id, this.pendingStage.keep, this.pendingStage.stage);
      this.pendingStage = null;
      saveProgress(this.progress);
    }
    this.input.endFrame();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // o mundo é desenhado com zoom (celular) e os menus por cima, no tamanho normal
    worldView(true);
    ctx.save();
    ctx.scale(WORLD_ZOOM, WORLD_ZOOM);
    try { this.world.render(ctx); } finally { ctx.restore(); worldView(false); }
    this.ui.render(ctx);
  }

  // ── ações chamadas pela interface ──

  buy(itemId: string): void {
    const item = getItem(itemId);
    if (this.progress.owned.includes(itemId)) return;
    if (item.priceGems) {
      if (this.progress.gems < item.priceGems) { this.ui.toast('Gemas insuficientes (caem dos chefes)'); this.sfx.play('nomp'); return; }
      this.progress.gems -= item.priceGems;
    } else {
      if (this.progress.gold < item.price) { this.ui.toast('Ouro insuficiente'); this.sfx.play('nomp'); return; }
      this.progress.gold -= item.price;
    }
    this.progress.owned.push(itemId);
    const ok = usableBy(item, this.progress.classId);
    if (ok) this.progress.equipped[item.slot] = itemId;
    this.world.refreshStats();
    this.ui.toast(ok ? `Comprado e equipado: ${item.name}` : `Comprado: ${item.name}`);
    this.sfx.play('coin');
    saveProgress(this.progress);
  }

  /** Tira o equipamento do espaço (fica no inventário). */
  unequip(slot: Slot): void {
    if (!this.progress.equipped[slot]) return;
    delete this.progress.equipped[slot];
    this.world.refreshStats();
    this.sfx.play('ui');
    saveProgress(this.progress);
  }

  /** Valor de venda: metade do preço (gemas para Mítico/Divino); itens sem preço pela força. */
  sellValue(itemId: string): { gold: number; gems: number } {
    const e = getItem(itemId);
    if (e.priceGems) return { gold: 0, gems: Math.max(1, Math.floor(e.priceGems / 2)) };
    return { gold: Math.max(10, Math.round(e.price ? e.price / 2 : gearScore(e) * 25)), gems: 0 };
  }

  sell(itemId: string): void {
    const p = this.progress;
    const e = getItem(itemId);
    if (!p.owned.includes(itemId)) return;
    if (p.equipped[e.slot] === itemId) { this.ui.toast('Desequipe antes de vender'); this.sfx.play('nomp'); return; }
    if (STARTER_WEAPONS.has(itemId)) { this.ui.toast('A arma inicial não pode ser vendida'); this.sfx.play('nomp'); return; }
    const v = this.sellValue(itemId);
    p.gold += v.gold;
    p.gems += v.gems;
    p.owned = p.owned.filter((id) => id !== itemId);
    delete p.upgrades[itemId];
    this.ui.toast(`Vendido: ${e.name} (+${v.gems ? `${v.gems} gemas` : `${v.gold} G`})`);
    this.sfx.play('coin');
    saveProgress(p);
  }

  equip(itemId: string): void {
    const item = getItem(itemId);
    if (!this.progress.owned.includes(itemId)) return;
    if (!usableBy(item, this.progress.classId)) {
      const cls = getClass(this.progress.classId ?? 'warrior').name;
      this.ui.toast(`${cls} não usa ${WEAPON_KINDS[weaponKindOf(item) ?? 'sword']?.name.toLowerCase() ?? 'esta arma'}`);
      this.sfx.play('nomp');
      return;
    }
    this.progress.equipped[item.slot] = itemId;
    this.world.refreshStats();
    this.sfx.play('ui');
    saveProgress(this.progress);
  }

  /** Estado de uma recompensa do passe: resgatada, disponível, falta nível ou faltam gemas. */
  passState(id: string): 'claimed' | 'ready' | 'level' | 'gems' {
    const p = this.progress, r = PASS.find((x) => x.id === id);
    if (!r || (p.passClaimed ?? []).includes(id)) return 'claimed';
    if (p.level < r.level) return 'level';
    if (r.gems && p.gems < r.gems) return 'gems';
    return 'ready';
  }

  /** Resgata uma recompensa do passe (grátis: só o nível; pago: nível e gemas). */
  claimPass(id: string): void {
    const p = this.progress, r = PASS.find((x) => x.id === id);
    if (!r) return;
    const st = this.passState(id);
    if (st === 'claimed') return;
    if (st === 'level') { this.ui.toast(`Chegue ao nível ${r.level} para resgatar`); this.sfx.play('nomp'); return; }
    if (st === 'gems') { this.ui.toast(`Faltam gemas (${r.gems})`); this.sfx.play('nomp'); return; }
    if (r.gems) p.gems -= r.gems;
    p.passClaimed = [...(p.passClaimed ?? []), id];
    const cls = p.classId ?? 'warrior';
    const got: { icon: string; label: string }[] = [];
    for (const g of r.give) {
      if (g.kind === 'bag') got.push(this.applyDrop({ kind: 'bag', id: g.id, n: g.n }, false));
      else if (g.kind === 'exp') { this.world.gainExp(g.n, false); got.push({ icon: r.icon, label: `${g.n} XP` }); }
      else if (g.kind === 'gear') got.push(this.applyDrop({ kind: 'gear', id: g.id }, false));
      else if (g.kind === 'classWeapon') got.push(this.applyDrop({ kind: 'gear', id: `wp_${CLASS_WEAPON[cls] ?? 'sword'}_${g.style}` }, false));
      else if (g.kind === 'classPiece') got.push(this.applyDrop({ kind: 'gear', id: `ar_${SET_OF[cls] ?? 'warrior'}_${g.part}_${g.skin}` }, false));
      else if (g.kind === 'randomGear') {
        const gid = rollGear(Math.max(p.level, 12), 2, 0, cls);
        if (gid) got.push(this.applyDrop({ kind: 'gear', id: gid }, false));
      }
    }
    this.world.refreshStats();
    this.sfx.play('levelup');
    saveProgress(p);
    this.ui.showReward(`Passe de batalha: ${r.name}`, got, true);
  }

  heal(): void {
    this.world.heal();
    this.sfx.play('levelup');
  }

  acceptQuest(q: QuestDef): void {
    this.quests.accept(q);
    this.ui.toast(`Nova missão: ${q.title}`);
    this.sfx.play('ui');
    saveProgress(this.progress);
  }

  completeQuest(q: QuestDef): void {
    if (!this.quests.isReady(q)) return;
    this.quests.complete(q);
    const r = q.reward;
    if (r.gold) this.progress.gold += r.gold;
    if (r.item) {
      if (this.progress.owned.includes(r.item)) this.progress.gold += Math.round(getItem(r.item).price / 2);
      else this.progress.owned.push(r.item);
    }
    if (r.exp) this.world.gainExp(r.exp, false);
    this.ui.toast(`Recompensa: ${rewardText(r)}`);
    this.sfx.play('coin');
    saveProgress(this.progress);
  }

  travel(stageId: string): void {
    const p = this.world.player;
    this.pendingStage = { id: stageId, keep: { hp: p.hp, mp: p.mp } };
  }

  returnToTown(): void {
    this.ui.close();
    if (this.eventRun && !this.eventRun.done) this.ui.toast('Você saiu do evento.');
    this.eventRun = null;
    this.pendingStage = { id: START_STAGE };
  }
}
