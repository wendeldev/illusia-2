import { ENEMIES, getClass, getEnemy, getItem, getStage, START_STAGE, type QuestDef } from '../data';
import { bagItem, keyFor } from '../data/items';
import { generateTerrain } from './terrain';
import { autoEquip, rollChest, type Drop } from './loot';
import type { SceneryTheme, StageDef } from '../types';
import { TRACKS } from '../data/music';
import { Sfx, vibrate } from '../engine/audio';
import type { Input } from '../engine/input';
import { Music } from '../engine/music';
import { QuestBook, rewardText } from './quests';
import { starBits, type StageResult } from './stars';
import { loadProgress, saveProgress, type Progress } from './progress';
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

  private hooks: WorldHooks = {
    openNpc: (npc) => this.ui.openNpc(npc),
    changeStage: (id) => {
      const p = this.world.player;
      this.pendingStage = { id, keep: { hp: p.hp, mp: p.mp } };
    },
    playerDied: () => this.ui.showDead(),
    toast: (msg) => this.ui.toast(msg),
    openMap: () => this.ui.openMap(),
    save: () => saveProgress(this.progress),
    sound: (name) => this.sfx.play(name),
    vibrate: (ms) => { if (!this.sfx.muted) vibrate(ms); },
    killed: (def) => this.questsReady(this.quests.onKill(def, this.world.stage.region)),
    stageCleared: (id) => { if (id === 'arena') this.arenaReward(); else this.questsReady(this.quests.onClear(id)); },
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
        const got = rollChest(it.tier ?? 0, p.level).map((d) => this.applyDrop(d, false));
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
    this.world.update(dt, this.input, !paused);
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
    this.world.render(ctx);
    this.ui.render(ctx);
  }

  // ── ações chamadas pela interface ──

  buy(itemId: string): void {
    const item = getItem(itemId);
    if (this.progress.owned.includes(itemId)) return;
    if (this.progress.gold < item.price) {
      this.ui.toast('Ouro insuficiente');
      this.sfx.play('nomp');
      return;
    }
    this.progress.gold -= item.price;
    this.progress.owned.push(itemId);
    this.ui.toast(`Comprado: ${item.name}`);
    this.sfx.play('coin');
    saveProgress(this.progress);
  }

  equip(itemId: string): void {
    const item = getItem(itemId);
    if (!this.progress.owned.includes(itemId)) return;
    this.progress.equipped[item.slot] = itemId;
    this.world.refreshStats();
    this.sfx.play('ui');
    saveProgress(this.progress);
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
    this.pendingStage = { id: START_STAGE };
  }
}
