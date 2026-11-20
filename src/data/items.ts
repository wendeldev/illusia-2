// Itens da bolsa (empilháveis): moedas, poções, baús, chaves, materiais, orbes, cartas,
// runas, tíquetes, coletáveis... O ícone é `it_<id>` no atlas de itens.

export type BagKind =
  | 'gem' | 'potion' | 'chest' | 'key' | 'crystal' | 'quest' | 'material' | 'orb' | 'card' | 'rune'
  | 'ticket' | 'collectible' | 'event' | 'evolution' | 'food';

export interface BagItem {
  id: string;
  name: string;
  kind: BagKind;
  description: string;
  /** preço na loja da ferreira (gold ou gemas); sem isso não é vendido */
  price?: { gold?: number; gems?: number };
  /** nível do baú/chave (0 madeira ... 6 angelical) */
  tier?: number;
}

/** Afinidade das classes: multiplicador do bônus de orbes, cartas e runas. */
export const AFFINITY: Record<string, Record<string, number>> = {
  warrior: { orb_fire: 1.2, orb_star: 1.8, orb_thunder: 1.2, card_blade: 1.5, card_guard: 1.6, rune_silver: 1.5, orb_prism: 1 },
  mage: { orb_fire: 1.5, orb_water: 2, orb_arcane: 1.8, card_life: 1.5, card_death: 1.4, rune_purple: 1.6, rune_green: 1.5 },
  assassin: { orb_wind: 2, orb_thunder: 1.5, card_star: 2, card_death: 1.5, card_blade: 1.2, rune_gold: 1.3 },
};

export function affinity(classId: string | undefined, itemId: string): number {
  return AFFINITY[classId ?? '']?.[itemId] ?? 1;
}

const I = (id: string, name: string, kind: BagKind, description: string, extra: Partial<BagItem> = {}): BagItem =>
  ({ id, name, kind, description, ...extra });

export const BAG_ITEMS: BagItem[] = [
  // gemas: só caem de chefes
  I('gem_blue', 'Safira', 'gem', 'Gema rara. Só cai de chefes. Usada em aprimoramentos e na loja.'),
  I('gem_red', 'Rubi', 'gem', 'Gema rara. Só cai de chefes.'),
  I('gem_purple', 'Ametista', 'gem', 'Gema rara. Só cai de chefes.'),
  I('gem_gold', 'Topázio', 'gem', 'Gema rara. Só cai de chefes.'),
  I('gem_rainbow', 'Prisma', 'gem', 'Gema lendária. Vale 5 gemas comuns.'),
  // poções
  I('pot_hp', 'Poção de Vida', 'potion', 'Recupera 40% da vida.', { price: { gold: 60 } }),
  I('pot_mp', 'Poção de Mana', 'potion', 'Recupera 40% do MP.', { price: { gold: 60 } }),
  I('pot_hp2', 'Poção de Vigor', 'potion', 'Recupera 70% da vida.', { price: { gold: 250 } }),
  I('pot_mp2', 'Poção Dourada', 'potion', 'Recupera 70% do MP.', { price: { gold: 250 } }),
  I('pot_mp3', 'Mana Rara', 'potion', 'Recupera todo o MP e zera a recarga dos poderes. Cai de chefes.'),
  I('pot_elixir', 'Elixir Alado', 'potion', 'Recupera toda a vida e o MP. Cai de chefes.'),
  I('pot_divine', 'Elixir Divino', 'potion', 'Vida e MP cheios e invencível por 5 s. Muito raro.'),
  // baús (abrem com a chave do mesmo nível ou maior)
  I('chest_wood', 'Baú de Madeira', 'chest', 'Precisa de uma Chave de Bronze.', { tier: 0 }),
  I('chest_iron', 'Baú de Ferro', 'chest', 'Precisa de uma Chave de Bronze.', { tier: 1 }),
  I('chest_blue', 'Baú Azul', 'chest', 'Precisa de uma Chave de Prata.', { tier: 2 }),
  I('chest_purple', 'Baú Arcano', 'chest', 'Precisa de uma Chave de Rubi.', { tier: 3 }),
  I('chest_gold', 'Baú Dourado', 'chest', 'Precisa de uma Chave de Ametista.', { tier: 4 }),
  I('chest_red', 'Baú Real', 'chest', 'Precisa de uma Chave de Ametista.', { tier: 5 }),
  I('chest_angel', 'Baú Angelical', 'chest', 'Precisa de uma Chave Angelical. Recompensas lendárias.', { tier: 6 }),
  // chaves
  I('key_bronze', 'Chave de Bronze', 'key', 'Abre baús de madeira e de ferro.', { tier: 1, price: { gold: 150 } }),
  I('key_silver', 'Chave de Prata', 'key', 'Abre baús azuis (e os de nível menor).', { tier: 2, price: { gold: 600 } }),
  I('key_ruby', 'Chave de Rubi', 'key', 'Abre baús arcanos.', { tier: 3, price: { gold: 2000 } }),
  I('key_amethyst', 'Chave de Ametista', 'key', 'Abre baús dourados e reais.', { tier: 5, price: { gems: 6 } }),
  I('key_angel', 'Chave Angelical', 'key', 'Abre qualquer baú, até o Angelical.', { tier: 6, price: { gems: 20 } }),
  // cristais (aprimoramento +4 a +6; caem de chefes intermediários e baús)
  I('cry_blue', 'Cristal Azul', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  I('cry_red', 'Cristal Vermelho', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  I('cry_green', 'Cristal Verde', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  I('cry_gold', 'Cristal Dourado', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  I('cry_purple', 'Cristal Roxo', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  I('cry_white', 'Cristal Celeste', 'crystal', 'Material de aprimoramento (+4 a +6).'),
  // itens de missão
  I('q_map', 'Mapa Rasgado', 'quest', 'Pedaço de um mapa antigo.'),
  I('q_scroll', 'Pergaminho Selado', 'quest', 'Uma mensagem misteriosa.'),
  I('q_letter', 'Carta Perdida', 'quest', 'Endereçada a alguém da vila.'),
  I('q_book', 'Grimório Antigo', 'quest', 'Páginas de magia esquecida.'),
  I('q_orb', 'Orbe da Visão', 'quest', 'Mostra lugares distantes.'),
  I('q_seal', 'Selo Solar', 'quest', 'Fragmento de um selo sagrado.'),
  I('q_amulet', 'Amuleto da Maré', 'quest', 'Relíquia das profundezas.'),
  // materiais (loja e drops)
  I('m_ore', 'Minério', 'material', 'Aprimoramento +1 a +3.', { price: { gold: 40 } }),
  I('m_iron', 'Barra de Ferro', 'material', 'Aprimoramento +4 a +6.', { price: { gold: 180 } }),
  I('m_gold', 'Barra de Ouro', 'material', 'Aprimoramento +7 a +10.', { price: { gold: 900 } }),
  I('m_sapphire', 'Safira Bruta', 'material', 'Material raro de forja.'),
  I('m_ruby', 'Rubi Bruto', 'material', 'Material raro de forja.'),
  I('m_amethyst', 'Ametista Bruta', 'material', 'Material raro de forja.'),
  I('m_herb', 'Erva Medicinal', 'material', 'O Taro usa para curar.'),
  I('m_wood', 'Madeira Nobre', 'material', 'Usada em cabos de armas.'),
  I('m_leather', 'Couro Curtido', 'material', 'Usado em botas e luvas.'),
  I('m_bone', 'Osso Antigo', 'material', 'Resto de monstros.'),
  I('m_essence', 'Essência Mágica', 'material', 'Aprimoramento +7 a +10.', { price: { gems: 2 } }),
  // orbes de habilidade (somam pontos permanentes; cada classe aproveita diferente)
  I('orb_fire', 'Orbe de Fogo', 'orb', '+1 de ataque por orbe. Melhor na Maga e no Guerreiro.'),
  I('orb_water', 'Orbe da Água', 'orb', '+4 de MP por orbe. Melhor na Maga.'),
  I('orb_wind', 'Orbe do Vento', 'orb', '+0,3% de crítico por orbe. Melhor no Assassino.'),
  I('orb_thunder', 'Orbe do Trovão', 'orb', '+1 de ataque por orbe. Melhor no Assassino.'),
  I('orb_arcane', 'Orbe Arcano', 'orb', '+2% de dano dos poderes por orbe. Melhor na Maga.'),
  I('orb_star', 'Orbe Estelar', 'orb', '+1 de defesa e +6 de vida por orbe. Melhor no Guerreiro.'),
  I('orb_prism', 'Orbe Prismático', 'orb', 'Um pouco de tudo.'),
  // cartas (2 espaços) e runas (1 espaço)
  I('card_blade', 'Carta da Lâmina', 'card', '+10% de ataque. Guerreiro aproveita 1,5×.'),
  I('card_guard', 'Carta do Escudo', 'card', '+12% de defesa e vida. Guerreiro aproveita 1,6×.'),
  I('card_life', 'Carta da Vida', 'card', '+12% de vida e regenera MP. Maga aproveita 1,5×.'),
  I('card_star', 'Carta da Estrela', 'card', '+6% de crítico. Assassino aproveita 2×.'),
  I('card_death', 'Carta da Morte', 'card', '+15% de dano dos poderes. Maga e Assassino aproveitam mais.'),
  I('rune_silver', 'Runa de Prata', 'rune', '-8% de dano recebido. Guerreiro aproveita 1,5×.'),
  I('rune_green', 'Runa da Natureza', 'rune', 'Regenera vida e MP. Maga aproveita 1,5×.'),
  I('rune_purple', 'Runa Arcana', 'rune', '-12% de recarga dos poderes. Maga aproveita 1,6×.'),
  I('rune_gold', 'Runa da Fortuna', 'rune', '+20% de ouro e EXP. Assassino aproveita 1,3×.'),
  // tíquetes
  I('t_bronze', 'Tíquete de Bronze', 'ticket', 'Entrada na Arena dos Chefes (fácil).', { price: { gold: 400 } }),
  I('t_blue', 'Tíquete Azul', 'ticket', 'Entrada na Arena dos Chefes (normal).', { price: { gold: 1500 } }),
  I('t_purple', 'Tíquete Arcano', 'ticket', 'Entrada na Arena dos Chefes (difícil).', { price: { gems: 4 } }),
  I('t_gold', 'Tíquete Dourado', 'ticket', 'Entrada na Arena dos Chefes (lendária).', { price: { gems: 10 } }),
  I('t_key', 'Passe de Evento', 'ticket', 'Começa um evento de tesouro na próxima fase.', { price: { gems: 3 } }),
  I('t_vip', 'Passe VIP', 'ticket', 'Dobra as recompensas da próxima arena.', { price: { gems: 8 } }),
  // coletáveis (álbum): cada 4 diferentes dão +2% de ataque e vida
  ...['d_orb_blue:Esfera Azul', 'd_orb_fire:Esfera de Fogo', 'd_orb_purple:Esfera Sombria', 'd_orb_green:Esfera Verde', 'd_amber:Âmbar',
    'd_moon:Fragmento Lunar', 'd_feather:Pena Branca', 'd_eye:Olho Maldito', 'd_spike:Espinho', 'd_fang:Presa', 'd_horn:Chifre',
    'd_batwing:Asa de Morcego', 'd_redfeather:Pena Rubra', 'd_flame:Chama Eterna', 'd_icecrystal:Gelo Eterno', 'd_void:Vórtice',
    's_blue:Alma Azul', 's_red:Alma Rubra', 's_green:Alma Verde', 's_gold:Alma Dourada', 's_purple:Alma Roxa', 's_white:Alma Pálida',
    's_pink:Alma Rosada', 's_void:Alma do Vazio', 'o_clover:Trevo', 'o_star:Estrela', 'o_star_blue:Estrela Azul']
    .map((s) => { const [id, name] = s.split(':'); return I(id, name, 'collectible', 'Coletável de inimigos. Complete o álbum!'); }),
  // itens de evento (raros)
  ...['e_wings:Broche Alado', 'e_crown:Coroa Perdida', 'e_rose:Rosa Eterna', 'e_ring:Anel do Juramento', 'e_tome:Tomo Proibido',
    'e_hourglass:Ampulheta do Tempo', 'e_snowflake:Floco Eterno', 'e_pumpkin:Abóbora Encantada']
    .map((s) => { const [id, name] = s.split(':'); return I(id, name, 'event', 'Item raro de evento. Cada um dá +3% de ataque e vida.'); }),
  // orbes de evolução (aprimoramento +7 a +10; caem de chefes finais)
  I('ev_green', 'Orbe de Evolução Verde', 'evolution', 'Aprimoramento +7 a +10.'),
  I('ev_blue', 'Orbe de Evolução Azul', 'evolution', 'Aprimoramento +7 a +10.'),
  I('ev_purple', 'Orbe de Evolução Roxo', 'evolution', 'Aprimoramento +7 a +10.'),
  I('ev_gold', 'Orbe de Evolução Dourado', 'evolution', 'Aprimoramento +7 a +10.'),
  I('ev_red', 'Orbe de Evolução Rubro', 'evolution', 'Aprimoramento +7 a +10.'),
  I('ev_crest', 'Brasão da Ascensão', 'evolution', 'Vale 3 orbes de evolução.'),
  I('ev_prism', 'Orbe Prismático da Ascensão', 'evolution', 'Vale 5 orbes de evolução.'),
  // comida (usada na hora ao pegar)
  ...['f_drumstick', 'f_steak', 'f_bread', 'f_apple', 'f_grapes', 'f_cheese', 'f_juice', 'f_honey', 'f_fish']
    .map((id) => I(id, 'Comida', 'food', 'Recupera 12% da vida ao pegar.')),
];

const BY_ID = new Map(BAG_ITEMS.map((b) => [b.id, b]));
export function bagItem(id: string): BagItem | undefined {
  return BY_ID.get(id);
}

/** Baú por nível do monstro (madeira até real). */
export function chestForLevel(level: number): string {
  const t = Math.min(5, Math.floor(level / 16));
  return ['chest_wood', 'chest_iron', 'chest_blue', 'chest_purple', 'chest_gold', 'chest_red'][t];
}

export function keyForLevel(level: number): string {
  const t = Math.min(5, Math.floor(level / 16));
  return ['key_bronze', 'key_bronze', 'key_silver', 'key_ruby', 'key_amethyst', 'key_amethyst'][t];
}

/** Chave mais fraca que abre o baú (de quem tem). */
export function keyFor(chestTier: number, bag: Record<string, number>): string | null {
  const keys = BAG_ITEMS.filter((b) => b.kind === 'key' && (b.tier ?? 0) >= Math.max(1, chestTier) && (bag[b.id] ?? 0) > 0);
  keys.sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
  return keys[0]?.id ?? null;
}

/** Itens vendidos pela ferreira (aba Materiais). */
export const SHOP_GOODS = BAG_ITEMS.filter((b) => b.price).map((b) => b.id);
