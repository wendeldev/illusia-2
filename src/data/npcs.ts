import type { NpcDef } from '../types';

export const NPCS: NpcDef[] = [
  {
    id: 'brida', name: 'Ferreira Brida', color: '#d9783f', action: 'shop',
    dialog: ['Bem-vindo à forja! Lâminas e armaduras feitas aqui mesmo.', 'Escolha com calma.'],
    shop: ['bronze_sword', 'moon_blade', 'rune_greatsword', 'leather_vest', 'chainmail', 'warden_plate', 'cloth_hood', 'iron_helm', 'sapphire_ring'],
  },
  {
    id: 'taro', name: 'Curandeiro Taro', color: '#7ac9a5', action: 'heal',
    dialog: ['Você parece cansado, viajante.', 'Deixe-me cuidar dessas feridas...'],
  },
  {
    id: 'ivy', name: 'Capitã Ivy', color: '#5b7bd6', action: 'talk',
    dialog: [
      'Monstros saem do Bosque Sussurrante toda noite.',
      'Limpe o bosque e a estrada para as Ruínas de Ferro vai abrir.',
      'Dizem que algo enorme cresce no fundo da Caverna Cinzenta...',
    ],
  },
];
