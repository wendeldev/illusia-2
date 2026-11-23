// Equipamentos em camadas (prancha de peças): armas, sets por classe, botas, asas e auras,
// em 8 raridades. Gerados por fórmula; o ícone de cada peça também é o desenho que aparece no corpo.
import type { EquipmentDef, Slot } from '../types';

export const RARITY_NAMES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico', 'Divino', 'Celestial'];
export const RARITY_KEYS = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino', 'celestial'];
export const RARITY_COLORS = ['#a8b0c0', '#6fe06a', '#5fa8ff', '#c07bff', '#ffb840', '#ff4f4f', '#fff0b0', '#8ff0ff'];
const MULT = [1, 1.7, 2.8, 4.5, 7, 10.5, 15, 21];

export const WEAPON_KINDS: Record<string, { name: string; atk: number; crit?: number; mp?: number }> = {
  sword: { name: 'Espada', atk: 6 },
  axe: { name: 'Machado', atk: 7.5 },
  spear: { name: 'Lança', atk: 6.5, crit: 0.005 },
  dagger: { name: 'Adaga', atk: 5, crit: 0.02 },
  staff: { name: 'Cajado', atk: 5, mp: 18 },
};
/** Arma preferida de cada classe: +25% no ataque da arma. */
export const PREFERRED: Record<string, string[]> = {
  warrior: ['sword', 'axe', 'spear'], assassin: ['dagger'], mage: ['staff'],
};
/** Set de armadura de cada classe. */
export const SET_OF: Record<string, string> = { warrior: 'warrior', assassin: 'assassin', mage: 'mage' };
export const SET_NAMES: Record<string, string> = { warrior: 'Guerreiro', assassin: 'Assassino', mage: 'Mago' };

const PIECES: { key: string; slot: Slot; name: string; def?: number; hp?: number; atk?: number; mp?: number; crit?: number }[] = [
  { key: 'armor', slot: 'armor', name: 'Armadura', def: 4, hp: 35 },
  { key: 'arms', slot: 'gloves', name: 'Braçadeiras', atk: 2, def: 1 },
  { key: 'pants', slot: 'pants', name: 'Calças', def: 3, hp: 20 },
  { key: 'cape', slot: 'cape', name: 'Capa', def: 1, mp: 10, crit: 0.005 },
];
/** Tempero de cada set: mago mais MP, assassino mais crítico, guerreiro mais vida. */
const FLAVOR: Record<string, { hp: number; mp: number; atk: number; crit: number }> = {
  warrior: { hp: 1.3, mp: 0.8, atk: 1, crit: 0.8 }, assassin: { hp: 0.9, mp: 1, atk: 1.1, crit: 1.8 },
  mage: { hp: 0.85, mp: 1.8, atk: 1.05, crit: 1 },
};

/** Preço na loja: tudo em ouro, crescendo com a raridade (Celestial só sai dos eventos). Mítico e Divino são o destino
 *  do ouro do fim do jogo (antes só aceitavam gemas e o ouro se acumulava sem uso). */
function price(r: number, weight: number): { price: number; priceGems?: number } {
  if (r >= 7) return { price: 0 };
  return { price: Math.round(90 * Math.pow(MULT[r], PRICE_EXP) * weight) };
}
const PRICE_EXP = 1.7;

const round = (v: number) => Math.round(v * 10) / 10;
const out: EquipmentDef[] = [];
for (let r = 0; r < 8; r++) {
  const m = MULT[r], key = RARITY_KEYS[r], rn = RARITY_NAMES[r];
  const event = r >= 7;
  for (const [kind, w] of Object.entries(WEAPON_KINDS)) {
    out.push({
      id: `wp_${kind}_${r}`, name: `${w.name} ${rn}`, slot: 'weapon', rarity: r, weaponKind: kind, category: kind,
      atk: round(w.atk * m), crit: w.crit ? round(w.crit * Math.sqrt(m) * 100) / 100 : undefined, mp: w.mp ? Math.round(w.mp * m) : undefined,
      icon: `gw_${kind}_${key}`, description: `${w.name} de raridade ${rn}.`, dropOnly: event, ...price(r, 1.2),
    });
  }
  for (const cls of Object.keys(SET_NAMES)) {
    const f = FLAVOR[cls];
    for (const p of PIECES) {
      out.push({
        id: `ar_${cls}_${p.key}_${r}`, name: `${p.name} ${rn} (${SET_NAMES[cls]})`, slot: p.slot, rarity: r, setClass: cls, category: p.key,
        def: p.def ? round(p.def * m) : undefined, hp: p.hp ? Math.round(p.hp * m * f.hp) : undefined,
        atk: p.atk ? round(p.atk * m * f.atk) : undefined, mp: p.mp ? Math.round(p.mp * m * f.mp) : undefined,
        crit: p.crit ? round(p.crit * Math.sqrt(m) * f.crit * 100) / 100 : undefined,
        icon: `gs_${cls}_${key}_${p.key}`, description: `Peça do set ${rn} do ${SET_NAMES[cls]}. Set completo (4 peças) dá bônus.`,
        dropOnly: event, ...price(r, 1),
      });
    }
  }
  const extra: [string, Slot, string, string, Partial<EquipmentDef>][] = [
    // halo (auréola): ocupa o espaço da cabeça, o mesmo para todas as classes
    ['hl', 'helmet', 'Halo', 'halo', { def: round(2 * m), hp: Math.round(15 * m), mp: Math.round(5 * m) }],
    ['bt', 'boots', 'Botas', 'gb', { def: round(1 * m), hp: Math.round(12 * m) }],
    ['wb', 'wings', 'Asas', 'gwb', { atk: round(3 * m), hp: Math.round(20 * m) }],
    ['wf', 'wingsFront', 'Asas Frontais', 'gwf', { mp: Math.round(15 * m), crit: round(0.008 * Math.sqrt(m) * 100) / 100 }],
    ['au', 'aura', 'Aura', 'gau', { atk: round(2 * m), crit: round(0.006 * Math.sqrt(m) * 100) / 100 }],
  ];
  for (const [pre, slot, name, icon, st] of extra) {
    out.push({
      id: `${pre}_${r}`, name: `${name} ${rn}`, slot, rarity: r, category: pre, icon: `${icon}_${key}`,
      description: `${name} de raridade ${rn}.`, dropOnly: event, ...price(r, 1.1), ...st,
    });
  }
}
export const GEAR: EquipmentDef[] = out;

/** Recompensa de uma classe numa raridade: set (4 peças) + halo + arma preferida. */
export function setFor(classId: string | undefined, rarity: number): string[] {
  const cls = SET_OF[classId ?? 'warrior'] ?? 'warrior';
  const weapon = (PREFERRED[classId ?? 'warrior'] ?? ['sword'])[0];
  return [`hl_${rarity}`, ...PIECES.map((p) => `ar_${cls}_${p.key}_${rarity}`), `wp_${weapon}_${rarity}`];
}

export const SHOP_CATEGORIES: [string, string][] = [
  ['sword', 'Espadas'], ['axe', 'Machados'], ['spear', 'Lanças'], ['dagger', 'Adagas'], ['staff', 'Cajados'],
  ['hl', 'Halos'], ['armor', 'Armaduras'], ['arms', 'Braços'], ['pants', 'Calças'], ['cape', 'Capas'],
  ['bt', 'Botas'], ['wb', 'Asas T.'], ['wf', 'Asas F.'], ['au', 'Auras'], ['classic', 'Clássicos'],
];
