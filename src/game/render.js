// Toda a arte é desenhada por código (formas vetoriais), sem sprites externos.
import { CLASSES } from '../data/classes.js';
import { NPCS } from '../data/world.js';
import { CONSUMABLES, QUEST_ITEMS, RARITY } from '../data/items.js';

export const VIEW_W = 640, VIEW_H = 360;

const THEMES = {
  vila: { sky: ['#ffb88a', '#ffe2b8'], far: '#e8a88a', mid: '#b98a7a', ground: '#7a5a3a', top: '#8fc96a', plat: '#a0703f', deco: 'houses' },
  campos: { sky: ['#7cc4ff', '#d8f1ff'], far: '#a6d8a0', mid: '#7cbf6a', ground: '#8a6a3f', top: '#f0c84a', plat: '#b8864a', deco: 'wheat' },
  bosque: { sky: ['#4a6b7a', '#a8c8c0'], far: '#5b7f6f', mid: '#3c5e4c', ground: '#3e3428', top: '#4f8f4a', plat: '#6b4f33', deco: 'trees', fog: true },
  arena: { sky: ['#3b1f4a', '#e07a5f'], far: '#7a3b52', mid: '#5a2c40', ground: '#5c4433', top: '#c9a66b', plat: '#8a6a4a', deco: 'pillars' },
  ruinas: { sky: ['#1e1838', '#4a3e78'], far: '#3a3466', mid: '#2c2850', ground: '#2a2640', top: '#6fc3d9', plat: '#5a5a8a', deco: 'crystals' },
};

function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

export function drawBackground(ctx, map, camX, t) {
  const th = THEMES[map.theme];
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (map.theme === 'ruinas') {
    for (let i = 0; i < 60; i++) {
      const x = (hash(i) * 1400 - camX * 0.05) % 700, y = hash(i + 9) * 200;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.02 + i));
      ctx.fillStyle = '#fff'; ctx.fillRect((x + 700) % 700 - 30, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = map.theme === 'vila' ? '#fff3c9' : '#fffbe6';
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(500 - camX * 0.02, 70, 26, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // montanhas distantes
  ctx.fillStyle = th.far;
  ctx.beginPath(); ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 16) {
    const wx = x + camX * 0.2;
    ctx.lineTo(x, 190 - Math.sin(wx * 0.006) * 40 - Math.sin(wx * 0.017) * 14);
  }
  ctx.lineTo(VIEW_W, VIEW_H); ctx.fill();

  // camada intermediária
  ctx.fillStyle = th.mid;
  const off = camX * 0.45;
  if (th.deco === 'trees') {
    for (let i = Math.floor(off / 70) - 1; i < (off + VIEW_W) / 70 + 1; i++) {
      const x = i * 70 - off + hash(i) * 30, h = 90 + hash(i + 3) * 70;
      ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x + 26, 300 - h); ctx.lineTo(x + 52, 300); ctx.fill();
    }
  } else if (th.deco === 'crystals') {
    for (let i = Math.floor(off / 90) - 1; i < (off + VIEW_W) / 90 + 1; i++) {
      const x = i * 90 - off + hash(i) * 40, h = 60 + hash(i + 5) * 90;
      ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x + 14, 300 - h); ctx.lineTo(x + 30, 300 - h * 0.7); ctx.lineTo(x + 40, 300); ctx.fill();
    }
  } else if (th.deco === 'pillars') {
    for (let i = Math.floor(off / 110) - 1; i < (off + VIEW_W) / 110 + 1; i++) {
      const x = i * 110 - off;
      ctx.fillRect(x, 140, 26, 160); ctx.fillRect(x - 6, 132, 38, 10);
    }
    ctx.fillRect(0, 128, VIEW_W, 6);
  } else if (th.deco === 'houses') {
    for (let i = Math.floor(off / 160) - 1; i < (off + VIEW_W) / 160 + 1; i++) {
      const x = i * 160 - off + hash(i) * 40, h = 50 + hash(i + 2) * 30;
      ctx.fillRect(x, 300 - h, 70, h);
      ctx.beginPath(); ctx.moveTo(x - 8, 300 - h); ctx.lineTo(x + 35, 300 - h - 34); ctx.lineTo(x + 78, 300 - h); ctx.fill();
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0, VIEW_H);
    for (let x = 0; x <= VIEW_W; x += 12) { const wx = x + off; ctx.lineTo(x, 250 - Math.sin(wx * 0.01) * 18); }
    ctx.lineTo(VIEW_W, VIEW_H); ctx.fill();
  }
}

export function drawMap(ctx, map, t) {
  const th = THEMES[map.theme];
  for (const s of map.solids) {
    ctx.fillStyle = th.ground; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = th.top; ctx.fillRect(s.x, s.y, s.w, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = s.x + 10; x < s.x + s.w; x += 34) ctx.fillRect(x, s.y + 14 + (x % 3) * 8, 10, 4);
    if (th.deco === 'wheat') {
      ctx.fillStyle = '#d9a83a';
      for (let x = s.x + 4; x < s.x + s.w; x += 9) ctx.fillRect(x, s.y - 4 - (x % 5), 2, 5 + (x % 5));
    }
  }
  for (const p of map.platforms) {
    ctx.fillStyle = th.plat; ctx.fillRect(p.x, p.y, p.w, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(p.x, p.y, p.w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = p.x + 6; x < p.x + p.w; x += 24) ctx.fillRect(x, p.y + 8, 3, 6);
  }
  for (const pt of map.portals) drawPortal(ctx, pt, t);
}

function drawPortal(ctx, pt, t) {
  const x = pt.x, y = 300;
  ctx.save();
  const pulse = 0.6 + Math.sin(t * 0.08) * 0.2;
  const g = ctx.createRadialGradient(x, y - 30, 4, x, y - 30, 34);
  g.addColorStop(0, `rgba(255,255,255,${pulse})`); g.addColorStop(1, 'rgba(140,200,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 30, 22, 34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,235,255,0.9)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y - 30, 16, 28, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawFog(ctx, map, camX, t) {
  if (!THEMES[map.theme].fog) return;
  ctx.fillStyle = 'rgba(220,235,235,0.12)';
  for (let i = 0; i < 4; i++) {
    const x = ((t * 0.3 + i * 260 - camX * 0.8) % 900 + 900) % 900 - 200;
    ctx.beginPath(); ctx.ellipse(x, 270 + i * 6, 180, 26, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- Personagens ----------
function shadow(ctx, x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(x, y, w, 3, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawHero(ctx, p, clsId) {
  const c = CLASSES[clsId];
  const x = p.x + p.w / 2, y = p.y + p.h;
  shadow(ctx, x, y, 10);
  if (p.inv > 0 && p.state !== 'dash' && (p.anim >> 2) % 2) ctx.globalAlpha = 0.45;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (p.state === 'dead') { ctx.rotate(-p.face * Math.min(1.5, p.t * 0.08)); }
  ctx.scale(p.face, 1);
  const run = p.state === 'run';
  const bob = run ? Math.abs(Math.sin(p.anim * 0.3)) * -2 : Math.sin(p.anim * 0.05) * 0.6;
  const leg = run ? Math.sin(p.anim * 0.3) * 5 : p.state === 'air' ? 3 : 0;

  // capa / manto
  ctx.fillStyle = c.dark;
  if (clsId === 'guardiao') { ctx.beginPath(); ctx.moveTo(-6, -27 + bob); ctx.lineTo(-13 - (run ? 3 : 0), -6); ctx.lineTo(-3, -8); ctx.fill(); }
  if (clsId === 'sombra') { ctx.fillRect(-10 - (run ? 4 : 0), -27 + bob, 8, 3); }
  // pernas
  ctx.fillStyle = '#2b2f3a';
  ctx.fillRect(-6 + leg * 0.5, -12, 5, 12); ctx.fillRect(1 - leg * 0.5, -12, 5, 12);
  // corpo
  ctx.fillStyle = c.color;
  if (clsId === 'arcanista') {
    ctx.beginPath(); ctx.moveTo(-8, -27 + bob); ctx.lineTo(8, -27 + bob); ctx.lineTo(10, -5); ctx.lineTo(-10, -5); ctx.fill();
  } else {
    ctx.beginPath(); ctx.roundRect(-8, -27 + bob, 16, 17, 4); ctx.fill();
  }
  ctx.fillStyle = c.accent; ctx.fillRect(-8, -15 + bob, 16, 2);
  // cabeça
  ctx.fillStyle = '#f3d2b3';
  ctx.beginPath(); ctx.arc(0, -33 + bob, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath(); ctx.arc(-1, -35 + bob, 8.5, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
  if (clsId === 'arcanista') { ctx.fillStyle = c.dark; ctx.beginPath(); ctx.moveTo(-10, -38 + bob); ctx.lineTo(10, -38 + bob); ctx.lineTo(-2, -54 + bob); ctx.fill(); }
  if (clsId === 'sombra') { ctx.fillStyle = c.dark; ctx.fillRect(-8, -31 + bob, 16, 4); }
  ctx.fillStyle = '#1b1b24'; ctx.fillRect(3, -34 + bob, 2, 3);

  // arma
  let ang = 0.5;
  if (p.state === 'attack' && p.step && !p.step.proj) {
    const st = p.step, k = Math.min(1, p.t / st.active[1]);
    ang = (p.combo % 2 ? 1.2 - k * 2.6 : -1.8 + k * 2.8);
  } else if (p.state === 'skill') ang = p.anim * 0.6;
  else if (p.state === 'cast' || (p.state === 'attack' && p.step?.proj)) ang = -0.3;
  else if (p.state === 'dash' || p.state === 'dashSkill') ang = 1.4;
  ctx.save();
  ctx.translate(4, -20 + bob);
  ctx.rotate(ang);
  if (c.weapon === 'espada') {
    ctx.fillStyle = '#dfe6ee'; ctx.fillRect(0, -2, 22, 4);
    ctx.fillStyle = c.accent; ctx.fillRect(-3, -4, 3, 8);
  } else if (c.weapon === 'adagas') {
    ctx.fillStyle = '#dfe6ee'; ctx.fillRect(0, -1.5, 13, 3);
    ctx.fillStyle = c.accent; ctx.fillRect(-2, -3, 2, 6);
  } else {
    ctx.fillStyle = '#7a5530'; ctx.fillRect(-6, -1.5, 30, 3);
    ctx.fillStyle = c.accent; ctx.shadowColor = c.accent; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(25, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.restore();
  if (clsId === 'guardiao') { // escudo
    ctx.fillStyle = '#c9d2dd'; ctx.beginPath(); ctx.roundRect(-11, -24 + bob, 7, 12, 3); ctx.fill();
    ctx.fillStyle = c.accent; ctx.fillRect(-9, -20 + bob, 3, 4);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(185,140,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 20, 24, 0, Math.PI * 2); ctx.stroke();
  }
  for (const b of p.buffs) if (!b.shield && p.anim % 20 < 10) {
    ctx.fillStyle = b.color; ctx.fillRect(x - 12 + (p.anim % 24), y - 4 - (p.anim % 30), 2, 2);
  }
}

export function drawNPC(ctx, npc, t, near) {
  const d = NPCS[npc.id];
  const x = npc.x, y = 300;
  shadow(ctx, x, y, 10);
  ctx.save(); ctx.translate(x, y);
  const bob = Math.sin(t * 0.05 + x) * 0.8;
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-6, -10, 5, 10); ctx.fillRect(1, -10, 5, 10);
  ctx.fillStyle = d.color; ctx.beginPath(); ctx.moveTo(-9, -28 + bob); ctx.lineTo(9, -28 + bob); ctx.lineTo(11, -6); ctx.lineTo(-11, -6); ctx.fill();
  ctx.fillStyle = '#f3d2b3'; ctx.beginPath(); ctx.arc(0, -34 + bob, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = d.hair; ctx.beginPath(); ctx.arc(0, -36 + bob, 8.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1b24'; ctx.fillRect(-4, -35 + bob, 2, 3); ctx.fillRect(2, -35 + bob, 2, 3);
  if (npc.id === 'tobias') { ctx.fillStyle = '#fff'; ctx.fillRect(-7, -48 + bob, 14, 8); }
  ctx.restore();
  if (npc.marker) {
    ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = npc.marker === '?' ? '#7dff9a' : '#ffd84a';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    const my = y - 58 + Math.sin(t * 0.1) * 2;
    ctx.strokeText(npc.marker, x, my); ctx.fillText(npc.marker, x, my);
  }
  ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = near ? '#fff' : 'rgba(255,255,255,0.75)';
  ctx.fillText(d.name, x, y + 14);
}

export function drawCrystal(ctx, c) {
  const x = c.x + c.w / 2, y = c.y + c.h;
  shadow(ctx, x, y, 18);
  const glow = c.hp / c.maxHp;
  ctx.save();
  ctx.shadowColor = '#7fd0ff'; ctx.shadowBlur = 10 + Math.sin(c.anim * 0.08) * 6;
  ctx.fillStyle = c.flash > 0 && c.flash % 2 ? '#ffffff' : `hsl(${195 - (1 - glow) * 190}, 80%, ${55 + glow * 15}%)`;
  ctx.beginPath(); ctx.moveTo(x, c.y - Math.sin(c.anim * 0.05) * 2); ctx.lineTo(x + 15, c.y + 22); ctx.lineTo(x + 8, y); ctx.lineTo(x - 8, y); ctx.lineTo(x - 15, c.y + 22); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 3, c.y + 12, 3, 18);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 20, c.y - 12, 40, 4);
  ctx.fillStyle = '#7fd0ff'; ctx.fillRect(x - 20, c.y - 12, 40 * glow, 4);
}

export function drawEnemy(ctx, e) {
  const d = e.d, x = e.x + e.w / 2, y = e.y + e.h;
  if (!e.alive) ctx.globalAlpha = Math.max(0, 1 - e.dead / 30);
  if (d.ai !== 'flyer') shadow(ctx, x, y, e.w / 2);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (e.telegraph && (e.anim >> 2) % 2) ctx.translate((Math.random() - 0.5) * 3, 0);
  ctx.scale(e.face, 1);
  const flash = e.flash > 0 && e.flash % 2;
  const col = flash ? '#ffffff' : e.frozen > 0 ? '#bfefff' : d.color;
  const a = e.anim;
  switch (e.type) {
    case 'gotinha': {
      const sq = Math.sin(a * 0.15) * 2;
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -9 + sq / 2, 11 + sq / 2, 9 - sq / 2, 0, Math.PI, 0); ctx.lineTo(11, 0); ctx.lineTo(-11, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-6, -14, 3, 3);
      eyes(ctx, 3, -9);
      break;
    }
    case 'cogumelo': {
      ctx.fillStyle = '#f1e3c8'; ctx.fillRect(-6, -14, 12, 14);
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -15, 13, 11, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -20, 2.5, 0, 7); ctx.arc(5, -18, 2, 0, 7); ctx.fill();
      eyes(ctx, 2, -9);
      break;
    }
    case 'vespa': case 'morcego': {
      const flap = Math.sin(a * 0.6) * 6;
      ctx.fillStyle = e.type === 'vespa' ? 'rgba(255,255,255,0.7)' : (flash ? '#fff' : '#4a6f8a');
      ctx.beginPath(); ctx.ellipse(-3, -14 - flap / 2, 8, 4 + Math.abs(flap) / 2, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -9, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
      if (e.type === 'vespa') { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-4, -15, 2, 12); ctx.fillRect(1, -15, 2, 12); ctx.fillRect(-11, -10, 4, 2); }
      eyes(ctx, 4, -11);
      break;
    }
    case 'espinho': {
      ctx.fillStyle = '#6b4f33'; ctx.fillRect(-8, -6, 16, 6);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-10, -4); ctx.quadraticCurveTo(-12, -30, 0, -34); ctx.quadraticCurveTo(12, -30, 10, -4); ctx.fill();
      ctx.fillStyle = '#2a5a35';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10, -8 - i * 7); ctx.lineTo(-15, -11 - i * 7); ctx.lineTo(-9, -12 - i * 7); ctx.fill(); }
      ctx.fillStyle = '#ffdf6b'; ctx.beginPath(); ctx.arc(8, -24, 4 + (e.state === 'windup' ? 2 : 0), 0, 7); ctx.fill();
      eyes(ctx, 1, -22);
      break;
    }
    case 'lobo': case 'javali': {
      const run = Math.abs(e.vx) > 0.2 ? Math.sin(a * 0.4) * 3 : 0;
      ctx.fillStyle = flash ? '#fff' : '#3a3a48';
      ctx.fillRect(-14 + run, -8, 5, 8); ctx.fillRect(8 - run, -8, 5, 8);
      ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(-e.w / 2, -e.h + 2, e.w - 6, e.h - 8, 8); ctx.fill();
      ctx.beginPath(); ctx.roundRect(e.w / 2 - 16, -e.h - 2, 16, 14, 5); ctx.fill();
      if (e.type === 'lobo') { ctx.beginPath(); ctx.moveTo(e.w / 2 - 14, -e.h - 1); ctx.lineTo(e.w / 2 - 10, -e.h - 9); ctx.lineTo(e.w / 2 - 6, -e.h); ctx.fill(); ctx.fillRect(-e.w / 2 - 8, -e.h + 6, 10, 4); }
      else { ctx.fillStyle = '#f3ead8'; ctx.fillRect(e.w / 2 - 2, -e.h + 8, 5, 3); ctx.fillStyle = '#5e4632'; ctx.fillRect(-e.w / 2, -e.h + 2, e.w - 6, 4); }
      eyes(ctx, e.w / 2 - 6, -e.h + 4, e.telegraph ? '#ff4040' : '#1b1b24');
      break;
    }
    case 'golem': {
      const st = Math.sin(a * 0.05) * 1.5;
      ctx.fillStyle = flash ? '#fff' : '#4a5a78';
      ctx.fillRect(-26, -22, 18, 22); ctx.fillRect(8, -22, 18, 22);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(-34, -70 + st); ctx.lineTo(34, -70 + st); ctx.lineTo(28, -20); ctx.lineTo(-28, -20); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#9fe6ff';
      ctx.beginPath(); ctx.moveTo(-12, -94 + st); ctx.lineTo(0, -108 + st); ctx.lineTo(14, -92 + st); ctx.lineTo(10, -70 + st); ctx.lineTo(-10, -70 + st); ctx.fill();
      const arm = ['slam'].includes(e.state) ? -30 : 0;
      ctx.fillStyle = col; ctx.fillRect(-48, -66 + st + arm, 16, 40); ctx.fillRect(32, -66 + st + arm, 16, 40);
      const core = e.phase === 2 ? '#ff6b6b' : '#ffffff';
      ctx.fillStyle = core; ctx.shadowColor = core; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, -48 + st, 7, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = e.telegraph ? '#ff4040' : '#1b1b24'; ctx.fillRect(4, -88 + st, 5, 4);
      break;
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (e.frozen > 0) { ctx.fillStyle = 'rgba(160,230,255,0.35)'; ctx.fillRect(e.x - 2, e.y - 2, e.w + 4, e.h + 4); }
  if (e.alive && !d.boss && e.hp < e.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x, e.y - 8, e.w, 4);
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(e.x, e.y - 8, e.w * (e.hp / e.maxHp), 4);
  }
}

function eyes(ctx, x, y, color = '#1b1b24') {
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2, 5, 5);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y - 1, 2, 3);
}

export function drawProjectile(ctx, pr) {
  ctx.save();
  ctx.translate(pr.x, pr.y);
  if (pr.glyph === 'knife') {
    ctx.rotate(Math.atan2(pr.vy, pr.vx));
    ctx.fillStyle = '#e8f0f8'; ctx.fillRect(-6, -1.5, 12, 3);
    ctx.fillStyle = pr.color; ctx.fillRect(-8, -2, 3, 4);
  } else if (pr.kind === 'wave') {
    ctx.fillStyle = pr.color; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(-10, 9); ctx.lineTo(0, -12); ctx.lineTo(10, 9); ctx.fill();
  } else if (pr.kind === 'shard') {
    ctx.rotate(pr.life * 0.2);
    ctx.fillStyle = pr.color; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 0); ctx.lineTo(0, 7); ctx.lineTo(-4, 0); ctx.fill();
  } else {
    ctx.shadowColor = pr.color; ctx.shadowBlur = 10;
    ctx.fillStyle = pr.color; ctx.beginPath(); ctx.arc(0, 0, pr.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(-pr.r * 0.3, -pr.r * 0.3, pr.r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawDrop(ctx, it, t) {
  const bob = it.onGround ? Math.sin(t * 0.1 + it.x) * 1.5 : 0;
  const x = it.x + it.w / 2, y = it.y + it.h / 2 + bob;
  if (it.kind === 'gold') {
    ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#c99a1a'; ctx.fillRect(x - 1, y - 2, 2, 4);
    return;
  }
  let color = '#fff';
  if (it.kind === 'cons') color = CONSUMABLES[it.id].color;
  else if (it.kind === 'quest') color = QUEST_ITEMS[it.id].color;
  else if (it.kind === 'equip') color = RARITY[it.item.rarity].color;
  if (it.kind === 'equip' && it.item.rarity > 0) {
    ctx.globalAlpha = 0.35 + Math.sin(t * 0.1) * 0.15; ctx.fillStyle = color;
    ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  if (it.kind === 'cons') { ctx.beginPath(); ctx.arc(x, y + 1, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#ddd'; ctx.fillRect(x - 2, y - 7, 4, 4); }
  else if (it.kind === 'equip') { ctx.beginPath(); ctx.roundRect(x - 6, y - 6, 12, 12, 3); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 3, y - 3, 6, 6); }
  else { ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 5, y); ctx.fill(); }
}
