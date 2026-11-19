import { hasItem } from '../data';
import type { Slot } from '../types';

const SAVE_KEY = 'lumen-save-v1';

export interface Progress {
  level: number;
  exp: number;
  gold: number;
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  cleared: string[];
}

export function newProgress(): Progress {
  return {
    level: 1,
    exp: 0,
    gold: 60,
    owned: ['training_sword'],
    equipped: { weapon: 'training_sword' },
    cleared: [],
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newProgress();
    const p = { ...newProgress(), ...(JSON.parse(raw) as Partial<Progress>) };
    // descarta itens que não existem mais (conteúdo mudou entre versões)
    p.owned = p.owned.filter(hasItem);
    for (const slot of Object.keys(p.equipped) as Slot[]) {
      const id = p.equipped[slot];
      if (!id || !p.owned.includes(id)) delete p.equipped[slot];
    }
    return p;
  } catch {
    return newProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    /* navegador sem armazenamento: o jogo continua, só não salva */
  }
}
