// Quais poderes estão nos 4 botões, por classe (salvo no progresso).
import { getClass } from '../data';
import type { SkillDef } from '../types';
import type { Progress } from './progress';

export const SLOT_COUNT = 4;

/** Poderes nos botões (null = botão vazio). Sem escolha salva: os 4 primeiros da classe. */
export function slotSkills(p: Progress): (SkillDef | null)[] {
  const cls = getClass(p.classId);
  const ids = p.skillSlots?.[cls.id] ?? cls.skills.slice(0, SLOT_COUNT).map((s) => s.id);
  const out: (SkillDef | null)[] = [];
  for (let i = 0; i < SLOT_COUNT; i++) out.push(cls.skills.find((s) => s.id === ids[i]) ?? null);
  return out;
}

/** Coloca o poder no botão `slot` (se já estava em outro botão, troca de lugar). */
export function assignSlot(p: Progress, slot: number, skillId: string): void {
  const cls = getClass(p.classId);
  const cur = slotSkills(p).map((s) => s?.id ?? '');
  const prev = cur.indexOf(skillId);
  if (prev >= 0) cur[prev] = cur[slot];
  cur[slot] = skillId;
  p.skillSlots = { ...(p.skillSlots ?? {}), [cls.id]: cur };
}
