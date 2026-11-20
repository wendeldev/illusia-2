import { getItem, getNpc, QUESTS, type QuestDef, type QuestReward } from '../data';
import type { EnemyDef } from '../types';
import type { Progress } from './progress';

export type QuestStatus = 'offer' | 'active' | 'ready';

/** Regras das missões: o que cada NPC oferece, contagem e conclusão. */
export class QuestBook {
  constructor(private progress: Progress) {}

  target(q: QuestDef): number {
    return q.goal.kind === 'clear' ? 1 : q.goal.count;
  }

  count(q: QuestDef): number {
    if (q.goal.kind === 'collect') return Math.min(this.target(q), this.progress.bag[q.goal.itemId] ?? 0);
    return Math.min(this.target(q), this.progress.quests[q.id]?.count ?? 0);
  }

  isReady(q: QuestDef): boolean {
    return this.progress.quests[q.id]?.status === 'active' && this.count(q) >= this.target(q);
  }

  /** A missão atual do NPC (a primeira ainda não entregue), se houver. */
  current(npcId: string): { quest: QuestDef; status: QuestStatus } | null {
    for (const q of QUESTS) {
      if (q.giver !== npcId) continue;
      const st = this.progress.quests[q.id];
      if (st?.status === 'done') continue;
      if (st?.status === 'active') return { quest: q, status: this.isReady(q) ? 'ready' : 'active' };
      if (q.requiresStage && !this.progress.cleared.includes(q.requiresStage)) return null;
      return { quest: q, status: 'offer' };
    }
    return null;
  }

  mark(npcId: string): '!' | '?' | null {
    const c = this.current(npcId);
    return c?.status === 'offer' ? '!' : c?.status === 'ready' ? '?' : null;
  }

  active(): QuestDef[] {
    return QUESTS.filter((q) => this.progress.quests[q.id]?.status === 'active');
  }

  doneCount(): number {
    return QUESTS.filter((q) => this.progress.quests[q.id]?.status === 'done').length;
  }

  accept(q: QuestDef): void {
    const already = q.goal.kind === 'clear' && this.progress.cleared.includes(q.goal.stageId);
    this.progress.quests[q.id] = { status: 'active', count: already ? 1 : 0 };
  }

  /** Conta um inimigo derrotado. Retorna as missões que acabaram de ficar prontas. */
  onKill(def: EnemyDef, region: number | undefined): QuestDef[] {
    const done: QuestDef[] = [];
    for (const q of this.active()) {
      const g = q.goal;
      if (g.kind !== 'kill') continue;
      if (g.enemyIds && !g.enemyIds.includes(def.id)) continue;
      if (g.region !== undefined && g.region !== region) continue;
      const st = this.progress.quests[q.id];
      const before = st.count;
      st.count = Math.min(g.count, st.count + 1);
      if (before < g.count && st.count >= g.count) done.push(q);
    }
    return done;
  }

  onClear(stageId: string): QuestDef[] {
    const done: QuestDef[] = [];
    for (const q of this.active()) {
      if (q.goal.kind === 'clear' && q.goal.stageId === stageId && this.progress.quests[q.id].count < 1) {
        this.progress.quests[q.id].count = 1;
        done.push(q);
      }
    }
    return done;
  }

  complete(q: QuestDef): void {
    if (q.goal.kind === 'collect') this.progress.bag[q.goal.itemId] = Math.max(0, (this.progress.bag[q.goal.itemId] ?? 0) - q.goal.count);
    this.progress.quests[q.id] = { status: 'done', count: this.target(q) };
  }

  giverName(q: QuestDef): string {
    return getNpc(q.giver).name;
  }
}

export function rewardText(r: QuestReward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${r.gold} G`);
  if (r.exp) parts.push(`${r.exp} EXP`);
  if (r.item) parts.push(getItem(r.item).name);
  return parts.join(' + ');
}
