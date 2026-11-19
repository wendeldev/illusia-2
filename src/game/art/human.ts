// Personagens humanos desenhados por partes (estilo cartoon com contorno).
// Cada parte (pernas, tronco, cabeça, braços, arma) é posicionada por uma Pose,
// então animar é só mudar ângulos ao longo do tempo.
import type { HumanLook, WeaponLook } from '../../types';
import { shade } from '../draw';

export const OUTLINE = '#1d1a24';

/**
 * Ângulos de membros: 0 = apontando para baixo, π/2 = para frente, π = para cima.
 */
export interface Pose {
  armFront: number;
  armBack: number;
  weapon: number;
  legFront: number;
  legBack: number;
  /** deslocamento vertical do corpo (negativo = para cima, ex.: pulo) */
  bodyY: number;
  /** inclinação do tronco em radianos (positivo = para frente) */
  lean: number;
  /** -1..1: achata horizontalmente (efeito de giro) */
  scaleX: number;
  /** 0..1: caído no chão */
  lying: number;
  eyesClosed: boolean;
  /** rastro da arma durante o golpe (ângulos de início e fim) */
  trail?: { from: number; to: number; color: string };
}

export function basePose(): Pose {
  return {
    armFront: 0.4, armBack: -0.2, weapon: 2.5, legFront: 0, legBack: 0,
    bodyY: 0, lean: 0, scaleX: 1, lying: 0, eyesClosed: false,
  };
}

export const DEFAULT_LOOK: HumanLook = {
  skin: '#f1c9a5', hair: '#6b3f22', hairStyle: 'short', outfit: '#3d6fd6', trim: '#f0d070',
  pants: '#2c3550', boots: '#5a3a22', armor: 'cloth',
};

const dir = (a: number, len: number) => ({ x: Math.sin(a) * len, y: Math.cos(a) * len });

function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string, outline: string): void {
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 2;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

function blob(ctx: CanvasRenderingContext2D, fill: string, outline: string, path: () => void): void {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outline;
  ctx.stroke();
}

// medidas do corpo (altura total ≈ 44px)
const HIP_Y = -12;
const LEG = 12;
const SHOULDER_Y = -24;
const ARM = 10;
const HEAD = { x: 1, y: -34, r: 9 };

export function drawHuman(
  ctx: CanvasRenderingContext2D,
  x: number, groundY: number, facing: number,
  look: HumanLook, pose: Pose, flash = false,
): void {
  const C = (c: string) => (flash ? '#ffffff' : c);
  const O = flash ? '#ffffff' : OUTLINE;

  // sombra (diminui quando pula)
  const lift = Math.max(0, -pose.bodyY);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, groundY, 13 * (1 - lift / 60) + (pose.lying * 10), 4.5 * (1 - lift / 60), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, groundY + pose.bodyY);
  if (pose.lying > 0) {
    ctx.translate(-facing * pose.lying * 4, -pose.lying * 4);
    ctx.rotate(-facing * pose.lying * Math.PI / 2);
  }
  ctx.scale(facing * pose.scaleX, 1);

  const withLean = (fn: () => void) => {
    ctx.save();
    ctx.translate(0, HIP_Y);
    ctx.rotate(pose.lean);
    ctx.translate(0, -HIP_Y);
    fn();
    ctx.restore();
  };

  // braço de trás (mais escuro)
  withLean(() => {
    const s = { x: -3, y: SHOULDER_Y };
    const h = dir(pose.armBack, ARM);
    limb(ctx, s.x, s.y, s.x + h.x, s.y + h.y, 4.5, C(shade(look.outfit, -0.25)), O);
    blob(ctx, C(shade(look.skin, -0.12)), O, () => ctx.arc(s.x + h.x, s.y + h.y, 2.4, 0, Math.PI * 2));
  });

  // pernas
  const leg = (hx: number, a: number, back: boolean) => {
    const f = dir(a, LEG);
    limb(ctx, hx, HIP_Y, hx + f.x, HIP_Y + f.y, 5, C(back ? shade(look.pants, -0.2) : look.pants), O);
    blob(ctx, C(back ? shade(look.boots, -0.15) : look.boots), O, () =>
      ctx.ellipse(hx + f.x + 1.5, HIP_Y + f.y - 0.5, 4, 2.6, 0, 0, Math.PI * 2));
  };
  leg(-2, pose.legBack, true);
  leg(2, pose.legFront, false);

  withLean(() => {
    drawTorso(ctx, look, C, O);
    drawHead(ctx, look, pose, C, O);
    // braço da frente + arma/objeto
    const s = { x: 2, y: SHOULDER_Y };
    const h = dir(pose.armFront, ARM);
    const hx = s.x + h.x, hy = s.y + h.y;
    if (pose.trail && look.weapon) drawTrail(ctx, s.x, s.y, look.weapon.length + ARM, pose.trail);
    if (look.weapon) drawWeapon(ctx, hx, hy, pose.weapon, look.weapon, flash);
    if (look.prop) drawProp(ctx, hx, hy, pose.weapon, look.prop, C, O);
    limb(ctx, s.x, s.y, hx, hy, 4.5, C(look.outfit), O);
    blob(ctx, C(look.skin), O, () => ctx.arc(hx, hy, 2.6, 0, Math.PI * 2));
  });

  ctx.restore();
}

function drawTorso(ctx: CanvasRenderingContext2D, look: HumanLook, C: (c: string) => string, O: string): void {
  // tronco levemente trapezoidal
  blob(ctx, C(look.outfit), O, () => {
    ctx.moveTo(-6.5, -27);
    ctx.lineTo(6.5, -27);
    ctx.lineTo(7.5, -11);
    ctx.lineTo(-7.5, -11);
    ctx.closePath();
  });
  ctx.lineWidth = 1;
  switch (look.armor) {
    case 'leather':
      ctx.strokeStyle = C(look.trim);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -26);
      ctx.lineTo(6, -13);
      ctx.stroke();
      break;
    case 'mail':
      ctx.fillStyle = C(shade(look.outfit, -0.18));
      for (let yy = -25; yy < -13; yy += 3) {
        for (let xx = -5 + ((yy / 3) % 2 ? 1.5 : 0); xx < 6; xx += 3) ctx.fillRect(xx, yy, 1.4, 1.4);
      }
      break;
    case 'plate':
      ctx.fillStyle = C(shade(look.outfit, 0.15));
      ctx.fillRect(-4, -25, 3, 8);
      blob(ctx, C(look.trim), O, () => ctx.ellipse(-5, -26, 4.5, 3, 0, 0, Math.PI * 2));
      blob(ctx, C(look.trim), O, () => ctx.ellipse(6, -26, 4.5, 3, 0, 0, Math.PI * 2));
      break;
    case 'cloth':
      break;
  }
  if (look.apron) {
    blob(ctx, C(look.apron), O, () => {
      ctx.moveTo(-1, -22);
      ctx.lineTo(7, -22);
      ctx.lineTo(8, -7);
      ctx.lineTo(-1, -7);
      ctx.closePath();
    });
  }
  // cinto
  ctx.fillStyle = C(look.trim);
  ctx.fillRect(-7.3, -14.5, 14.6, 2.6);
  ctx.fillStyle = C(shade(look.trim, -0.3));
  ctx.fillRect(1, -14.5, 2.6, 2.6);
  if (look.pendant) {
    ctx.strokeStyle = C('#d9c79a');
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2, -27);
    ctx.lineTo(2, -22);
    ctx.lineTo(5, -27);
    ctx.stroke();
    blob(ctx, C(look.pendant), O, () => ctx.arc(2, -21.5, 1.8, 0, Math.PI * 2));
  }
}

function drawHead(ctx: CanvasRenderingContext2D, look: HumanLook, pose: Pose, C: (c: string) => string, O: string): void {
  const { x, y, r } = HEAD;
  const helmet = look.helmet;
  if (helmet?.style === 'hood') {
    blob(ctx, C(helmet.color), O, () => ctx.arc(x - 0.5, y, r + 1.5, 0, Math.PI * 2));
    blob(ctx, C(shade(helmet.color, -0.15)), O, () => {
      ctx.moveTo(x - 9, y + 3);
      ctx.lineTo(x - 13, y + 11);
      ctx.lineTo(x - 4, y + 8);
    });
    blob(ctx, C(look.skin), O, () => ctx.ellipse(x + 3, y + 1.5, 6.5, 7, 0, 0, Math.PI * 2));
  } else {
    // cabelo de trás
    if (look.hairStyle === 'long') blob(ctx, C(shade(look.hair, -0.1)), O, () => ctx.rect(x - 9, y - 2, 7, 15));
    if (look.hairStyle === 'bun') blob(ctx, C(look.hair), O, () => ctx.arc(x - 7, y - 7, 4.5, 0, Math.PI * 2));
    blob(ctx, C(look.skin), O, () => ctx.arc(x, y, r, 0, Math.PI * 2));
    // cabelo de cima
    blob(ctx, C(look.hair), O, () => {
      ctx.arc(x, y, r + 0.5, Math.PI * 0.9, Math.PI * 2.08);
      ctx.lineTo(x + 3, y - 3);
      ctx.lineTo(x - 4, y - 2);
      ctx.lineTo(x - 9, y + 3);
      ctx.closePath();
    });
    if (look.hairStyle === 'spiky' && !helmet) {
      blob(ctx, C(look.hair), O, () => {
        ctx.moveTo(x - 8, y - 5);
        ctx.lineTo(x - 13, y - 10);
        ctx.lineTo(x - 5, y - 9);
        ctx.lineTo(x - 6, y - 14);
        ctx.lineTo(x + 1, y - 9.5);
        ctx.lineTo(x + 3, y - 14);
        ctx.lineTo(x + 6, y - 8);
        ctx.closePath();
      });
    }
  }
  // olho
  ctx.fillStyle = C('#1d1a24');
  if (pose.eyesClosed || pose.lying > 0.5) ctx.fillRect(x + 4, y + 1, 3, 1);
  else {
    ctx.fillRect(x + 4.5, y - 1, 2, 3.5);
    ctx.fillStyle = C('#ffffff');
    ctx.fillRect(x + 4.5, y - 1, 1, 1);
  }
  ctx.fillStyle = C('rgba(230,120,120,0.45)');
  ctx.fillRect(x + 2, y + 3.5, 3, 1.5);

  if (helmet?.style === 'helm') {
    blob(ctx, C(helmet.color), O, () => {
      ctx.arc(x, y - 1, r + 1.5, Math.PI, Math.PI * 2);
      ctx.closePath();
    });
    ctx.fillStyle = C(shade(helmet.color, -0.2));
    ctx.fillRect(x - r - 1.5, y - 2.5, (r + 1.5) * 2, 2.5);
    blob(ctx, C(helmet.color), O, () => ctx.rect(x + 6, y - 2, 2.2, 6));
    ctx.fillStyle = C('rgba(255,255,255,0.4)');
    ctx.fillRect(x - 4, y - 8, 3, 2);
  } else if (helmet?.style === 'captain') {
    blob(ctx, C(helmet.color), O, () => ctx.ellipse(x, y - 7, 13, 3, -0.1, 0, Math.PI * 2));
    blob(ctx, C(helmet.color), O, () => ctx.rect(x - 6, y - 15, 12, 8));
    ctx.fillStyle = C('#d9a83f');
    ctx.fillRect(x - 6, y - 10, 12, 2);
    blob(ctx, C('#e8e8e8'), O, () => ctx.ellipse(x - 8, y - 16, 5, 2, -0.6, 0, Math.PI * 2));
  }
}

function drawWeapon(ctx: CanvasRenderingContext2D, hx: number, hy: number, angle: number, w: WeaponLook, flash: boolean): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-angle);
  const O = flash ? '#ffffff' : OUTLINE;
  // cabo e guarda
  ctx.fillStyle = flash ? '#fff' : w.hilt;
  ctx.fillRect(-1.2, -4, 2.4, 6);
  blob(ctx, flash ? '#fff' : shade(w.hilt, 0.15), O, () => ctx.rect(-w.width - 1.5, 2, w.width * 2 + 3, 2.2));
  if (w.glow && !flash) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = w.glow;
    ctx.beginPath();
    ctx.ellipse(0, 4 + w.length / 2, w.width + 2.5, w.length / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // lâmina
  blob(ctx, flash ? '#fff' : w.blade, O, () => {
    const hw = w.width / 2;
    ctx.moveTo(-hw, 4);
    if (w.curve) {
      ctx.quadraticCurveTo(-hw - 3, 4 + w.length * 0.6, 2, 4 + w.length);
      ctx.quadraticCurveTo(hw + 1, 4 + w.length * 0.5, hw, 4);
    } else {
      ctx.lineTo(-hw, 4 + w.length - w.width);
      ctx.lineTo(0, 4 + w.length);
      ctx.lineTo(hw, 4 + w.length - w.width);
      ctx.lineTo(hw, 4);
    }
    ctx.closePath();
  });
  if (!flash) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-w.width / 2 + 0.6, 5, 0.9, w.length * 0.7);
    if (w.glow && w.length > 22) {
      ctx.fillStyle = w.glow;
      for (let k = 8; k < w.length - 4; k += 5) ctx.fillRect(-0.8, k, 1.6, 2);
    }
  }
  ctx.restore();
}

function drawProp(
  ctx: CanvasRenderingContext2D, hx: number, hy: number, angle: number,
  prop: NonNullable<HumanLook['prop']>, C: (c: string) => string, O: string,
): void {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-angle);
  switch (prop) {
    case 'hammer':
      limb(ctx, 0, -3, 0, 13, 2, C('#7a5030'), O);
      blob(ctx, C('#6d7580'), O, () => ctx.rect(-5, 11, 10, 6));
      break;
    case 'staff':
      limb(ctx, 0, -14, 0, 24, 2.2, C('#8a5a2b'), O);
      blob(ctx, C('#9ff0d0'), O, () => ctx.arc(0, 26, 3.5, 0, Math.PI * 2));
      break;
    case 'spear':
      limb(ctx, 0, -16, 0, 26, 2, C('#6b4a32'), O);
      blob(ctx, C('#c9d1da'), O, () => {
        ctx.moveTo(-2.5, 25);
        ctx.lineTo(0, 34);
        ctx.lineTo(2.5, 25);
        ctx.closePath();
      });
      break;
  }
  ctx.restore();
}

function drawTrail(ctx: CanvasRenderingContext2D, sx: number, sy: number, reach: number, t: NonNullable<Pose['trail']>): void {
  const steps = 10;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = t.from + (t.to - t.from) * (i / steps);
    const d = dir(a, reach);
    if (i === 0) ctx.moveTo(sx + d.x, sy + d.y);
    else ctx.lineTo(sx + d.x, sy + d.y);
  }
  for (let i = steps; i >= 0; i--) {
    const a = t.from + (t.to - t.from) * (i / steps);
    const d = dir(a, reach * 0.55);
    ctx.lineTo(sx + d.x, sy + d.y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(sx + dir(t.from, reach).x, sy + dir(t.from, reach).y, sx + dir(t.to, reach).x, sy + dir(t.to, reach).y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, t.color);
  ctx.fillStyle = g;
  ctx.fill();
}
