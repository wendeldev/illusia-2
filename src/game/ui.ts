import { getEnemy, getItem, getStage, REGIONS, SKILLS, STAGES_PER_REGION, stageId, type QuestDef } from '../data';
import type { Sfx } from '../engine/audio';
import type { Music } from '../engine/music';
import { rewardText, type QuestBook } from './quests';
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
}

type Modal =
  | { kind: 'dialog'; npc: NpcDef; lines: string[]; line: number; after: () => void }
  | { kind: 'offer'; npc: NpcDef; quest: QuestDef; sel: number }
  | { kind: 'quests' }
  | { kind: 'result'; r: StageResult; t: number; shown: number }
  | { kind: 'shop'; npc: NpcDef; sel: number; scroll: number }
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
  { action: 'attack', x: 62, y: 300, r: 34, label: '⚔' },
  { action: 'skill1', x: 140, y: 320, r: 22, label: '1' },
  { action: 'skill2', x: 126, y: 250, r: 22, label: '2' },
  { action: 'skill3', x: 56, y: 222, r: 22, label: '3' },
  { action: 'interact', x: 208, y: 330, r: 18, label: '✋' },
  { action: 'menu', x: 26, y: 24, r: 16, label: '☰' },
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
        this.modal = { kind: 'shop', npc, sel: 0, scroll: 0 };
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

  showResult(r: StageResult): void {
    this.modal = { kind: 'result', r, t: 0, shown: 0 };
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
    const confirm = input.consume('attack') || input.consume('interact');
    const back = input.consume('menu');

    switch (m.kind) {
      case 'dialog':
        if (confirm) this.advanceDialog(m);
        else if (back) this.close();
        break;
      case 'shop':
      case 'menu': {
        const list = m.kind === 'shop' ? m.npc.shop ?? [] : this.game.progress.owned;
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
    // missões em andamento
    const qb = this.game.quests;
    qb.active().slice(0, 3).forEach((q, i) => {
      const ready = qb.isReady(q);
      const label = ready ? `✔ ${q.title} · ${qb.giverName(q)}` : `📜 ${q.title} ${qb.count(q)}/${qb.target(q)}`;
      text(ctx, label, 12, 84 + i * 14, { size: 9, color: ready ? '#8fe07a' : '#e8ecf4' });
    });

    text(ctx, world.stage.name, VIEW_W / 2, 16, { size: 12, align: 'center' });
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
      text(ctx, 'Mover: WASD/Setas · Atacar: J · Poderes: K L I · Falar/Entrar: E · Menu: M', VIEW_W / 2, VIEW_H - 10,
        { size: 10, align: 'center', color: 'rgba(255,255,255,0.85)' });
      return;
    }
    const j = input.joystick;
    const jx = j?.ox ?? 90, jy = j?.oy ?? 290;
    ctx.globalAlpha = j ? 0.5 : 0.22;
    circle(ctx, jx, jy, 40, '#000');
    circle(ctx, j?.x ?? jx, j?.y ?? jy, 18, '#fff');
    ctx.globalAlpha = 1;

    for (const b of BUTTONS) {
      if (b.action === 'menu') continue;
      const skillIdx = b.action.startsWith('skill') ? Number(b.action.slice(5)) - 1 : -1;
      const skill = SKILLS[skillIdx];
      if (skillIdx >= 0 && !skill) continue;
      const active = b.action !== 'interact' || !!world.nearby();
      ctx.globalAlpha = active ? 0.55 : 0.25;
      circle(ctx, b.x, b.y, b.r, '#000');
      ctx.globalAlpha = 1;
      ctx.strokeStyle = skill ? skill.color : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      if (skill) {
        if (progress.level < skill.unlockLevel) {
          text(ctx, `Nv${skill.unlockLevel}`, b.x, b.y, { size: 9, align: 'center', color: '#aaa' });
          continue;
        }
        const cd = world.player.cooldowns[skill.id] ?? 0;
        if (cd > 0) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / skill.cooldown));
          ctx.fill();
        }
        text(ctx, skill.name.split(' ')[0], b.x, b.y - 4, { size: 8, align: 'center' });
        text(ctx, `${skill.mpCost} MP`, b.x, b.y + 7, { size: 7, align: 'center', color: '#9cc4ff' });
      } else {
        text(ctx, b.label, b.x, b.y + 1, { size: b.r * 0.9, align: 'center' });
      }
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
    text(ctx, item.name, x + 8, y + h / 2 - 5, { size: 11, outline: false });
    text(ctx, `${SLOT_NAMES[item.slot]} · ${describeBonus(item)}`, x + 8, y + h / 2 + 6, { size: 8, outline: false, color: '#aab4cc', bold: false });
    let label: string, color: string;
    if (equipped) { label = 'Equipado'; color = '#8fe07a'; }
    else if (owned) { label = 'Equipar'; color = '#9cc4ff'; }
    else if (showPrice) { label = `${item.price} G`; color = progress.gold >= item.price ? '#ffd36b' : '#e0524f'; }
    else { label = ''; color = '#fff'; }
    text(ctx, label, x + w - 8, y + h / 2 - 1, { size: 11, align: 'right', color, outline: false });
    this.regions.push({ x, y, w, h: h - 3, fn: onTap });
  }

  private drawShop(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'shop' }>): void {
    const w = 500, h = 316, x = (VIEW_W - w) / 2, y = 22;
    this.panel(ctx, x, y, w, h, `${m.npc.name} — Loja`);
    text(ctx, `${this.game.progress.gold} G`, x + w - 44, y + 16, { size: 12, align: 'right', color: '#ffd36b' });
    const list = m.npc.shop ?? [];
    this.scrollList(ctx, m, list.length, SHOP_ROWS, x + w - 26, y + 34, SHOP_ROWS * 30);
    list.slice(m.scroll, m.scroll + SHOP_ROWS).forEach((id, k) => {
      const i = m.scroll + k;
      this.itemRow(ctx, x + 10, y + 34 + k * 30, w - 42, 30, id, i === m.sel, () => { m.sel = i; this.itemAction(id); }, true);
    });
  }

  private drawMenu(ctx: CanvasRenderingContext2D, m: Extract<Modal, { kind: 'menu' }>): void {
    const { progress, world } = this.game;
    const s = world.stats;
    const x = 20, y = 16, w = VIEW_W - 40, h = VIEW_H - 32;
    this.panel(ctx, x, y, w, h, 'Personagem');
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
    text(ctx, 'Poderes', lx, y + 192, { size: 12, color: '#ffe9a8' });
    SKILLS.forEach((sk, i) => {
      const locked = progress.level < sk.unlockLevel;
      const yy = y + 212 + i * 30;
      text(ctx, `${i + 1}. ${sk.name}`, lx, yy, { size: 11, color: locked ? '#777' : sk.color, outline: false });
      text(ctx, locked ? `Desbloqueia no nível ${sk.unlockLevel}` : `${sk.mpCost} MP · ${sk.cooldown}s · ${sk.description}`,
        lx, yy + 12, { size: 8, color: '#aab4cc', outline: false, bold: false });
    });

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
