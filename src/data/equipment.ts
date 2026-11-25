import type { EquipmentDef } from '../types';
import { GEAR } from './gear';

export const EQUIPMENT: EquipmentDef[] = [
  // Armas
  { id: 'training_sword', name: 'Espada de Treino', slot: 'weapon', atk: 4, price: 0, description: 'Leve e gasta.', look: { weapon: { blade: '#b8c0cc', hilt: '#8a5a2b', length: 15, width: 3 } } },
  { id: 'bronze_sword', name: 'Espada de Bronze', slot: 'weapon', atk: 9, price: 120, description: 'Confiável para iniciantes.', look: { weapon: { blade: '#d79b55', hilt: '#6b3f22', length: 18, width: 3.5 } } },
  { id: 'moon_blade', rarity: 2, name: 'Lâmina Lunar', slot: 'weapon', atk: 16, crit: 0.05, price: 420, description: 'Brilha sob a lua.', look: { weapon: { blade: '#e4f4ff', hilt: '#4a5a9a', length: 20, width: 3, curve: true, glow: '#8fd8ff' } } },
  { id: 'rune_greatsword', name: 'Montante Rúnico', slot: 'weapon', atk: 27, price: 950, description: 'Pesado e gravado com runas.', look: { weapon: { blade: '#5d6675', hilt: '#2a2f3a', length: 27, width: 5.5, glow: '#5ff0e0' } } },
  { id: 'storm_saber', name: 'Sabre da Tempestade', slot: 'weapon', atk: 38, price: 2200, description: 'Estala com eletricidade.', look: { weapon: { blade: '#cfe0ff', hilt: '#3a4a90', length: 21, width: 3.5, curve: true, glow: '#ffe08a' } } },
  { id: 'ember_blade', name: 'Lâmina Brasa', slot: 'weapon', atk: 52, crit: 0.05, price: 4600, description: 'Forjada no coração do vulcão.', look: { weapon: { blade: '#ff9a3c', hilt: '#4a1a1a', length: 22, width: 4.5, glow: '#ff7a2a' } } },
  { id: 'frost_fang', rarity: 3, name: 'Presa Gélida', slot: 'weapon', atk: 68, price: 8200, description: 'Nunca derrete.', look: { weapon: { blade: '#dff4ff', hilt: '#5f90c0', length: 23, width: 4, curve: true, glow: '#9fd3ff' } } },
  { id: 'sun_greatsword', name: 'Montante Solar', slot: 'weapon', atk: 90, price: 14500, description: 'Brilha como o meio-dia.', look: { weapon: { blade: '#ffe08a', hilt: '#8a5a2b', length: 28, width: 6, glow: '#fff4c0' } } },
  { id: 'void_edge', rarity: 4, name: 'Fio do Vazio', slot: 'weapon', atk: 120, crit: 0.1, price: 25000, description: 'Corta até a escuridão.', look: { weapon: { blade: '#4a3a6a', hilt: '#1a1428', length: 25, width: 4, curve: true, glow: '#c49bff' } } },
  // Armaduras
  { id: 'leather_vest', name: 'Gibão de Couro', slot: 'armor', def: 3, hp: 20, price: 80, description: 'Proteção básica.', look: { outfit: '#8a5a2b', trim: '#c79a5a', armor: 'leather' } },
  { id: 'chainmail', name: 'Cota de Malha', slot: 'armor', def: 7, hp: 45, price: 320, description: 'Anéis de aço entrelaçados.', look: { outfit: '#9aa3ad', trim: '#5d6675', armor: 'mail' } },
  { id: 'warden_plate', name: 'Placas do Vigia', slot: 'armor', def: 13, hp: 90, price: 850, description: 'Usada pelos guardas da muralha.', look: { outfit: '#c9d1da', trim: '#d9a83f', armor: 'plate' } },
  { id: 'scale_mail', name: 'Cota de Escamas', slot: 'armor', def: 20, hp: 150, price: 2000, description: 'Escamas de dragão do pântano.', look: { outfit: '#5f8a6a', trim: '#c4a040', armor: 'mail' } },
  { id: 'ember_plate', name: 'Placas Brasa', slot: 'armor', def: 30, hp: 240, price: 5200, description: 'Quentes ao toque.', look: { outfit: '#a8452a', trim: '#ffb040', armor: 'plate' } },
  { id: 'frost_guard', name: 'Guarda Gélida', slot: 'armor', def: 42, hp: 360, price: 9800, description: 'Aço temperado no gelo eterno.', look: { outfit: '#9fc8e8', trim: '#e8f4ff', armor: 'plate' } },
  { id: 'aegis_plate', name: 'Placas Égide', slot: 'armor', def: 58, hp: 520, price: 18500, description: 'A armadura dos heróis antigos.', look: { outfit: '#f0e6c0', trim: '#d9a83f', armor: 'plate' } },
  // Elmos
  { id: 'cloth_hood', name: 'Capuz de Pano', slot: 'helmet', def: 1, mp: 10, price: 50, description: 'Ajuda a concentrar.', look: { helmet: { style: 'hood', color: '#5b7a4f' } } },
  { id: 'iron_helm', name: 'Elmo de Ferro', slot: 'helmet', def: 4, hp: 25, price: 260, description: 'Amassado, mas resistente.', look: { helmet: { style: 'helm', color: '#8a929c' } } },
  { id: 'horned_helm', name: 'Elmo Chifrudo', slot: 'helmet', def: 8, hp: 60, price: 1500, description: 'Assusta os lobos.', look: { helmet: { style: 'helm', color: '#a87a42' } } },
  { id: 'crown_helm', name: 'Elmo Coroado', slot: 'helmet', def: 16, hp: 140, mp: 30, price: 7200, description: 'Digno de um rei.', look: { helmet: { style: 'helm', color: '#d9a83f' } } },
  // Acessórios
  { id: 'sapphire_ring', name: 'Anel de Safira', slot: 'accessory', mp: 30, price: 220, description: 'Aumenta a reserva de MP.', look: { pendant: '#4f8fe0' } },
  { id: 'falcon_amulet', name: 'Amuleto do Falcão', slot: 'accessory', atk: 3, crit: 0.08, price: 480, description: 'Olhos afiados, golpes certeiros.', look: { pendant: '#e0b04f' } },
  { id: 'ember_ring', rarity: 2, name: 'Anel Brasa', slot: 'accessory', atk: 10, mp: 40, price: 2600, description: 'Aquece a lâmina.', look: { pendant: '#ff7a2a' } },
  { id: 'star_pendant', rarity: 4, name: 'Pingente Estelar', slot: 'accessory', atk: 20, crit: 0.12, mp: 60, price: 12500, description: 'Um pedaço do céu.', look: { pendant: '#fff4c0' } },
  // Botas
  { id: 'leather_boots', name: 'Botas de Couro', slot: 'boots', def: 2, hp: 15, price: 120, description: 'Confortáveis para longas viagens.', rarity: 0 },
  { id: 'iron_boots', name: 'Botas de Ferro', slot: 'boots', def: 6, hp: 50, price: 900, description: 'Pesadas, mas protegem bem.', rarity: 1 },
  { id: 'winged_boots', name: 'Botas Aladas', slot: 'boots', def: 10, hp: 90, crit: 0.04, price: 0, description: 'Leves como uma pena.', rarity: 2, dropOnly: true },
  { id: 'gold_boots', name: 'Botas Douradas', slot: 'boots', def: 18, hp: 180, atk: 6, price: 0, description: 'Usadas pelos reis antigos.', rarity: 3, dropOnly: true },
  // Luvas
  { id: 'leather_gloves', name: 'Luvas de Couro', slot: 'gloves', atk: 3, price: 150, description: 'Firmes no cabo da arma.', icon: 'it_glove_leather', rarity: 0 },
  { id: 'iron_gauntlets', name: 'Manoplas de Ferro', slot: 'gloves', atk: 8, def: 3, price: 1100, description: 'Socos que doem.', icon: 'it_glove_iron', rarity: 1 },
  { id: 'rune_gauntlets', name: 'Manoplas Rúnicas', slot: 'gloves', atk: 16, crit: 0.05, mp: 30, price: 0, description: 'Runas brilham a cada golpe.', icon: 'it_glove_rune', rarity: 2, dropOnly: true },
  { id: 'dragon_gauntlets', name: 'Garras de Dragão', slot: 'gloves', atk: 30, crit: 0.08, price: 0, description: 'Forjadas com escamas de dragão.', icon: 'it_glove_dragon', rarity: 4, dropOnly: true },
  ...GEAR,
];
