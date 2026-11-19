import type { EquipmentDef } from '../types';

export const EQUIPMENT: EquipmentDef[] = [
  // Armas
  { id: 'training_sword', name: 'Espada de Treino', slot: 'weapon', atk: 4, price: 0, description: 'Leve e gasta.', look: { weapon: { blade: '#b8c0cc', hilt: '#8a5a2b', length: 15, width: 3 } } },
  { id: 'bronze_sword', name: 'Espada de Bronze', slot: 'weapon', atk: 9, price: 120, description: 'Confiável para iniciantes.', look: { weapon: { blade: '#d79b55', hilt: '#6b3f22', length: 18, width: 3.5 } } },
  { id: 'moon_blade', name: 'Lâmina Lunar', slot: 'weapon', atk: 16, crit: 0.05, price: 420, description: 'Brilha sob a lua.', look: { weapon: { blade: '#e4f4ff', hilt: '#4a5a9a', length: 20, width: 3, curve: true, glow: '#8fd8ff' } } },
  { id: 'rune_greatsword', name: 'Montante Rúnico', slot: 'weapon', atk: 27, price: 950, description: 'Pesado e gravado com runas.', look: { weapon: { blade: '#5d6675', hilt: '#2a2f3a', length: 27, width: 5.5, glow: '#5ff0e0' } } },
  // Armaduras
  { id: 'leather_vest', name: 'Gibão de Couro', slot: 'armor', def: 3, hp: 20, price: 80, description: 'Proteção básica.', look: { outfit: '#8a5a2b', trim: '#c79a5a', armor: 'leather' } },
  { id: 'chainmail', name: 'Cota de Malha', slot: 'armor', def: 7, hp: 45, price: 320, description: 'Anéis de aço entrelaçados.', look: { outfit: '#9aa3ad', trim: '#5d6675', armor: 'mail' } },
  { id: 'warden_plate', name: 'Placas do Vigia', slot: 'armor', def: 13, hp: 90, price: 850, description: 'Usada pelos guardas da muralha.', look: { outfit: '#c9d1da', trim: '#d9a83f', armor: 'plate' } },
  // Elmos
  { id: 'cloth_hood', name: 'Capuz de Pano', slot: 'helmet', def: 1, mp: 10, price: 50, description: 'Ajuda a concentrar.', look: { helmet: { style: 'hood', color: '#5b7a4f' } } },
  { id: 'iron_helm', name: 'Elmo de Ferro', slot: 'helmet', def: 4, hp: 25, price: 260, description: 'Amassado, mas resistente.', look: { helmet: { style: 'helm', color: '#8a929c' } } },
  // Acessórios
  { id: 'sapphire_ring', name: 'Anel de Safira', slot: 'accessory', mp: 30, price: 220, description: 'Aumenta a reserva de MP.', look: { pendant: '#4f8fe0' } },
  { id: 'falcon_amulet', name: 'Amuleto do Falcão', slot: 'accessory', atk: 3, crit: 0.08, price: 480, description: 'Olhos afiados, golpes certeiros.', look: { pendant: '#e0b04f' } },
];
