import { hasItem, hasStage, LEGACY_STAGE_IDS } from '../data';
import { expToNext, legacyExpToNext } from './stats';
import type { Slot } from '../types';

const SAVE_KEY = 'lumen-save-v1';

export interface Progress {
  level: number;
  exp: number;
  gold: number;
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  cleared: string[];
  /** estado das missões: ativa (com contagem) ou entregue */
  quests: Record<string, QuestState>;
  /** estrelas por fase (bits: 1 = vencer, 2 = rapidez, 4 = pouco dano) */
  stars: Record<string, number>;
  /** versão do save (2 = nova curva de níveis) */
  version: number;
}

export interface QuestState {
  status: 'active' | 'done';
  count: number;
}

export function newProgress(): Progress {
  return {
    level: 1,
    exp: 0,
    gold: 60,
    owned: ['training_sword'],
    equipped: { weapon: 'training_sword' },
    cleared: [],
    quests: {},
    stars: {},
    version: 2,
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const p = { ...newProgress(), ...parsed };
    if (!parsed.version || parsed.version < 2) migrateLevels(p);
    // descarta itens que não existem mais (conteúdo mudou entre versões)
    p.owned = p.owned.filter(hasItem);
    p.cleared = [...new Set(p.cleared.map((id) => LEGACY_STAGE_IDS[id] ?? id).filter(hasStage))];
    for (const slot of Object.keys(p.equipped) as Slot[]) {
      const id = p.equipped[slot];
      if (!id || !p.owned.includes(id)) delete p.equipped[slot];
    }
    return p;
  } catch {
    return newProgress();
  }
}

/** Converte o nível de saves antigos para a nova curva mantendo toda a EXP já ganha. */
function migrateLevels(p: Progress): void {
  let total = p.exp;
  for (let l = 1; l < p.level; l++) total += legacyExpToNext(l);
  p.level = 1;
  while (total >= expToNext(p.level)) { total -= expToNext(p.level); p.level++; }
  p.exp = total;
  p.version = 2;
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch {
    /* navegador sem armazenamento: o jogo continua, só não salva */
  }
}
