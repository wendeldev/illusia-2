import { getItem } from '../../data';
import type { HumanLook } from '../../types';
import type { Progress } from '../progress';
import { basePose, DEFAULT_LOOK, type Pose } from './human';

export type ActionAnim = 'combo0' | 'combo1' | 'combo2' | 'wind' | 'whirl' | 'thunder';

/** Estado mínimo que a animação do jogador precisa. */
export interface PlayerAnimState {
  action: ActionAnim | null;
  /** tempo decorrido / duração total da ação */
  actionT: number;
  actionDur: number;
  moving: boolean;
  walk: number;
  hurt: boolean;
  dead: boolean;
  deadAnim: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** A aparência do jogador muda conforme o equipamento. */
export function playerLook(progress: Progress): HumanLook {
  const look: HumanLook = { ...DEFAULT_LOOK, hairStyle: 'spiky' };
  for (const id of Object.values(progress.equipped)) {
    if (!id) continue;
    const l = getItem(id).look;
    if (!l) continue;
    if (l.weapon) look.weapon = l.weapon;
    if (l.outfit) look.outfit = l.outfit;
    if (l.trim) look.trim = l.trim;
    if (l.armor) look.armor = l.armor;
    if (l.helmet) look.helmet = l.helmet;
    if (l.pendant) look.pendant = l.pendant;
  }
  return look;
}

export function playerPose(s: PlayerAnimState, time: number): Pose {
  const p = basePose();
  p.eyesClosed = time % 3.4 < 0.12; // piscar
  p.bodyY = Math.sin(time * 3) * 0.5; // respiração

  if (s.dead) {
    p.lying = easeOut(s.deadAnim / 0.35);
    p.armFront = 2.6;
    p.armBack = 2.8;
    p.weapon = 2.6;
    p.eyesClosed = true;
    return p;
  }

  if (s.moving) {
    const w = Math.sin(s.walk);
    p.legFront = w * 0.75;
    p.legBack = -w * 0.75;
    p.armBack = w * 0.7;
    p.armFront = 0.5 - w * 0.35;
    p.weapon = 2.5 - w * 0.2;
    p.bodyY = -Math.abs(Math.cos(s.walk)) * 1.6;
    p.lean = 0.08;
  }

  if (s.action) {
    const t = clamp01(s.actionT / s.actionDur);
    const e = easeOut(t * 1.4);
    // postura de luta: pernas abertas
    p.legFront = 0.45;
    p.legBack = -0.35;
    p.armBack = -0.5;
    p.bodyY = 0;
    const swing = (from: number, to: number, color: string) => {
      const a = lerp(from, to, e);
      p.armFront = a;
      p.weapon = a;
      if (t < 0.75) p.trail = { from: lerp(from, to, Math.max(0, e - 0.45)), to: a, color };
    };
    switch (s.action) {
      case 'combo0':
        swing(3.0, 0.5, 'rgba(255,255,255,0.75)');
        p.lean = lerp(-0.15, 0.22, e);
        break;
      case 'combo1':
        swing(0.3, 2.9, 'rgba(255,255,255,0.75)');
        p.lean = lerp(0.18, -0.12, e);
        break;
      case 'combo2':
        swing(3.7, 0.3, 'rgba(255,233,168,0.9)');
        p.lean = lerp(-0.35, 0.38, e);
        p.bodyY = -Math.sin(Math.PI * t) * 5;
        p.legFront = 0.8;
        p.legBack = -0.7;
        break;
      case 'wind': {
        const a = lerp(2.7, 1.55, e);
        p.armFront = a;
        p.weapon = a;
        p.lean = lerp(-0.1, 0.3, e);
        if (t < 0.6) p.trail = { from: lerp(2.7, 1.55, Math.max(0, e - 0.5)), to: a, color: 'rgba(127,227,255,0.85)' };
        break;
      }
      case 'whirl':
        // giro: achatar e espelhar o corpo dá a ilusão de rotação
        p.scaleX = Math.cos(t * Math.PI * 4);
        p.armFront = 1.57;
        p.weapon = 1.57;
        p.armBack = -1.4;
        break;
      case 'thunder': {
        // pula e golpeia o chão
        p.bodyY = -20 * Math.sin(Math.PI * clamp01(t * 1.15));
        const a = t < 0.45 ? lerp(1.0, 3.4, easeOut(t / 0.45)) : lerp(3.4, 0.35, easeOut((t - 0.45) / 0.3));
        p.armFront = a;
        p.weapon = a;
        p.lean = t < 0.45 ? -0.25 : 0.4;
        p.legFront = t < 0.8 ? 1.0 : 0.5;
        p.legBack = t < 0.8 ? -0.2 : -0.5;
        if (t > 0.45 && t < 0.85) p.trail = { from: 3.4, to: a, color: 'rgba(196,155,255,0.9)' };
        break;
      }
    }
  } else if (s.hurt) {
    p.lean = -0.4;
    p.armFront = 2.0;
    p.armBack = 2.3;
    p.weapon = 2.2;
    p.legFront = 0.3;
    p.legBack = -0.3;
    p.eyesClosed = true;
  }
  return p;
}

export function npcLook(look: Partial<HumanLook>): HumanLook {
  return { ...DEFAULT_LOOK, ...look };
}

export function npcPose(idle: 'hammer' | 'still' | undefined, time: number, seed: number): Pose {
  const p = basePose();
  p.eyesClosed = (time + seed) % 4.1 < 0.12;
  p.bodyY = Math.sin(time * 2 + seed) * 0.5;
  if (idle === 'hammer') {
    // martela a bigorna em ciclos
    const c = (time * 1.3 + seed) % 1;
    const a = c < 0.6 ? lerp(0.8, 3.0, easeOut(c / 0.6)) : lerp(3.0, 0.8, easeOut((c - 0.6) / 0.15));
    p.armFront = a;
    p.weapon = a;
    p.lean = c < 0.6 ? -0.08 : 0.15;
  } else {
    // segura o cajado/lança em pé
    p.armFront = 0.9;
    p.weapon = Math.PI;
  }
  return p;
}
