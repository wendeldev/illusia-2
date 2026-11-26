// Equipamentos em camadas (prancha de peças): armas, sets por classe, botas, asas e auras,
// em 8 raridades. Gerados por fórmula; o ícone de cada peça também é o desenho que aparece no corpo.
import type { EquipmentDef, Slot } from '../types';

export const RARITY_NAMES = ['Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico', 'Divino', 'Celestial'];
export const RARITY_KEYS = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino', 'celestial'];
export const RARITY_COLORS = ['#a8b0c0', '#6fe06a', '#5fa8ff', '#c07bff', '#ffb840', '#ff4f4f', '#fff0b0', '#8ff0ff'];
const MULT = [1, 1.7, 2.8, 4.5, 7, 10.5, 15, 21];

export const WEAPON_KINDS: Record<string, { name: string; atk: number; crit?: number; mp?: number }> = {
  sword: { name: 'Espada', atk: 6 },
  dagger: { name: 'Adaga', atk: 5, crit: 0.02 },
  staff: { name: 'Cajado', atk: 5, mp: 18 },
};
/** Arma de cada classe (cada classe só usa a sua): Guerreiro espada, Maga cajado, Assassino adaga. */
export const CLASS_WEAPON: Record<string, string> = { warrior: 'sword', mage: 'staff', assassin: 'dagger' };
/** Arma da classe: +25% no ataque da arma. */
export const PREFERRED: Record<string, string[]> = Object.fromEntries(Object.entries(CLASS_WEAPON).map(([c, k]) => [c, [k]]));
/** Arma inicial de cada classe (não pode ser vendida). */
export const STARTER_WEAPON: Record<string, string> = { warrior: 'training_sword', mage: 'wp_staff_0', assassin: 'wp_dagger_0' };
export const STARTER_WEAPONS = new Set(Object.values(STARTER_WEAPON));

/** Tipo da arma (as armas clássicas sem tipo são espadas). */
export function weaponKindOf(e: { slot: Slot; weaponKind?: string }): string | undefined {
  return e.slot === 'weapon' ? e.weaponKind ?? 'sword' : undefined;
}
/** A classe pode usar o item? (só as armas têm dono: cada classe usa a sua) */
export function usableBy(e: { slot: Slot; weaponKind?: string }, classId: string | undefined): boolean {
  if (e.slot === 'costume' || e.slot === 'shield') return (classId ?? 'warrior') === 'warrior';
  return e.slot !== 'weapon' || weaponKindOf(e) === CLASS_WEAPON[classId ?? 'warrior'];
}
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
    // escudo: só o Guerreiro (na mão de trás, por cima de qualquer traje)
    ['sh', 'shield', 'Escudo', 'gsh', { def: round(2.5 * m), hp: Math.round(15 * m) }],
    ['au', 'aura', 'Aura', 'gau', { atk: round(2 * m), crit: round(0.006 * Math.sqrt(m) * 100) / 100 }],
  ];
  for (const [pre, slot, name, icon, st] of extra) {
    out.push({
      id: `${pre}_${r}`, name: `${name} ${rn}`, slot, rarity: r, category: pre, icon: `${icon}_${key}`,
      description: `${name} de raridade ${rn}.`, dropOnly: event, ...price(r, 1.1), ...st,
    });
  }
}
// ── passe de batalha: peças próprias (não vendem na loja; vêm só do passe) ──
/** Armas neon do passe: cada classe recebe a sua arma (espada, cajado ou adaga) nesse visual. */
export const PASS_WEAPON_STYLES: Record<string, { name: string; rarity: number; mul: number }> = {
  white: { name: 'de Luz Branca', rarity: 5, mul: 1 },
  black: { name: 'Neon Negro', rarity: 5, mul: 1 },
  violet: { name: 'Neon Violeta', rarity: 5, mul: 1.12 },
  green: { name: 'Neon Verde', rarity: 5, mul: 1.1 },
  emerald: { name: 'Neon Esmeralda', rarity: 6, mul: 1.05 },
};
const pass = (e: Omit<EquipmentDef, 'price' | 'dropOnly'>) => out.push({ ...e, price: 0, dropOnly: true, passOnly: true });
for (const [kind, w] of Object.entries(WEAPON_KINDS)) {
  for (const [st, ps] of Object.entries(PASS_WEAPON_STYLES)) {
    const m = MULT[ps.rarity] * ps.mul;
    pass({
      id: `wp_${kind}_${st}`, name: `${w.name} ${ps.name}`, slot: 'weapon', rarity: ps.rarity, weaponKind: kind, category: kind,
      atk: round(w.atk * m), crit: w.crit ? round(w.crit * Math.sqrt(m) * 100) / 100 : undefined, mp: w.mp ? Math.round(w.mp * m) : undefined,
      icon: `gw_${kind}_${st}`, description: `${w.name} do passe de batalha, com brilho ${ps.name.toLowerCase()}.`,
    });
  }
}
/** Peças do passe: fogo (grátis) e vaca (com gemas), para cada classe. */
for (const [skin, sname, r] of [['fire', 'de Fogo', 4], ['cow', 'de Vaca', 5]] as const) {
  const m = MULT[r];
  for (const cls of Object.keys(SET_NAMES)) {
    const f = FLAVOR[cls];
    pass({
      id: `ar_${cls}_armor_${skin}`, name: skin === 'cow' ? `Macacão de Vaca (${SET_NAMES[cls]})` : `Armadura de Fogo (${SET_NAMES[cls]})`,
      slot: 'armor', rarity: r, setClass: cls, category: 'armor', def: round(4 * m), hp: Math.round(35 * m * f.hp),
      icon: `gs_${cls}_${skin}_armor`, description: `Armadura ${sname} do passe de batalha.`,
    });
    pass({
      id: `ar_${cls}_arms_${skin}`, name: `Luvas ${sname} (${SET_NAMES[cls]})`, slot: 'gloves', rarity: r, setClass: cls, category: 'arms',
      atk: round(2 * m * f.atk), def: round(1 * m), icon: `gs_${cls}_${skin}_arms`, description: `Luvas ${sname} do passe de batalha.`,
    });
  }
  pass({ id: `bt_${skin}`, name: `Botas ${sname}`, slot: 'boots', rarity: r, category: 'bt', def: round(1 * m), hp: Math.round(12 * m), icon: `gb_${skin}`, description: `Botas ${sname} do passe de batalha.` });
}
pass({ id: 'au_skull', name: 'Aura de Caveira', slot: 'aura', rarity: 4, category: 'au', atk: round(2 * MULT[4]), crit: 0.02, icon: 'gau_skull', description: 'Uma caveira de fogo arde atrás de você (passe de batalha).' });
pass({ id: 'au_horns', name: 'Aura de Chifres', slot: 'aura', rarity: 5, category: 'au', atk: round(2 * MULT[5]), crit: 0.02, icon: 'gau_horns', description: 'Chifres de energia ao seu redor (passe de batalha).' });
pass({ id: 'acc_amulet_pass', name: 'Amuleto Guardião', slot: 'accessory', rarity: 2, def: 12, icon: 'ps_amulet', description: 'Amuleto raro: +12 de defesa (passe de batalha).' });
pass({ id: 'acc_ring_pass', name: 'Anel Rubro', slot: 'accessory', rarity: 2, atk: 10, icon: 'ps_ring', description: 'Anel raro: +10 de ataque (passe de batalha).' });

// ── trajes do Guerreiro: roupa inteira desenhada (corpo + roupa), cai dos chefes ──
/** id do traje → [nome, raridade] */
export const COSTUMES: Record<string, [string, number]> = {
  palha: ['Traje do Camponês', 1], ovelha: ['Traje de Ovelha', 1], chifres: ['Armadura de Chifres', 2],
  pistoleiro: ['Traje do Pistoleiro', 3], chama: ['Traje da Guarda da Chama', 3], principe: ['Traje do Príncipe', 4],
  nuvem: ['Armadura Dourada das Nuvens', 4],
};
for (const [t, [name, r]] of Object.entries(COSTUMES)) {
  const m = MULT[r];
  out.push({
    id: `cs_${t}`, name, slot: 'costume', rarity: r, setClass: 'warrior', category: 'costume', price: 0, dropOnly: true,
    def: round(2 * m), hp: Math.round(25 * m), icon: `pd_warrior_traje_${t}`,
    description: `Traje do Guerreiro (cai dos chefes). Veste o personagem inteiro.`,
  });
}

export const GEAR: EquipmentDef[] = out;

/** Recompensa de uma classe numa raridade: set (4 peças) + halo + arma preferida. */
export function setFor(classId: string | undefined, rarity: number): string[] {
  const cls = SET_OF[classId ?? 'warrior'] ?? 'warrior';
  const weapon = (PREFERRED[classId ?? 'warrior'] ?? ['sword'])[0];
  return [`hl_${rarity}`, ...PIECES.map((p) => `ar_${cls}_${p.key}_${rarity}`), `wp_${weapon}_${rarity}`];
}

export const SHOP_CATEGORIES: [string, string][] = [
  ['sword', 'Espadas'], ['dagger', 'Adagas'], ['staff', 'Cajados'],
  ['hl', 'Halos'], ['armor', 'Armaduras'], ['arms', 'Braços'], ['pants', 'Calças'], ['cape', 'Capas'],
  ['bt', 'Botas'], ['sh', 'Escudos'], ['au', 'Auras'], ['classic', 'Clássicos'],
];
