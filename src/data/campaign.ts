// Campanha: 9 regiões × 10 fases, geradas a partir de regras simples.
// Para mudar a campanha, edite REGIONS (nomes, cenário, inimigos e chefes)
// ou as regras em makeStage().
import type { Mood, SceneryTheme, StageDef, WaveDef } from '../types';

export interface RegionDef {
  name: string;
  theme: SceneryTheme;
  /** inimigos comuns, do mais fraco ao mais forte */
  roster: string[];
  /** chefe intermediário (fase 5) */
  elite: string;
  /** chefe da região (fase 10) */
  boss: string;
}

export const REGIONS: RegionDef[] = [
  { name: 'Bosque Sussurrante', theme: 'forest', roster: ['moss_slime', 'shadow_wolf', 'leaf_bat'], elite: 'alpha_wolf', boss: 'moss_guardian' },
  { name: 'Pântano Nebuloso', theme: 'swamp', roster: ['bog_slime', 'marsh_bat', 'swamp_shroom'], elite: 'toad_king', boss: 'plague_shroom' },
  { name: 'Ruínas de Ferro', theme: 'ruins', roster: ['stone_slime', 'sand_jackal', 'rust_golem'], elite: 'iron_sentinel', boss: 'iron_colossus' },
  { name: 'Dunas Rubras', theme: 'desert', roster: ['sand_slime', 'dune_hound', 'vulture'], elite: 'scarab', boss: 'golden_jackal' },
  { name: 'Caverna Cinzenta', theme: 'cave', roster: ['crystal_slime', 'cave_bat', 'cave_golem'], elite: 'crystal_golem', boss: 'fungus_king' },
  { name: 'Picos Gelados', theme: 'snow', roster: ['frost_slime', 'snow_wolf', 'ice_golem'], elite: 'yeti', boss: 'frost_ancient' },
  { name: 'Vulcão Ardente', theme: 'volcano', roster: ['magma_slime', 'fire_bat', 'magma_golem'], elite: 'salamander', boss: 'lava_lord' },
  { name: 'Cidadela Sombria', theme: 'castle', roster: ['shadow_slime', 'dread_wolf', 'gargoyle', 'dark_armor'], elite: 'night_knight', boss: 'shadow_beast' },
  { name: 'Ilhas Celestes', theme: 'sky', roster: ['cloud_slime', 'storm_bat', 'sky_golem'], elite: 'griffin', boss: 'storm_emperor' },
];

export const STAGES_PER_REGION = 10;

export const stageId = (n: number) => `s${String(n).padStart(2, '0')}`;

/** Ids antigos (versão com 3 fases) → novos, para não perder o progresso salvo. */
export const LEGACY_STAGE_IDS: Record<string, string> = { whisper_woods: 's01', iron_ruins: 's02', gray_cave: 's03' };

function rand(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function moodFor(theme: SceneryTheme, s: number): Mood {
  if (theme === 'cave') return 'day';
  if (s <= 4) return 'day';
  if (s <= 7) return 'dusk';
  return 'night';
}

function makeStage(r: number, s: number): StageDef {
  const region = REGIONS[r];
  const n = r * STAGES_PER_REGION + s; // 1..90
  const width = 1700 + s * 90;
  const depth = region.theme === 'cave' ? 140 : 150;
  const waveCount = 3 + Math.floor((s - 1) / 3); // 3..6
  const waves: WaveDef[] = [];
  const first = 330, last = width - 520;
  for (let w = 0; w < waveCount; w++) {
    const triggerX = Math.round(first + ((last - first) * w) / Math.max(1, waveCount - 1));
    const isFinal = w === waveCount - 1;
    const enemies: WaveDef['enemies'] = [];
    if (isFinal && s === STAGES_PER_REGION) {
      enemies.push({ enemyId: region.boss, count: 1 }, { enemyId: region.roster[0], count: 2 });
    } else if (isFinal && s === 5) {
      enemies.push({ enemyId: region.elite, count: 1 }, { enemyId: region.roster[1], count: 2 });
    } else {
      // mistura de inimigos: mais e mais variados conforme avança
      const total = Math.min(8, 3 + Math.floor(s / 3) + Math.floor(r / 3) + (w > 1 ? 1 : 0));
      const kinds = Math.min(region.roster.length, 1 + Math.floor((s + w) / 3));
      const counts = new Map<string, number>();
      for (let k = 0; k < total; k++) {
        const id = region.roster[Math.floor(rand(n * 100 + w * 10 + k) * kinds)];
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      // golens são lentos e fortes: no máximo 2 por onda
      for (const [id, c] of counts) enemies.push({ enemyId: id, count: id.includes('golem') || id === 'dark_armor' ? Math.min(c, 2) : c });
    }
    waves.push({ triggerX, enemies });
  }
  const isLast = n === REGIONS.length * STAGES_PER_REGION;
  const nextR = Math.floor(n / STAGES_PER_REGION), nextS = (n % STAGES_PER_REGION) + 1;
  const nextLabel = isLast ? 'Vila de Lumen' : `Próxima: ${REGIONS[nextR].name} ${nextR + 1}-${nextS}`;
  return {
    id: stageId(n),
    name: `${region.name} ${r + 1}-${s}`,
    width, depth,
    theme: region.theme,
    mood: moodFor(region.theme, s),
    power: 1 + (n - 1) * 0.11,
    region: r,
    index: n,
    spawn: { x: 90, y: 75 },
    npcs: [],
    portals: [
      { x: 40, y: 75, to: 'lumen', label: 'Voltar à vila' },
      { x: width - 60, y: 75, to: isLast ? 'lumen' : stageId(n + 1), label: nextLabel, requiresClear: true },
    ],
    waves,
  };
}

export const CAMPAIGN: StageDef[] = REGIONS.flatMap((_, r) =>
  Array.from({ length: STAGES_PER_REGION }, (_, i) => makeStage(r, i + 1)));
