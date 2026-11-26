import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { QUESTS } from '../data/world.js';
import { RARITY } from '../data/items.js';
import { expToNext } from './stats.js';
import { VIEW_W, VIEW_H } from './render.js';

function bar(ctx, x, y, w, h, k, color, back = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = back; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  if (k > 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * Math.min(1, k)), h, h / 2); ctx.fill(); }
}

function text(ctx, str, x, y, { size = 11, color = '#fff', align = 'left', bold = true, stroke = true } = {}) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  if (stroke) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

export function drawHUD(ctx, g) {
  const save = g.save, s = g.stats, c = CLASSES[save.cls], p = g.player;

  // Painel do personagem
  ctx.fillStyle = 'rgba(10,14,30,0.55)'; ctx.beginPath(); ctx.roundRect(8, 8, 196, 52, 10); ctx.fill();
  ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(32, 34, 18, 0, Math.PI * 2); ctx.fill();
  text(ctx, `${save.level}`, 32, 39, { size: 15, align: 'center' });
  text(ctx, `${c.name}`, 58, 22, { size: 10, color: '#d8e2ff' });
  bar(ctx, 58, 27, 138, 10, save.hp / s.maxHp, save.hp / s.maxHp < 0.3 ? '#ff4d4d' : '#e8484f');
  if (p.shield > 0) bar(ctx, 58, 27, 138, 4, p.shield / s.maxHp, '#b98cff', 'transparent');
  text(ctx, `${Math.ceil(save.hp)}/${s.maxHp}`, 127, 36, { size: 9, align: 'center' });
  bar(ctx, 58, 41, 138, 8, save.mp / s.maxMp, '#4f7fe0');
  text(ctx, `${Math.floor(save.mp)}/${s.maxMp}`, 127, 48.5, { size: 8, align: 'center' });
  text(ctx, `● ${save.gold}`, 214, 22, { size: 11, color: '#ffd84a' });
  if (save.points > 0) text(ctx, `+${save.points} pontos (Menu)`, 214, 38, { size: 9, color: '#7dff9a' });

  // EXP
  const need = expToNext(save.level);
  bar(ctx, 0, VIEW_H - 4, VIEW_W, 4, save.exp / need, '#b49cff', 'rgba(0,0,0,0.5)');

  // Buffs
  let bx = 214;
  for (const b of p.buffs) {
    const sk = SKILLS[b.id];
    ctx.fillStyle = 'rgba(10,14,30,0.6)'; ctx.beginPath(); ctx.roundRect(bx, 44, 18, 18, 4); ctx.fill();
    text(ctx, sk.glyph, bx + 9, 57, { size: 11, color: sk.color, align: 'center', stroke: false });
    bar(ctx, bx, 63, 18, 2, b.t / sk.dur, sk.color);
    bx += 22;
  }

  // Habilidades e poções (canto inferior)
  if (!g.ui.touch) {
    const keys = ['U', 'I', 'O'];
    const sx = VIEW_W / 2 - 92;
    c.skills.forEach((id, i) => {
      const sk = SKILLS[id], x = sx + i * 38, y = VIEW_H - 46;
      const locked = save.level < sk.unlock;
      ctx.fillStyle = 'rgba(10,14,30,0.65)'; ctx.beginPath(); ctx.roundRect(x, y, 32, 32, 7); ctx.fill();
      text(ctx, locked ? '🔒' : sk.glyph, x + 16, y + 22, { size: locked ? 12 : 16, color: sk.color, align: 'center', stroke: false });
      if (p.cds[i] > 0) {
        const k = p.cds[i] / sk.cd;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y + 32 * (1 - k), 32, 32 * k);
        text(ctx, `${Math.ceil(p.cds[i] / 60)}`, x + 16, y + 21, { size: 11, align: 'center' });
      } else if (!locked && save.mp < sk.mp) {
        ctx.fillStyle = 'rgba(40,60,160,0.45)'; ctx.fillRect(x, y, 32, 32);
      }
      text(ctx, keys[i], x + 4, y + 10, { size: 8, color: '#aab' });
    });
    const pots = [['pocao_vida', 'Q', '#e0484f'], ['pocao_mana', 'E', '#4f7fe0']];
    pots.forEach(([id, key, col], i) => {
      const x = sx + 124 + i * 34, y = VIEW_H - 46;
      ctx.fillStyle = 'rgba(10,14,30,0.65)'; ctx.beginPath(); ctx.roundRect(x, y, 28, 32, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + 14, y + 18, 7, 0, 7); ctx.fill();
      text(ctx, `${g.countItem(id)}`, x + 24, y + 29, { size: 9, align: 'right' });
      text(ctx, key, x + 4, y + 10, { size: 8, color: '#aab' });
    });
  }

  // Missões ativas
  let qy = 20;
  for (const [id, q] of Object.entries(QUESTS)) {
    if (g.questState(id) !== 'active') continue;
    const prog = g.questProgress(id), ready = prog >= q.count;
    text(ctx, q.title, VIEW_W - 10, qy, { size: 10, align: 'right', color: ready ? '#7dff9a' : '#ffe9a8' });
    text(ctx, ready ? 'Volte para a vila' : `${prog}/${q.count}`, VIEW_W - 10, qy + 12, { size: 9, align: 'right', color: '#dde', bold: false });
    qy += 28;
  }

  // Combo
  if (g.combo >= 3) {
    const k = g.comboTimer / 130;
    ctx.globalAlpha = Math.min(1, k * 3);
    text(ctx, `${g.combo}`, VIEW_W - 24, 150, { size: 30, align: 'right', color: g.combo >= 50 ? '#ff7a2e' : '#ffd84a' });
    text(ctx, 'COMBO', VIEW_W - 24, 164, { size: 10, align: 'right' });
    if (g.combo >= 10) text(ctx, `+${Math.min(20, Math.floor(g.combo / 10) * 2)}% dano`, VIEW_W - 24, 176, { size: 9, align: 'right', color: '#ffb36b' });
    bar(ctx, VIEW_W - 84, 182, 60, 3, k, '#ffd84a');
    ctx.globalAlpha = 1;
  }

  // Modo desafio
  const ar = g.arena;
  if (ar) {
    const label = ar.mode === 'defesa' ? 'Defesa do Cristal' : 'Desafio das Ondas';
    text(ctx, `${label} • Onda ${ar.wave}`, VIEW_W / 2, 78, { size: 12, align: 'center', color: '#ffd84a' });
    const info = ar.over ? 'Fim! Saia pelo portal à esquerda' : ar.breakT > 0 ? `Próxima onda em ${Math.ceil(ar.breakT / 60)}s` : `Inimigos restantes: ${ar.alive + ar.toSpawn}`;
    text(ctx, info, VIEW_W / 2, 91, { size: 10, align: 'center', color: '#dde', bold: false });
    if (ar.crystal) bar(ctx, VIEW_W / 2 - 90, 97, 180, 7, ar.crystal.hp / ar.crystal.maxHp, '#7fd0ff');
  }

  // Chefe
  const b = g.boss;
  if (b && b.alive && g.bossIntro) {
    const w = 300, x = (VIEW_W - w) / 2, oy = g.arena ? 38 : 0;
    text(ctx, b.d.name, VIEW_W / 2, 78 + oy, { size: 11, align: 'center', color: '#ffd0d0' });
    bar(ctx, x, 84 + oy, w, 9, b.hp / b.maxHp, b.phase === 2 ? '#ff6b3d' : '#e0484f');
  }

  // Avisos
  let ty = VIEW_H - 64;
  for (let i = g.toasts.length - 1; i >= 0; i--) {
    const t = g.toasts[i];
    ctx.globalAlpha = Math.min(1, t.t / 30);
    const col = t.rarity != null ? RARITY[t.rarity].color : t.color;
    text(ctx, t.text, 12, ty, { size: 11, color: col });
    ty -= 16;
  }
  ctx.globalAlpha = 1;

  // Faixa de mapa / nível
  if (g.banner) {
    const bn = g.banner, k = Math.min(1, bn.t / 30, (170 - bn.t) / 20 + 0.2);
    ctx.globalAlpha = Math.max(0, k);
    ctx.fillStyle = 'rgba(10,14,30,0.5)'; ctx.fillRect(0, 112, VIEW_W, 54);
    text(ctx, bn.text, VIEW_W / 2, 142, { size: 24, align: 'center', color: bn.level ? '#ffd84a' : bn.boss ? '#ff8a8a' : '#fff' });
    if (bn.sub) text(ctx, bn.sub, VIEW_W / 2, 158, { size: 11, align: 'center', color: '#d8e2ff' });
    ctx.globalAlpha = 1;
  }
}
