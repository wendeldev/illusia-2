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
  /** poderes nos 4 botões, por classe */
  skillSlots?: Record<string, string[]>;
  /** classe escolhida (vazio = ainda não escolheu) */
  classId?: string;
  /** versão do save (2 = nova curva de níveis) */
  version: number;
  /** gemas (só caem de chefes) */
  gems: number;
  /** itens empilháveis: id -> quantidade */
  bag: Record<string, number>;
  /** aprimoramento de cada equipamento (+0 a +10) */
  upgrades: Record<string, number>;
  /** cartas equipadas (2) e runa (1) */
  cards: (string | null)[];
  rune: string | null;
  /** próxima fase começa com evento (Passe de Evento) */
  eventPass?: boolean;
  /** próxima arena com recompensas dobradas (Passe VIP) */
  vipPass?: boolean;
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
    gems: 0,
    bag: { pot_hp: 3, pot_mp: 2 },
    upgrades: {},
    cards: [null, null],
    rune: null,
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
    p.bag = { ...(p.bag ?? {}) };
    p.upgrades = { ...(p.upgrades ?? {}) };
    p.cards = Array.isArray(p.cards) ? [p.cards[0] ?? null, p.cards[1] ?? null] : [null, null];
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
