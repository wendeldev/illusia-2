import { CLASSES, getItem, hasItem, hasStage, LEGACY_STAGE_IDS } from '../data';
import { STARTER_WEAPON, usableBy } from '../data/gear';
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
  /** eventos vencidos: chefe -> bits (1 = Difícil, 2 = Épico) */
  eventsCleared?: Record<string, number>;
  /** equipamentos já vistos no inventário (os outros aparecem com o selo "N" de novo) */
  seen?: string[];
  /** recompensas do passe de batalha já resgatadas */
  passClaimed?: string[];
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
    owned: ['training_sword', 'sh_0'],
    equipped: { weapon: 'training_sword', shield: 'sh_0' },
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
    // capacetes dos sets viraram halos da mesma raridade
    const helm = (id: string) => id.replace(/^ar_\w+?_helmet_(\d)$/, 'hl_$1');
    p.owned = [...new Set(p.owned.map(helm))];
    for (const slot of Object.keys(p.equipped) as Slot[]) { const id = p.equipped[slot]; if (id) p.equipped[slot] = helm(id); }
    p.upgrades = Object.fromEntries(Object.entries(p.upgrades ?? {}).map(([k, v]) => [helm(k), v]));
    // machados e lanças saíram do jogo (cada classe tem a sua arma): viram espadas da mesma raridade
    const axe = (id: string) => id.replace(/^wp_(axe|spear)_(\d)$/, 'wp_sword_$2');
    p.owned = [...new Set(p.owned.map(axe))];
    for (const slot of Object.keys(p.equipped) as Slot[]) { const id = p.equipped[slot]; if (id) p.equipped[slot] = axe(id); }
    p.upgrades = Object.fromEntries(Object.entries(p.upgrades ?? {}).map(([k, v]) => [axe(k), v]));
    if (Array.isArray(p.seen)) p.seen = p.seen.map(axe);
    // descarta itens que não existem mais (conteúdo mudou entre versões)
    p.owned = p.owned.filter(hasItem);
    // saves de antes do selo "novo": tudo o que já tinha conta como visto
    p.seen = Array.isArray(p.seen) ? p.seen : [...p.owned];
    p.passClaimed = Array.isArray(p.passClaimed) ? p.passClaimed : [];
    p.bag = { ...(p.bag ?? {}) };
    p.upgrades = { ...(p.upgrades ?? {}) };
    p.cards = Array.isArray(p.cards) ? [p.cards[0] ?? null, p.cards[1] ?? null] : [null, null];
    // classes que saíram do jogo (Arqueiro, Lutador, Lanceiro): vira Guerreiro
    if (p.classId && !CLASSES.some((c) => c.id === p.classId)) p.classId = 'warrior';
    if (p.skillSlots) p.skillSlots = Object.fromEntries(Object.entries(p.skillSlots).filter(([c]) => CLASSES.some((k) => k.id === c)));
    p.cleared = [...new Set(p.cleared.map((id) => LEGACY_STAGE_IDS[id] ?? id).filter(hasStage))];
    for (const slot of Object.keys(p.equipped) as Slot[]) {
      const id = p.equipped[slot];
      if (!id || !p.owned.includes(id)) delete p.equipped[slot];
    }
    fitWeapon(p);
    fitShield(p);
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

/** A arma equipada tem que ser a da classe: senão equipa a melhor arma da classe que o jogador tem
 * (ou a arma inicial da classe). Retorna true se trocou. */
export function fitWeapon(p: Progress): boolean {
  const cls = p.classId ?? 'warrior';
  const cur = p.equipped.weapon;
  if (cur && hasItem(cur) && usableBy(getItem(cur), cls)) return false;
  const mine = p.owned.filter((id) => hasItem(id) && getItem(id).slot === 'weapon' && usableBy(getItem(id), cls));
  const best = mine.sort((a, b) => (getItem(b).atk ?? 0) - (getItem(a).atk ?? 0))[0];
  const starter = STARTER_WEAPON[cls] ?? 'training_sword';
  if (!best && !p.owned.includes(starter)) p.owned.push(starter);
  p.equipped.weapon = best ?? starter;
  return true;
}

/** Guerreiro começa com o Escudo Comum (outras classes não usam escudo). */
export function fitShield(p: Progress): void {
  if ((p.classId ?? 'warrior') !== 'warrior') { delete p.equipped.shield; return; }
  if (!p.owned.includes('sh_0')) p.owned.push('sh_0');
  if (!p.equipped.shield) p.equipped.shield = 'sh_0';
}
