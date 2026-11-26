import { CLASSES, EQUIPMENT, getClass, hasItem, getEnemy, getItem, getStage, REGIONS, STAGES_PER_REGION, stageId, type QuestDef } from '../data';
import type { Sfx } from '../engine/audio';
import type { Music } from '../engine/music';
import { drawFit, drawSprite, drawSpriteH, drawSub, frameSize, hasSprite, spritesReady, tileAspect } from '../engine/sprites';
import { glow } from './art/scene3d';
import { drawDollIdle } from './art/layers';
import { PASS } from '../data/pass';
import { CLASS_WEAPON, RARITY_COLORS, RARITY_NAMES, SET_NAMES, SET_OF, SHOP_CATEGORIES, STARTER_WEAPON, STARTER_WEAPONS, WEAPON_KINDS, setFor, usableBy } from '../data/gear';
import { gearScore } from './loot';
import { DIFFICULTIES, EVENT_PHASES, MYTHIC_BOSSES, rewardRarity, TICKET_OF, type MythicBoss } from '../data/mythic';
import { rewardText, type QuestBook } from './quests';
import { assignSlot, SLOT_COUNT, slotSkills } from './skillslots';
import { affinity, BAG_ITEMS, bagItem, SHOP_GOODS, type BagKind } from '../data/items';
import { collectionCount, setBonus, upgradeMul } from './stats';
import { BUFFS } from './world';
import type { EquipmentDef, Slot } from '../types';
import { countStars, DAMAGE_LIMIT, drawStar, drawStars, formatTime, type StageResult } from './stars';
import type { Input, TouchButton } from '../engine/input';
import { VIEW_H, VIEW_W } from '../engine/view';
import type { NpcDef, SceneryTheme } from '../types';
import { bar, circle, text, wrapText } from './draw';
import type { Progress } from './progress';
import { describeBonus, expToNext, SLOT_NAMES } from './stats';
import { levelColor, type World } from './world';

export interface GameApi {
  progress: Progress;
  world: World;
  sfx: Sfx;
  music: Music;
  quests: QuestBook;
  acceptQuest(q: QuestDef): void;
  completeQuest(q: QuestDef): void;
  buy(itemId: string): void;
  equip(itemId: string): void;
  heal(): void;
  returnToTown(): void;
  travel(stageId: string): void;
  chooseClass(id: string): void;
  save(): void;
  useBagItem(id: string): void;
  buyGood(id: string): void;
  upgradeCost(itemId: string): { level: number; gold: number; needs: [string, string[], number][] } | null;
  have(ids: string[]): number;
  upgrade(itemId: string): void;
  startArena(tier: number): void;
  startEvent(bossKey: string, diff: number): void;
  passState(id: string): 'claimed' | 'ready' | 'level' | 'gems';
  claimPass(id: string): void;
  unequip(slot: Slot): void;
  sell(itemId: string): void;
  sellValue(itemId: string): { gold: number; gems: number };
  eventRun: { boss: MythicBoss; diff: number; phase: number; timeLeft: number; done: boolean } | null;
}

type Modal =
  | { kind: 'dialog'; npc: NpcDef; lines: string[]; line: number; after: () => void }
  | { kind: 'offer'; npc: NpcDef; quest: QuestDef; sel: number }
  | { kind: 'quests' }
  | { kind: 'classes'; sel: number; first: boolean }
  | { kind: 'skills'; slot: number; sel: number }
  | { kind: 'result'; r: StageResult; t: number; shown: number }
  | { kind: 'shop'; npc: NpcDef; sel: number; scroll: number; tab: number; cat: number; allSets?: boolean }
  | { kind: 'bag'; tab: number; sel: string | null; filter: number; page: number; sort: number }
  | { kind: 'reward'; title: string; items: { icon: string; label: string }[]; t: number; back?: Modal }
  | { kind: 'pass'; scroll: [number, number] }
  | { kind: 'arena' }
  | { kind: 'events'; sel: number; diff: number }
  | { kind: 'menu'; sel: number; scroll: number }
  | { kind: 'map'; region: number; sel: number }
  | { kind: 'dead' };

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
}

// x é medido a partir da borda DIREITA da tela (a largura varia por aparelho)
const BUTTON_LAYOUT: TouchButton[] = [
  { action: 'attack', x: 60, y: 298, r: 34, label: '⚔' },
  { action: 'jump', x: 142, y: 320, r: 27, label: '▲' },
  { action: 'skill1', x: 132, y: 250, r: 22, label: '1' },
  { action: 'skill2', x: 66, y: 214, r: 22, label: '2' },
  { action: 'skill3', x: 200, y: 280, r: 22, label: '3' },
  { action: 'skill4', x: 140, y: 186, r: 22, label: '4' },
  { action: 'interact', x: 214, y: 330, r: 16, label: '✋' },
  { action: 'menu', x: 26, y: 24, r: 16, label: '☰' },
  { action: 'potHp', x: 26, y: 66, r: 15, label: 'HP' },
  { action: 'potMp', x: 26, y: 102, r: 15, label: 'MP' },
  { action: 'bag', x: 26, y: 138, r: 15, label: '🎒' },
];
const BUTTONS: TouchButton[] = BUTTON_LAYOUT.map((b) => ({ ...b }));

const SHOP_ROWS = 9;
const MENU_ROWS = 11;

const THEME_COLORS: Record<SceneryTheme, [string, string]> = {
  village: ['#8fc8f0', '#6aa048'], forest: ['#a8dcc4', '#3f8a45'], swamp: ['#9ab4a0', '#4f6a3a'],
  ruins: ['#f2a07b', '#c8b490'], desert: ['#9fd0ec', '#e0b478'], cave: ['#2a2638', '#5a5474'],
  snow: ['#b0d4f0', '#eef6fc'], volcano: ['#5a2220', '#ff6a2a'], castle: ['#33264f', '#5a5670'], sky: ['#8cc8f4', '#ffffff'],
};

function layoutButtons(): void {
  BUTTON_LAYOUT.forEach((b, i) => { BUTTONS[i].x = VIEW_W - b.x; });
}

export class Ui {
  modal: Modal | null = null;
  private toasts: { text: string; life: number }[] = [];
  /** áreas clicáveis do último quadro desenhado (a última registrada tem prioridade) */
  private regions: Region[] = [];
  private prevAxisY = 0;
  private prevAxisX = 0;

  constructor(private game: GameApi, private input: Input) {
    layoutButtons();
    input.buttons = BUTTONS;
  }

  toast(msg: string): void {
    this.toasts.push({ text: msg, life: 2.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  private openMenu(): void {
    this.modal = { kind: 'menu', sel: 0, scroll: 0 };
    this.game.sfx.play('ui');
  }

  // ── mapa do mundo ──

  private unlocked(n: number): boolean {
    return n <= 1 || this.game.progress.cleared.includes(stageId(n - 1));
  }

  openMap(): void {
    // abre na fase mais avançada liberada
    let n = 1;
    while (n < REGIONS.length * STAGES_PER_REGION && this.unlocked(n + 1)) n++;
    this.modal = { kind: 'map', region: Math.floor((n - 1) / STAGES_PER_REGION), sel: (n - 1) % STAGES_PER_REGION };
    this.game.sfx.play('ui');
  }

  private mapMove(m: Extract<Modal, { kind: 'map' }>, delta: number): void {
    let n = m.region * STAGES_PER_REGION + m.sel + delta;
    n = Math.max(0, Math.min(REGIONS.length * STAGES_PER_REGION - 1, n));
    m.region = Math.floor(n / STAGES_PER_REGION);
    m.sel = n % STAGES_PER_REGION;
  }

  private mapEnter(m: Extract<Modal, { kind: 'map' }>): void {
    const n = m.region * STAGES_PER_REGION + m.sel + 1;
    if (!this.unlocked(n)) {
      this.toast('Vença a fase anterior para liberar esta');
      this.game.sfx.play('nomp');
      return;
    }
    this.close();
    this.game.travel(stageId(n));
  }

  openNpc(npc: NpcDef): void {
    this.game.sfx.play('ui');
    const after = () => this.npcAction(npc);
    const cur = this.game.quests.current(npc.id);
    if (!cur) return this.dialog(npc, npc.dialog, after);
    const q = cur.quest;
    switch (cur.status) {
      case 'ready':
        return this.dialog(npc, [q.thanks, `Recompensa: ${rewardText(q.reward)}`], () => {
          this.game.completeQuest(q);
          // se houver outra missão em seguida, já oferece
          const next = this.game.quests.current(npc.id);
          if (next?.status === 'offer') this.dialog(npc, next.quest.intro, () => this.offer(npc, next.quest));
          else after();
        });
      case 'active': {
        const qb = this.game.quests;
        return this.dialog(npc, [`${q.title}: ${q.goal.label} (${qb.count(q)}/${qb.target(q)}).`, 'Volte quando terminar!'], after);
      }
      case 'offer':
        return this.dialog(npc, q.intro, () => this.offer(npc, q));
    }
  }

  private dialog(npc: NpcDef, lines: string[], after: () => void): void {
    this.modal = { kind: 'dialog', npc, lines, line: 0, after };
  }

  private offer(npc: NpcDef, quest: QuestDef): void {
    this.modal = { kind: 'offer', npc, quest, sel: 0 };
  }

  private answerOffer(m: Extract<Modal, { kind: 'offer' }>, accept: boolean): void {
    if (accept) this.game.acceptQuest(m.quest);
    else this.game.sfx.play('ui');
    this.npcAction(m.npc);
  }

  /** O que o NPC faz depois da conversa: loja, cura ou nada. */
  private npcAction(npc: NpcDef): void {
    switch (npc.action) {
      case 'shop':
        this.modal = { kind: 'shop', npc, sel: 0, scroll: 0, tab: 0, cat: 0 };
        break;
      case 'heal':
        this.game.heal();
        this.toast('HP e MP restaurados');
        this.close();
        break;
      case 'talk':
        this.close();
        break;
    }
  }

  /** Tela de escolha de classe. `first` = primeiro jogo (não dá para fechar sem escolher). */
  openClasses(first = false): void {
    const cur = CLASSES.findIndex((c) => c.id === this.game.progress.classId);
    this.modal = { kind: 'classes', sel: Math.max(0, cur), first };
  }

  showResult(r: StageResult): void {
    this.modal = { kind: 'result', r, t: 0, shown: 0 };
  }

  showReward(title: string, items: { icon: string; label: string }[], backToPrev = false): void {
    this.modal = { kind: 'reward', title, items, t: 0, back: backToPrev && this.modal ? this.modal : undefined };
  }

  openBag(tab = 0): void {
    this.modal = { kind: 'bag', tab, sel: null, filter: 0, page: 0, sort: 0 };
    this.game.sfx.play('ui');
  }

  openEvents(): void {
    this.modal = { kind: 'events', sel: 0, diff: 0 };
    this.game.sfx.play('ui');
  }

  openPass(): void {
    this.modal = { kind: 'pass', scroll: [0, 0] };
    this.game.sfx.play('ui');
  }

  showDead(): void {
    this.modal = { kind: 'dead' };
  }

  close(): void {
    this.modal = null;
  }

  /** Retorna true se um menu está aberto (o mundo fica pausado). */
  update(dt: number): boolean {
    for (const t of this.toasts) t.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    const input = this.input;

    for (const t of input.taps) {
      const r = [...this.regions].reverse().find((r) => t.x >= r.x && t.x <= r.x + r.w && t.y >= r.y && t.y <= r.y + r.h);
      if (r) { r.fn(); break; }
    }

    if (!this.modal && input.consume('menu')) this.openMenu();
    if (!this.modal && input.consume('bag')) this.openBag();
    if (!this.modal && input.consume('events')) this.openEvents();
    if (!this.modal && input.consume('pass')) this.openPass();
    input.buttonsEnabled = !this.modal;
    const m = this.modal;
    if (!m) return false;

    const ay = input.axis.y, ax = input.axis.x;
    const up = ay < -0.5 && this.prevAxisY >= -0.5;
    const down = ay > 0.5 && this.prevAxisY <= 0.5;
    const left = ax < -0.5 && this.prevAxisX >= -0.5;
    const right = ax > 0.5 && this.prevAxisX <= 0.5;
    this.prevAxisY = ay;
    this.prevAxisX = ax;
    const confirm = input.consume('attack') || input.consume('interact') || input.consume('jump');
    const back = input.consume('menu');

    switch (m.kind) {
      case 'dialog':
        if (confirm) this.advanceDialog(m);
        else if (back) this.close();
        break;
      case 'shop':
      case 'menu': {
        if (m.kind === 'shop') {
          if (left) { m.tab = (m.tab + 2) % 3; m.sel = 0; m.scroll = 0; }
          if (right) { m.tab = (m.tab + 1) % 3; m.sel = 0; m.scroll = 0; }
          if (m.tab !== 0) { if (back) this.close(); break; }
        }
        const list = m.kind === 'shop' ? this.shopList(m) : this.game.progress.owned;
        if (up) m.sel = Math.max(0, m.sel - 1);
        if (down) m.sel = Math.min(list.length - 1, m.sel + 1);
        if (up || down) this.keepVisible(m, m.kind === 'shop' ? SHOP_ROWS : MENU_ROWS);
        if (confirm && list[m.sel]) this.itemAction(list[m.sel]);
        if (back) this.close();
        break;
      }
      case 'map':
        if (left) this.mapMove(m, -1);
        if (right) this.mapMove(m, 1);
        if (up) this.mapMove(m, -5);
        if (down) this.mapMove(m, 5);
        if (confirm) this.mapEnter(m);
        if (back) this.close();
        break;
      case 'offer':
        if (left || up) m.sel = 0;
        if (right || down) m.sel = 1;
        if (confirm) this.answerOffer(m, m.sel === 0);
        else if (back) this.answerOffer(m, false);
        break;
      case 'quests':
        if (confirm || back) this.close();
        break;
      case 'bag':
        if (left) m.tab = (m.tab + 4) % 5;
        if (right) m.tab = (m.tab + 1) % 5;
        if (back) this.close();
        break;
      case 'pass':
        if (up) m.scroll = [Math.max(0, m.scroll[0] - 1), Math.max(0, m.scroll[1] - 1)];
        if (down) m.scroll = [m.scroll[0] + 1, m.scroll[1] + 1];
        if (back) this.close();
        break;
      case 'reward':
        m.t += dt;
        if ((confirm || back) && m.t > 0.4) this.modal = m.back ?? null;
        break;
      case 'events':
        if (up) m.sel = (m.sel + MYTHIC_BOSSES.length - 1) % MYTHIC_BOSSES.length;
        if (down) m.sel = (m.sel + 1) % MYTHIC_BOSSES.length;
        if (left || right) m.diff = 1 - m.diff;
        if (confirm) this.game.startEvent(MYTHIC_BOSSES[m.sel].key, m.diff);
        if (back) this.close();
        break;
      case 'arena':
        if (back) this.close();
        break;
      case 'skills': {
        const list = this.game.world.cls.skills;
        if (left) m.slot = (m.slot + SLOT_COUNT - 1) % SLOT_COUNT;
        if (right) m.slot = (m.slot + 1) % SLOT_COUNT;
        if (up) m.sel = Math.max(0, m.sel - 1);
        if (down) m.sel = Math.min(list.length - 1, m.sel + 1);
        if (confirm && list[m.sel]) this.pickSkill(m, list[m.sel].id);
        if (back) this.modal = { kind: 'menu', sel: 0, scroll: 0 };
        break;
      }
      case 'classes':
        if (left) m.sel = (m.sel + CLASSES.length - 1) % CLASSES.length;
        if (right) m.sel = (m.sel + 1) % CLASSES.length;
        if (confirm) { this.game.chooseClass(CLASSES[m.sel].id); this.close(); }
        else if (back && !m.first) this.close();
        break;
      case 'result': {
        m.t += dt;
        // as estrelas aparecem uma a uma, com som
        const due = Math.min(3, Math.floor((m.t - 0.25) / 0.35) + 1);
        while (m.shown < due) {
          if (m.r.stars[m.shown]) this.game.sfx.play(m.r.newStars[m.shown] ? 'levelup' : 'coin');
          m.shown++;
        }
        if ((confirm || back) && m.t > 0.6) this.close();
        break;
      }
      case 'dead':
        if (confirm) this.game.returnToTown();
        break;
    }
    return true;
  }

  private advanceDialog(m: Extract<Modal, { kind: 'dialog' }>): void {
    m.line++;
    this.game.sfx.play('ui');
    if (m.line >= m.lines.length) m.after();
  }

  private itemAction(itemId: string): void {
    if (this.game.progress.owned.includes(itemId)) this.game.equip(itemId);
    else this.game.buy(itemId);
  }

  // ───────────────────────── desenho ─────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    layoutButtons();
    this.regions = [];
    this.drawHud(ctx);
    if (!this.modal) this.drawControls(ctx);
    this.toasts.forEach((t, i) => {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      text(ctx, t.text, VIEW_W / 2, 132 + i * 18, { size: 13, align: 'center', color: '#ffe9a8' });
      ctx.globalAlpha = 1;
    });
    const m = this.modal;
    if (!m) return;
    switch (m.kind) {
      case 'dialog': return this.drawDialog(ctx, m);
      case 'shop': return this.drawShop(ctx, m);
      case 'menu': return this.drawMenu(ctx, m);
      case 'map': return this.drawMap(ctx, m);
      case 'offer': return this.drawOffer(ctx, m);
      case 'quests': return this.drawQuests(ctx);
      case 'classes': return this.drawClasses(ctx, m);
      case 'skills': return this.drawSkills(ctx, m);
      case 'bag': return this.drawBag(ctx, m);
      case 'reward': return this.drawReward(ctx, m);
      case 'pass': return this.drawPass(ctx, m);
      case 'arena': return this.drawArena(ctx);
      case 'events': return this.drawEvents(ctx, m);
      case 'result': return this.drawResult(ctx, m);
      case 'dead': return this.drawDead(ctx);
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const { world, progress } = this.game;
    const p = world.player;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(6, 6, 176, 50);
    text(ctx, `Nv ${progress.level}`, 12, 19, { size: 12, color: '#ffe9a8' });
    bar(ctx, 52, 12, 124, 10, p.hp / p.maxHp, '#e0524f');
    text(ctx, `${Math.ceil(p.hp)}/${p.maxHp}`, 114, 17, { size: 8, align: 'center' });
    bar(ctx, 52, 26, 124, 8, p.mp / p.maxMp, '#4f8fe0');
    text(ctx, `${Math.floor(p.mp)}/${p.maxMp}`, 114, 30, { size: 7, align: 'center' });
    bar(ctx, 12, 42, 164, 4, progress.exp / expToNext(progress.level), '#8fe07a');
    text(ctx, `${progress.gold} G`, 12, 66, { size: 11, color: '#ffd36b' });
    drawSpriteH(ctx, 'it_gem_blue', 82, 73, 13);
    text(ctx, `${progress.gems}`, 92, 66, { size: 11, color: '#9fd3ff' });
    // bônus temporários (sequência de abates)
    let bx = 116;
    for (const [k, t] of Object.entries(world.buffs)) {
      const b = BUFFS[k];
      if (!b) continue;
      ctx.globalAlpha = t < 3 && Math.floor(t * 6) % 2 ? 0.4 : 1;
      drawSpriteH(ctx, b.icon, bx + 9, 66, 18);
      ctx.globalAlpha = 1;
      text(ctx, `${Math.ceil(t)}`, bx + 9, 79, { size: 7, align: 'center' });
      bx += 21;
    }
    if (world.event) {
      const ev = bagItem(world.event);
      drawSpriteH(ctx, 'it_' + world.event, VIEW_W / 2 - 70, 56, 14);
      text(ctx, `Evento do Tesouro: ${ev?.name ?? ''} · drops +50%`, VIEW_W / 2 + 6, 50, { size: 9, align: 'center', color: '#ffd36b' });
    }
    // botão de Eventos (chefes Lendários e Míticos)
    if (!this.modal && !world.stage.id.startsWith('ev_')) {
      const ex = VIEW_W - 26, ey = 176;
      const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.2;
      glow(ctx, ex, ey, 24, '#ff6a6a', pulse * 0.5);
      ctx.globalAlpha = 0.7;
      circle(ctx, ex, ey, 16, '#2a1020');
      ctx.globalAlpha = 1;
      drawSpriteH(ctx, 'it_tk_myth', ex, ey + 12, 24);
      ctx.strokeStyle = '#ff8a5a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, 16, 0, Math.PI * 2);
      ctx.stroke();
      text(ctx, 'Eventos', ex, ey + 24, { size: 8, align: 'center', color: '#ffd36b' });
      this.regions.push({ x: ex - 20, y: ey - 20, w: 40, h: 50, fn: () => this.openEvents() });
      // botão do Passe de Batalha (brilha quando há recompensa para resgatar)
      const px = ex, py = ey + 56;
      const ready = PASS.some((r) => this.game.passState(r.id) === 'ready');
      if (ready) glow(ctx, px, py, 24, '#ffd36b', pulse * 0.6);
      ctx.globalAlpha = 0.7;
      circle(ctx, px, py, 16, '#1a2040');
      ctx.globalAlpha = 1;
      this.icon(ctx, 'ps_tickets', px, py, 24);
      ctx.strokeStyle = '#ffd36b';
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.stroke();
      if (ready) { circle(ctx, px + 12, py - 12, 5, '#e0524f'); text(ctx, '!', px + 12, py - 12, { size: 8, align: 'center', outline: false }); }
      text(ctx, 'Passe', px, py + 24, { size: 8, align: 'center', color: '#ffd36b' });
      this.regions.push({ x: px - 20, y: py - 20, w: 40, h: 50, fn: () => this.openPass() });
    }
    const run = this.game.eventRun;
    if (run && world.stage.id.startsWith('ev_')) {
      const t = Math.max(0, run.timeLeft), mm = Math.floor(t / 60), ss = Math.floor(t % 60);
      const low = t < 300;
      ctx.fillStyle = 'rgba(30,0,10,0.6)';
      ctx.fillRect(VIEW_W / 2 - 110, 4, 220, 30);
      text(ctx, `⏳ ${mm}:${String(ss).padStart(2, '0')}`, VIEW_W / 2 - 100, 19, { size: 14, color: low && Math.floor(t * 2) % 2 ? '#ff5f5f' : '#ffe9a8' });
      text(ctx, `${run.boss.name} · Fase ${run.phase}/${EVENT_PHASES}`, VIEW_W / 2 + 102, 13, { size: 9, align: 'right', color: run.boss.tier === 'myth' ? '#ff8a8a' : '#ffb840' });
      text(ctx, DIFFICULTIES[run.diff].name, VIEW_W / 2 + 102, 26, { size: 8, align: 'right', color: '#aab4cc' });
    }
    // missões em andamento
    const qb = this.game.quests;
    qb.active().slice(0, 3).forEach((q, i) => {
      const ready = qb.isReady(q);
      const label = ready ? `✔ ${q.title} · ${qb.giverName(q)}` : `📜 ${q.title} ${qb.count(q)}/${qb.target(q)}`;
      text(ctx, label, 12, 92 + i * 14, { size: 9, color: ready ? '#8fe07a' : '#e8ecf4' });
    });

    if (!run || !world.stage.id.startsWith('ev_')) text(ctx, world.stage.name, VIEW_W / 2, 16, { size: 12, align: 'center' });
    // cronômetro e dano da fase (metas das estrelas)
    const par = world.stage.parTime;
    if (par) {
      const fast = world.elapsed <= par;
      const dmg = world.damageTaken / world.player.maxHp;
      const rx = VIEW_W - 48;
      text(ctx, `⏱ ${formatTime(world.elapsed)} / ${formatTime(par)}`, rx, 14, { size: 10, align: 'right', color: fast ? '#9ff0a0' : '#ff9b9b' });
      text(ctx, `💔 ${Math.round(dmg * 100)}% / ${Math.round(DAMAGE_LIMIT * 100)}%`, rx, 28, { size: 10, align: 'right', color: dmg <= DAMAGE_LIMIT ? '#9ff0a0' : '#ff9b9b' });
      const bits = this.game.progress.stars[world.stage.id] ?? 0;
      if (bits) drawStars(ctx, rx - 22, 42, 9, bits);
    }
    const boss = world.boss;
    if (boss) {
      text(ctx, `${boss.def.name} · Nv ${boss.level}${boss.enraged ? ' (furioso!)' : ''}`, VIEW_W / 2, 32, { size: 11, align: 'center', color: boss.enraged ? '#ff6b6b' : '#ffb3c4' });
      bar(ctx, VIEW_W / 2 - 130, 40, 260, 8, boss.hp / boss.maxHp, boss.enraged ? '#e03030' : '#c4466b');
    }

    // botão de menu também clicável com mouse
    const mb = BUTTONS[BUTTONS.length - 1];
    if (!this.modal) {
      circle(ctx, mb.x, mb.y, mb.r, 'rgba(0,0,0,0.45)');
      text(ctx, mb.label, mb.x, mb.y + 1, { size: 14, align: 'center' });
      this.regions.push({ x: mb.x - mb.r, y: mb.y - mb.r, w: mb.r * 2, h: mb.r * 2, fn: () => this.openMenu() });
    }
  }

  private drawControls(ctx: CanvasRenderingContext2D): void {
    const input = this.input;
    const { world, progress } = this.game;
    if (!input.touchMode) {
      text(ctx, 'Andar: A/D · Pular: Espaço · Escada: W/S · Atacar: J · Poderes: K L I O · Falar: E · Menu: M · Bolsa: G · Eventos: N · Passe: P', VIEW_W / 2, VIEW_H - 10,
        { size: 10, align: 'center', color: 'rgba(255,255,255,0.85)' });
      return;
    }
    const j = input.joystick;
    const jx = j?.ox ?? 90, jy = j?.oy ?? 290;
    ctx.globalAlpha = j ? 0.5 : 0.22;
    circle(ctx, jx, jy, 40, '#000');
    circle(ctx, j?.x ?? jx, j?.y ?? jy, 18, '#fff');
    ctx.globalAlpha = 1;

    const slots = slotSkills(progress);
    for (const b of BUTTONS) {
      if (b.action === 'menu') continue;
      if (b.action === 'potHp' || b.action === 'potMp' || b.action === 'bag') {
        const id = b.action === 'bag' ? '' : this.bestPotion(b.action === 'potHp' ? 'hp' : 'mp');
        const n = id ? progress.bag[id] ?? 0 : 0;
        ctx.globalAlpha = 0.6;
        circle(ctx, b.x, b.y, b.r, '#14101c');
        ctx.globalAlpha = n || b.action === 'bag' ? 1 : 0.35;
        drawSpriteH(ctx, b.action === 'bag' ? 'it_st_bag' : 'it_' + (id || (b.action === 'potHp' ? 'pot_hp' : 'pot_mp')), b.x, b.y + b.r * 0.8, b.r * 1.6);
        ctx.globalAlpha = 1;
        if (b.action !== 'bag') text(ctx, `${n}`, b.x + b.r * 0.7, b.y + b.r * 0.7, { size: 8, align: 'center' });
        ctx.strokeStyle = '#e0b04f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      const skillIdx = b.action.startsWith('skill') ? Number(b.action.slice(5)) - 1 : -1;
      const skill = skillIdx >= 0 ? slots[skillIdx] : null;
      if (skillIdx >= 0 && !skill) continue;
      const active = b.action !== 'interact' || !!world.nearby();
      // botão estilo "ícone com moldura dourada"
      ctx.globalAlpha = active ? 0.62 : 0.28;
      circle(ctx, b.x, b.y, b.r, '#14101c');
      ctx.globalAlpha = 1;
      if (skill && hasSprite(skill.icon) && progress.level >= skill.unlockLevel) {
        const sz = b.r * 1.62;
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r - 1.5, 0, Math.PI * 2);
        ctx.clip();
        drawSpriteH(ctx, skill.icon, b.x, b.y + sz / 2, sz);
        const cd = world.player.cooldowns[skill.id] ?? 0;
        const noMp = world.player.mp < skill.mpCost;
        if (cd > 0 || noMp) {
          ctx.fillStyle = noMp && cd <= 0 ? 'rgba(20,30,80,0.55)' : 'rgba(0,0,0,0.62)';
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd > 0 ? cd / skill.cooldown : 1));
          ctx.fill();
        }
        ctx.restore();
        if ((world.player.cooldowns[skill.id] ?? 0) > 0) text(ctx, `${Math.ceil(world.player.cooldowns[skill.id])}`, b.x, b.y, { size: 12, align: 'center' });
        text(ctx, `${skill.mpCost}`, b.x + b.r * 0.62, b.y + b.r * 0.72, { size: 7, align: 'center', color: '#9cc4ff' });
      } else if (skill) {
        if (progress.level < skill.unlockLevel) text(ctx, `Nv${skill.unlockLevel}`, b.x, b.y, { size: 9, align: 'center', color: '#aaa' });
        else {
          text(ctx, skill.name.split(' ')[0], b.x, b.y - 4, { size: 8, align: 'center' });
          text(ctx, `${skill.mpCost} MP`, b.x, b.y + 7, { size: 7, align: 'center', color: '#9cc4ff' });
        }
      } else {
        text(ctx, b.label, b.x, b.y + 1, { size: b.r * 0.9, align: 'center', color: '#ffe9a8' });
      }
      // moldura dourada
      ctx.strokeStyle = '#3a2a10';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = skill ? '#e0b04f' : 'rgba(224,176,79,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, title: string, closable = true): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => {} }); // bloqueia cliques atrás
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#5a6a90';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(ctx, title, x + 12, y + 16, { size: 13, color: '#ffe9a8' });
    if (closable) {
      text(ctx, '✕', x + w - 16, y + 16, { size: 14, align: 'center' });
      this.regions.push({ x: x + w - 34, y, w: 34, h: 32, fn: () => this.close() });
    }
  }

  private drawDialog(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'dialog' }>): void {
    const x = 20, y = 246, w = VIEW_W - 40, h = 98;
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => this.advanceDialog(m) });
    ctx.fillStyle = 'rgba(20,26,40,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = m.npc.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(ctx, m.npc.name, x + 12, y + 14, { size: 12, color: m.npc.color });
    const lines = wrapText(ctx, m.lines[m.line] ?? '', w - 24, 13);
    lines.forEach((l, i) => text(ctx, l, x + 12, y + 36 + i * 18, { size: 13, outline: false }));
    text(ctx, '▶ toque / J', x + w - 12, y + h - 12, { size: 9, align: 'right', color: '#aab' });
  }

  private itemRow(
    ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
    itemId: string, selected: boolean, onTap: () => void, showPrice: boolean,
  ): void {
    const { progress } = this.game;
    const item = getItem(itemId);
    const owned = progress.owned.includes(itemId);
    const equipped = progress.equipped[item.slot] === itemId;
    ctx.fillStyle = selected ? '#34406a' : '#252e45';
    ctx.fillRect(x, y, w, h - 3);
    // ícone do item (pixel art)
    let tx = x + 8;
    if (hasSprite(item.icon ?? 'icon_' + itemId)) {
      const sz = h - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 4, y + 1.5, sz, sz);
      this.icon(ctx, item.icon ?? 'icon_' + itemId, x + 4 + sz / 2, y + 1.5 + sz / 2, sz - 3);
      tx = x + sz + 10;
    }
    text(ctx, item.name, tx, y + h / 2 - 5, { size: 11, outline: false, color: item.rarity !== undefined ? RARITY_COLORS[item.rarity] : '#ffffff' });
    text(ctx, `${SLOT_NAMES[item.slot]} · ${describeBonus(item)}`, tx, y + h / 2 + 6, { size: 8, outline: false, color: '#aab4cc', bold: false });
    let label: string, color: string;
    if (equipped) { label = 'Equipado'; color = '#8fe07a'; }
    else if (!usableBy(item, progress.classId)) { label = 'Outra classe'; color = '#8a8f9a'; }
    else if (owned) { label = 'Equipar'; color = '#9cc4ff'; }
    else if (showPrice && item.priceGems) { label = `${item.priceGems} gemas`; color = progress.gems >= item.priceGems ? '#9fd3ff' : '#e0524f'; }
    else if (showPrice) { label = `${item.price} G`; color = progress.gold >= item.price ? '#ffd36b' : '#e0524f'; }
    else { label = ''; color = '#fff'; }
    text(ctx, label, x + w - 8, y + h / 2 - 1, { size: 11, align: 'right', color, outline: false });
    this.regions.push({ x, y, w, h: h - 3, fn: onTap });
  }

  /** Equipamentos à venda na categoria escolhida (sem os que só caem de chefes/eventos). */
  private shopList(m: Extract<Modal, { kind: 'shop' }>): string[] {
    const cat = this.shopCats()[m.cat]?.[0] ?? 'classic';
    const cls = this.game.progress.classId;
    if (cat === 'classic') return (m.npc.shop ?? []).filter((id) => !getItem(id).dropOnly && usableBy(getItem(id), cls));
    const mine = SET_OF[this.game.progress.classId ?? 'warrior'];
    return EQUIPMENT.filter((e) => e.category === cat && !e.dropOnly && (!e.setClass || m.allSets || e.setClass === mine)).map((e) => e.id);
  }

  /** Categorias da loja: das armas, só a da classe (cada classe usa a sua). */
  private shopCats(): [string, string][] {
    const mine = CLASS_WEAPON[this.game.progress.classId ?? 'warrior'];
    const warrior = (this.game.progress.classId ?? 'warrior') === 'warrior';
    return SHOP_CATEGORIES.filter(([k]) => (!(k in WEAPON_KINDS) || k === mine) && (k !== 'sh' || warrior));
  }

  /** Melhor poção do tipo que o jogador tem (a mais fraca primeiro, para não desperdiçar). */
  bestPotion(kind: 'hp' | 'mp'): string {
    const order = kind === 'hp' ? ['pot_hp', 'pot_hp2', 'pot_elixir', 'pot_divine'] : ['pot_mp', 'pot_mp2', 'pot_mp3', 'pot_elixir'];
    return order.find((id) => (this.game.progress.bag[id] ?? 0) > 0) ?? '';
  }

  private tabs(ctx: CanvasRenderingContext2D, x: number, y: number, names: string[], cur: number, set: (i: number) => void): void {
    const w = Math.min(110, 460 / names.length);
    names.forEach((n, i) => {
      const tx = x + i * (w + 4);
      ctx.fillStyle = i === cur ? '#4a5a90' : '#252e45';
      ctx.fillRect(tx, y, w, 20);
      if (i === cur) { ctx.fillStyle = '#ffd36b'; ctx.fillRect(tx, y + 18, w, 2); }
      text(ctx, n, tx + w / 2, y + 10, { size: 10, align: 'center', outline: false, color: i === cur ? '#ffffff' : '#aab4cc' });
      this.regions.push({ x: tx, y: y - 2, w, h: 24, fn: () => { set(i); this.game.sfx.play('ui'); } });
    });
  }

  private icon(ctx: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, alpha = 1): void {
    if (!hasSprite(name)) return;
    ctx.globalAlpha = alpha;
    // cabe na caixa: peças largas (asas, botas, aura) ficam mais baixas
    const hgt = Math.min(size, size * tileAspect(name));
    drawSpriteH(ctx, name, cx, cy + hgt / 2, hgt);
    ctx.globalAlpha = 1;
  }

  private drawShop(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'shop' }>): void {
    const { progress } = this.game;
    const w = Math.min(VIEW_W - 24, 600), h = 340, x = (VIEW_W - w) / 2, y = 10;
    this.panel(ctx, x, y, w, h, `${m.npc.name} — Ferreira`);
    text(ctx, `${progress.gold} G`, x + w - 110, y + 16, { size: 12, align: 'right', color: '#ffd36b' });
    this.icon(ctx, 'it_gem_blue', x + w - 98, y + 16, 12);
    text(ctx, `${progress.gems}`, x + w - 88, y + 16, { size: 12, color: '#9fd3ff' });
    this.tabs(ctx, x + 10, y + 30, ['Equipamentos', 'Materiais', 'Aprimorar'], m.tab, (i) => { m.tab = i; m.sel = 0; m.scroll = 0; });
    const top = y + 56;
    if (m.tab === 0) {
      // categorias em 2 linhas
      const per = 8, cw = (w - 20) / per;
      const cats = this.shopCats();
      m.cat = Math.min(m.cat, cats.length - 1);
      cats.forEach(([, label], i) => {
        const cx = x + 10 + (i % per) * cw, cy = top + Math.floor(i / per) * 20;
        const on = i === m.cat;
        ctx.fillStyle = on ? '#5a4a90' : '#232a40';
        ctx.fillRect(cx, cy, cw - 3, 17);
        text(ctx, label, cx + (cw - 3) / 2, cy + 9, { size: 9, align: 'center', outline: false, color: on ? '#ffd36b' : '#aab4cc' });
        this.regions.push({ x: cx, y: cy, w: cw - 3, h: 18, fn: () => { m.cat = i; m.sel = 0; m.scroll = 0; this.game.sfx.play('ui'); } });
      });
      const lt = top + 42;
      const cat = cats[m.cat][0];
      if (['armor', 'arms', 'pants', 'cape'].includes(cat)) {
        const label = m.allSets ? 'Mostrando: todas as classes' : `Mostrando: set do ${SET_NAMES[SET_OF[progress.classId ?? 'warrior']]}`;
        text(ctx, label + ' (toque para trocar)', x + w - 14, y + 16 + 22, { size: 8, align: 'right', outline: false, color: '#9cc4ff' });
        this.regions.push({ x: x + w - 220, y: y + 28, w: 210, h: 18, fn: () => { m.allSets = !m.allSets; m.sel = 0; m.scroll = 0; } });
      }
      const list = this.shopList(m);
      const rows = 9;
      this.scrollList(ctx, m, list.length, rows, x + w - 26, lt, rows * 28);
      list.slice(m.scroll, m.scroll + rows).forEach((id, k) => {
        const i = m.scroll + k;
        this.itemRow(ctx, x + 10, lt + k * 28, w - 42, 28, id, i === m.sel, () => { m.sel = i; this.itemAction(id); }, true);
      });
      return;
    }
    if (m.tab === 1) {
      // grade de materiais, poções, chaves e tíquetes
      const cols = 4, cw = (w - 20) / cols, ch = 38;
      const list = SHOP_GOODS;
      const rows = 7;
      const total = Math.ceil(list.length / cols);
      m.scroll = Math.max(0, Math.min(Math.max(0, total - rows), m.scroll));
      if (total > rows) this.scrollList(ctx, m, total, rows, x + w - 26, top, rows * ch);
      list.slice(m.scroll * cols, (m.scroll + rows) * cols).forEach((id, k) => {
        const it = bagItem(id)!;
        const cx = x + 10 + (k % cols) * cw, cy = top + Math.floor(k / cols) * ch;
        ctx.fillStyle = '#252e45';
        ctx.fillRect(cx, cy, cw - (total > rows ? 8 : 4), ch - 4);
        this.icon(ctx, 'it_' + id, cx + 17, cy + 17, 28);
        text(ctx, it.name, cx + 34, cy + 10, { size: 9, outline: false });
        const pr = it.price!;
        const ok = pr.gems ? progress.gems >= pr.gems : progress.gold >= (pr.gold ?? 0);
        text(ctx, pr.gems ? `${pr.gems} gemas` : `${pr.gold} G`, cx + 34, cy + 24, { size: 9, outline: false, color: ok ? (pr.gems ? '#9fd3ff' : '#ffd36b') : '#e0524f' });
        text(ctx, `x${progress.bag[id] ?? 0}`, cx + cw - 10, cy + 24, { size: 8, align: 'right', outline: false, color: '#aab4cc' });
        this.regions.push({ x: cx, y: cy, w: cw - 4, h: ch - 4, fn: () => this.game.buyGood(id) });
      });
      return;
    }
    // aprimorar o que está equipado
    const slots = Object.entries(progress.equipped).filter(([, id]) => id) as [Slot, string][];
    text(ctx, 'Toque para aprimorar (+10% dos atributos do item por nível, até +10)', x + 14, top + 4, { size: 9, outline: false, color: '#aab4cc' });
    const urows = 7;
    this.scrollList(ctx, m, slots.length, urows, x + w - 26, top + 14, urows * 36);
    const uw = slots.length > urows ? w - 34 : w - 20;
    slots.slice(m.scroll, m.scroll + urows).forEach(([slot, id], k) => {
      const e = getItem(id);
      const cy = top + 14 + k * 36;
      const c = this.game.upgradeCost(id);
      const lv = progress.upgrades[id] ?? 0;
      ctx.fillStyle = '#252e45';
      ctx.fillRect(x + 10, cy, uw, 33);
      this.icon(ctx, e.icon ?? 'icon_' + id, x + 28, cy + 16, 28);
      text(ctx, `${e.name} +${lv}`, x + 48, cy + 10, { size: 11, outline: false, color: lv >= 7 ? '#ffd36b' : lv >= 4 ? '#9fd3ff' : '#ffffff' });
      text(ctx, SLOT_NAMES[slot], x + 48, cy + 24, { size: 8, outline: false, color: '#aab4cc', bold: false });
      if (!c) { text(ctx, 'MÁXIMO', x + uw, cy + 16, { size: 11, align: 'right', color: '#ffd36b', outline: false }); return; }
      let nx = x + 210;
      const okGold = progress.gold >= c.gold;
      text(ctx, `${c.gold} G`, nx, cy + 16, { size: 10, outline: false, color: okGold ? '#ffd36b' : '#e0524f' });
      nx += 62;
      for (const [label, ids, n] of c.needs) {
        const have = this.game.have(ids);
        const ic = ids[0] === '$gems' ? 'it_gem_blue' : 'it_' + (ids.find((i2) => (progress.bag[i2] ?? 0) > 0) ?? ids[0]);
        this.icon(ctx, ic, nx + 8, cy + 16, 18);
        text(ctx, `${have}/${n}`, nx + 20, cy + 16, { size: 9, outline: false, color: have >= n ? '#8fe07a' : '#e0524f' });
        void label;
        nx += 58;
      }
      ctx.fillStyle = '#3f8a45';
      ctx.fillRect(x + uw - 54, cy + 5, 58, 23);
      text(ctx, `+${lv + 1}`, x + uw - 25, cy + 16, { size: 11, align: 'center' });
      this.regions.push({ x: x + 10, y: cy, w: w - 20, h: 33, fn: () => this.game.upgrade(id) });
    });
  }

  // ───────────────────────── inventário (visual da prancha de inventário) ─────────────────────────

  /** Sprite da interface encaixado na caixa (mantém a proporção). */
  private ui(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number, alpha = 1): void {
    if (!hasSprite(name)) return;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    ctx.imageSmoothingEnabled = true;
    drawFit(ctx, name, x, y, x + w, y + h, 'contain', 'mid');
    ctx.globalAlpha = a;
  }

  /** Painel escuro com moldura dourada. */
  private goldPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#1d1418'); g.addColorStop(1, '#0d0a0e');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#6b4a1c'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.strokeStyle = '#e0b04f'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    ctx.fillStyle = '#ffd36b';
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-2.5, -2.5, 5, 5); ctx.restore(); }
  }

  /** Moldura de raridade + ícone do item (espaços, grade e detalhes). */
  private itemCell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, id: string | undefined, selected = false): void {
    const e = id ? getItem(id) : null;
    const r = e ? Math.min(6, e.rarity ?? 0) : -1;
    if (selected) glow(ctx, x + s / 2, y + s / 2, s * 0.9, '#ffb840', 0.45);
    this.ui(ctx, e ? `ui_rar_${r}` : 'ui_slot_empty', x, y, s, s);
    if ((e?.rarity ?? 0) >= 7) { ctx.strokeStyle = RARITY_COLORS[7]; ctx.lineWidth = 1.5; ctx.strokeRect(x + 2, y + 2, s - 4, s - 4); }
    const other = !!e && !usableBy(e, this.game.progress.classId);
    if (e) this.icon(ctx, e.icon ?? 'icon_' + id, x + s / 2, y + s / 2, s * 0.72, other ? 0.35 : 1);
    if (other) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 2, y + 2, s - 4, s - 4); }
    if (selected) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); }
  }

  private drawBag(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'bag' }>): void {
    const { progress } = this.game;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => {} });
    const x = 6, y = 4, w = VIEW_W - 12, h = VIEW_H - 8;
    ctx.fillStyle = '#0a0709';
    ctx.fillRect(x, y, w, h);
    // topo: título, moedas e fechar
    this.ui(ctx, 'ui_title_inv', x + 4, y + 2, 140, 27);
    let tx = x + w - 40;
    this.ui(ctx, 'ui_btn_close', tx, y + 3, 32, 25);
    this.regions.push({ x: tx - 4, y, w: 40, h: 32, fn: () => this.close() });
    const money = (icon: string, v: string, color: string) => {
      const bw = 96;
      tx -= bw + 8;
      ctx.fillStyle = '#1a1214'; ctx.fillRect(tx + 10, y + 8, bw - 10, 16);
      ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 1; ctx.strokeRect(tx + 10.5, y + 8.5, bw - 11, 15);
      this.ui(ctx, icon, tx, y + 4, 24, 24);
      text(ctx, v, tx + bw - 6, y + 16, { size: 11, align: 'right', color, outline: false });
    };
    money('ui_gem_blue', progress.gems.toLocaleString('pt-BR'), '#cfe6ff');
    money('ui_coin', progress.gold.toLocaleString('pt-BR'), '#ffe9a8');
    // abas da esquerda
    const top = y + 34, bodyH = h - 38;
    const TABS: [string, string][] = [['gw_sword_lendario', 'Equipamento'], ['ui_tab_items', 'Itens'], ['ui_tab_mats', 'Materiais'], ['ui_tab_cons', 'Cartas/Orbes'], ['ui_tab_other', 'Coleção']];
    const lw = 98;
    this.goldPanel(ctx, x, top, lw + 8, bodyH);
    TABS.forEach(([ic, label], i) => {
      const ty = top + 8 + i * 40, on = i === m.tab;
      const g = ctx.createLinearGradient(0, ty, 0, ty + 34);
      if (on) { g.addColorStop(0, '#8a1f1f'); g.addColorStop(1, '#4a0c0e'); } else { g.addColorStop(0, '#2a2226'); g.addColorStop(1, '#151013'); }
      ctx.fillStyle = g;
      ctx.fillRect(x + 6, ty, lw - 4, 34);
      ctx.strokeStyle = on ? '#ffd36b' : '#5a4530'; ctx.lineWidth = 1;
      ctx.strokeRect(x + 6.5, ty + 0.5, lw - 5, 33);
      this.ui(ctx, ic, x + 9, ty + 5, 24, 24);
      text(ctx, label, x + 36, ty + 17, { size: label.length > 10 ? 8 : 9, outline: false, color: on ? '#ffffff' : '#d8c8a8' });
      this.regions.push({ x: x + 6, y: ty, w: lw - 4, h: 34, fn: () => { m.tab = i; m.sel = null; m.page = 0; this.game.sfx.play('ui'); } });
    });
    const cx0 = x + lw + 12, cw = x + w - cx0;
    if (m.tab === 0) return this.drawInventory(ctx, m, cx0, top, cw, bodyH);
    // outras abas: grade de itens empilháveis
    this.goldPanel(ctx, cx0, top, cw, bodyH);
    this.drawBagItems(ctx, m, cx0 + 8, top + 8, cw - 16);
  }

  /** Abas Itens, Materiais, Cartas/Orbes e Coleção. */
  private drawBagItems(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'bag' }>, x: number, top: number, w: number): void {
    const { progress, world } = this.game;
    const kinds: Record<number, BagKind[]> = { 1: ['potion', 'chest', 'key', 'ticket'], 2: ['material', 'crystal', 'evolution', 'quest'], 3: ['card', 'rune', 'orb'], 4: ['collectible', 'event'] };
    const showAll = m.tab === 4;
    let list = BAG_ITEMS.filter((b) => kinds[m.tab].includes(b.kind) && (showAll || (progress.bag[b.id] ?? 0) > 0));
    if (m.tab === 3) {
      const cls = getClass(progress.classId);
      text(ctx, `Cartas (2) e Runa (1) · bônus para ${cls.name}:`, x + 4, top + 6, { size: 10, outline: false, color: '#ffe9a8' });
      const slots = [progress.cards[0], progress.cards[1], progress.rune];
      slots.forEach((id, k) => {
        const sx = x + 4 + k * 48, sy = top + 16;
        this.ui(ctx, id ? (k === 2 ? 'ui_rar_3' : 'ui_rar_4') : 'ui_slot_empty', sx, sy, 42, 42);
        if (id) this.icon(ctx, 'it_' + id, sx + 21, sy + 21, 30);
        else text(ctx, k === 2 ? 'Runa' : 'Carta', sx + 21, sy + 21, { size: 8, align: 'center', outline: false, color: '#776' });
      });
      const s = world.stats;
      text(ctx, `Poderes ${Math.round(s.skillMul * 100)}% · Recarga ${Math.round(s.cdMul * 100)}% · Dano recebido ${Math.round(s.dmgTaken * 100)}% · Ouro/EXP ${Math.round(s.goldMul * 100)}%`, x + 154, top + 26, { size: 9, outline: false, color: '#9cc4ff', bold: false });
      text(ctx, 'Orbes somam pontos permanentes. ★ = sua classe aproveita mais.', x + 154, top + 44, { size: 9, outline: false, color: '#aab4cc', bold: false });
      list = list.sort((a, b) => (a.kind === 'orb' ? 1 : 0) - (b.kind === 'orb' ? 1 : 0));
      this.grid(ctx, m, list, x, top + 66, w, 3);
      return;
    }
    if (m.tab === 4) {
      const col = collectionCount(progress);
      text(ctx, `Álbum: ${col.normal}/27 coletáveis · ${col.event}/8 itens de evento · bônus: +${Math.floor(col.normal / 4) * 2 + col.event * 3}% ataque e vida`, x + 4, top + 6, { size: 10, outline: false, color: '#ffe9a8' });
      this.grid(ctx, m, list, x, top + 18, w, 4, true);
      return;
    }
    if (!list.length) text(ctx, 'Nada aqui ainda. Derrote inimigos e abra baús!', x + w / 2, top + 80, { size: 12, align: 'center', outline: false, color: '#aab4cc' });
    this.grid(ctx, m, list, x, top, w, 5);
  }

  /** Equipamento: personagem com os 11 espaços, inventário com filtros e detalhes do item escolhido. */
  private drawInventory(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'bag' }>, x: number, top: number, w: number, h: number): void {
    const { progress, world } = this.game;
    const t = performance.now() / 1000;
    // ── personagem ──
    const pw = 176;
    this.goldPanel(ctx, x, top, pw, h);
    const cls = getClass(progress.classId);
    ctx.fillStyle = '#1e1619'; ctx.fillRect(x + 30, top + 6, pw - 60, 16);
    ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 1; ctx.strokeRect(x + 30.5, top + 6.5, pw - 61, 15);
    text(ctx, `Nv. ${progress.level}  ${cls.name}`, x + pw / 2, top + 14, { size: 10, align: 'center', outline: false, color: '#ffd36b' });
    const S = 34, step = 37;
    const LEFT: Slot[] = ['helmet', 'armor', 'gloves', 'pants', 'boots', 'weapon', 'shield'];
    const RIGHT: Slot[] = ['costume', 'cape', 'aura', 'accessory'];
    const slotAt = (slot: Slot, sx: number, sy: number) => {
      const id = progress.equipped[slot];
      this.itemCell(ctx, sx, sy, S, id, !!id && m.sel === id);
      if (!id) text(ctx, SLOT_NAMES[slot], sx + S / 2, sy + S / 2, { size: 6, align: 'center', outline: false, color: '#8a7a6a' });
      this.regions.push({ x: sx, y: sy, w: S, h: S, fn: () => { if (id) { m.sel = id; this.markSeen(id); } this.game.sfx.play('ui'); } });
    };
    LEFT.forEach((s, i) => slotAt(s, x + 6, top + 28 + i * step));
    RIGHT.forEach((s, i) => slotAt(s, x + pw - 6 - S, top + 28 + i * step));
    const fx = x + pw / 2, fy = top + 200;
    glow(ctx, fx, fy - 30, 52, '#ffb840', 0.22);
    ctx.strokeStyle = 'rgba(255,200,90,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(fx, fy, 30, 7, 0, 0, Math.PI * 2); ctx.stroke();
    drawDollIdle(ctx, progress, fx, fy, 1, 1.45, t);
    const s = world.stats;
    const sy0 = top + h - 46;
    ctx.fillStyle = '#160f12'; ctx.fillRect(x + 6, sy0, pw - 12, 40);
    ctx.strokeStyle = '#6b4a1c'; ctx.strokeRect(x + 6.5, sy0 + 0.5, pw - 13, 39);
    const st = (label: string, v: string, c: string, cx: number, cy: number) => {
      text(ctx, label, cx, cy, { size: 8, outline: false, color: c });
      text(ctx, v, cx + 72, cy, { size: 9, align: 'right', outline: false, color: '#ffffff' });
    };
    st('⚔ ATQ', `${s.atk}`, '#ffd36b', x + 12, sy0 + 10); st('🛡 DEF', `${s.def}`, '#ffd36b', x + 92, sy0 + 10);
    st('❤ HP', `${s.maxHp}`, '#ff8a8a', x + 12, sy0 + 23); st('💧 MP', `${s.maxMp}`, '#8ac4ff', x + 92, sy0 + 23);
    const sb = setBonus(progress);
    text(ctx, sb ? `Set ${SET_NAMES[sb.cls]} ${sb.pieces}/4: +${Math.round(sb.mul * 100)}%` : `Crítico ${Math.round(s.crit * 100)}%`, x + pw / 2, sy0 + 34, { size: 7, align: 'center', outline: false, color: '#ffb840' });

    // ── detalhes (direita) ──
    const dw = Math.min(160, Math.max(140, w * 0.22));
    const dx = x + w - dw;
    this.goldPanel(ctx, dx, top, dw, h);
    this.drawItemDetail(ctx, m, dx, top, dw, h);

    // ── inventário (meio) ──
    const gx = x + pw + 4, gw = dx - 4 - gx;
    this.goldPanel(ctx, gx, top, gw, h);
    const FILTERS: [string, (e: EquipmentDef) => boolean][] = [
      ['ui_flt_all', () => true],
      ['ui_flt_weapon', (e) => e.slot === 'weapon'],
      ['ui_flt_armor', (e) => ['armor', 'gloves', 'pants', 'boots', 'cape', 'costume', 'shield'].includes(e.slot)],
      ['ui_flt_helmet', (e) => e.slot === 'helmet'],
      ['ui_flt_ring', (e) => e.slot === 'accessory'],
      ['ui_flt_gem', (e) => e.slot === 'aura'],
    ];
    const fw = Math.min(36, (gw - 12) / FILTERS.length);
    FILTERS.forEach(([ic], i) => {
      const bx = gx + 6 + i * fw, on = i === m.filter;
      if (on) glow(ctx, bx + fw / 2, top + 18, fw * 0.7, '#ff7040', 0.35);
      this.ui(ctx, ic, bx + 1, top + 6, fw - 2, 24, on ? 1 : 0.6);
      if (on && i > 0) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.5; ctx.strokeRect(bx + 2, top + 7, fw - 4, 22); }
      this.regions.push({ x: bx, y: top + 4, w: fw, h: 28, fn: () => { m.filter = i; m.page = 0; this.game.sfx.play('ui'); } });
    });
    const items = this.inventoryList(m, FILTERS[m.filter][1]);
    const C = 34, gap = 3;
    const cols = Math.max(1, Math.floor((gw - 12 + gap) / (C + gap)));
    const rows = Math.max(1, Math.floor((h - 40 - 30 + gap) / (C + gap)));
    const per = cols * rows;
    const pages = Math.max(1, Math.ceil(items.length / per));
    m.page = Math.min(m.page, pages - 1);
    const ox = gx + (gw - (cols * (C + gap) - gap)) / 2;
    for (let k = 0; k < per; k++) {
      const id = items[m.page * per + k];
      const cx = ox + (k % cols) * (C + gap), cy = top + 36 + Math.floor(k / cols) * (C + gap);
      if (!id) { this.ui(ctx, 'ui_slot_off', cx, cy, C, C, 0.7); continue; }
      const e = getItem(id);
      this.itemCell(ctx, cx, cy, C, id, m.sel === id);
      const lv = progress.upgrades[id] ?? 0;
      if (lv) text(ctx, `+${lv}`, cx + 3, cy + 7, { size: 7, color: '#ffd36b' });
      if (progress.equipped[e.slot] === id) this.ui(ctx, 'ui_badge_e', cx + C - 12, cy - 1, 13, 13);
      else {
        if (!(progress.seen ?? []).includes(id)) this.ui(ctx, 'ui_badge_n', cx + C - 12, cy - 1, 13, 13);
        const cmp = this.compare(id);
        if (cmp) this.ui(ctx, cmp > 0 ? 'ui_arrow_up' : 'ui_arrow_down', cx + C - 11, cy + C - 13, 10, 12);
      }
      this.regions.push({ x: cx, y: cy, w: C, h: C, fn: () => {
        if (m.sel === id) this.game.equip(id); // toque duplo: equipar
        else { m.sel = id; this.markSeen(id); this.game.sfx.play('ui'); }
      } });
    }
    // contador e páginas
    const by = top + h - 24;
    ctx.fillStyle = '#1a1214'; ctx.fillRect(gx + gw / 2 - 36, by, 72, 18);
    ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 1; ctx.strokeRect(gx + gw / 2 - 35.5, by + 0.5, 71, 17);
    text(ctx, `${progress.owned.length} / 100`, gx + gw / 2, by + 9, { size: 10, align: 'center', outline: false });
    if (pages > 1) {
      this.ui(ctx, 'ui_nav_left', gx + gw / 2 - 64, by - 3, 22, 24, m.page > 0 ? 1 : 0.35);
      this.ui(ctx, 'ui_nav_right', gx + gw / 2 + 42, by - 3, 22, 24, m.page < pages - 1 ? 1 : 0.35);
      this.regions.push({ x: gx + gw / 2 - 68, y: by - 6, w: 30, h: 30, fn: () => { m.page = Math.max(0, m.page - 1); this.game.sfx.play('ui'); } });
      this.regions.push({ x: gx + gw / 2 + 38, y: by - 6, w: 30, h: 30, fn: () => { m.page = Math.min(pages - 1, m.page + 1); this.game.sfx.play('ui'); } });
    }
    // organizar
    this.ui(ctx, 'ui_btn_sort', gx + gw - 66, by - 2, 60, 22);
    this.regions.push({ x: gx + gw - 66, y: by - 4, w: 60, h: 26, fn: () => { m.sort = (m.sort + 1) % 2; m.page = 0; this.toast(m.sort ? 'Organizado por tipo' : 'Organizado por raridade'); this.game.sfx.play('ui'); } });
  }

  /** Equipamentos do inventário: equipados primeiro, depois por raridade (ou por tipo). */
  private inventoryList(m: Extract<Modal, { kind: 'bag' }>, ok: (e: EquipmentDef) => boolean): string[] {
    const { progress } = this.game;
    const ORDER: Slot[] = ['weapon', 'helmet', 'armor', 'gloves', 'pants', 'boots', 'cape', 'aura', 'accessory', 'costume', 'shield'];
    const eq = new Set(Object.values(progress.equipped));
    return progress.owned.filter((id) => hasItem(id) && ok(getItem(id))).sort((a, b) => {
      const ea = getItem(a), eb = getItem(b);
      const q = (eq.has(b) ? 1 : 0) - (eq.has(a) ? 1 : 0);
      if (q) return q;
      const byRar = (eb.rarity ?? 0) - (ea.rarity ?? 0);
      const bySlot = ORDER.indexOf(ea.slot) - ORDER.indexOf(eb.slot);
      return (m.sort ? bySlot || byRar : byRar || bySlot) || gearScore(eb) - gearScore(ea);
    });
  }

  /** +1 melhor, -1 pior que o equipado no mesmo espaço, 0 igual/sem comparação. */
  private compare(id: string): number {
    const { progress } = this.game;
    const e = getItem(id);
    if (!usableBy(e, progress.classId)) return 0;
    const cur = progress.equipped[e.slot];
    if (!cur) return 1;
    const a = gearScore(e, upgradeMul(progress, id)), b = gearScore(getItem(cur), upgradeMul(progress, cur));
    return a > b * 1.001 ? 1 : a < b * 0.999 ? -1 : 0;
  }

  private markSeen(id: string): void {
    const p = this.game.progress;
    p.seen ??= [];
    if (!p.seen.includes(id)) { p.seen.push(id); this.game.save(); }
  }

  /** Painel de detalhes: atributos, comparação com o equipado e os botões Equipar/Desequipar/Vender. */
  private drawItemDetail(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'bag' }>, x: number, top: number, w: number, h: number): void {
    const { progress } = this.game;
    const id = m.sel && progress.owned.includes(m.sel) ? m.sel : null;
    if (!id) {
      text(ctx, 'Toque num item para', x + w / 2, top + h / 2 - 8, { size: 9, align: 'center', outline: false, color: '#aab4cc' });
      text(ctx, 'ver os detalhes', x + w / 2, top + h / 2 + 6, { size: 9, align: 'center', outline: false, color: '#aab4cc' });
      return;
    }
    const e = getItem(id);
    const r = e.rarity ?? 0;
    const u = upgradeMul(progress, id);
    const lv = progress.upgrades[id] ?? 0;
    this.itemCell(ctx, x + 8, top + 8, 44, id);
    const lines = wrapText(ctx, `${e.name}${lv ? ` +${lv}` : ''}`, w - 64, 10);
    lines.slice(0, 2).forEach((l, i) => text(ctx, l, x + 58, top + 14 + i * 12, { size: 10, outline: false, color: RARITY_COLORS[r] }));
    const kind = e.weaponKind ? ` (${WEAPON_KINDS[e.weaponKind]?.name ?? ''})` : '';
    text(ctx, `Tipo: ${SLOT_NAMES[e.slot]}${kind}`, x + 58, top + 40, { size: 8, outline: false, color: '#d8c8a8', bold: false });
    text(ctx, `Raridade: `, x + 58, top + 51, { size: 8, outline: false, color: '#d8c8a8', bold: false });
    text(ctx, RARITY_NAMES[r], x + 98, top + 51, { size: 8, outline: false, color: RARITY_COLORS[r] });
    // atributos (com o aprimoramento) e diferença para o equipado no espaço
    const cur = progress.equipped[e.slot];
    const ce = cur && cur !== id ? getItem(cur) : null;
    const cu = cur ? upgradeMul(progress, cur) : 1;
    const rows: [string, string, number, number, boolean][] = [
      ['⚔', 'ATQ', (e.atk ?? 0) * u, (ce?.atk ?? 0) * cu, false],
      ['🛡', 'DEF', (e.def ?? 0) * u, (ce?.def ?? 0) * cu, false],
      ['❤', 'HP', (e.hp ?? 0) * u, (ce?.hp ?? 0) * cu, false],
      ['💧', 'MP', (e.mp ?? 0) * u, (ce?.mp ?? 0) * cu, false],
      ['✦', 'Crítico', (e.crit ?? 0) * u * 100, (ce?.crit ?? 0) * cu * 100, true],
    ];
    const ry0 = top + 62;
    ctx.fillStyle = '#160f12'; ctx.fillRect(x + 6, ry0, w - 12, rows.length * 15 + 6);
    ctx.strokeStyle = '#6b4a1c'; ctx.lineWidth = 1; ctx.strokeRect(x + 6.5, ry0 + 0.5, w - 13, rows.length * 15 + 5);
    rows.forEach(([ic, label, v, old, pct], i) => {
      const yy = ry0 + 10 + i * 15;
      const fmt = (n: number) => pct ? `${Math.round(n * 10) / 10}%` : `${Math.round(n)}`;
      text(ctx, `${ic} ${label}`, x + 12, yy, { size: 9, outline: false, color: '#e8dcc0' });
      text(ctx, v ? `+${fmt(v)}` : '—', x + w - (ce ? 42 : 12), yy, { size: 9, align: 'right', outline: false, color: '#ffffff' });
      if (ce) {
        const d = v - old;
        if (Math.abs(d) > 0.05) text(ctx, `${d > 0 ? '▲' : '▼'}${fmt(Math.abs(d))}`, x + w - 10, yy, { size: 7, align: 'right', outline: false, color: d > 0 ? '#5fe05f' : '#ff5f5f' });
      }
    });
    if (ce) text(ctx, `▲▼ comparado com ${ce.name}`, x + w / 2, ry0 + rows.length * 15 + 14, { size: 6, align: 'center', outline: false, color: '#9a8a7a', bold: false });
    const desc = wrapText(ctx, e.description ?? '', w - 16, 7);
    desc.slice(0, 3).forEach((l, i) => text(ctx, l, x + 8, ry0 + rows.length * 15 + 26 + i * 9, { size: 7, outline: false, color: '#aab4cc', bold: false }));
    // botões
    const bw = w - 16, bx = x + 8;
    const equipped = progress.equipped[e.slot] === id;
    const b1 = top + h - 64;
    const other = !usableBy(e, progress.classId);
    this.ui(ctx, equipped ? 'ui_btn_unequip' : 'ui_btn_equip', bx, b1, bw, 28, other ? 0.4 : 1);
    if (other) text(ctx, `Arma de outra classe`, x + w / 2, b1 - 7, { size: 7, align: 'center', outline: false, color: '#ff9a7a' });
    this.regions.push({ x: bx, y: b1, w: bw, h: 28, fn: () => { if (equipped) this.game.unequip(e.slot); else this.game.equip(id); } });
    const b2 = top + h - 32;
    const v = this.game.sellValue(id);
    const canSell = !equipped && !STARTER_WEAPONS.has(id);
    this.ui(ctx, 'ui_btn_sell', bx, b2, bw * 0.58, 26, canSell ? 1 : 0.4);
    text(ctx, v.gems ? `${v.gems} 💎` : `${v.gold} G`, bx + bw, b2 + 13, { size: 8, align: 'right', outline: false, color: canSell ? '#ffd36b' : '#776' });
    this.regions.push({ x: bx, y: b2, w: bw * 0.58, h: 26, fn: () => { this.game.sell(id); if (!progress.owned.includes(id)) m.sel = null; } });
  }

  /** Grade de ícones da bolsa; tocar seleciona, tocar de novo usa. */
  private grid(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'bag' }>, list: { id: string; name: string; kind: BagKind; description: string }[], x: number, y: number, w: number, rows: number, album = false): void {
    const { progress } = this.game;
    const cell = 50, cols = Math.floor(w / cell);
    list.slice(0, cols * rows).forEach((it, k) => {
      const cx = x + (k % cols) * cell, cy = y + Math.floor(k / cols) * cell;
      const n = progress.bag[it.id] ?? 0;
      const sel = m.sel === it.id;
      const equipped = progress.cards.includes(it.id) || progress.rune === it.id;
      if (sel) glow(ctx, cx + (cell - 4) / 2, cy + (cell - 4) / 2, cell * 0.8, '#ffb840', 0.4);
      this.ui(ctx, sel || equipped ? 'ui_slot_sel' : 'ui_slot_empty', cx, cy, cell - 4, cell - 4);
      if (equipped) this.ui(ctx, 'ui_badge_e', cx + cell - 16, cy - 2, 13, 13);
      this.icon(ctx, 'it_' + it.id, cx + (cell - 4) / 2, cy + (cell - 4) / 2, 36, album && n === 0 ? 0.25 : 1);
      if (album) this.icon(ctx, n > 0 ? 'it_st_ok' : 'it_st_question', cx + cell - 12, cy + 9, 13);
      else text(ctx, `${n}`, cx + cell - 8, cy + cell - 12, { size: 9, align: 'right' });
      if ((it.kind === 'card' || it.kind === 'rune' || it.kind === 'orb') && affinity(progress.classId, it.id) > 1) text(ctx, '★', cx + 6, cy + 8, { size: 10, color: '#ffd36b' });
      this.regions.push({ x: cx, y: cy, w: cell - 4, h: cell - 4, fn: () => {
        if (m.sel === it.id && !album) this.game.useBagItem(it.id);
        else { m.sel = it.id; this.game.sfx.play('ui'); }
      } });
    });
    // descrição do selecionado
    const it = list.find((b) => b.id === m.sel);
    const fy = VIEW_H - 40;
    if (it) {
      text(ctx, it.name, x + 4, fy, { size: 11, outline: false, color: '#ffe9a8' });
      const hint = album ? '' : it.kind === 'potion' ? ' · toque de novo para usar' : it.kind === 'chest' ? ' · toque de novo para abrir' : it.kind === 'card' || it.kind === 'rune' ? ' · toque de novo para equipar/tirar' : it.kind === 'ticket' ? ' · toque de novo para usar' : '';
      text(ctx, it.description + hint, x + 4, fy + 14, { size: 9, outline: false, color: '#aab4cc', bold: false });
      if (!album && ['potion', 'chest', 'ticket', 'card', 'rune'].includes(it.kind)) {
        this.ui(ctx, 'ui_btn_use', x + w - 76, fy - 8, 72, 26);
        this.regions.push({ x: x + w - 76, y: fy - 8, w: 72, h: 26, fn: () => this.game.useBagItem(it.id) });
      }
    }
  }

  private drawReward(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'reward' }>): void {
    const w = 440, h = 60 + Math.ceil(m.items.length / 2) * 34 + 30, x = (VIEW_W - w) / 2, y = Math.max(8, (VIEW_H - h) / 2);
    this.panel(ctx, x, y, w, h, m.title, false);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => { if (m.t > 0.4) this.modal = m.back ?? null; } });
    m.items.forEach((it, i) => {
      const appear = m.t - i * 0.08;
      if (appear < 0) return;
      const ix = x + 16 + (i % 2) * (w / 2 - 10), iy = y + 40 + Math.floor(i / 2) * 34;
      const pop = 1 + Math.max(0, 0.3 - appear) * 2;
      glow(ctx, ix + 14, iy + 14, 18, '#ffd36b', 0.25);
      this.icon(ctx, it.icon, ix + 14, iy + 14, 26 * pop);
      text(ctx, it.label, ix + 34, iy + 14, { size: 10, outline: false });
    });
    text(ctx, 'Toque para continuar', x + w / 2, y + h - 14, { size: 9, align: 'center', outline: false, color: '#aab4cc' });
  }

  /** Eventos: escolher o chefe Lendário/Mítico, a dificuldade e ver a recompensa. */
  /** Passe de batalha: grátis (azul) à esquerda e com gemas (dourado) à direita, por nível. */
  private drawPass(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'pass' }>): void {
    const { progress } = this.game;
    const x = 12, y = 8, w = VIEW_W - 24, h = VIEW_H - 16;
    this.panel(ctx, x, y, w, h, '⚔ Passe de Batalha');
    text(ctx, `Nível ${progress.level}`, x + w - 150, y + 16, { size: 10, align: 'right', color: '#ffe9a8' });
    this.icon(ctx, 'it_gem_blue', x + w - 128, y + 16, 12);
    text(ctx, `${progress.gems}`, x + w - 118, y + 16, { size: 10, color: '#9fd3ff' });
    const colW = (w - 30) / 2, top = y + 34, rowH = 30, rows = Math.floor((h - 50) / rowH);
    (['free', 'paid'] as const).forEach((track, ci) => {
      const list = PASS.filter((r) => r.track === track);
      const cx = x + 8 + ci * (colW + 14);
      const paid = track === 'paid';
      const main = paid ? '#ffc94a' : '#5fb4ff';
      ctx.fillStyle = paid ? 'rgba(60,40,10,0.55)' : 'rgba(10,30,70,0.55)';
      ctx.fillRect(cx, top - 4, colW, h - 36);
      ctx.strokeStyle = main; ctx.lineWidth = 1.5; ctx.strokeRect(cx + 0.5, top - 3.5, colW - 1, h - 37);
      text(ctx, paid ? 'PASSE COM GEMAS' : 'PASSE GRÁTIS', cx + colW / 2, top + 7, { size: 11, align: 'center', color: main });
      const ly = top + 18, vis = rows - 1;
      m.scroll[ci] = Math.max(0, Math.min(Math.max(0, list.length - vis), m.scroll[ci]));
      const sm = { sel: 0, scroll: m.scroll[ci] };
      this.scrollList(ctx, sm, list.length, vis, cx + colW - 22, ly, vis * rowH);
      m.scroll[ci] = sm.scroll;
      list.slice(m.scroll[ci], m.scroll[ci] + vis).forEach((r, k) => {
        const ry = ly + k * rowH, rw = colW - 30;
        const st = this.game.passState(r.id);
        ctx.fillStyle = st === 'ready' ? (paid ? '#3e3216' : '#1c3050') : '#1b2134';
        ctx.fillRect(cx + 4, ry, rw, rowH - 3);
        if (st === 'ready') { ctx.strokeStyle = main; ctx.lineWidth = 1; ctx.strokeRect(cx + 4.5, ry + 0.5, rw - 1, rowH - 4); }
        this.icon(ctx, r.icon, cx + 20, ry + (rowH - 3) / 2, 24, st === 'level' ? 0.45 : 1);
        text(ctx, r.name, cx + 38, ry + 9, { size: 9, outline: false, color: st === 'level' ? '#8a93a8' : '#ffffff' });
        text(ctx, `NV ${r.level}`, cx + 38, ry + 20, { size: 8, outline: false, color: progress.level >= r.level ? '#8fe07a' : '#ff9a7a' });
        // botão
        const bw = 70, bx = cx + 4 + rw - bw - 4, by = ry + 4, bh = rowH - 11;
        let label = '', col = '#555c70', fg = '#cfd6e6';
        if (st === 'claimed') { label = '✓ Resgatado'; col = '#24402a'; fg = '#8fe07a'; }
        else if (st === 'level') { label = `🔒 NV ${r.level}`; col = '#2a2f40'; fg = '#8a93a8'; }
        else if (st === 'gems') { label = `${r.gems} 💎`; col = '#402424'; fg = '#ff8a8a'; }
        else { label = r.gems ? `${r.gems} 💎` : 'Resgatar'; col = paid ? '#a07818' : '#2f7a3f'; fg = '#ffffff'; }
        ctx.fillStyle = col; ctx.fillRect(bx, by, bw, bh);
        text(ctx, label, bx + bw / 2, by + bh / 2, { size: 8, align: 'center', outline: false, color: fg });
        if (st !== 'claimed') this.regions.push({ x: bx - 4, y: ry, w: bw + 8, h: rowH - 3, fn: () => this.game.claimPass(r.id) });
      });
    });
  }

  private drawEvents(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'events' }>): void {
    const { progress } = this.game;
    const x = 12, y = 8, w = VIEW_W - 24, h = VIEW_H - 16;
    this.panel(ctx, x, y, w, h, '👑 Eventos — Chefes Lendários e Míticos');
    const tl = progress.bag.tk_legend ?? 0, tm = progress.bag.tk_myth ?? 0;
    this.icon(ctx, 'it_tk_legend', x + w - 150, y + 16, 16);
    text(ctx, `x${tl}`, x + w - 140, y + 16, { size: 10, color: '#ffb840' });
    this.icon(ctx, 'it_tk_myth', x + w - 106, y + 16, 16);
    text(ctx, `x${tm}`, x + w - 96, y + 16, { size: 10, color: '#ff8a8a' });
    const t = performance.now() / 1000;
    // lista de chefes
    MYTHIC_BOSSES.forEach((b, i) => {
      const ry = y + 32 + i * 43, rw = 206;
      const on = i === m.sel;
      const myth = b.tier === 'myth';
      ctx.fillStyle = on ? (myth ? '#4a2030' : '#4a3a20') : '#252e45';
      ctx.fillRect(x + 8, ry, rw, 40);
      if (on) { ctx.strokeStyle = myth ? '#ff6a6a' : '#ffb840'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 8, ry, rw, 40); }
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 8, ry, 44, 40); ctx.clip();
      drawSpriteH(ctx, `boss_my_${b.key}_idle`, x + 30, ry + 38, 36, -1);
      ctx.restore();
      text(ctx, b.name, x + 56, ry + 12, { size: 11, outline: false, color: myth ? '#ff8a8a' : '#ffc860' });
      const done = progress.eventsCleared?.[b.key] ?? 0;
      text(ctx, `${myth ? 'Mítico' : 'Lendário'}  ${done & 1 ? '✔Difícil ' : ''}${done & 2 ? '✔Épico' : ''}`, x + 56, ry + 28, { size: 8, outline: false, color: '#aab4cc', bold: false });
      this.regions.push({ x: x + 8, y: ry, w: rw, h: 40, fn: () => { m.sel = i; this.game.sfx.play('ui'); } });
    });
    // detalhes
    const b = MYTHIC_BOSSES[m.sel];
    const rx = x + 222, rw = w - 232, py = y + 32, ph = 112;
    const pano = `pano_my_${b.key}`;
    const [pw, phh] = frameSize(pano);
    const sw = Math.min(pw, (rw * phh) / ph);
    if (pw) drawSub(ctx, pano, ((t * 12) % Math.max(1, pw - sw)), 0, sw, phh, rx, py, rw, ph);
    ctx.strokeStyle = b.color; ctx.lineWidth = 1.5; ctx.strokeRect(rx, py, rw, ph);
    glow(ctx, rx + rw * 0.72, py + ph - 30, 60, b.color, 0.3);
    drawSprite(ctx, `boss_my_${b.key}_idle`, t * 3, rx + rw * 0.72, py + ph - 4, -1, { scale: 0.8 });
    for (let k = 0; k < 3; k++) drawSpriteH(ctx, `mye_${b.key}_${(k * 2) % 6}`, rx + 34 + k * 40, py + ph - 4, 36, 1);
    text(ctx, b.name, rx + 8, py + 12, { size: 13, color: '#ffffff' });
    text(ctx, `${EVENT_PHASES} fases · 40 minutos · horda própria`, rx + 8, py + 28, { size: 9, color: '#ffe9a8' });
    // dificuldade
    const by = py + ph + 6;
    DIFFICULTIES.forEach((d, i) => {
      const bx = rx + i * 110, on = i === m.diff;
      ctx.fillStyle = on ? (i ? '#7a2a5a' : '#6a4a20') : '#252e45';
      ctx.fillRect(bx, by, 104, 22);
      if (on) { ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, 104, 22); }
      text(ctx, d.name, bx + 52, by + 11, { size: 11, align: 'center', outline: false, color: on ? '#ffffff' : '#aab4cc' });
      this.regions.push({ x: bx, y: by, w: 104, h: 22, fn: () => { m.diff = i; this.game.sfx.play('ui'); } });
    });
    const D = DIFFICULTIES[m.diff];
    text(ctx, `Monstros nível ${progress.level + D.levelAdd}+ · vida ×${D.hpMul}`, rx + 226, by + 11, { size: 9, outline: false, color: '#aab4cc', bold: false });
    // recompensa: o set da classe na raridade do evento
    const r = rewardRarity(b.tier, m.diff);
    const cls = SET_OF[progress.classId ?? 'warrior'];
    const ry = by + 28;
    text(ctx, `Recompensa: Set ${RARITY_NAMES[r]} do ${SET_NAMES[cls]}`, rx, ry + 6, { size: 11, color: RARITY_COLORS[r] });
    const ids = setFor(progress.classId, r);
    ids.forEach((id, k) => {
      const ix = rx + k * 38;
      ctx.fillStyle = '#1c2236'; ctx.fillRect(ix, ry + 16, 35, 35);
      ctx.strokeStyle = RARITY_COLORS[r]; ctx.lineWidth = 1; ctx.strokeRect(ix, ry + 16, 35, 35);
      this.icon(ctx, getItem(id).icon ?? '', ix + 17, ry + 33, 27);
    });
    // prévia do personagem com o set (camadas)
    const preview: Progress = { ...progress, equipped: { ...progress.equipped }, upgrades: {} };
    for (const id of ids) preview.equipped[getItem(id).slot] = id;
    // (à direita dos ícones, sem cobrir nada; sempre o personagem montado com as peças, nunca arte pronta)
    const px = rx + ids.length * 38 + 60, pyy = ry + 112;
    glow(ctx, px, pyy - 40, 50, RARITY_COLORS[r], 0.25);
    drawDollIdle(ctx, preview, px, pyy, 1, 1.4, t);
    // entrar
    const ticket = TICKET_OF[b.tier];
    const have = progress.bag[ticket] ?? 0;
    const ex = rx, ey = y + h - 38;
    ctx.fillStyle = have ? '#3f8a45' : '#4a3a3a';
    ctx.fillRect(ex, ey, 200, 30);
    this.icon(ctx, 'it_' + ticket, ex + 18, ey + 15, 22);
    text(ctx, have ? `Entrar (1 ${bagItem(ticket)?.name})` : `Sem ${bagItem(ticket)?.name}`, ex + 112, ey + 15, { size: 10, align: 'center', outline: false });
    this.regions.push({ x: ex, y: ey, w: 200, h: 30, fn: () => this.game.startEvent(b.key, m.diff) });
    if (!have) text(ctx, 'Tíquetes: loja da ferreira (gemas) ou chefes', ex, ey - 8, { size: 8, outline: false, color: '#aab4cc', bold: false });
  }

  private drawArena(ctx: CanvasRenderingContext2D): void {
    const { progress } = this.game;
    const w = 480, h = 260, x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    this.panel(ctx, x, y, w, h, '⚔ Arena dos Chefes');
    text(ctx, 'Enfrente um chefe no seu nível. Precisa de um tíquete (loja da ferreira).', x + 14, y + 38, { size: 10, outline: false, color: '#aab4cc' });
    const tiers = [
      ['t_bronze', 'Fácil', 'Chefe intermediário', 'Baú Azul + 3 gemas'],
      ['t_blue', 'Normal', 'Chefe intermediário +3 níveis', 'Baú Arcano + 6 gemas'],
      ['t_purple', 'Difícil', 'Chefe final +6 níveis', 'Baú Dourado + 9 gemas'],
      ['t_gold', 'Lendária', 'Chefe final +9 níveis', 'Baú Angelical + 12 gemas'],
    ];
    tiers.forEach(([ticket, name, foe, reward], i) => {
      const ry = y + 54 + i * 46;
      const n = progress.bag[ticket] ?? 0;
      ctx.fillStyle = n ? '#2c3a5a' : '#22283a';
      ctx.fillRect(x + 12, ry, w - 24, 42);
      this.icon(ctx, 'it_' + ticket, x + 34, ry + 21, 32);
      text(ctx, `${name} · ${foe}`, x + 60, ry + 13, { size: 11, outline: false });
      text(ctx, `Prêmio: ${reward}${progress.vipPass ? ' (VIP x2)' : ''}`, x + 60, ry + 29, { size: 9, outline: false, color: '#ffd36b', bold: false });
      text(ctx, `x${n}`, x + w - 24, ry + 21, { size: 11, align: 'right', color: n ? '#8fe07a' : '#e0524f', outline: false });
      this.regions.push({ x: x + 12, y: ry, w: w - 24, h: 42, fn: () => this.game.startArena(i) });
    });
  }

  private drawMenu(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'menu' }>): void {
    const { progress, world } = this.game;
    const s = world.stats;
    const x = 20, y = 16, w = VIEW_W - 40, h = VIEW_H - 32;
    this.panel(ctx, x, y, w, h, `Personagem · ${getClass(progress.classId).name}`);
    const lx = x + 14;
    const rows: [string, string][] = [
      ['Nível', `${progress.level}`],
      ['EXP', `${progress.exp} / ${expToNext(progress.level)}`],
      ['HP', `${Math.ceil(world.player.hp)} / ${s.maxHp}`],
      ['MP', `${Math.floor(world.player.mp)} / ${s.maxMp}`],
      ['Ataque', `${s.atk}`],
      ['Defesa', `${s.def}`],
      ['Crítico', `${Math.round(s.crit * 100)}%`],
      ['Ouro', `${progress.gold} G`],
    ];
    rows.forEach(([k, v], i) => {
      text(ctx, k, lx, y + 42 + i * 17, { size: 11, color: '#aab4cc', outline: false });
      text(ctx, v, lx + 190, y + 42 + i * 17, { size: 11, align: 'right', outline: false });
    });
    text(ctx, 'Poderes nos botões', lx, y + 192, { size: 12, color: '#ffe9a8' });
    const slotsM = slotSkills(progress);
    for (let k = 0; k < SLOT_COUNT; k++) {
      const sx = lx + k * 46, sy = y + 204;
      ctx.fillStyle = '#252e45';
      ctx.fillRect(sx, sy, 40, 40);
      const sk = slotsM[k];
      if (sk && hasSprite(sk.icon)) drawSpriteH(ctx, sk.icon, sx + 20, sy + 38, 36);
      else if (sk) text(ctx, sk.name.split(' ')[0], sx + 20, sy + 20, { size: 8, align: 'center', outline: false });
      text(ctx, `${k + 1}`, sx + 4, sy + 6, { size: 8, outline: true, color: '#ffe9a8' });
    }
    const bx2 = lx, by2 = y + 250;
    ctx.fillStyle = '#3f5fb0';
    ctx.fillRect(bx2, by2, 112, 20);
    text(ctx, '✦ Trocar poderes', bx2 + 56, by2 + 10, { size: 10, align: 'center', outline: false });
    this.regions.push({ x: bx2, y: by2 - 2, w: 112, h: 24, fn: () => { this.modal = { kind: 'skills', slot: 0, sel: 0 }; this.game.sfx.play('ui'); } });
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(bx2 + 118, by2, 92, 20);
    text(ctx, '🎒 Bolsa', bx2 + 164, by2 + 10, { size: 10, align: 'center', outline: false });
    this.regions.push({ x: bx2 + 118, y: by2 - 2, w: 92, h: 24, fn: () => this.openBag() });

    // som, música e diário de missões
    const { sfx, music } = this.game;
    const by = y + h - 30;
    const button = (bx: number, bw: number, label: string, on: boolean, fn: () => void) => {
      ctx.fillStyle = on ? '#34406a' : '#2a2f3d';
      ctx.fillRect(bx, by, bw, 22);
      text(ctx, label, bx + bw / 2, by + 11, { size: 10, align: 'center', outline: false, color: on ? '#ffffff' : '#8890a0' });
      this.regions.push({ x: bx, y: by - 4, w: bw, h: 30, fn });
    };
    button(lx, 64, sfx.muted ? '🔇 Som' : '🔊 Som', !sfx.muted, () => { sfx.setMuted(!sfx.muted); sfx.play('ui'); });
    button(lx + 70, 70, music.muted ? '🎵 Música ✕' : '🎵 Música', !music.muted, () => { music.setMuted(!music.muted); sfx.play('ui'); });
    button(lx + 146, 74, `📜 Missões`, true, () => { this.modal = { kind: 'quests' }; sfx.play('ui'); });
    const inTown = world.stage.id === 'lumen';
    button(lx + 226, 92, `⚔ Classe`, inTown, () => {
      if (inTown) { this.openClasses(); sfx.play('ui'); } else { this.toast('Troque de classe na vila'); sfx.play('nomp'); }
    });

    const rx = x + 240, rw = w - 252;
    text(ctx, 'Equipamentos (toque para equipar)', rx, y + 42, { size: 11, color: '#ffe9a8' });
    this.scrollList(ctx, m, progress.owned.length, MENU_ROWS, rx + rw - 18, y + 54, MENU_ROWS * 24);
    progress.owned.slice(m.scroll, m.scroll + MENU_ROWS).forEach((id, k) => {
      const i = m.scroll + k;
      this.itemRow(ctx, rx, y + 54 + k * 24, rw - 22, 24, id, i === m.sel, () => { m.sel = i; this.itemAction(id); }, false);
    });
  }

  private keepVisible(m: { sel: number; scroll: number }, rows: number): void {
    if (m.sel < m.scroll) m.scroll = m.sel;
    if (m.sel >= m.scroll + rows) m.scroll = m.sel - rows + 1;
  }

  /** Barra de rolagem com botões ▲ ▼ (só aparece se a lista não cabe). */
  private scrollList(ctx: CanvasRenderingContext2D, m: { sel: number; scroll: number }, total: number, rows: number, x: number, y: number, h: number): void {
    if (total <= rows) { m.scroll = 0; return; }
    m.scroll = Math.max(0, Math.min(total - rows, m.scroll));
    const btn = (by: number, label: string, delta: number) => {
      ctx.fillStyle = '#34406a';
      ctx.fillRect(x, by, 18, 26);
      text(ctx, label, x + 9, by + 13, { size: 11, align: 'center', outline: false });
      this.regions.push({ x: x - 6, y: by - 4, w: 30, h: 34, fn: () => {
        m.scroll = Math.max(0, Math.min(total - rows, m.scroll + delta));
        m.sel = Math.max(m.scroll, Math.min(m.scroll + rows - 1, m.sel));
        this.game.sfx.play('ui');
      } });
    };
    btn(y, '▲', -Math.max(1, rows - 2));
    btn(y + h - 26, '▼', Math.max(1, rows - 2));
    // trilho
    const trackY = y + 30, trackH = h - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 7, trackY, 4, trackH);
    ctx.fillStyle = '#9cc4ff';
    ctx.fillRect(x + 7, trackY + (trackH * m.scroll) / total, 4, Math.max(10, (trackH * rows) / total));
  }

  private drawMap(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'map' }>): void {
    const x = 16, y = 12, w = VIEW_W - 32, h = VIEW_H - 24;
    const stars = this.game.progress.stars;
    const total = Object.values(stars).reduce((a, b) => a + countStars(b), 0);
    this.panel(ctx, x, y, w, h, `Mapa do mundo  ·  ★ ${total}/${REGIONS.length * STAGES_PER_REGION * 3}`);
    let regionStars = 0;
    for (let k = 1; k <= STAGES_PER_REGION; k++) regionStars += countStars(stars[stageId(m.region * STAGES_PER_REGION + k)]);
    const region = REGIONS[m.region];
    const [c1, c2] = THEME_COLORS[region.theme];
    // faixa da região
    const g = ctx.createLinearGradient(0, y + 34, 0, y + 74);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(x + 12, y + 34, w - 24, 40);
    text(ctx, `Região ${m.region + 1} de ${REGIONS.length}  ·  ★ ${regionStars}/${STAGES_PER_REGION * 3}`, VIEW_W / 2, y + 46, { size: 10, align: 'center' });
    text(ctx, region.name, VIEW_W / 2, y + 62, { size: 15, align: 'center', color: '#ffe9a8' });
    const arrow = (ax: number, label: string, delta: number, enabled: boolean) => {
      ctx.globalAlpha = enabled ? 1 : 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(ax, y + 38, 34, 32);
      text(ctx, label, ax + 17, y + 54, { size: 16, align: 'center' });
      ctx.globalAlpha = 1;
      if (enabled) this.regions.push({ x: ax - 4, y: y + 34, w: 42, h: 40, fn: () => { m.region += delta; m.sel = 0; this.game.sfx.play('ui'); } });
    };
    arrow(x + 16, '◀', -1, m.region > 0);
    arrow(x + w - 50, '▶', 1, m.region < REGIONS.length - 1);

    // cartões das fases (2 fileiras de 5)
    const cols = 5, gap = 8;
    const cw = (w - 24 - gap * (cols - 1)) / cols, ch = 62;
    for (let s = 0; s < STAGES_PER_REGION; s++) {
      const n = m.region * STAGES_PER_REGION + s + 1;
      const cx = x + 12 + (s % cols) * (cw + gap), cy = y + 82 + Math.floor(s / cols) * (ch + gap);
      const open = this.unlocked(n);
      const done = this.game.progress.cleared.includes(stageId(n));
      const isBoss = s + 1 === STAGES_PER_REGION, isElite = s + 1 === 5;
      ctx.fillStyle = s === m.sel ? '#34406a' : open ? '#252e45' : '#1a1f2e';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = isBoss ? '#e05a7a' : isElite ? '#e0a050' : s === m.sel ? '#9cc4ff' : '#3a4560';
      ctx.lineWidth = s === m.sel ? 2 : 1;
      ctx.strokeRect(cx, cy, cw, ch);
      text(ctx, `${m.region + 1}-${s + 1}`, cx + cw / 2, cy + 18, { size: 15, align: 'center', color: open ? '#ffffff' : '#666e80' });
      const lv = getStage(stageId(n)).level ?? 1;
      text(ctx, `Nv ${lv}`, cx + cw - 5, cy + 9, { size: 8, align: 'right', outline: false, color: open ? levelColor(lv, this.game.progress.level) : '#666e80' });
      if (done) drawStars(ctx, cx + cw / 2, cy + 37, 12, stars[stageId(n)] ?? 1);
      else text(ctx, open ? '▶ Jogar' : '🔒', cx + cw / 2, cy + 36, { size: 9, align: 'center', outline: false, color: open ? '#9cc4ff' : '#666e80' });
      if (isBoss || isElite) text(ctx, isBoss ? '☠ CHEFE' : '★ Chefe', cx + cw / 2, cy + 52, { size: 9, align: 'center', outline: false, color: isBoss ? '#ff8aa0' : '#ffc070' });
      this.regions.push({ x: cx, y: cy, w: cw, h: ch, fn: () => {
        if (m.sel === s) this.mapEnter(m);
        else { m.sel = s; this.game.sfx.play('ui'); }
      } });
    }

    // informações da fase escolhida
    const n = m.region * STAGES_PER_REGION + m.sel + 1;
    const st = getStage(stageId(n));
    const iy = y + 82 + 2 * (ch + gap) + 4;
    const lastWave = st.waves[st.waves.length - 1];
    const bossDef = lastWave.enemies.map((e) => getEnemy(e.enemyId)).find((d) => d.boss);
    text(ctx, st.name, x + 16, iy + 10, { size: 12, color: '#ffe9a8', outline: false });
    const mood = st.mood === 'night' ? 'Noite' : st.mood === 'dusk' ? 'Entardecer' : 'Dia';
    const lvl = st.level ?? 1;
    text(ctx, `Monstros Nv ${lvl}–${lvl + 1}${bossDef ? ` · Chefe: ${bossDef.name} (Nv ${lvl + (bossDef.hp >= 600 ? 3 : 2)})` : ''} · ${st.waves.length} ondas · ${mood}`,
      x + 16, iy + 28, { size: 9, color: '#aab4cc', outline: false, bold: false });
    text(ctx, `Estrelas: ★ vencer · ★ em até ${formatTime(st.parTime ?? 0)} · ★ perdendo no máximo ${Math.round(DAMAGE_LIMIT * 100)}% da vida`,
      x + 16, iy + 44, { size: 9, color: '#ffd36b', outline: false, bold: false });
    const open = this.unlocked(n);
    const bw = 110, bx = x + w - bw - 14, by = iy + 2;
    ctx.fillStyle = open ? '#3f8a45' : '#3a3f4a';
    ctx.fillRect(bx, by, bw, 32);
    text(ctx, open ? 'Entrar ▶' : 'Bloqueada', bx + bw / 2, by + 16, { size: 13, align: 'center', color: open ? '#ffffff' : '#888' });
    this.regions.push({ x: bx, y: by, w: bw, h: 32, fn: () => this.mapEnter(m) });
    ctx.fillStyle = '#8a2a3a';
    ctx.fillRect(bx - 104, by, 96, 32);
    text(ctx, '⚔ Arena', bx - 56, by + 16, { size: 12, align: 'center' });
    this.regions.push({ x: bx - 104, y: by, w: 96, h: 32, fn: () => { this.modal = { kind: 'arena' }; this.game.sfx.play('ui'); } });
  }

  private pickSkill(m: Extract<Modal, { kind: 'skills' }>, id: string): void {
    const sk = this.game.world.cls.skills.find((s) => s.id === id);
    if (!sk) return;
    if (this.game.progress.level < sk.unlockLevel) {
      this.toast(`${sk.name} desbloqueia no nível ${sk.unlockLevel}`);
      this.game.sfx.play('nomp');
      return;
    }
    assignSlot(this.game.progress, m.slot, id);
    this.game.save();
    this.game.sfx.play('ui');
    this.toast(`${sk.name} no botão ${m.slot + 1}`);
    m.slot = (m.slot + 1) % SLOT_COUNT;
  }

  private drawSkills(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'skills' }>): void {
    const { progress, world } = this.game;
    const x = 16, y = 10, w = VIEW_W - 32, h = VIEW_H - 20;
    this.panel(ctx, x, y, w, h, `Poderes · ${world.cls.name}`);
    // botões 1-4 (escolha qual trocar)
    const slots = slotSkills(progress);
    text(ctx, 'Escolha o botão e depois o poder:', x + 14, y + 40, { size: 10, outline: false, color: '#aab4cc' });
    for (let k = 0; k < SLOT_COUNT; k++) {
      const sx = x + 210 + k * 54, sy = y + 26;
      const sel = k === m.slot;
      ctx.fillStyle = sel ? '#4a5a90' : '#252e45';
      ctx.fillRect(sx, sy, 46, 30);
      ctx.strokeStyle = sel ? '#ffd36b' : '#3a4560';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(sx, sy, 46, 30);
      const sk = slots[k];
      if (sk && hasSprite(sk.icon)) drawSpriteH(ctx, sk.icon, sx + 30, sy + 28, 26);
      text(ctx, `${k + 1}`, sx + 8, sy + 15, { size: 12, color: '#ffe9a8' });
      this.regions.push({ x: sx, y: sy, w: 46, h: 30, fn: () => { m.slot = k; this.game.sfx.play('ui'); } });
    }
    // lista dos poderes (2 colunas)
    const list = world.cls.skills;
    const cw = (w - 30) / 2, ch = 62;
    list.forEach((sk, i) => {
      const cx = x + 10 + (i % 2) * (cw + 10), cy = y + 64 + Math.floor(i / 2) * (ch + 4);
      const locked = progress.level < sk.unlockLevel;
      const inSlot = slots.findIndex((q) => q?.id === sk.id);
      ctx.fillStyle = i === m.sel ? '#34406a' : '#252e45';
      ctx.fillRect(cx, cy, cw, ch);
      if (hasSprite(sk.icon)) {
        ctx.globalAlpha = locked ? 0.35 : 1;
        drawSpriteH(ctx, sk.icon, cx + 28, cy + 54, 48);
        ctx.globalAlpha = 1;
      }
      text(ctx, sk.name, cx + 58, cy + 12, { size: 11, outline: false, color: locked ? '#777' : '#ffffff' });
      text(ctx, locked ? `🔒 Nível ${sk.unlockLevel}` : `${sk.mpCost} MP · ${sk.cooldown}s`, cx + 58, cy + 26, { size: 9, outline: false, color: locked ? '#ff9b9b' : '#9cc4ff', bold: false });
      wrapText(ctx, sk.description, cw - 66, 8).slice(0, 2).forEach((l, k) => text(ctx, l, cx + 58, cy + 39 + k * 10, { size: 8, outline: false, color: '#aab4cc', bold: false }));
      if (inSlot >= 0) text(ctx, `[${inSlot + 1}]`, cx + cw - 8, cy + 12, { size: 10, align: 'right', color: '#ffd36b', outline: false });
      this.regions.push({ x: cx, y: cy, w: cw, h: ch, fn: () => { m.sel = i; this.pickSkill(m, sk.id); } });
    });
  }

  private drawClasses(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'classes' }>): void {
    const x = 16, y = 12, w = VIEW_W - 32, h = VIEW_H - 24;
    this.panel(ctx, x, y, w, h, m.first ? 'Escolha sua classe' : 'Trocar de classe', !m.first);
    const n = CLASSES.length, gap = 6;
    const cw = (w - 24 - gap * (n - 1)) / n, ch = 150;
    const t = performance.now() / 1000;
    CLASSES.forEach((c, i) => {
      const cx = x + 12 + i * (cw + gap), cy = y + 36;
      const sel = i === m.sel;
      ctx.fillStyle = sel ? '#34406a' : '#252e45';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = sel ? '#ffd36b' : '#3a4560';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(cx, cy, cw, ch);
      if (spritesReady()) {
        // prévia: o corpo da classe com a arma inicial
        const weapon = STARTER_WEAPON[c.id] ?? 'training_sword';
        const preview = { ...this.game.progress, classId: c.id, equipped: { weapon }, upgrades: {} };
        drawDollIdle(ctx, preview, cx + cw / 2, cy + 98, 1, sel ? 1.5 : 1.35, t);
      }
      text(ctx, c.name, cx + cw / 2, cy + 116, { size: 13, align: 'center', color: sel ? '#ffe9a8' : '#ffffff' });
      text(ctx, c.basic.kind === 'shot' ? 'Ataque à distância' : 'Corpo a corpo', cx + cw / 2, cy + 134, { size: 9, align: 'center', outline: false, color: '#aab4cc' });
      this.regions.push({ x: cx, y: cy, w: cw, h: ch, fn: () => {
        if (m.sel === i) { this.game.chooseClass(c.id); this.close(); } else { m.sel = i; this.game.sfx.play('ui'); }
      } });
    });
    const c = CLASSES[m.sel];
    const iy = y + 36 + ch + 12;
    wrapText(ctx, c.description, w - 160, 11).forEach((l, i) => text(ctx, l, x + 16, iy + 6 + i * 15, { size: 11, outline: false }));
    const mods = c.mods;
    const stat = (v: number) => (v > 1.05 ? '▲' : v < 0.95 ? '▼' : '•');
    text(ctx, `Vida ${stat(mods.hp)}  MP ${stat(mods.mp)}  Ataque ${stat(mods.atk)}  Defesa ${stat(mods.def)}  Crítico ${stat(mods.crit)}`,
      x + 16, iy + 42, { size: 10, outline: false, color: '#9cc4ff' });
    if (c.skills.some((s) => s.icon)) c.skills.forEach((s, k) => drawSpriteH(ctx, s.icon!, x + 30 + k * 30, iy + 82, 26));
    else text(ctx, `Poderes: ${c.skills.map((s) => s.name).join(' · ')}`, x + 16, iy + 60, { size: 10, outline: false, color: '#ffd36b', bold: false });
    const bw = 130, bx = x + w - bw - 14, by = iy;
    ctx.fillStyle = '#3f8a45';
    ctx.fillRect(bx, by, bw, 34);
    text(ctx, 'Escolher ▶', bx + bw / 2, by + 17, { size: 13, align: 'center' });
    this.regions.push({ x: bx, y: by, w: bw, h: 34, fn: () => { this.game.chooseClass(c.id); this.close(); } });
  }

  private drawOffer(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'offer' }>): void {
    const w = 380, h = 190, x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    this.panel(ctx, x, y, w, h, `Missão de ${m.npc.name}`, false);
    text(ctx, m.quest.title, x + w / 2, y + 46, { size: 16, align: 'center', color: '#ffe9a8' });
    wrapText(ctx, `Objetivo: ${m.quest.goal.label}`, w - 40, 11).forEach((l, i) =>
      text(ctx, l, x + w / 2, y + 74 + i * 15, { size: 11, align: 'center', outline: false }));
    text(ctx, `Recompensa: ${rewardText(m.quest.reward)}`, x + w / 2, y + 110, { size: 11, align: 'center', color: '#ffd36b', outline: false });
    const btn = (bx: number, label: string, i: number, color: string) => {
      ctx.fillStyle = m.sel === i ? color : '#2a2f3d';
      ctx.fillRect(bx, y + h - 50, 150, 34);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, y + h - 50, 150, 34);
      text(ctx, label, bx + 75, y + h - 33, { size: 13, align: 'center' });
      this.regions.push({ x: bx, y: y + h - 50, w: 150, h: 34, fn: () => this.answerOffer(m, i === 0) });
    };
    btn(x + 30, '✔ Aceitar', 0, '#3f8a45');
    btn(x + w - 180, 'Agora não', 1, '#5a6278');
  }

  private drawQuests(ctx: CanvasRenderingContext2D): void {
    const x = 20, y = 16, w = VIEW_W - 40, h = VIEW_H - 32;
    const qb = this.game.quests;
    this.panel(ctx, x, y, w, h, `Missões  ·  ${qb.doneCount()} concluídas`);
    const list = qb.active();
    if (!list.length) {
      text(ctx, 'Nenhuma missão em andamento.', x + w / 2, y + 90, { size: 13, align: 'center', outline: false });
      text(ctx, 'Procure NPCs com ! na cabeça, na Vila de Lumen.', x + w / 2, y + 112, { size: 11, align: 'center', outline: false, color: '#aab4cc' });
      return;
    }
    list.forEach((q, i) => {
      const ry = y + 36 + i * 52;
      const ready = qb.isReady(q);
      ctx.fillStyle = ready ? '#24402c' : '#252e45';
      ctx.fillRect(x + 12, ry, w - 24, 46);
      text(ctx, `${q.title}  ·  ${qb.giverName(q)}`, x + 22, ry + 12, { size: 12, color: ready ? '#8fe07a' : '#ffe9a8', outline: false });
      text(ctx, ready ? `Pronta! Volte a ${qb.giverName(q)} para receber a recompensa.` : q.goal.label, x + 22, ry + 27, { size: 10, outline: false, bold: false });
      text(ctx, `Recompensa: ${rewardText(q.reward)}`, x + 22, ry + 39, { size: 9, color: '#ffd36b', outline: false, bold: false });
      const t = qb.target(q), c = qb.count(q);
      bar(ctx, x + w - 150, ry + 18, 120, 8, c / t, ready ? '#8fe07a' : '#9cc4ff');
      text(ctx, `${c}/${t}`, x + w - 90, ry + 34, { size: 10, align: 'center', outline: false });
    });
  }

  private drawResult(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'result' }>): void {
    const w = 400, h = 250, x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    const r = m.r;
    this.panel(ctx, x, y, w, h, 'Fase concluída!', false);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => { if (m.t > 0.6) this.close(); } });
    // estrelas grandes que "saltam" ao aparecer
    for (let i = 0; i < 3; i++) {
      const appear = m.t - (0.25 + i * 0.35);
      const on = r.stars[i] && appear >= 0;
      const pop = on ? 1 + Math.max(0, 0.5 - appear * 2.5) : 1;
      drawStar(ctx, x + w / 2 + (i - 1) * 54, y + 64, 21 * pop, on);
    }
    const rows: [string, string, boolean, boolean][] = [
      ['Vencer a fase', '', r.stars[0], r.newStars[0]],
      ['Rapidez', `${formatTime(r.time)}  (meta ${formatTime(r.par)})`, r.stars[1], r.newStars[1]],
      ['Pouco dano', `perdeu ${Math.round(r.damage * 100)}%  (meta ${Math.round(DAMAGE_LIMIT * 100)}%)`, r.stars[2], r.newStars[2]],
    ];
    rows.forEach(([label, info, ok, isNew], i) => {
      const ry = y + 108 + i * 26;
      if (m.t < 0.25 + i * 0.35) return;
      text(ctx, ok ? '✔' : '✘', x + 26, ry, { size: 13, color: ok ? '#8fe07a' : '#ff7b7b', outline: false });
      text(ctx, label, x + 46, ry, { size: 12, outline: false });
      text(ctx, info, x + 150, ry, { size: 10, outline: false, bold: false, color: '#aab4cc' });
      if (isNew) text(ctx, 'NOVA!', x + w - 24, ry, { size: 10, align: 'right', color: '#ffd36b', outline: false });
    });
    if (m.t > 1.2) {
      if (r.bonusGold) text(ctx, `Bônus das estrelas novas: +${r.bonusGold} G`, x + w / 2, y + h - 40, { size: 12, align: 'center', color: '#ffd36b' });
      else if (r.stars.every(Boolean)) text(ctx, 'Perfeito! Todas as estrelas.', x + w / 2, y + h - 40, { size: 12, align: 'center', color: '#ffd36b' });
      text(ctx, 'Toque ou aperte J para continuar', x + w / 2, y + h - 18, { size: 10, align: 'center', color: '#aab4cc', outline: false });
    }
  }

  private drawDead(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(40,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => this.game.returnToTown() });
    text(ctx, 'Você foi derrotado', VIEW_W / 2, VIEW_H / 2 - 12, { size: 24, align: 'center', color: '#ff9b9b' });
    text(ctx, 'Toque na tela ou aperte J para voltar à vila', VIEW_W / 2, VIEW_H / 2 + 18, { size: 12, align: 'center' });
  }
}
