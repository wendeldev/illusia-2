// Monstros desenhados por partes, com animação de andar, preparar golpe, atacar, sofrer dano e morrer.
import type { EnemyShape } from '../../types';
import { shade } from '../draw';
import { OUTLINE } from './human';

export interface MonsterAnim {
  /** tempo (com semente própria para cada monstro não ficar sincronizado) */
  t: number;
  moving: boolean;
  /** 0..1 preparando o golpe */
  windup: number;
  /** 1→0 logo após golpear */
  strike: number;
  hurt: boolean;
  /** 0..1 morrendo */
  dying: number;
  flash: boolean;
}

type Ctx = CanvasRenderingContext2D;

function shape(ctx: Ctx, fill: string, outline: string, path: () => void, lw = 1.5): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

function groundShadow(ctx: Ctx, w: number, scale = 1): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, w * scale, w * 0.33 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function eye(ctx: Ctx, x: number, y: number, r: number, angry: boolean, C: (c: string) => string, O: string, pupil = '#1d1a24'): void {
  shape(ctx, C('#ffffff'), O, () => ctx.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2), 1);
  ctx.fillStyle = C(pupil);
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y + r * 0.1, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = O;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 1.5);
    ctx.lineTo(x + r, y - r * 0.8);
    ctx.stroke();
  }
}

export function drawMonster(
  ctx: Ctx, kind: EnemyShape, x: number, groundY: number, r: number,
  color: string, facing: number, a: MonsterAnim,
): void {
  const C = (c: string) => (a.flash ? '#ffffff' : c);
  const O = a.flash ? '#ffffff' : OUTLINE;
  ctx.save();
  ctx.translate(x, groundY);
  if (a.dying > 0) ctx.globalAlpha = Math.max(0, 1 - a.dying);
  ctx.scale(facing, 1);
  // tremor de "carregando" o golpe
  if (a.windup > 0) ctx.translate(Math.sin(a.t * 70) * a.windup * 1.2, 0);
  switch (kind) {
    case 'blob': slime(ctx, r, color, a, C, O); break;
    case 'beast': wolf(ctx, r, color, a, C, O); break;
    case 'golem': golem(ctx, r, color, a, C, O); break;
    case 'flyer': bat(ctx, r, color, a, C, O); break;
    case 'mushroom': mushroom(ctx, r, color, a, C, O); break;
  }
  ctx.restore();
}

function slime(ctx: Ctx, r: number, color: string, a: MonsterAnim, C: (c: string) => string, O: string): void {
  let hop = 0, squash = Math.sin(a.t * 4) * 0.05, dx = 0;
  if (a.moving && a.windup === 0) {
    const ph = (a.t * 2.6) % 1;
    hop = Math.sin(ph * Math.PI) * r * 0.55;
    squash = ph < 0.12 || ph > 0.9 ? 0.22 : -0.1;
  }
  if (a.windup > 0) squash = 0.32 * a.windup;
  if (a.strike > 0) { squash = -0.25 * a.strike; dx = a.strike * r * 0.7; hop = a.strike * r * 0.3; }
  if (a.hurt) squash = 0.28;
  if (a.dying > 0) squash = 0.3 + a.dying * 0.5;
  const sx = 1 + squash, sy = 1 - squash;
  groundShadow(ctx, r * sx, 1 - hop / (r * 2));
  ctx.translate(dx, -hop);
  const h = r * 1.7 * sy, w = r * sx;
  // corpo em forma de gota
  shape(ctx, C(color), O, () => {
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w * 1.05, -h * 0.75, -w * 0.4, -h * 1.05, 0, -h);
    ctx.bezierCurveTo(w * 0.5, -h * 1.05, w * 1.05, -h * 0.7, w, 0);
    ctx.closePath();
  });
  if (!a.flash) {
    ctx.fillStyle = shade(color, -0.15);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.12, w * 0.85, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-w * 0.35, -h * 0.72, w * 0.18, h * 0.12, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // tufos de musgo
    ctx.fillStyle = shade(color, -0.3);
    for (const k of [-0.35, 0, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(w * k - 2, -h * 0.97 + Math.abs(k) * h * 0.18);
      ctx.lineTo(w * k, -h * 1.15 + Math.abs(k) * h * 0.18);
      ctx.lineTo(w * k + 2.5, -h * 0.96 + Math.abs(k) * h * 0.18);
      ctx.fill();
    }
  }
  const er = Math.max(2.2, r * 0.17);
  eye(ctx, w * 0.15, -h * 0.55, er, a.windup > 0, C, O);
  eye(ctx, w * 0.55, -h * 0.52, er, a.windup > 0, C, O);
  // boca
  ctx.strokeStyle = O;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (a.windup > 0 || a.strike > 0) ctx.ellipse(w * 0.4, -h * 0.3, 2.5, 2 + a.strike * 2, 0, 0, Math.PI * 2);
  else ctx.arc(w * 0.38, -h * 0.36, 2.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function wolf(ctx: Ctx, r: number, color: string, a: MonsterAnim, C: (c: string) => string, O: string): void {
  groundShadow(ctx, r * 1.4);
  let bx = 0, by = 0, headDrop = 0, jaw = 0;
  if (a.windup > 0) { bx = -a.windup * r * 0.35; by = a.windup * 3; headDrop = a.windup * 3; }
  if (a.strike > 0) { bx = a.strike * r * 0.9; by = -a.strike * 4; jaw = a.strike; }
  if (a.hurt) { bx = -3; headDrop = -3; }
  const gait = a.moving ? a.t * 14 : 0;
  const bodyY = -r * 0.95 + by + (a.moving ? Math.sin(gait * 2) * 1.2 : Math.sin(a.t * 3) * 0.5);
  const legY = bodyY + r * 0.25;
  const dark = C(shade(color, -0.25));
  const legs = (far: boolean) => {
    const off = far ? Math.PI : 0;
    for (const [lx, ph] of [[-r * 0.7, 0], [r * 0.55, Math.PI / 2]] as const) {
      const sw = a.moving ? Math.sin(gait + ph + off) * r * 0.4 : 0;
      ctx.lineCap = 'round';
      ctx.strokeStyle = O;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(bx + lx, legY);
      ctx.lineTo(bx + lx + sw * 0.4, legY + r * 0.35);
      ctx.lineTo(bx + lx + sw, 0);
      ctx.stroke();
      ctx.strokeStyle = far ? dark : C(color);
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  };
  legs(true);
  // cauda
  const wag = Math.sin(a.t * (a.moving ? 14 : 5)) * 0.5;
  shape(ctx, C(color), O, () => {
    ctx.moveTo(bx - r * 1.0, bodyY - r * 0.1);
    ctx.quadraticCurveTo(bx - r * 1.7, bodyY - r * (0.5 + wag), bx - r * 1.8, bodyY - r * (0.9 + wag * 0.5));
    ctx.quadraticCurveTo(bx - r * 1.4, bodyY - r * 0.3, bx - r * 0.9, bodyY + r * 0.15);
  });
  // corpo
  shape(ctx, C(color), O, () => ctx.ellipse(bx, bodyY, r * 1.2, r * 0.62, 0, 0, Math.PI * 2));
  // juba no peito
  shape(ctx, C(shade(color, 0.12)), O, () => {
    ctx.moveTo(bx + r * 0.45, bodyY - r * 0.5);
    ctx.lineTo(bx + r * 1.0, bodyY - r * 0.2);
    ctx.lineTo(bx + r * 0.85, bodyY + r * 0.25);
    ctx.lineTo(bx + r * 0.7, bodyY + r * 0.05);
    ctx.lineTo(bx + r * 0.55, bodyY + r * 0.4);
    ctx.lineTo(bx + r * 0.4, bodyY + r * 0.1);
    ctx.closePath();
  });
  if (!a.flash) {
    ctx.fillStyle = shade(color, -0.2);
    ctx.beginPath();
    ctx.ellipse(bx - r * 0.1, bodyY - r * 0.32, r * 0.85, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shade(color, 0.2);
    ctx.beginPath();
    ctx.ellipse(bx + r * 0.2, bodyY + r * 0.3, r * 0.6, r * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  legs(false);
  // cabeça
  const hx = bx + r * 1.05, hy = bodyY - r * 0.35 + headDrop;
  shape(ctx, C(color), O, () => {
    ctx.moveTo(hx - r * 0.25, hy - r * 0.45);
    ctx.lineTo(hx - r * 0.05, hy - r * 0.95);
    ctx.lineTo(hx + r * 0.2, hy - r * 0.5);
    ctx.closePath();
  });
  shape(ctx, C(color), O, () => ctx.ellipse(hx, hy, r * 0.58, r * 0.5, 0, 0, Math.PI * 2));
  // focinho e mandíbula
  shape(ctx, C(shade(color, 0.1)), O, () => {
    ctx.moveTo(hx + r * 0.2, hy - r * 0.18);
    ctx.lineTo(hx + r * 1.0, hy - r * 0.02 - jaw * 2);
    ctx.lineTo(hx + r * 1.0, hy + r * 0.16 - jaw * 2);
    ctx.lineTo(hx + r * 0.25, hy + r * 0.15);
    ctx.closePath();
  });
  shape(ctx, C(shade(color, -0.1)), O, () => {
    ctx.moveTo(hx + r * 0.25, hy + r * 0.15);
    ctx.lineTo(hx + r * 0.8, hy + r * 0.2 + jaw * 5);
    ctx.lineTo(hx + r * 0.2, hy + r * 0.32);
    ctx.closePath();
  });
  ctx.fillStyle = C('#1d1a24');
  ctx.beginPath();
  ctx.arc(hx + r * 1.0, hy + r * 0.02 - jaw * 2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C(a.windup > 0 ? '#ff2020' : '#ff6050');
  ctx.beginPath();
  ctx.ellipse(hx + r * 0.18, hy - r * 0.12, 2, 1.4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  if (jaw > 0.2) {
    ctx.fillStyle = C('#ffffff');
    ctx.fillRect(hx + r * 0.5, hy + r * 0.12, 1.2, 2.2);
    ctx.fillRect(hx + r * 0.7, hy + r * 0.12, 1.2, 2.2);
  }
}

function golem(ctx: Ctx, r: number, color: string, a: MonsterAnim, C: (c: string) => string, O: string): void {
  groundShadow(ctx, r * 1.1);
  const step = a.moving ? Math.sin(a.t * 5) : 0;
  const stomp = Math.abs(step) * -2;
  const raise = a.windup; // braços sobem ao preparar
  const slam = a.strike;
  const dark = C(shade(color, -0.25));
  const stone = C(shade(color, 0.08));
  const glow = C(a.windup > 0 ? '#ffdd55' : '#ff9a3c');
  // pernas
  for (const [lx, s] of [[-r * 0.35, step], [r * 0.3, -step]] as const) {
    shape(ctx, s > 0 ? dark : C(color), O, () => ctx.rect(lx - r * 0.2 + s * 2, -r * 0.75 + Math.max(0, s) * -3, r * 0.4, r * 0.75 - Math.max(0, s) * -3));
  }
  const ty = -r * 0.7 + stomp + slam * 3;
  // braço de trás
  const arm = (front: boolean) => {
    const sx = front ? r * 0.55 : -r * 0.5;
    const base = front ? -step * 0.4 : step * 0.4;
    const ang = slam > 0 ? base + (1.45 - base) * slam : base + (2.9 - base) * raise;
    const L = r * 0.95;
    const ex = sx + Math.sin(ang) * L, ey = ty - r * 1.15 + Math.cos(ang) * L;
    ctx.lineCap = 'round';
    ctx.strokeStyle = O;
    ctx.lineWidth = r * 0.42 + 2;
    ctx.beginPath();
    ctx.moveTo(sx, ty - r * 1.15);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = front ? stone : dark;
    ctx.lineWidth = r * 0.42;
    ctx.stroke();
    shape(ctx, front ? stone : dark, O, () => ctx.arc(ex, ey, r * 0.34, 0, Math.PI * 2));
  };
  arm(false);
  // tronco de pedra
  shape(ctx, C(color), O, () => {
    ctx.moveTo(-r * 0.75, ty);
    ctx.lineTo(-r * 0.9, ty - r * 1.25);
    ctx.lineTo(r * 0.85, ty - r * 1.35);
    ctx.lineTo(r * 0.7, ty);
    ctx.closePath();
  });
  if (!a.flash) {
    ctx.strokeStyle = shade(color, -0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, ty - r * 0.5);
    ctx.lineTo(-r * 0.1, ty - r * 0.65);
    ctx.lineTo(r * 0.2, ty - r * 0.3);
    ctx.moveTo(r * 0.1, ty - r * 1.0);
    ctx.lineTo(r * 0.5, ty - r * 0.85);
    ctx.stroke();
  }
  // núcleo brilhante
  const pulse = 0.7 + Math.sin(a.t * 4) * 0.3;
  ctx.globalAlpha *= 0.5;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(r * 0.1, ty - r * 0.7, r * 0.3 * pulse + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha /= 0.5;
  shape(ctx, glow, O, () => ctx.arc(r * 0.1, ty - r * 0.7, r * 0.15, 0, Math.PI * 2), 1);
  // cabeça
  shape(ctx, stone, O, () => ctx.rect(-r * 0.25, ty - r * 1.75, r * 0.65, r * 0.45));
  ctx.fillStyle = glow;
  ctx.fillRect(r * 0.1, ty - r * 1.58, r * 0.25, r * 0.08);
  arm(true);
}

function bat(ctx: Ctx, r: number, color: string, a: MonsterAnim, C: (c: string) => string, O: string): void {
  let h = r * 2.6 + Math.sin(a.t * 5) * 4, dx = 0;
  if (a.windup > 0) h += a.windup * 8;
  if (a.strike > 0) { h = r * 1.4 + (1 - a.strike) * r; dx = a.strike * r; }
  if (a.dying > 0) h *= 1 - a.dying;
  groundShadow(ctx, r * 0.9, Math.max(0.4, 1 - h / 80));
  ctx.translate(dx, -h);
  const flap = Math.sin(a.t * (a.windup > 0 ? 30 : 18));
  const wing = (far: boolean) => {
    const dirx = far ? -1 : 1;
    const lift = flap * r * 0.6;
    shape(ctx, C(far ? shade(color, -0.3) : shade(color, -0.12)), O, () => {
      ctx.moveTo(0, -r * 0.1);
      ctx.lineTo(dirx * r * 0.9, -r * 0.4 - lift);
      ctx.lineTo(dirx * r * 1.9, -r * 0.1 - lift * 1.2);
      ctx.lineTo(dirx * r * 1.5, r * 0.25 - lift * 0.6);
      ctx.lineTo(dirx * r * 1.05, r * 0.05 - lift * 0.5);
      ctx.lineTo(dirx * r * 0.7, r * 0.35 - lift * 0.3);
      ctx.closePath();
    });
  };
  wing(true);
  shape(ctx, C(color), O, () => ctx.ellipse(0, 0, r * 0.65, r * 0.6, 0, 0, Math.PI * 2));
  // orelhas
  for (const ex of [-0.25, 0.25]) {
    shape(ctx, C(color), O, () => {
      ctx.moveTo(r * (ex - 0.15), -r * 0.45);
      ctx.lineTo(r * ex, -r * 0.95);
      ctx.lineTo(r * (ex + 0.15), -r * 0.45);
      ctx.closePath();
    });
  }
  ctx.fillStyle = C(a.windup > 0 ? '#ff2020' : '#ff6b6b');
  ctx.beginPath();
  ctx.arc(r * 0.15, -r * 0.1, 1.8, 0, Math.PI * 2);
  ctx.arc(r * 0.42, -r * 0.08, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C('#ffffff');
  ctx.fillRect(r * 0.2, r * 0.18, 1.2, 2.2);
  ctx.fillRect(r * 0.36, r * 0.18, 1.2, 2.2);
  wing(false);
}

function mushroom(ctx: Ctx, r: number, color: string, a: MonsterAnim, C: (c: string) => string, O: string): void {
  groundShadow(ctx, r * 1.2);
  const waddle = a.moving ? Math.sin(a.t * 6) * 0.08 : Math.sin(a.t * 2) * 0.03;
  const crouch = a.windup * 6;
  const lunge = a.strike * r * 0.4;
  const stemC = C('#f3e3c3');
  ctx.translate(lunge, 0);
  ctx.rotate(waddle + a.strike * 0.25 - a.windup * 0.15);
  // pezinhos
  const step = a.moving ? Math.sin(a.t * 6) * 4 : 0;
  shape(ctx, C('#c9b48f'), O, () => ctx.ellipse(-r * 0.3 + step, -3, r * 0.25, 4, 0, 0, Math.PI * 2));
  shape(ctx, C('#c9b48f'), O, () => ctx.ellipse(r * 0.3 - step, -3, r * 0.25, 4, 0, 0, Math.PI * 2));
  // tronco (caule)
  const top = -r * 1.35 + crouch;
  shape(ctx, stemC, O, () => {
    ctx.moveTo(-r * 0.55, -4);
    ctx.quadraticCurveTo(-r * 0.7, top * 0.5, -r * 0.45, top);
    ctx.lineTo(r * 0.5, top);
    ctx.quadraticCurveTo(r * 0.75, top * 0.5, r * 0.55, -4);
    ctx.closePath();
  });
  // bracinhos
  const armA = a.windup > 0 ? -2.6 * a.windup : a.strike > 0 ? 1.4 : Math.sin(a.t * 6) * 0.4;
  for (const [sx, s] of [[-r * 0.5, -1], [r * 0.5, 1]] as const) {
    const ang = s > 0 ? armA : -armA * 0.7;
    const ex = sx + Math.sin(ang + (s > 0 ? 0.4 : -0.4)) * r * 0.45;
    const ey = top * 0.55 + Math.cos(ang) * r * 0.45;
    ctx.lineCap = 'round';
    ctx.strokeStyle = O;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(sx, top * 0.55);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = stemC;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // rosto
  const fy = top * 0.62;
  eye(ctx, r * 0.05, fy, 4, true, C, O, '#c4466b');
  eye(ctx, r * 0.35, fy, 4, true, C, O, '#c4466b');
  ctx.fillStyle = C('#5a2030');
  ctx.beginPath();
  ctx.ellipse(r * 0.22, fy + 9, 5, 2 + a.strike * 4 + a.windup * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // chapéu
  const capY = top + 4;
  shape(ctx, C(color), O, () => {
    ctx.moveTo(-r * 1.15, capY);
    ctx.bezierCurveTo(-r * 1.25, capY - r * 1.2, r * 1.25, capY - r * 1.2, r * 1.15, capY);
    ctx.quadraticCurveTo(0, capY + 6, -r * 1.15, capY);
    ctx.closePath();
  }, 2);
  if (!a.flash) {
    ctx.fillStyle = '#fff4ea';
    for (const [sx, sy, sr] of [[-0.6, -0.35, 0.18], [0.1, -0.7, 0.22], [0.65, -0.3, 0.16], [-0.15, -0.25, 0.11]]) {
      ctx.beginPath();
      ctx.ellipse(r * sx, capY + r * sy, r * sr, r * sr * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // coroa
  const cy = capY - r * 0.88;
  shape(ctx, C('#f0c040'), O, () => {
    ctx.moveTo(-r * 0.35, cy);
    ctx.lineTo(-r * 0.4, cy - r * 0.35);
    ctx.lineTo(-r * 0.18, cy - r * 0.18);
    ctx.lineTo(0, cy - r * 0.42);
    ctx.lineTo(r * 0.18, cy - r * 0.18);
    ctx.lineTo(r * 0.4, cy - r * 0.35);
    ctx.lineTo(r * 0.35, cy);
    ctx.closePath();
  });
  ctx.fillStyle = C('#4fd0e0');
  ctx.beginPath();
  ctx.arc(0, cy - r * 0.12, 2, 0, Math.PI * 2);
  ctx.fill();
}
