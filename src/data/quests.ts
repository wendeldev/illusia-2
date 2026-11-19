// Missões dos NPCs. Cada NPC oferece as suas em ordem: a próxima só aparece
// depois de entregar a anterior (e, se tiver `requiresStage`, depois de vencer essa fase).

export type QuestGoal =
  /** derrotar inimigos (de uma lista de tipos e/ou de uma região; vazio = qualquer um) */
  | { kind: 'kill'; count: number; enemyIds?: string[]; region?: number; label: string }
  /** vencer uma fase */
  | { kind: 'clear'; stageId: string; label: string };

export interface QuestReward {
  gold?: number;
  exp?: number;
  item?: string;
}

export interface QuestDef {
  id: string;
  /** id do NPC que dá a missão */
  giver: string;
  title: string;
  /** falas ao oferecer a missão */
  intro: string[];
  goal: QuestGoal;
  reward: QuestReward;
  /** fala ao entregar */
  thanks: string;
  requiresStage?: string;
}

const SLIMES = ['moss_slime', 'bog_slime', 'stone_slime', 'sand_slime', 'crystal_slime', 'frost_slime', 'magma_slime', 'shadow_slime', 'cloud_slime'];
const WOLVES = ['shadow_wolf', 'sand_jackal', 'dune_hound', 'snow_wolf', 'dread_wolf', 'alpha_wolf'];
const FLYERS = ['leaf_bat', 'marsh_bat', 'vulture', 'cave_bat', 'fire_bat', 'gargoyle', 'storm_bat'];
const GOLEMS = ['rust_golem', 'cave_golem', 'ice_golem', 'magma_golem', 'dark_armor', 'sky_golem'];

const boss = (enemyId: string, label: string): QuestGoal => ({ kind: 'kill', count: 1, enemyIds: [enemyId], label });

export const QUESTS: QuestDef[] = [
  // ── Capitã Ivy: a história (chefes das regiões) ──
  {
    id: 'ivy1', giver: 'ivy', title: 'O guardião do bosque',
    intro: ['Algo desperta no fundo do Bosque Sussurrante.', 'Os lenhadores falam de um gigante coberto de musgo. Derrote-o.'],
    goal: boss('moss_guardian', 'Derrote o Guardião Musgoso (1-10)'),
    reward: { gold: 300, exp: 250 }, thanks: 'O bosque está em paz de novo. Bom trabalho, recruta!',
  },
  {
    id: 'ivy2', giver: 'ivy', title: 'Névoa venenosa',
    intro: ['Uma névoa roxa sobe do Pântano Nebuloso.', 'Dizem que vem de um fungo enorme. Acabe com ele.'],
    goal: boss('plague_shroom', 'Derrote o Fungo Pestilento (2-10)'),
    reward: { gold: 700, exp: 700, item: 'chainmail' }, thanks: 'A névoa sumiu. Leve esta cota de malha, vai precisar.',
  },
  {
    id: 'ivy3', giver: 'ivy', title: 'O colosso desperto',
    intro: ['As Ruínas de Ferro tremem toda noite.', 'Um colosso antigo voltou a andar. Pare-o antes que chegue à vila.'],
    goal: boss('iron_colossus', 'Derrote o Colosso de Ferro (3-10)'),
    reward: { gold: 1400, exp: 1500 }, thanks: 'Você derrubou um colosso! A vila inteira fala de você.',
  },
  {
    id: 'ivy4', giver: 'ivy', title: 'O chacal dourado',
    intro: ['Caravanas somem nas Dunas Rubras.', 'Os sobreviventes falam de um chacal que brilha como ouro.'],
    goal: boss('golden_jackal', 'Derrote o Chacal Dourado (4-10)'),
    reward: { gold: 2400, exp: 2800, item: 'horned_helm' }, thanks: 'As caravanas voltaram a passar. Este elmo é seu.',
  },
  {
    id: 'ivy5', giver: 'ivy', title: 'O rei sob a terra',
    intro: ['Os mineiros fugiram da Caverna Cinzenta.', 'Um fungo coroado governa lá embaixo.'],
    goal: boss('fungus_king', 'Derrote o Rei Fungo (5-10)'),
    reward: { gold: 3800, exp: 4500 }, thanks: 'Sem o rei, os fungos se espalharam e sumiram. Ótimo!',
  },
  {
    id: 'ivy6', giver: 'ivy', title: 'Inverno sem fim',
    intro: ['Nos Picos Gelados a neve não para de cair.', 'Um golem ancestral de gelo está por trás disso.'],
    goal: boss('frost_ancient', 'Derrote o Golem Ancestral de Gelo (6-10)'),
    reward: { gold: 5500, exp: 7000 }, thanks: 'A primavera chegou aos picos. Obrigada!',
  },
  {
    id: 'ivy7', giver: 'ivy', title: 'O senhor da lava',
    intro: ['O Vulcão Ardente vai entrar em erupção.', 'O Senhor da Lava está acordando. Só você pode impedi-lo.'],
    goal: boss('lava_lord', 'Derrote o Senhor da Lava (7-10)'),
    reward: { gold: 8000, exp: 10000, item: 'ember_plate' }, thanks: 'O vulcão se acalmou. Estas placas foram forjadas na lava dele.',
  },
  {
    id: 'ivy8', giver: 'ivy', title: 'A fera das trevas',
    intro: ['A Cidadela Sombria foi tomada pela escuridão.', 'Uma fera feita de sombras caça quem se aproxima.'],
    goal: boss('shadow_beast', 'Derrote a Fera das Trevas (8-10)'),
    reward: { gold: 11000, exp: 14000 }, thanks: 'A luz voltou à cidadela. Falta só uma ameaça...',
  },
  {
    id: 'ivy9', giver: 'ivy', title: 'A última tempestade',
    intro: ['Tudo começou nas Ilhas Celestes.', 'O Imperador da Tempestade comanda os monstros. Esta é a batalha final.'],
    goal: boss('storm_emperor', 'Derrote o Imperador da Tempestade (9-10)'),
    reward: { gold: 20000, exp: 20000, item: 'aegis_plate' }, thanks: 'Você salvou o reino! Lumen nunca vai esquecer seu nome.',
  },

  // ── Curandeiro Taro: caçadas ──
  {
    id: 'taro1', giver: 'taro', title: 'Lodo nas ervas',
    intro: ['Os lodos estão comendo minhas ervas medicinais.', 'Pode afastar alguns deles para mim?'],
    goal: { kind: 'kill', count: 12, enemyIds: SLIMES, label: 'Derrote 12 lodos' },
    reward: { gold: 150, exp: 120, item: 'cloth_hood' }, thanks: 'Minhas ervas agradecem! Tome este capuz, ajuda a concentrar.',
  },
  {
    id: 'taro2', giver: 'taro', title: 'Uivos na noite',
    intro: ['Lobos rondam a estrada à noite.', 'Os viajantes chegam aqui feridos. Cace alguns.'],
    goal: { kind: 'kill', count: 15, enemyIds: WOLVES, label: 'Derrote 15 lobos ou chacais' },
    reward: { gold: 600, exp: 600 }, thanks: 'A estrada está mais segura. Obrigado!', requiresStage: 's05',
  },
  {
    id: 'taro3', giver: 'taro', title: 'Asas na escuridão',
    intro: ['Morcegos e abutres atacam quem colhe ervas.', 'Derrube as criaturas voadoras.'],
    goal: { kind: 'kill', count: 20, enemyIds: FLYERS, label: 'Derrote 20 criaturas voadoras' },
    reward: { gold: 1600, exp: 1800, item: 'sapphire_ring' }, thanks: 'Céu limpo! Este anel guarda mais energia para seus poderes.', requiresStage: 's25',
  },
  {
    id: 'taro4', giver: 'taro', title: 'Cristais curativos',
    intro: ['Os cristais da caverna curam qualquer ferida.', 'Mas monstros guardam todos eles. Abra caminho.'],
    goal: { kind: 'kill', count: 30, region: 4, label: 'Derrote 30 inimigos na Caverna Cinzenta' },
    reward: { gold: 3000, exp: 4000 }, thanks: 'Com estes cristais vou curar a vila inteira!', requiresStage: 's41',
  },
  {
    id: 'taro5', giver: 'taro', title: 'Flor de fogo',
    intro: ['Uma flor rara cresce na beira da lava.', 'Os monstros do vulcão não deixam ninguém chegar perto.'],
    goal: { kind: 'kill', count: 35, region: 6, label: 'Derrote 35 inimigos no Vulcão Ardente' },
    reward: { gold: 7000, exp: 9000, item: 'ember_ring' }, thanks: 'A flor de fogo! Fiz este anel com as pétalas.', requiresStage: 's61',
  },

  // ── Ferreira Brida: materiais para a forja ──
  {
    id: 'brida1', giver: 'brida', title: 'Ferro velho',
    intro: ['Estou sem ferro para a forja!', 'Os golens são feitos de metal... derrote alguns e me traga os restos.'],
    goal: { kind: 'kill', count: 6, enemyIds: GOLEMS, label: 'Derrote 6 golens' },
    reward: { gold: 400, item: 'iron_helm' }, thanks: 'Ferro de primeira! Forjei este elmo para você.', requiresStage: 's21',
  },
  {
    id: 'brida2', giver: 'brida', title: 'Escamas do brejo',
    intro: ['Quero fazer uma armadura de escamas.', 'O material vem dos monstros do Pântano Nebuloso.'],
    goal: { kind: 'kill', count: 25, region: 1, label: 'Derrote 25 inimigos no Pântano Nebuloso' },
    reward: { gold: 800, item: 'scale_mail' }, thanks: 'Ficou linda! A Cota de Escamas é sua.', requiresStage: 's15',
  },
  {
    id: 'brida3', giver: 'brida', title: 'Areia da forja',
    intro: ['A areia rubra das dunas deixa o aço mais forte.', 'Vença o chefe das dunas e traga areia do covil dele.'],
    goal: { kind: 'clear', stageId: 's40', label: 'Vença a fase 4-10' },
    reward: { gold: 1500, item: 'storm_saber' }, thanks: 'Com essa areia fiz um sabre que estala de energia!',
  },
  {
    id: 'brida4', giver: 'brida', title: 'Gelo eterno',
    intro: ['Gelo que nunca derrete... imagine uma lâmina disso!', 'Derrote os golens e lodos dos Picos Gelados.'],
    goal: { kind: 'kill', count: 20, enemyIds: ['ice_golem', 'frost_slime', 'yeti'], label: 'Derrote 20 golens de gelo, lodos gélidos ou yetis' },
    reward: { gold: 4000, item: 'frost_fang' }, thanks: 'A Presa Gélida! Minha melhor obra até hoje.', requiresStage: 's55',
  },
  {
    id: 'brida5', giver: 'brida', title: 'Metal das estrelas',
    intro: ['Nas Ilhas Celestes caem pedaços de estrela.', 'Os golens celestes guardam esse metal.'],
    goal: { kind: 'kill', count: 12, enemyIds: ['sky_golem', 'griffin'], label: 'Derrote 12 golens celestes ou grifos' },
    reward: { gold: 9000, item: 'sun_greatsword' }, thanks: 'O Montante Solar brilha como o meio-dia. É seu!', requiresStage: 's83',
  },
];
