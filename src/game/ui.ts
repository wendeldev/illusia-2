import { getItem, SKILLS } from '../data';
import type { Sfx } from '../engine/audio';
import type { Input, TouchButton } from '../engine/input';
import { VIEW_H, VIEW_W } from '../engine/view';
import type { NpcDef } from '../types';
import { bar, circle, text, wrapText } from './draw';
import type { Progress } from './progress';
import { describeBonus, expToNext, SLOT_NAMES } from './stats';
import type { World } from './world';

export interface GameApi {
  progress: Progress;
  world: World;
  sfx: Sfx;
  buy(itemId: string): void;
  equip(itemId: string): void;
  heal(): void;
  returnToTown(): void;
}

type Modal =
  | { kind: 'dialog'; npc: NpcDef; line: number }
  | { kind: 'shop'; npc: NpcDef; sel: number }
  | { kind: 'menu'; sel: number }
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

function layoutButtons(): void {
  BUTTON_LAYOUT.forEach((b, i) => { BUTTONS[i].x = VIEW_W - b.x; });
}

export class Ui {
  modal: Modal | null = null;
  private toasts: { text: string; life: number }[] = [];
  /** áreas clicáveis do último quadro desenhado (a última registrada tem prioridade) */
  private regions: Region[] = [];
  private prevAxisY = 0;

  constructor(private game: GameApi, private input: Input) {
    layoutButtons();
    input.buttons = BUTTONS;
  }

  toast(msg: string): void {
    this.toasts.push({ text: msg, life: 2.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  private openMenu(): void {
    this.modal = { kind: 'menu', sel: 0 };
    this.game.sfx.play('ui');
  }

  openNpc(npc: NpcDef): void {
    this.modal = { kind: 'dialog', npc, line: 0 };
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
    input.buttonsEnabled = !this.modal;
    const m = this.modal;
    if (!m) return false;

    const ay = input.axis.y;
    const up = ay < -0.5 && this.prevAxisY >= -0.5;
    const down = ay > 0.5 && this.prevAxisY <= 0.5;
    this.prevAxisY = ay;
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
        if (confirm && list[m.sel]) this.itemAction(list[m.sel]);
        if (back) this.close();
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
    if (m.line < m.npc.dialog.length) return;
    switch (m.npc.action) {
      case 'shop':
        this.modal = { kind: 'shop', npc: m.npc, sel: 0 };
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
      text(ctx, t.text, VIEW_W / 2, 70 + i * 18, { size: 13, align: 'center', color: '#ffe9a8' });
      ctx.globalAlpha = 1;
    });
    const m = this.modal;
    if (!m) return;
    switch (m.kind) {
      case 'dialog': return this.drawDialog(ctx, m);
      case 'shop': return this.drawShop(ctx, m);
      case 'menu': return this.drawMenu(ctx, m);
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

    text(ctx, world.stage.name, VIEW_W / 2, 16, { size: 12, align: 'center' });
    const boss = world.boss;
    if (boss) {
      text(ctx, boss.def.name, VIEW_W / 2, 32, { size: 11, align: 'center', color: '#ffb3c4' });
      bar(ctx, VIEW_W / 2 - 130, 40, 260, 8, boss.hp / boss.def.hp, '#c4466b');
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
    const lines = wrapText(ctx, m.npc.dialog[m.line] ?? '', w - 24, 13);
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
    (m.npc.shop ?? []).forEach((id, i) => {
      this.itemRow(ctx, x + 10, y + 34 + i * 30, w - 20, 30, id, i === m.sel, () => { m.sel = i; this.itemAction(id); }, true);
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

    // ligar/desligar som
    const sfx = this.game.sfx;
    const bx = lx, by = y + h - 30;
    ctx.fillStyle = '#34406a';
    ctx.fillRect(bx, by, 130, 22);
    text(ctx, sfx.muted ? '🔇 Som: desligado' : '🔊 Som: ligado', bx + 8, by + 11, { size: 11, outline: false });
    this.regions.push({ x: bx, y: by, w: 130, h: 22, fn: () => { sfx.setMuted(!sfx.muted); sfx.play('ui'); } });

    const rx = x + 240, rw = w - 252;
    text(ctx, 'Equipamentos (toque para equipar)', rx, y + 42, { size: 11, color: '#ffe9a8' });
    progress.owned.forEach((id, i) => {
      this.itemRow(ctx, rx, y + 54 + i * 24, rw, 24, id, i === m.sel, () => { m.sel = i; this.itemAction(id); }, false);
    });
  }

  private drawDead(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(40,0,0,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.regions.push({ x: 0, y: 0, w: VIEW_W, h: VIEW_H, fn: () => this.game.returnToTown() });
    text(ctx, 'Você foi derrotado', VIEW_W / 2, VIEW_H / 2 - 12, { size: 24, align: 'center', color: '#ff9b9b' });
    text(ctx, 'Toque na tela ou aperte J para voltar à vila', VIEW_W / 2, VIEW_H / 2 + 18, { size: 12, align: 'center' });
  }
}
