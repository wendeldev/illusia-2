import type { EquipmentDef } from '../types';

export const EQUIPMENT: EquipmentDef[] = [
  // Armas
  { id: 'training_sword', name: 'Espada de Treino', slot: 'weapon', atk: 4, price: 0, description: 'Leve e gasta.' },
  { id: 'bronze_sword', name: 'Espada de Bronze', slot: 'weapon', atk: 9, price: 120, description: 'Confiável para iniciantes.' },
  { id: 'moon_blade', name: 'Lâmina Lunar', slot: 'weapon', atk: 16, crit: 0.05, price: 420, description: 'Brilha sob a lua.' },
  { id: 'rune_greatsword', name: 'Montante Rúnico', slot: 'weapon', atk: 27, price: 950, description: 'Pesado e gravado com runas.' },
  // Armaduras
  { id: 'leather_vest', name: 'Gibão de Couro', slot: 'armor', def: 3, hp: 20, price: 80, description: 'Proteção básica.' },
  { id: 'chainmail', name: 'Cota de Malha', slot: 'armor', def: 7, hp: 45, price: 320, description: 'Anéis de aço entrelaçados.' },
  { id: 'warden_plate', name: 'Placas do Vigia', slot: 'armor', def: 13, hp: 90, price: 850, description: 'Usada pelos guardas da muralha.' },
  // Elmos
  { id: 'cloth_hood', name: 'Capuz de Pano', slot: 'helmet', def: 1, mp: 10, price: 50, description: 'Ajuda a concentrar.' },
  { id: 'iron_helm', name: 'Elmo de Ferro', slot: 'helmet', def: 4, hp: 25, price: 260, description: 'Amassado, mas resistente.' },
  // Acessórios
  { id: 'sapphire_ring', name: 'Anel de Safira', slot: 'accessory', mp: 30, price: 220, description: 'Aumenta a reserva de MP.' },
  { id: 'falcon_amulet', name: 'Amuleto do Falcão', slot: 'accessory', atk: 3, crit: 0.08, price: 480, description: 'Olhos afiados, golpes certeiros.' },
];
