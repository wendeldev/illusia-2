// Interface em HTML sobre o canvas: título, seleção de classe, menu, diálogos e morte.
import { CLASSES } from './data/classes.js';
import { SKILLS } from './data/skills.js';
import { NPCS, QUESTS, HONORS } from './data/world.js';
import { CONSUMABLES, QUEST_ITEMS, RARITY, SLOT_NAMES, fmtStat } from './data/items.js';
import { ATTRS, expToNext } from './game/stats.js';
import { newSave, loadSave, deleteSave } from './game/game.js';
import { sfx, initAudio, setMuted, isMuted } from './engine/audio.js';

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class UI {
  constructor() {
    this.root = $('#overlay');
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);
    this.tab = 'char';
    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      initAudio();
      sfx('ui');
      this.act(el.dataset.act, el.dataset.arg);
    });
  }

  bind(game) { this.game = game; }

  show(html, cls = '') {
    this.root.innerHTML = `<div class="panel ${cls}">${html}</div>`;
    this.root.hidden = false;
    if (this.game) this.game.paused = true;
  }
  hide() {
    this.root.hidden = true; this.root.innerHTML = '';
    if (this.game) { this.game.paused = false; this.game.input.clear(); }
    this.mode = null;
  }

  // ---------- Título ----------
  showTitle() {
    this.mode = 'title';
    const save = loadSave();
    this.show(`
      <h1 class="logo">Ecos de Aurora</h1>
      <p class="tagline">Um RPG de ação 2D</p>
      <div class="col">
        ${save ? `<button class="big" data-act="continue">Continuar <small>${esc(CLASSES[save.cls].name)} • Nv. ${save.level}</small></button>` : ''}
        <button class="big" data-act="new">Novo jogo</button>
      </div>
      <p class="hint">${this.touch ? 'Gire o celular na horizontal para jogar.' : 'Setas/WASD mover • Espaço pular • J atacar • L dash • U/I/O habilidades • Q/E poções • ↑ interagir • Esc menu'}</p>
    `, 'title');
  }

  showClassSelect() {
    this.mode = 'classes';
    const cards = Object.entries(CLASSES).map(([id, c]) => `
      <button class="card" data-act="pick" data-arg="${id}" style="--c:${c.color}">
        <span class="swatch"></span>
        <b>${esc(c.name)}</b><small>${esc(c.role)}</small>
        <p>${esc(c.desc)}</p>
        <ul>
          <li>HP ${c.base.hp} • MP ${c.base.mp}</li>
          <li>ATQ ${c.base.atk} • DEF ${c.base.def}</li>
          <li>Crítico ${Math.round(c.base.crit * 100)}%</li>
        </ul>
      </button>`).join('');
    this.show(`<h2>Escolha sua classe</h2><div class="cards">${cards}</div>
      <button data-act="title">Voltar</button>`, 'wide');
  }

  // ---------- Menu ----------
  openMenu(tab) {
    if (tab) this.tab = tab;
    this.mode = 'menu';
    const tabs = [['char', 'Personagem'], ['inv', 'Inventário'], ['skills', 'Habilidades'], ['quests', 'Missões'], ['honors', 'Conquistas'], ['system', 'Sistema']];
    const body = { char: () => this.charTab(), inv: () => this.invTab(), skills: () => this.skillsTab(), quests: () => this.questsTab(), honors: () => this.honorsTab(), system: () => this.systemTab() }[this.tab]();
    this.show(`
      <div class="tabs">${tabs.map(([id, n]) => `<button class="${this.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${n}</button>`).join('')}
        <button class="close" data-act="close">✕</button></div>
      <div class="tabbody">${body}</div>`, 'menu');
  }

  charTab() {
    const g = this.game, s = g.stats, save = g.save, c = CLASSES[save.cls];
    const rows = Object.entries(ATTRS).map(([k, a]) => `
      <tr><td>${a.name}<small>${a.desc}</small></td><td class="num">${save.alloc[k]}</td>
      <td>${save.points > 0 ? `<button class="mini" data-act="alloc" data-arg="${k}">+</button>` : ''}</td></tr>`).join('');
    const eq = Object.keys(SLOT_NAMES).map((slot) => {
      const it = save.equip[slot];
      return `<div class="slot"><small>${SLOT_NAMES[slot]}</small>${it ? this.itemLabel(it) + `<button class="mini" data-act="unequip" data-arg="${slot}">Tirar</button>` : '<i>vazio</i>'}</div>`;
    }).join('');
    return `
      <div class="grid2">
        <div>
          <h3>${esc(c.name)} • Nível ${save.level}</h3>
          <p class="muted">EXP ${save.exp} / ${expToNext(save.level)}</p>
          <table class="stats">
            <tr><td>HP</td><td class="num">${Math.ceil(save.hp)} / ${s.maxHp}</td></tr>
            <tr><td>MP</td><td class="num">${Math.floor(save.mp)} / ${s.maxMp}</td></tr>
            <tr><td>Ataque</td><td class="num">${s.atk}</td></tr>
            <tr><td>Defesa</td><td class="num">${s.def}</td></tr>
            <tr><td>Crítico</td><td class="num">${(s.crit * 100).toFixed(1)}%</td></tr>
            <tr><td>Poder de habilidade</td><td class="num">${Math.round(s.skillPower * 100)}%</td></tr>
            <tr><td>Ouro</td><td class="num">${save.gold}</td></tr>
          </table>
        </div>
        <div>
          <h3>Atributos <span class="pill">${save.points} pontos</span></h3>
          <table class="stats">${rows}</table>
          <h3>Equipamento</h3>${eq}
        </div>
      </div>`;
  }

  itemLabel(it) {
    const stats = Object.entries(it.stats).map(([k, v]) => fmtStat(k, v)).join(' • ');
    return `<span class="item" style="color:${RARITY[it.rarity].color}">${esc(it.name)}</span><small>Nv. ${it.level} • ${stats}</small>`;
  }

  invTab() {
    const save = this.game.save;
    const items = save.inventory.map((it, i) => {
      if (it.kind === 'equip') {
        const cur = save.equip[it.slot];
        const diff = Object.entries(it.stats).map(([k, v]) => {
          const d = +(v - ((cur && cur.stats[k]) || 0)).toFixed(3);
          return d ? `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}</span>` : '';
        }).join('');
        const canEquip = !it.cls || it.cls === save.cls;
        return `<div class="inv-row"><div>${this.itemLabel(it)} <small>${SLOT_NAMES[it.slot]} ${diff}</small></div>
          <div class="actions">${canEquip ? `<button class="mini" data-act="equip" data-arg="${i}">Equipar</button>` : '<small>outra classe</small>'}
          <button class="mini ghost" data-act="sell" data-arg="${i}">Vender ${it.value}</button></div></div>`;
      }
      const def = it.kind === 'cons' ? CONSUMABLES[it.id] : QUEST_ITEMS[it.id];
      return `<div class="inv-row"><div><span class="item" style="color:${def.color}">${esc(def.name)} ×${it.qty}</span><small>${esc(def.desc)}</small></div>
        <div class="actions">${it.kind === 'cons' ? `<button class="mini" data-act="use" data-arg="${it.id}">Usar</button>` : '<small>item de missão</small>'}</div></div>`;
    }).join('');
    return `<p class="muted">${save.inventory.length}/30 espaços • ${save.gold} ouro</p>
      ${items || '<p class="muted">Vazio.</p>'}`;
  }

  skillsTab() {
    const save = this.game.save;
    const keys = this.touch ? ['1', '2', '3'] : ['U', 'I', 'O'];
    return CLASSES[save.cls].skills.map((id, i) => {
      const sk = SKILLS[id], locked = save.level < sk.unlock;
      return `<div class="skill ${locked ? 'locked' : ''}"><span class="glyph" style="color:${sk.color}">${sk.glyph}</span>
        <div><b>${esc(sk.name)}</b> <small>[${keys[i]}] • ${sk.mp} MP • recarga ${(sk.cd / 60).toFixed(1)}s ${locked ? `• desbloqueia no Nv. ${sk.unlock}` : ''}</small>
        <p>${esc(sk.desc)}</p></div></div>`;
    }).join('') + `<p class="muted">Dica: ataque durante o dash para um golpe especial. Golpes seguidos aumentam o combo e o dano.</p>`;
  }

  questsTab() {
    const g = this.game;
    const list = Object.entries(QUESTS).map(([id, q]) => {
      const st = g.questState(id);
      if (st === 'locked') return '';
      const label = { available: 'Disponível', active: g.questReady(id) ? 'Pronta para entregar' : 'Em andamento', done: 'Concluída' }[st];
      return `<div class="quest ${st}"><b>${esc(q.title)}</b> <span class="pill">${label}</span>
        <small>${esc(NPCS[q.giver].name)}${st === 'active' ? ` • ${g.questProgress(id)}/${q.count}` : ''}</small>
        <p>${esc(q.text)}</p></div>`;
    }).join('');
    return list || '<p class="muted">Nenhuma missão ainda. Converse com os moradores da Vila Aurora.</p>';
  }

  honorsTab() {
    const save = this.game.save;
    return `<p class="muted">Monstros: ${save.stats.kills} • Maior combo: ${save.stats.maxCombo} • Ataques em dash: ${save.stats.dashAttacks}</p>` +
      HONORS.map((h) => `<div class="honor ${save.honors.includes(h.id) ? 'got' : ''}"><b>${save.honors.includes(h.id) ? '🏅' : '○'} ${esc(h.name)}</b><small>${esc(h.desc)} • +${h.gold} ouro</small></div>`).join('');
  }

  systemTab() {
    return `<div class="col">
      <button data-act="save">Salvar agora</button>
      <button data-act="mute">${isMuted() ? 'Ativar som' : 'Desativar som'}</button>
      <button data-act="totitle">Voltar ao título</button>
      <button class="danger" data-act="wipe">Apagar progresso</button>
    </div>`;
  }

  // ---------- Diálogo com NPC ----------
  openDialog(npcId, msg = null) {
    const g = this.game, npc = NPCS[npcId];
    this.mode = 'dialog'; this.npc = npcId;
    let text = msg || npc.idle, buttons = '';
    if (!msg) {
      const qs = g.npcQuests(npcId);
      const ready = qs.find((id) => g.questReady(id));
      const avail = qs.find((id) => g.questState(id) === 'available');
      const active = qs.find((id) => g.questState(id) === 'active');
      if (ready) {
        text = QUESTS[ready].doneText;
        buttons += `<button data-act="complete" data-arg="${ready}">Entregar: ${esc(QUESTS[ready].title)}</button>`;
      } else if (avail) {
        const q = QUESTS[avail];
        text = q.text;
        const r = q.reward;
        buttons += `<p class="reward">Recompensa: ${r.exp} EXP • ${r.gold} ouro${r.items ? ' • poções' : ''}${r.equip != null ? ` • equipamento ${RARITY[r.equip].name.toLowerCase()}` : ''}</p>`;
        buttons += `<button data-act="accept" data-arg="${avail}">Aceitar missão</button>`;
      } else if (active) {
        text = `${QUESTS[active].title}: ${g.questProgress(active)}/${QUESTS[active].count}. Estou contando com você!`;
      }
      if (npc.role === 'arena') {
        const st = g.save.stats;
        buttons += `<p class="reward">Recordes: ${st.bestWave || 0} ondas • ${st.bestDefense || 0} defesas</p>`;
        buttons += `<button data-act="arena" data-arg="ondas">Desafio das Ondas<small>Sobreviva a ondas cada vez mais fortes. Chefe a cada 5 ondas.</small></button>`;
        buttons += g.save.level >= 3
          ? `<button data-act="arena" data-arg="defesa">Defesa do Cristal<small>Impeça que os monstros destruam o Cristal no centro da arena.</small></button>`
          : `<button disabled>Defesa do Cristal<small>Disponível a partir do Nv. 3</small></button>`;
      }
      if (npc.role === 'shop') {
        buttons += Object.entries(CONSUMABLES).map(([id, c]) => `<button data-act="buy" data-arg="${id}">Comprar ${esc(c.name)} (${c.price} ouro)</button>`).join('');
        buttons += `<button data-act="sellcommon">Vender todos os itens comuns</button>`;
      }
    }
    this.show(`
      <div class="speaker" style="--c:${npc.color}">${esc(npc.name)}</div>
      <p class="say">${esc(text)}</p>
      <div class="col">${buttons}<button class="ghost" data-act="close">Tchau</button></div>
      ${npc.role === 'shop' ? `<p class="muted">Seu ouro: ${g.save.gold}</p>` : ''}`, 'dialog');
  }

  showDeath() {
    this.mode = 'death';
    this.show(`<h2>Você caiu...</h2><p>A aurora vai te levar de volta para a vila. Você perde 10% do ouro.</p>
      <button class="big" data-act="respawn">Renascer na Vila Aurora</button>`, 'dialog');
  }

  // ---------- Ações ----------
  act(a, arg) {
    const g = this.game;
    switch (a) {
      case 'continue': this.hide(); g.start(loadSave()); break;
      case 'new': this.showClassSelect(); break;
      case 'title': case 'totitle':
        if (g?.running) { g.persist(); g.running = false; }
        this.showTitle(); break;
      case 'pick': this.hide(); g.start(newSave(arg)); g.toast('Converse com a Anciã Mirela (↑)', '#ffd84a'); break;
      case 'close': this.hide(); break;
      case 'tab': this.openMenu(arg); break;
      case 'alloc':
        if (g.save.points > 0) { g.save.points--; g.save.alloc[arg]++; g.recalc(); }
        this.openMenu(); break;
      case 'equip': {
        const inv = g.save.inventory, it = inv[+arg];
        if (!it || it.kind !== 'equip') break;
        const cur = g.save.equip[it.slot];
        inv.splice(+arg, 1);
        if (cur) inv.push(cur);
        g.save.equip[it.slot] = it; g.recalc(); this.openMenu(); break;
      }
      case 'unequip': {
        const it = g.save.equip[arg];
        if (it && g.addItem(it)) { g.save.equip[arg] = null; g.recalc(); }
        this.openMenu(); break;
      }
      case 'sell': {
        const it = g.save.inventory[+arg];
        if (it) { g.save.gold += it.value; g.save.inventory.splice(+arg, 1); sfx('coin'); }
        this.openMenu(); break;
      }
      case 'use': g.usePotion(arg); this.openMenu(); break;
      case 'save': g.persist(); g.toast('Jogo salvo', '#7dff9a'); this.hide(); break;
      case 'mute': setMuted(!isMuted()); this.openMenu(); break;
      case 'wipe':
        if (confirm('Apagar todo o progresso? Isso não pode ser desfeito.')) { deleteSave(); g.running = false; this.showTitle(); }
        break;
      case 'accept': g.acceptQuest(arg); this.openDialog(this.npc); break;
      case 'complete': g.completeQuest(arg); this.openDialog(this.npc); break;
      case 'buy': {
        const c = CONSUMABLES[arg];
        if (g.save.gold < c.price) { this.openDialog(this.npc, 'Hmm, falta ouro para isso.'); break; }
        if (!g.addItem({ kind: 'cons', id: arg, qty: 1 })) { this.openDialog(this.npc, 'Sua mochila está cheia!'); break; }
        g.save.gold -= c.price; sfx('coin'); this.openDialog(this.npc); break;
      }
      case 'sellcommon': {
        const inv = g.save.inventory;
        let total = 0;
        for (let i = inv.length - 1; i >= 0; i--) if (inv[i].kind === 'equip' && inv[i].rarity === 0) { total += inv[i].value; inv.splice(i, 1); }
        g.save.gold += total;
        this.openDialog(this.npc, total ? `Negócio fechado! Aqui estão ${total} de ouro.` : 'Você não tem itens comuns para vender.');
        break;
      }
      case 'arena': this.hide(); g.startArena(arg); break;
      case 'respawn': this.hide(); g.respawn(); break;
    }
  }
}
