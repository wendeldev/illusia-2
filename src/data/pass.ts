// Passe de batalha: recompensas por nível do personagem. O grátis é resgatado ao chegar no nível;
// o pago (gemas) também exige o nível e custa gemas por recompensa. Armas: cada classe recebe a sua
// (espada, cajado ou adaga) no visual do passe.

export type PassGive =
  | { kind: 'bag'; id: string; n: number }
  | { kind: 'exp'; n: number }
  | { kind: 'gear'; id: string }
  /** arma da classe do jogador no estilo do passe (wp_<tipo>_<estilo>) */
  | { kind: 'classWeapon'; style: string }
  /** item raro aleatório da classe (como um baú de chefe) */
  | { kind: 'randomGear' }
  /** peças por classe (ar_<classe>_<peça>_<skin>) */
  | { kind: 'classPiece'; part: 'armor' | 'arms'; skin: string };

export interface PassReward {
  id: string;
  track: 'free' | 'paid';
  level: number;
  name: string;
  /** ícone (sprite) */
  icon: string;
  /** preço em gemas (passe pago) */
  gems?: number;
  give: PassGive[];
}

const R: PassReward[] = [];
const add = (track: PassReward['track'], level: number, name: string, icon: string, give: PassGive[], gems?: number) =>
  R.push({ id: `${track}_${level}_${R.filter((r) => r.track === track && r.level === level).length}`, track, level, name, icon, give, gems });

// ── grátis ──
for (let lv = 2; lv <= 6; lv++) add('free', lv, 'Consumíveis', 'ps_cons', [{ kind: 'bag', id: 'pot_hp', n: 3 }, { kind: 'bag', id: 'pot_mp', n: 3 }, ...(lv >= 5 ? [{ kind: 'bag', id: 'pot_hp2', n: 1 } as PassGive] : [])]);
for (let lv = 3; lv <= 10; lv++) add('free', lv, '500 XP', 'ps_xp', [{ kind: 'exp', n: 500 }]);
add('free', 7, 'Materiais raros', 'ps_mats', [{ kind: 'bag', id: 'm_sapphire', n: 3 }, { kind: 'bag', id: 'm_amethyst', n: 3 }, { kind: 'bag', id: 'm_ruby', n: 2 }]);
add('free', 8, 'Item raro', 'ps_chest', [{ kind: 'randomGear' }]);
add('free', 12, 'Tíquete de acesso', 'ps_tickets', [{ kind: 'bag', id: 'tk_legend', n: 1 }]);
add('free', 13, 'Tíquete de acesso', 'ps_tickets', [{ kind: 'bag', id: 'tk_legend', n: 1 }]);
add('free', 14, 'Anel +10 ataque', 'ps_ring', [{ kind: 'gear', id: 'acc_ring_pass' }]);
add('free', 15, 'Amuleto +12 defesa', 'ps_amulet', [{ kind: 'gear', id: 'acc_amulet_pass' }]);
add('free', 25, 'Aura de caveira', 'ps_skull', [{ kind: 'gear', id: 'au_skull' }]);
add('free', 26, 'Materiais raros', 'ps_mats', [{ kind: 'bag', id: 'm_gold', n: 3 }, { kind: 'bag', id: 'm_essence', n: 2 }]);
add('free', 26, 'Botas e luvas de fogo', 'ps_fire_boots', [{ kind: 'gear', id: 'bt_fire' }, { kind: 'classPiece', part: 'arms', skin: 'fire' }]);
add('free', 27, 'Armadura rara de fogo', 'ps_fire_armor', [{ kind: 'classPiece', part: 'armor', skin: 'fire' }]);
add('free', 40, 'Arma de luz branca', 'ps_staff_white', [{ kind: 'classWeapon', style: 'white' }]);
add('free', 40, 'Arma neon negra', 'ps_bow_black', [{ kind: 'classWeapon', style: 'black' }]);
add('free', 45, 'Arma rara neon', 'ps_swords_neon', [{ kind: 'classWeapon', style: 'violet' }]);

// ── pago (gemas) ──
for (let lv = 3; lv <= 10; lv++) add('paid', lv, '500 XP', 'ps_xp', [{ kind: 'exp', n: 500 }], 5);
add('paid', 12, 'Tíquete de acesso', 'ps_tickets', [{ kind: 'bag', id: 'tk_legend', n: 1 }], 25);
add('paid', 13, 'Tíquete de acesso', 'ps_tickets', [{ kind: 'bag', id: 'tk_myth', n: 1 }], 35);
add('paid', 25, 'Aura de chifre', 'ps_horns', [{ kind: 'gear', id: 'au_horns' }], 60);
add('paid', 26, 'Tíquete Mítico', 'ps_tickets', [{ kind: 'bag', id: 'tk_myth', n: 1 }], 40);
add('paid', 26, 'Botas e luvas de vaca', 'ps_cow_boots', [{ kind: 'gear', id: 'bt_cow' }, { kind: 'classPiece', part: 'arms', skin: 'cow' }], 60);
add('paid', 27, 'Macacão raro de vaca', 'ps_cow_suit', [{ kind: 'classPiece', part: 'armor', skin: 'cow' }], 90);
add('paid', 40, 'Arma neon verde', 'ps_bow_green', [{ kind: 'classWeapon', style: 'green' }], 120);
add('paid', 45, 'Arma neon esmeralda', 'ps_swords_green', [{ kind: 'classWeapon', style: 'emerald' }], 150);

export const PASS: PassReward[] = R.sort((a, b) => a.level - b.level);
