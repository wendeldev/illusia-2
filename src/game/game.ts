import { getItem, getStage, START_STAGE } from '../data';
import type { Input } from '../engine/input';
import { loadProgress, saveProgress, type Progress } from './progress';
import { Ui, type GameApi } from './ui';
import { World, type WorldHooks } from './world';

export class Game implements GameApi {
  progress: Progress = loadProgress();
  world: World;
  ui: Ui;
  private pendingStage: { id: string; keep?: { hp: number; mp: number } } | null = null;

  private hooks: WorldHooks = {
    openNpc: (npc) => this.ui.openNpc(npc),
    changeStage: (id) => {
      const p = this.world.player;
      this.pendingStage = { id, keep: { hp: p.hp, mp: p.mp } };
    },
    playerDied: () => this.ui.showDead(),
    toast: (msg) => this.ui.toast(msg),
    save: () => saveProgress(this.progress),
  };

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
      return;
    }
    this.progress.gold -= item.price;
    this.progress.owned.push(itemId);
    this.ui.toast(`Comprado: ${item.name}`);
    saveProgress(this.progress);
  }

  equip(itemId: string): void {
    const item = getItem(itemId);
    if (!this.progress.owned.includes(itemId)) return;
    this.progress.equipped[item.slot] = itemId;
    this.world.refreshStats();
    saveProgress(this.progress);
  }

  heal(): void {
    this.world.heal();
  }

  returnToTown(): void {
    this.ui.close();
    this.pendingStage = { id: START_STAGE };
  }
}
