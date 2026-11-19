import { getItem, getStage, START_STAGE, type QuestDef } from '../data';
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
  private pendingStage: { id: string; keep?: { hp: number; mp: number } } | null = null;

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
    stageCleared: (id) => this.questsReady(this.quests.onClear(id)),
    questMark: (npcId) => this.quests.mark(npcId),
    stageResult: (r) => this.recordStars(r),
  };

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
  }

  private makeWorld(id: string, keep?: { hp: number; mp: number }): World {
    return new World(getStage(id), this.progress, this.hooks, keep);
  }

  update(dt: number): void {
    this.input.update();
    const paused = this.ui.update(dt);
    this.world.update(dt, this.input, !paused);
    // música da região; trilha de chefe enquanto houver um vivo
    this.music.play(this.world.boss ? TRACKS.boss : TRACKS[this.world.stage.theme]);
    if (this.pendingStage) {
      this.world = this.makeWorld(this.pendingStage.id, this.pendingStage.keep);
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
