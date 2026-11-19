import type { NpcDef } from '../types';

export const NPCS: NpcDef[] = [
  {
    id: 'brida', sprite: 'npc_brida', name: 'Ferreira Brida', color: '#d9783f', action: 'shop', idle: 'hammer',
    look: { skin: '#e8b48f', hair: '#a8452a', hairStyle: 'bun', outfit: '#d9783f', trim: '#7a3f1f', apron: '#5a4030', prop: 'hammer' },
    dialog: ['Bem-vindo à forja! Lâminas e armaduras feitas aqui mesmo.', 'Escolha com calma.'],
    shop: [
      'bronze_sword', 'moon_blade', 'rune_greatsword', 'storm_saber', 'ember_blade', 'sun_greatsword',
      'leather_vest', 'chainmail', 'warden_plate', 'scale_mail', 'ember_plate', 'frost_guard', 'aegis_plate',
      'cloth_hood', 'iron_helm', 'horned_helm', 'crown_helm', 'sapphire_ring', 'ember_ring',
    ],
  },
  {
    id: 'taro', sprite: 'npc_taro', name: 'Curandeiro Taro', color: '#7ac9a5', action: 'heal', idle: 'still',
    look: { skin: '#d9a77f', hair: '#e8e8e8', hairStyle: 'short', outfit: '#7ac9a5', trim: '#f0e6c0', pants: '#4a6a5a', helmet: { style: 'hood', color: '#3f8a6a' }, prop: 'staff' },
    dialog: ['Você parece cansado, viajante.', 'Deixe-me cuidar dessas feridas...'],
  },
  {
    id: 'ivy', sprite: 'npc_ivy', name: 'Capitã Ivy', color: '#5b7bd6', action: 'talk', idle: 'still',
    look: { skin: '#f1c9a5', hair: '#2a2a3a', hairStyle: 'long', outfit: '#5b7bd6', trim: '#d9a83f', armor: 'mail', helmet: { style: 'captain', color: '#2f3f7a' }, prop: 'spear' },
    dialog: [
      'Monstros estão saindo de todos os cantos do reino.',
      'Use o portal no portão leste: ele abre o mapa do mundo.',
      'São 9 regiões, cada uma com um chefe no fim. Vença uma fase para liberar a próxima.',
      'Cuidado com o Deus das Trevas, lá nas Ilhas Celestes...',
    ],
  },
];
