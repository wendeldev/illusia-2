// Simulação de balanceamento: percorre as 90 fases da campanha com um jogador "típico" (uma passada por fase,
// gasta o ouro no melhor equipamento da loja que couber) e mede, em cada fase:
//  - nível do jogador × nível dos monstros
//  - tempo para derrotar um monstro comum e o chefe (DPS do combo básico + poderes)
//  - quantos golpes o jogador aguenta de um monstro comum e do chefe
// Rode: npx esbuild tools/sim/balance.ts --bundle --platform=node --outfile=/tmp/bal.cjs --log-level=error && node /tmp/bal.cjs
import { CAMPAIGN } from '../../src/data/campaign';
import { ENEMIES } from '../../src/data/enemies';
import { CLASSES } from '../../src/data/classes';
import { GEAR, setFor } from '../../src/data/gear';
import { baseDamage, computeStats, enemyScale, expToNext } from '../../src/game/stats';
import { newProgress, type Progress } from '../../src/game/progress';
import { DIFFICULTIES, MYTHIC_BOSSES, bossId, minionId } from '../../src/data/mythic';

const byId = new Map(ENEMIES.map((e) => [e.id, e]));
const COMBO_MUL = (1 + 1.1 + 1.7) / 3;   // média dos 3 golpes
const COMBO_TIME = 0.22 + 0.22 + 0.36;   // segundos por combo (×speed da classe)
/** fração do tempo de luta em que o jogador realmente acerta (anda, desvia, espera o monstro) */
const UPTIME = 0.6;

function enemyAt(id: string, stageLevel: number) {
  const d = byId.get(id)!;
  // como no jogo: comum às vezes 1 nível acima (média +0,35), chefe intermediário +2, chefe da região +3
  const level = d.boss ? stageLevel + (d.hp >= 600 ? 3 : 2) : stageLevel + 0.35;
  return { d, level, ...enemyScale(d, level) };
}
const hit = (atk: number, def: number, mul = 1) => baseDamage(atk, def, mul);

/** Melhor raridade (0..) cujo set da classe + botas cabe no ouro gasto até agora (só o que a loja vende). */
function bestAffordable(cls: string, gold: number): number {
  let best = -1;
  for (let r = 0; r <= 6; r++) {
    const ids = [...setFor(cls, r), `bt_${r}`];
    const items = ids.map((id) => GEAR.find((g) => g.id === id)).filter(Boolean);
    if (items.some((e) => e!.dropOnly || e!.priceGems)) continue;
    const cost = items.reduce((a, e) => a + e!.price, 0);
    if (cost <= gold) best = r;
  }
  return best;
}

for (const cls of CLASSES) {
  const p: Progress = newProgress();
  p.classId = cls.id;
  let gold = 0, spent = 0, rarity = -1;
  const snapshots: { n: number; prog: Progress }[] = [];
  const rows: string[] = [];
  for (const st of CAMPAIGN) {
    const L = st.level!;
    const s = computeStats(p);
    const b = cls.basic;
    const rate = b.kind === 'melee' ? b.speed : b.rate, mulK = b.kind === 'melee' ? 1 : 0.9;
    const crit = 1 + Math.min(1, s.crit);
    // inimigos da fase
    const all = st.waves.flatMap((w) => w.enemies.flatMap((e) => Array(e.count).fill(e.enemyId)));
    const mobs = all.map((id) => enemyAt(id, L));
    const normal = mobs.filter((m) => !m.d.boss);
    const boss = mobs.find((m) => m.d.boss);
    const avg = (f: (m: (typeof mobs)[number]) => number, list = normal) => list.reduce((a, m) => a + f(m), 0) / Math.max(1, list.length);
    const ttk = (m: (typeof mobs)[number]) => m.hp / ((hit(s.atk, m.armor, COMBO_MUL * mulK) * 3 / (COMBO_TIME * rate)) * crit * UPTIME);
    const hitsToDie = (m: (typeof mobs)[number]) => s.maxHp / hit(m.atk, s.def);
    const n = st.index!;
    if ([40, 60, 80].includes(n)) snapshots.push({ n, prog: JSON.parse(JSON.stringify(p)) });
    if ([1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90].includes(n))
      rows.push([n, L, p.level, rarity, Math.round(s.atk), Math.round(s.maxHp), Math.round(s.def),
        avg(ttk).toFixed(1), boss ? ttk(boss).toFixed(0) : '-', avg(hitsToDie).toFixed(0), boss ? hitsToDie(boss).toFixed(1) : '-', Math.round(gold)].join('\t'));
    // recompensas da passada
    for (const m of mobs) {
      p.exp += m.exp;
      gold += m.gold;
      while (p.exp >= expToNext(p.level)) { p.exp -= expToNext(p.level); p.level++; }
    }
    // compra o melhor set que couber (gastando o ouro)
    const r = bestAffordable(cls.id, gold - spent + spent);
    if (r > rarity) {
      const ids = [...setFor(cls.id, r), `bt_${r}`];
      const cost = ids.reduce((a, id) => a + (GEAR.find((g) => g.id === id)?.price ?? 0), 0);
      if (cost <= gold) {
        gold -= cost;
        rarity = r;
        for (const id of ids) { const e = GEAR.find((g) => g.id === id)!; p.owned.push(id); p.equipped[e.slot] = id; }
      }
    }
  }
  console.log(`\n== ${cls.name} ==`);
  // eventos: o jogador como estava nas fases 40, 60 e 80 enfrenta a horda (fase 8) e o chefe
  const ev: string[] = [];
  for (const { n, prog } of snapshots) {
    const s2 = computeStats(prog);
    const b = cls.basic;
    const rate = b.kind === 'melee' ? b.speed : b.rate, mulK = b.kind === 'melee' ? 1 : 0.9;
    const crit = 1 + Math.min(1, s2.crit);
    for (const mb of [MYTHIC_BOSSES[0], MYTHIC_BOSSES[3]]) {
      DIFFICULTIES.forEach((D, di) => {
        const lvl = prog.level + D.levelAdd + 4;
        const one = (id: string) => { const d = byId.get(id)!; const sc = enemyScale(d, d.boss ? lvl + 3 : lvl); return { hp: sc.hp * D.hpMul, atk: sc.atk * D.atkMul, armor: sc.armor }; };
        const bossE = one(bossId(mb.key)), minion = one(minionId(mb.key, 0));
        const ttk = (m: { hp: number; armor: number }) => m.hp / ((hit(s2.atk, m.armor, COMBO_MUL * mulK) * 3 / (COMBO_TIME * rate)) * crit * UPTIME);
        ev.push(`fase ${n} (nív ${prog.level}) · ${mb.name} ${D.name}: chefe ${ttk(bossE).toFixed(0)} s / ${(s2.maxHp / hit(bossE.atk, s2.def)).toFixed(1)} golpes · horda ${ttk(minion).toFixed(1)} s / ${(s2.maxHp / hit(minion.atk, s2.def)).toFixed(0)} golpes`);
      });
    }
  }
  console.log('fase\tnívM\tnívJ\traridade\tATQ\tHP\tDEF\tTTK comum(s)\tTTK chefe(s)\tgolpes p/ morrer (comum)\t(chefe)\touro');
  console.log(rows.join('\n'));
  console.log(ev.join('\n'));
}
