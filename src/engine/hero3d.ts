// Personagem do jogador em 3D (modo 3D): boneco "chibi" feito de formas simples, do mesmo tamanho do boneco 2D
// (56 px do pé ao topo do cabelo), com contorno escuro e luz de desenho (toon). Cada equipamento equipado vira
// uma peça 3D do mesmo tamanho do corpo: halo, armadura com ombreiras, luvas, calças, botas, capa, asas,
// asas frontais, aura e a arma da classe (espada, cajado ou adaga). As animações (parado, andar, correr, pular,
// cair, pousar, ataques, dano e morte) são feitas por ângulos nas articulações.
// Unidade: 1 = 1 px lógico do jogo; y para cima, pés em y = 0, frente do boneco em +z.
import * as THREE from 'three';
import { getItem, hasItem } from '../data';
import { RARITY_COLORS } from '../data/gear';
import type { Slot } from '../types';
import { spriteSource } from './sprites';

export type HeroAnim = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'atk1' | 'atk2' | 'atk3' | 'hurt' | 'death';

export interface HeroPose {
  anim: HeroAnim;
  /** progresso da animação (0..1) nos golpes, dano, morte e pouso; fase do passo (em passos) ao andar/correr */
  t: number;
  /** tempo do jogo (balanço do parado, asas, capa, aura) */
  time: number;
  /** 1 = olhando para a direita */
  facing: number;
  flash?: boolean;
  /** brilho na ponta da arma (poderes) */
  charge?: number;
}

/** Tamanho do boneco 3D (igual ao DOLL_H do 2D). */
export const HERO_H = 56;

const SKIN = 0xf3c9a4;
const CLASS_LOOK: Record<string, { hair: number; hair2: number; shorts: number; eyes: number }> = {
  warrior: { hair: 0xd8342c, hair2: 0x8a1a18, shorts: 0x2b3f9a, eyes: 0x5a2a14 },
  mage: { hair: 0xf2c45a, hair2: 0xb07a26, shorts: 0xc0324a, eyes: 0x3a6ad0 },
  assassin: { hair: 0xd8d2e0, hair2: 0x8a849a, shorts: 0x2a2630, eyes: 0x6a3a8a },
};

// ── materiais ──
let GRAD: THREE.DataTexture | null = null;
function gradient(): THREE.DataTexture {
  if (GRAD) return GRAD;
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter;
  GRAD.needsUpdate = true;
  return GRAD;
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1c1420, side: THREE.BackSide });

function toon(color: THREE.ColorRepresentation, o: { emissive?: THREE.ColorRepresentation; glow?: number; map?: THREE.Texture } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: o.map ? 0xffffff : color, gradientMap: gradient(), map: o.map ?? null,
    emissive: new THREE.Color(o.emissive ?? 0x000000), emissiveIntensity: o.glow ?? 1,
  });
}

/** Texturas desenhadas (manchas de vaca, chamas). */
const TEX = new Map<string, THREE.Texture>();
function patternTex(kind: 'cow' | 'fire'): THREE.Texture {
  const hit = TEX.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  if (kind === 'cow') {
    g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#26222a';
    for (const [x, y, r] of [[12, 14, 9], [44, 10, 7], [30, 38, 10], [56, 46, 8], [8, 52, 7], [50, 28, 5]]) {
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, x * 0.1, 0, Math.PI * 2); g.fill();
    }
  } else {
    const gr = g.createLinearGradient(0, 64, 0, 0);
    gr.addColorStop(0, '#5a0a04'); gr.addColorStop(0.35, '#c8280c'); gr.addColorStop(0.7, '#ff8a1c'); gr.addColorStop(1, '#ffe27a');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,230,120,0.8)';
    for (let i = 0; i < 7; i++) {
      const x = i * 10 + 2;
      g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + 6, 34, x + 3, 18 + (i % 3) * 6); g.quadraticCurveTo(x + 9, 40, x + 10, 64); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX.set(kind, t);
  return t;
}

/** Textura de um sprite do atlas (auras em formato: caveira, chifres). */
function spriteTex(name: string): THREE.Texture | null {
  const hit = TEX.get(name);
  if (hit) return hit;
  const s = spriteSource(name);
  if (!s) return null;
  const c = document.createElement('canvas');
  c.width = s.w; c.height = s.h;
  c.getContext('2d')!.drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  TEX.set(name, t);
  return t;
}

let GLOW: THREE.Texture | null = null;
function glowTex(): THREE.Texture {
  if (GLOW) return GLOW;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  GLOW = new THREE.CanvasTexture(c);
  return GLOW;
}

// ── peças ──

/** Malha com contorno (casca invertida um pouco maior). */
function part(geo: THREE.BufferGeometry, mat: THREE.Material, outline = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (outline) {
    geo.computeBoundingSphere();
    const r = geo.boundingSphere?.radius ?? 4;
    const o = new THREE.Mesh(geo, OUTLINE);
    o.scale.setScalar(1 + 0.7 / Math.max(1.5, r));
    m.add(o);
  }
  return m;
}

const box = (w: number, h: number, d: number, r = 0) => (r ? roundedBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d));
function roundedBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  // caixa arredondada: esfera achatada nas proporções (barata e lisa)
  const g = new THREE.SphereGeometry(1, 14, 10);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 0.45);
    p.setXYZ(i, k(x) * (w / 2), k(y) * (h / 2), k(z) * (d / 2));
  }
  void r;
  g.computeVertexNormals();
  return g;
}
const cyl = (r1: number, r2: number, h: number, seg = 10) => new THREE.CylinderGeometry(r1, r2, h, seg);
const sph = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);

/** Membro: grupo da articulação com o osso para baixo (-y). */
function limb(len: number, r1: number, r2: number, mat: THREE.Material): { joint: THREE.Group; mesh: THREE.Mesh } {
  const joint = new THREE.Group();
  const mesh = part(cyl(r1, r2, len, 10), mat);
  mesh.position.y = -len / 2;
  joint.add(mesh);
  return { joint, mesh };
}

/** Cor e raridade de um item equipado. */
function itemInfo(id: string | undefined): { id: string; r: number; color: THREE.Color; skin: string } | null {
  if (!id || !hasItem(id)) return null;
  const e = getItem(id);
  const r = Math.max(0, Math.min(7, e.rarity ?? 0));
  const skin = /_(fire|cow)$/.test(id) ? id.replace(/.*_(fire|cow)$/, '$1') : '';
  const look = e.look?.outfit ?? e.look?.weapon?.blade;
  return { id, r, color: new THREE.Color(look ?? RARITY_COLORS[r]), skin };
}

// ── o boneco ──
export class Hero3D {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private armF = { sh: new THREE.Group(), el: new THREE.Group(), hand: new THREE.Group() };
  private armB = { sh: new THREE.Group(), el: new THREE.Group(), hand: new THREE.Group() };
  private legF = { hip: new THREE.Group(), knee: new THREE.Group(), foot: new THREE.Group() };
  private legB = { hip: new THREE.Group(), knee: new THREE.Group(), foot: new THREE.Group() };
  /** peças de equipamento (refeitas quando o equipamento muda) */
  private gear = new THREE.Group();
  private gearParts: THREE.Object3D[] = [];
  private wings: THREE.Group[] = [];
  private wingsF: THREE.Group[] = [];
  private cape: THREE.Group | null = null;
  private halo: THREE.Group | null = null;
  private aura: THREE.Group | null = null;
  private auraSprite: THREE.Sprite | null = null;
  private weapon: THREE.Group | null = null;
  private tip: THREE.Sprite;
  private weaponKind = 'sword';
  private mats: THREE.MeshToonMaterial[] = [];
  private bodyMats = 0;
  private key = '';
  private cls = '';

  constructor() {
    this.root.add(this.body);
    this.body.add(this.torso);
    this.root.add(this.gear);
    this.tip = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.tip.visible = false;
  }

  private mat(color: THREE.ColorRepresentation, o: Parameters<typeof toon>[1] = {}): THREE.MeshToonMaterial {
    const m = toon(color, o);
    this.mats.push(m);
    return m;
  }

  /** Monta o boneco da classe com o equipamento (só refaz quando algo mudou). */
  setLook(cls: string, equipped: Partial<Record<Slot, string>>): void {
    const key = cls + '|' + JSON.stringify(equipped);
    if (key === this.key) return;
    this.key = key;
    if (cls !== this.cls) { this.cls = cls; this.buildBody(cls); }
    this.buildGear(equipped);
  }

  private clear(g: THREE.Object3D): void {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); } });
    }
  }

  // ───── corpo base (sem equipamento) ─────
  private buildBody(cls: string): void {
    const look = CLASS_LOOK[cls] ?? CLASS_LOOK.warrior;
    this.clear(this.torso);
    this.mats = [];
    for (const a of [this.armF, this.armB]) { this.clear(a.sh); this.clear(a.el); this.clear(a.hand); }
    for (const l of [this.legF, this.legB]) { this.clear(l.hip); this.clear(l.knee); this.clear(l.foot); }
    this.clear(this.head);
    const skin = this.mat(SKIN), shorts = this.mat(look.shorts), hair = this.mat(look.hair), hair2 = this.mat(look.hair2);
    const dark = this.mat(0x241c26), eye = this.mat(look.eyes), white = this.mat(0xffffff);
    // tronco (quadril em y = 18, ombros em y = 31)
    this.torso.position.y = 18;
    const chest = part(box(13, 13, 8.5, 1), skin);
    chest.position.y = 6.5;
    this.torso.add(chest);
    const belt = part(box(13.6, 5, 9, 1), shorts);
    belt.position.y = 1;
    this.torso.add(belt);
    // cabeça grande (chibi), pescoço em y = 13 do tronco
    this.head.position.y = 13;
    this.torso.add(this.head);
    const skull = part(sph(11, 18, 14), skin);
    skull.scale.set(1, 0.94, 0.92);
    skull.position.y = 10.5;
    this.head.add(skull);
    // rosto: olhos grandes na frente, um pouco para o lado em que olha
    for (const sx of [-1, 1]) {
      const e = part(sph(2, 10, 8), eye, false);
      e.scale.set(0.8, 1.25, 0.4);
      e.position.set(sx * 4, 9.5, 9.6);
      this.head.add(e);
      const hl = part(sph(0.7, 6, 5), white, false);
      hl.position.set(sx * 4 - 0.5, 10.6, 10.2);
      this.head.add(hl);
      const brow = part(box(3.2, 0.8, 0.8), dark, false);
      brow.position.set(sx * 4, 13.2, 9.8);
      brow.rotation.z = sx * -0.15;
      this.head.add(brow);
    }
    const mouth = part(box(2.2, 0.6, 0.6), this.mat(0x8a3a3a), false);
    mouth.position.set(0, 5.6, 10.1);
    this.head.add(mouth);
    // cabelo de cada classe
    this.buildHair(cls, hair, hair2, dark);
    // braços (ombros em y = 12 do tronco) e pernas (quadril)
    const arm = (a: Hero3D['armF'], sx: number) => {
      a.sh.position.set(sx * 8, 12, 0);
      this.torso.add(a.sh);
      const up = limb(7.5, 2.4, 2.2, skin);
      a.sh.add(up.joint);
      a.el.position.y = -7.5;
      up.joint.add(a.el);
      const lo = limb(6.5, 2.2, 2, skin);
      a.el.add(lo.joint);
      a.hand.position.y = -7;
      lo.joint.add(a.hand);
      a.hand.add(part(sph(2.6, 10, 8), skin));
    };
    arm(this.armF, -1);
    arm(this.armB, 1);
    const leg = (l: Hero3D['legF'], sx: number) => {
      l.hip.position.set(sx * 3.6, 18, 0);
      this.body.add(l.hip);
      const th = limb(8.5, 3, 2.6, skin);
      l.hip.add(th.joint);
      const sh = part(cyl(3.3, 3.1, 4, 10), shorts);
      sh.position.y = -1.6;
      l.hip.add(sh);
      l.knee.position.y = -8.5;
      th.joint.add(l.knee);
      const sn = limb(8, 2.5, 2.2, skin);
      l.knee.add(sn.joint);
      l.foot.position.y = -8.5;
      sn.joint.add(l.foot);
      const ft = part(box(4.6, 2.4, 7, 1), skin);
      ft.position.set(0, 0.6, 1.6);
      l.foot.add(ft);
    };
    leg(this.legF, -1);
    leg(this.legB, 1);
    this.bodyMats = this.mats.length;
  }

  private buildHair(cls: string, hair: THREE.Material, hair2: THREE.Material, dark: THREE.Material): void {
    const H = this.head;
    const cap = part(sph(11.8, 16, 12, ), hair);
    cap.scale.set(1.03, 0.72, 0.96);
    cap.position.set(0, 16, -2);
    H.add(cap);
    const spike = (x: number, y: number, z: number, rx: number, rz: number, len: number, r: number, m = hair) => {
      const s = part(new THREE.ConeGeometry(r, len, 8), m);
      s.position.set(x, y, z);
      s.rotation.set(rx, 0, rz);
      H.add(s);
    };
    if (cls === 'warrior') {
      // ruivo espetado
      spike(0, 23, -1, -0.3, 0, 9, 3.6);
      spike(-5, 21.5, 0, -0.2, 0.6, 8, 3.2);
      spike(5, 21.5, 0, -0.2, -0.6, 8, 3.2);
      spike(-8.5, 17, -1, 0, 1.1, 7, 3, hair2);
      spike(8.5, 17, -1, 0, -1.1, 7, 3, hair2);
      spike(0, 19, -8, -1.2, 0, 9, 3.6, hair2);
      spike(-3, 16.5, 9, 0.9, 0.3, 5, 2.4);
      spike(3, 16.5, 9, 0.9, -0.3, 5, 2.4);
    } else if (cls === 'mage') {
      // loira de cabelo comprido até a cintura
      const back = part(box(20, 22, 6, 1), hair);
      back.position.set(0, 4, -7.5);
      H.add(back);
      for (const sx of [-1, 1]) {
        const side = part(box(4.5, 16, 7, 1), hair2);
        side.position.set(sx * 10.2, 6, -1);
        H.add(side);
      }
      const bang = part(box(18, 5, 5, 1), hair);
      bang.position.set(0, 16, 7);
      bang.rotation.x = 0.35;
      H.add(bang);
    } else {
      // prateado espetado com máscara escura no rosto
      spike(-4, 22, -2, -0.6, 0.4, 9, 3.4);
      spike(4, 22, -2, -0.6, -0.4, 9, 3.4);
      spike(0, 21, -7, -1.3, 0, 10, 3.8, hair2);
      spike(-8, 17, -4, -0.7, 1.0, 8, 3, hair2);
      spike(8, 17, -4, -0.7, -1.0, 8, 3, hair2);
      spike(0, 17, 9, 1.0, 0, 6, 2.8);
      const mask = part(box(17, 6, 4, 1), dark);
      mask.position.set(0, 4.5, 8.2);
      H.add(mask);
    }
  }

  // ───── equipamento ─────
  private buildGear(eq: Partial<Record<Slot, string>>): void {
    // tira as peças antigas presas no corpo
    this.mats.length = this.bodyMats;
    for (const p of this.gearParts) p.parent?.remove(p);
    this.gearParts = [];
    this.clear(this.gear);
    this.wings = []; this.wingsF = []; this.cape = null; this.halo = null; this.aura = null; this.auraSprite = null; this.weapon = null;
    const add = (parent: THREE.Object3D, o: THREE.Object3D) => { parent.add(o); this.gearParts.push(o); return o; };
    const metal = (c: THREE.Color, r: number, skin = '') => {
      if (skin) return this.mat(0xffffff, { map: patternTex(skin as 'cow' | 'fire'), emissive: skin === 'fire' ? 0x401000 : 0x000000 });
      return this.mat(c.clone().multiplyScalar(0.85), { emissive: r >= 5 ? c.clone().multiplyScalar(0.18) : 0x000000 });
    };
    const trimOf = (r: number) => this.mat(r >= 4 ? 0xffd36b : r >= 2 ? 0xd8dde8 : 0x8a6a4a);

    // armadura: peitoral, saiote e ombreiras
    const ar = itemInfo(eq.armor);
    if (ar) {
      const m = metal(ar.color, ar.r, ar.skin), trim = trimOf(ar.r);
      if (ar.skin === 'cow') {
        // macacão de vaca: corpo inteiro com capuz de orelhas
        const suit = part(box(15, 16, 10.5, 1), m);
        suit.position.y = 6;
        add(this.torso, suit);
        const hood = part(sph(12.4, 16, 12), m);
        hood.scale.set(1.04, 0.8, 1);
        hood.position.set(0, 14, -1.6);
        add(this.head, hood);
        for (const sx of [-1, 1]) {
          const horn = part(new THREE.ConeGeometry(1.6, 5, 8), this.mat(0xf2d27a));
          horn.position.set(sx * 6, 23, -1); horn.rotation.z = sx * -0.5;
          add(this.head, horn);
          const ear = part(box(4, 2, 3, 1), this.mat(0xf2a6b8));
          ear.position.set(sx * 12, 15, -1); ear.rotation.z = sx * 0.4;
          add(this.head, ear);
        }
        for (const l of [this.legF, this.legB]) {
          const legSuit = part(cyl(3.4, 3, 9, 10), m);
          legSuit.position.y = -4.4;
          add(l.hip, legSuit);
        }
      } else {
        const plate = part(box(15, 14, 10.5, 1), m);
        plate.position.y = 6.8;
        add(this.torso, plate);
        const gem = part(sph(1.6, 8, 6), this.mat(RARITY_COLORS[ar.r], { emissive: RARITY_COLORS[ar.r], glow: 0.8 }));
        gem.position.set(0, 9, 5.4);
        add(this.torso, gem);
        const skirt = part(cyl(7.6, 8.8, 5, 12), m);
        skirt.position.y = -0.5;
        add(this.torso, skirt);
        const band = part(box(15.6, 1.6, 11, 1), trim);
        band.position.y = 1.8;
        add(this.torso, band);
      }
      for (const a of [this.armF, this.armB]) {
        const pad = part(sph(4.4, 12, 8, ), m);
        pad.scale.set(1, 0.75, 1);
        pad.position.y = 0.6;
        add(a.sh, pad);
        if (ar.r >= 3 && ar.skin !== 'cow') {
          const sp = part(new THREE.ConeGeometry(1.2, 3.5, 6), trim);
          sp.position.y = 4;
          add(a.sh, sp);
        }
      }
    }
    // luvas (braçadeiras)
    const gl = itemInfo(eq.gloves);
    if (gl) {
      const m = metal(gl.color, gl.r, gl.skin);
      for (const a of [this.armF, this.armB]) {
        const cuff = part(cyl(2.9, 2.6, 5.5, 10), m);
        cuff.position.y = -4;
        add(a.el, cuff);
        const fist = part(sph(3, 10, 8), m);
        add(a.hand, fist);
      }
    }
    // calças
    const pa = itemInfo(eq.pants);
    if (pa) {
      const m = metal(pa.color.clone().multiplyScalar(0.72), pa.r, pa.skin);
      for (const l of [this.legF, this.legB]) {
        const t = part(cyl(3.4, 3, 8.6, 10), m);
        t.position.y = -4.4;
        add(l.hip, t);
        const k = part(sph(2.9, 10, 8), trimOf(pa.r));
        add(l.knee, k);
      }
    }
    // botas
    const bo = itemInfo(eq.boots);
    if (bo) {
      const m = metal(bo.color.clone().multiplyScalar(0.78), bo.r, bo.skin);
      for (const l of [this.legF, this.legB]) {
        const shin = part(cyl(2.9, 2.9, 5.5, 10), m);
        shin.position.y = -5.5;
        add(l.knee, shin);
        const shoe = part(box(5.4, 3, 7.8, 1), m);
        shoe.position.set(0, 0.8, 1.6);
        add(l.foot, shoe);
        if (bo.skin === 'cow') {
          const cuff = part(cyl(3.3, 3.3, 1.4, 10), this.mat(0xf2a6b8));
          cuff.position.y = -3.2;
          add(l.knee, cuff);
        }
      }
    }
    // capa
    const ca = itemInfo(eq.cape);
    if (ca) {
      const g = new THREE.Group();
      g.position.set(0, 12.5, -5);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(15, 21, 1, 4), this.mat(ca.color));
      (cloth.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
      cloth.position.y = -10.5;
      g.add(cloth);
      add(this.torso, g);
      this.cape = g;
    }
    // asas (atrás) e asas frontais
    const wi = itemInfo(eq.wings);
    if (wi) {
      const special = wi.id === 'wb_bluefire' ? 0x4aa8ff : wi.id === 'wb_blackbig' ? 0x1a1222 : null;
      const col = special ?? (wi.r === 0 ? 0xf4f4f8 : new THREE.Color(0xffffff).lerp(new THREE.Color(RARITY_COLORS[wi.r]), 0.45));
      const big = wi.id === 'wb_blackbig' ? 1.3 : 1;
      const glow = wi.id === 'wb_bluefire' ? 0x1050c0 : wi.r >= 5 ? new THREE.Color(RARITY_COLORS[wi.r]).multiplyScalar(0.3) : 0;
      for (const sx of [-1, 1]) {
        const w = this.wing(this.mat(col, { emissive: glow }), 1.0 * big);
        w.position.set(sx * 2.5, 9, -5.5);
        w.scale.x = sx;
        add(this.torso, w);
        this.wings.push(w);
      }
    }
    const wf = itemInfo(eq.wingsFront);
    if (wf) {
      const col = new THREE.Color(0xffffff).lerp(new THREE.Color(RARITY_COLORS[wf.r]), 0.6);
      for (const sx of [-1, 1]) {
        const w = this.wing(this.mat(col), 0.55);
        w.position.set(sx * 3, 5, 5);
        w.scale.x = sx;
        w.rotation.y = sx * -0.4;
        add(this.torso, w);
        this.wingsF.push(w);
      }
    }
    // halo (espaço da cabeça): anel de luz acima do cabelo; raridades altas com asinhas e pontas
    const hl = itemInfo(eq.helmet);
    if (hl) {
      const c = new THREE.Color(RARITY_COLORS[hl.r]);
      const g = new THREE.Group();
      g.position.set(0, 30, -1);
      const ringMat = new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.35) });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 1.1, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2 - 0.25;
      g.add(ring);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
      glow.scale.set(28, 14, 1);
      g.add(glow);
      if (hl.r >= 2) {
        for (const sx of [-1, 1]) {
          const w = this.wing(new THREE.MeshBasicMaterial({ color: c }), 0.32);
          w.position.set(sx * 6.5, 0, 0);
          w.scale.x = sx;
          g.add(w);
        }
      }
      if (hl.r >= 4) {
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        gem.position.set(0, 3, 7);
        g.add(gem);
      }
      add(this.head, g);
      this.halo = g;
    }
    // aura no chão (anel de luz) e auras em formato (caveira, chifres) atrás do corpo
    const au = itemInfo(eq.aura);
    if (au) {
      const g = new THREE.Group();
      const c = new THREE.Color(au.id === 'au_skull' ? 0xc050ff : au.id === 'au_horns' ? 0xa060ff : RARITY_COLORS[au.r]);
      const ring = new THREE.Mesh(new THREE.RingGeometry(12, 17, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.4;
      g.add(ring);
      const col = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 }));
      (col.material as THREE.SpriteMaterial).opacity = 0.2;
      col.scale.set(44, 60, 1);
      col.position.set(0, 26, -14);
      g.add(col);
      const shaped = au.id === 'au_skull' ? 'gau_skull' : au.id === 'au_horns' ? 'gau_horns' : '';
      const tex = shaped ? spriteTex(shaped) : null;
      if (tex) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const img = tex.image as HTMLCanvasElement;
        const w = au.id === 'au_skull' ? 72 : 58;
        s.scale.set(w, (w * img.height) / img.width, 1);
        s.position.set(0, au.id === 'au_skull' ? 44 : 46, -10);
        g.add(s);
        this.auraSprite = s;
      }
      this.gear.add(g);
      this.aura = g;
    }
    // arma da classe na mão da frente
    const wp = itemInfo(eq.weapon);
    if (wp) {
      const e = getItem(wp.id);
      this.weaponKind = e.weaponKind ?? 'sword';
      this.weapon = this.buildWeapon(this.weaponKind, wp);
      add(this.armF.hand, this.weapon);
    }
    this.armF.hand.add(this.tip);
  }

  /** Asa de penas (forma plana com espessura), presa pela base. */
  private wing(mat: THREE.Material, k: number): THREE.Group {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(6, 10, 18, 16, 26, 14);
    s.lineTo(22, 9); s.lineTo(25, 6); s.lineTo(19, 3); s.lineTo(21, 0); s.lineTo(14, -2); s.lineTo(15, -6); s.lineTo(8, -5);
    s.quadraticCurveTo(3, -4, 0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false });
    geo.translate(0, 0, -0.6);
    const m = part(geo, mat);
    m.scale.setScalar(k);
    m.rotation.y = -0.5;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }

  private buildWeapon(kind: string, wp: { id: string; r: number; color: THREE.Color }): THREE.Group {
    const g = new THREE.Group();
    const neon = /_(white|black|violet|green|emerald)$/.exec(wp.id)?.[1];
    const NEON: Record<string, number> = { white: 0xfff2c0, black: 0xb050ff, violet: 0xc070ff, green: 0x40ff60, emerald: 0x30ffb0 };
    const bladeCol = neon === 'black' ? new THREE.Color(0x2a1a3a) : neon ? new THREE.Color(NEON[neon]) : new THREE.Color(wp.r === 0 ? 0xd8dee8 : RARITY_COLORS[wp.r]).lerp(new THREE.Color(0xffffff), 0.3);
    const glowCol = neon ? NEON[neon] : wp.r >= 4 ? new THREE.Color(RARITY_COLORS[wp.r]).multiplyScalar(0.5) : 0;
    const blade = this.mat(bladeCol, { emissive: glowCol, glow: neon ? 0.9 : 0.6 });
    const hilt = this.mat(wp.r >= 3 ? 0xffd36b : 0x8a5a2b);
    if (kind === 'staff') {
      // cajado em pé na mão, orbe em cima
      const pole = part(cyl(1, 1.1, 34, 8), this.mat(wp.r >= 3 ? 0xe8c880 : 0x8a5a2b));
      pole.position.y = 10;
      g.add(pole);
      const head = part(new THREE.TorusGeometry(3.4, 0.9, 6, 16), hilt);
      head.position.y = 28;
      g.add(head);
      const orb = part(sph(3, 12, 10), this.mat(bladeCol, { emissive: neon ? NEON[neon] : RARITY_COLORS[wp.r], glow: 0.7 }), false);
      orb.position.y = 28;
      g.add(orb);
      this.tipAt(g, 0, 28, 0);
    } else {
      // espada ou adaga apontando para a frente e para cima
      const len = kind === 'dagger' ? 13 : 24;
      const w = kind === 'dagger' ? 2.6 : 3.4;
      const bl = part(box(w, len, 0.9), blade);
      bl.position.y = len / 2 + 2.6;
      g.add(bl);
      const point = part(new THREE.ConeGeometry(w / 2 * 1.15, 3.2, 4), blade);
      point.position.y = len + 2.6 + 1.5;
      point.rotation.y = Math.PI / 4;
      point.scale.z = 0.35;
      g.add(point);
      const guard = part(box(kind === 'dagger' ? 6 : 9, 1.6, 2), hilt);
      guard.position.y = 2;
      g.add(guard);
      const grip = part(cyl(0.9, 0.9, 5, 6), this.mat(0x4a2a1a));
      grip.position.y = -0.8;
      g.add(grip);
      this.tipAt(g, 0, len + 3, 0);
      g.rotation.x = 1.25; // lâmina para a frente
    }
    return g;
  }

  private tipAt(g: THREE.Group, x: number, y: number, z: number): void {
    g.userData.tip = new THREE.Vector3(x, y, z);
  }

  // ───── animação ─────
  pose(p: HeroPose): void {
    const { anim, t, time } = p;
    const S = Math.sin, C = Math.cos;
    const reset = (o: THREE.Object3D) => o.rotation.set(0, 0, 0);
    [this.body, this.torso, this.head, this.armF.sh, this.armF.el, this.armB.sh, this.armB.el, this.legF.hip, this.legF.knee, this.legB.hip, this.legB.knee, this.legF.foot, this.legB.foot].forEach(reset);
    this.body.position.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    // ¾ virado para a câmera, olhando para onde anda
    this.root.rotation.set(0, p.facing > 0 ? 0.62 : -0.62, 0);
    let armF = 0, armB = 0, elF = -0.35, elB = -0.35, hipF = 0, hipB = 0, kneeF = 0, kneeB = 0;
    const staff = this.weaponKind === 'staff';
    if (anim === 'idle') {
      const b = S(time * 2.6);
      this.body.position.y = b * 0.35;
      this.torso.rotation.x = b * 0.03;
      armF = -0.25 + b * 0.04; armB = 0.12 - b * 0.04;
      this.armF.sh.rotation.z = 0.15; this.armB.sh.rotation.z = -0.15;
      this.head.rotation.z = S(time * 1.3) * 0.04;
    } else if (anim === 'walk' || anim === 'run') {
      const run = anim === 'run';
      const ph = t * Math.PI * 0.4, sw = run ? 0.9 : 0.55;
      hipF = S(ph) * sw; hipB = -S(ph) * sw;
      kneeF = Math.max(0, -S(ph + 0.9)) * (run ? 1.4 : 0.9);
      kneeB = Math.max(0, S(ph + 0.9)) * (run ? 1.4 : 0.9);
      armF = -S(ph) * sw * 0.8 - 0.15; armB = S(ph) * sw * 0.8;
      elF = elB = run ? -1.1 : -0.45;
      this.body.position.y = Math.abs(C(ph)) * (run ? 1.6 : 0.8);
      this.body.rotation.x = run ? 0.22 : 0.05;
    } else if (anim === 'jump' || anim === 'fall') {
      const up = anim === 'jump';
      hipF = up ? -1.1 : -0.4; kneeF = up ? 1.6 : 0.5;
      hipB = up ? 0.3 : 0.2; kneeB = up ? 0.9 : 0.3;
      armF = up ? -2.2 : -1.2; armB = up ? -1.4 : 0.9;
      this.armF.sh.rotation.z = 0.3; this.armB.sh.rotation.z = -0.5;
      elF = -0.3;
    } else if (anim === 'land') {
      const k = S(Math.min(1, t) * Math.PI);
      this.body.scale.set(1 + k * 0.08, 1 - k * 0.12, 1 + k * 0.08);
      hipF = hipB = -0.4 * k; kneeF = kneeB = 0.8 * k;
      armF = armB = 0.3 * k;
    } else if (anim === 'atk1' || anim === 'atk2' || anim === 'atk3') {
      // preparo (0–0.3), golpe (0.3–0.55), volta
      const a = Math.min(1, t);
      const wind = a < 0.3 ? a / 0.3 : 1, hit = a < 0.3 ? 0 : Math.min(1, (a - 0.3) / 0.25), back = a < 0.55 ? 0 : (a - 0.55) / 0.45;
      const ease = (v: number) => v * v * (3 - 2 * v);
      if (staff) {
        // ergue o cajado e aponta para a frente
        armF = -0.6 - ease(wind) * 1.9 + ease(hit) * 1.3 + ease(back) * 0.7;
        elF = -0.2;
        this.body.rotation.x = 0.12 * hit * (1 - back);
        if (anim === 'atk3') this.body.rotation.y = S(a * Math.PI) * 0.5;
      } else if (anim === 'atk2') {
        // corte de baixo para cima
        armF = 0.9 * ease(wind) - 3.0 * ease(hit) + 1.8 * ease(back);
        elF = -0.2;
        this.torso.rotation.y = 0.4 * ease(wind) - 0.6 * ease(hit) + 0.2 * ease(back);
      } else {
        // corte de cima para baixo (atk3: giro completo)
        armF = -2.9 * ease(wind) + 2.6 * ease(hit) + 0.1 * ease(back) - 0.2;
        elF = -0.15;
        this.torso.rotation.y = -0.4 * ease(wind) + 0.7 * ease(hit) - 0.3 * ease(back);
        if (anim === 'atk3') this.body.rotation.y = ease(hit) * Math.PI * 2;
      }
      armB = 0.5 * hit * (1 - back);
      hipF = -0.5 * hit * (1 - back); kneeF = 0.5 * hit * (1 - back);
      hipB = 0.35 * hit * (1 - back);
      this.body.position.z = 2.5 * hit * (1 - back);
    } else if (anim === 'hurt') {
      const k = S(Math.min(1, t) * Math.PI);
      this.body.rotation.x = -0.3 * k;
      this.head.rotation.x = -0.25 * k;
      armF = 0.6 * k; armB = 0.8 * k;
      this.armF.sh.rotation.z = 0.5 * k; this.armB.sh.rotation.z = -0.5 * k;
      this.body.position.z = -2.5 * k;
    } else if (anim === 'death') {
      const k = Math.min(1, t * 1.15);
      const e = k * k;
      this.body.rotation.x = -Math.PI / 2 * e;
      this.body.position.z = -4 * e;
      this.body.position.y = 2 * S(k * Math.PI) ;
      hipF = -0.6 * k; kneeF = 1.0 * k; hipB = -0.2 * k; kneeB = 0.4 * k;
      armF = -2.4 * k; armB = -2.0 * k;
      this.armF.sh.rotation.z = 0.6 * k; this.armB.sh.rotation.z = -0.6 * k;
      this.head.rotation.x = -0.3 * k;
    }
    this.armF.sh.rotation.x = armF; this.armB.sh.rotation.x = armB;
    this.armF.el.rotation.x = elF; this.armB.el.rotation.x = elB;
    this.legF.hip.rotation.x = hipF; this.legB.hip.rotation.x = hipB;
    this.legF.knee.rotation.x = kneeF; this.legB.knee.rotation.x = kneeB;
    this.legF.foot.rotation.x = -(hipF + kneeF) * 0.4; this.legB.foot.rotation.x = -(hipB + kneeB) * 0.4;
    // arma: compensa o cotovelo para ficar na direção do braço; cajado em pé
    if (this.weapon) this.weapon.rotation.x = this.weaponKind === 'staff' ? -elF - armF * 0.15 : 1.25;
    // asas batendo, capa balançando, halo flutuando, aura pulsando
    const flap = 0.35 + S(time * 3) * 0.3;
    for (const w of this.wings) w.rotation.y = (w.scale.x > 0 ? -1 : 1) * flap;
    for (const w of this.wingsF) w.rotation.z = (w.scale.x > 0 ? 1 : -1) * S(time * 3 + 1) * 0.2;
    if (this.cape) this.cape.rotation.x = 0.12 + S(time * 4) * 0.06 + (anim === 'run' ? 0.5 : anim === 'walk' ? 0.2 : 0);
    if (this.halo) {
      this.halo.position.y = 30 + S(time * 2.4) * 0.8;
      this.halo.visible = anim !== 'death' || t < 0.4;
    }
    if (this.aura) {
      const k = 1 + S(time * 3) * 0.06;
      this.aura.scale.set(k, 1, k);
      this.aura.visible = anim !== 'death';
    }
    if (this.auraSprite) (this.auraSprite.material as THREE.SpriteMaterial).opacity = 0.75 + S(time * 5) * 0.15;
    // brilho na ponta da arma (poderes)
    const ch = p.charge ?? 0;
    const tip = this.weapon?.userData.tip as THREE.Vector3 | undefined;
    this.tip.visible = ch > 0.02 && !!tip;
    if (this.tip.visible && tip && this.weapon) {
      this.tip.position.copy(tip).applyEuler(this.weapon.rotation);
      this.tip.scale.setScalar(30 * ch);
      (this.tip.material as THREE.SpriteMaterial).opacity = 0.8 * ch;
    }
    // piscar branco ao levar dano
    const fl = p.flash ? 0.85 : 0;
    for (const m of this.mats) {
      if (m.userData.baseE === undefined) m.userData.baseE = m.emissive.getHex();
      if (fl) m.emissive.setRGB(fl, fl, fl);
      else m.emissive.setHex(m.userData.baseE as number);
    }
  }
}

/**
 * Retrato do boneco 3D para as telas (inventário, escolha de classe, eventos): renderizador próprio pequeno,
 * câmera ortográfica, e a imagem é copiada para o canvas 2D da interface.
 */
export class HeroPortrait {
  private canvas = document.createElement('canvas');
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-46, 46, 84, -8, -200, 200);
  private heroes = new Map<string, Hero3D>();
  private sun = new THREE.DirectionalLight(0xffffff, 1.7);

  constructor() {
    this.canvas.width = 184; this.canvas.height = 184;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x5a4a66, 1.1), this.sun);
    this.sun.position.set(-60, 140, 120);
    this.camera.position.set(0, 0, 100);
  }

  /** Desenha o boneco com os pés em (x, y) do contexto 2D; `k` = escala (1 = tamanho do jogo). */
  draw(ctx: CanvasRenderingContext2D, cls: string, equipped: Partial<Record<Slot, string>>, x: number, y: number, facing: number, k: number, time: number): void {
    // um boneco por visual (várias prévias na mesma tela)
    const key = cls + JSON.stringify(equipped);
    let h = this.heroes.get(key);
    if (!h) {
      if (this.heroes.size > 6) { for (const old of this.heroes.values()) this.scene.remove(old.root); this.heroes.clear(); }
      h = new Hero3D();
      this.heroes.set(key, h);
    }
    for (const o of this.heroes.values()) o.root.visible = o === h;
    if (!h.root.parent) this.scene.add(h.root);
    h.setLook(cls, equipped);
    h.pose({ anim: 'idle', t: 0, time, facing });
    this.renderer.render(this.scene, this.camera);
    const w = 92 * k;
    ctx.drawImage(this.canvas, x - w / 2, y - (84 / 92) * w, w, w);
  }
}
