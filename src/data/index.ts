import { ENEMIES } from './enemies';
import { EQUIPMENT } from './equipment';
import { NPCS } from './npcs';
import { QUESTS } from './quests';
import { MAP_PORTAL, STAGES, START_STAGE } from './stages';

export { ENEMIES, EQUIPMENT, MAP_PORTAL, NPCS, QUESTS, STAGES, START_STAGE };
export type { QuestDef, QuestGoal, QuestReward } from './quests';
export { CLASSES, DEFAULT_CLASS, getClass, type ClassDef } from './classes';
export { LEGACY_STAGE_IDS, REGIONS, STAGES_PER_REGION, stageId } from './campaign';

function index<T extends { id: string }>(list: T[], kind: string) {
  const map = new Map<string, T>();
  for (const item of list) {
    if (map.has(item.id)) throw new Error(`${kind} duplicado: ${item.id}`);
    map.set(item.id, item);
  }
  return (id: string): T => {
    const found = map.get(id);
    if (!found) throw new Error(`${kind} não encontrado: ${id}`);
    return found;
  };
}

export const getEnemy = index(ENEMIES, 'Inimigo');
export const getItem = index(EQUIPMENT, 'Equipamento');
export const getNpc = index(NPCS, 'NPC');
export const getStage = index(STAGES, 'Fase');
export const hasItem = (id: string) => EQUIPMENT.some((e) => e.id === id);
export const hasStage = (id: string) => STAGES.some((s) => s.id === id);

/** Verifica se todas as referências entre os dados existem (roda ao iniciar). */
export function validateContent(): void {
  getStage(START_STAGE);
  for (const s of STAGES) {
    s.npcs.forEach((n) => getNpc(n.npcId));
    s.portals.forEach((p) => { if (p.to !== MAP_PORTAL) getStage(p.to); if (p.requiresStage) getStage(p.requiresStage); });
    s.waves.forEach((w) => w.enemies.forEach((e) => getEnemy(e.enemyId)));
  }
  for (const n of NPCS) n.shop?.forEach(getItem);
  for (const e of ENEMIES) {
    e.drops?.forEach((d) => getItem(d.itemId));
    e.abilities?.forEach((a) => { if (a.kind === 'summon') getEnemy(a.enemyId); });
  }
  const questIds = new Set<string>();
  for (const q of QUESTS) {
    if (questIds.has(q.id)) throw new Error(`Missão duplicada: ${q.id}`);
    questIds.add(q.id);
    getNpc(q.giver);
    if (q.reward.item) getItem(q.reward.item);
    if (q.requiresStage) getStage(q.requiresStage);
    if (q.goal.kind === 'clear') getStage(q.goal.stageId);
    else if (q.goal.kind === 'kill') q.goal.enemyIds?.forEach(getEnemy);
  }
}
