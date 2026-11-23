// Fundo em Three.js (modo 3D, abra o jogo com ?3d): céu, panorama, nuvens, fileira de árvores/ruínas e névoa
// ficam a distâncias reais da câmera, e a paralaxe vem da perspectiva. Os poderes e projéteis acendem luzes
// que iluminam o cenário ao fundo. O jogo (terreno, personagens, efeitos e menus) continua no canvas 2D,
// desenhado por cima com o fundo transparente.
import * as THREE from 'three';
import type { BackdropSpec } from '../game/art/scenery';
import { spriteSource } from './sprites';
import { VIEW_H, VIEW_W } from './view';

/** Distância da câmera ao plano do jogo (z = 0), em px lógicos. Com ela, o plano z = 0 coincide com a tela. */
const FOV = 40;
const DIST = (360 / 2) / Math.tan((FOV / 2) * Math.PI / 180);
/** Camada com paralaxe p (0..1, 1 = anda junto com o chão) fica em z = -DIST · (1/p − 1). */
const depthOf = (p: number) => -DIST * (1 / p - 1);
const CAM_REST = 160;
const MAX_LIGHTS = 6;

export interface BackdropLight { x: number; y: number; color: string; power: number }

export interface BackdropState {
  stageId: string;
  stageWidth: number;
  camX: number;
  camY: number;
  time: number;
  shakeX: number;
  shakeY: number;
  spec: () => BackdropSpec;
  lights: BackdropLight[];
}

export class Backdrop3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 10, DIST * 40);
  private textures = new Map<HTMLImageElement, THREE.Texture>();
  private layers: { group: THREE.Group; parallax: number; drift: number }[] = [];
  private stageId = '';
  // Lambert divide a luz por π: ambiente π = cores iguais às do 2D (noite e entardecer tingem)
  private ambient = new THREE.AmbientLight(0xffffff, Math.PI);
  /** brilhos aditivos dos poderes e projéteis no cenário do fundo (luz que soma cor, até em cenários escuros) */
  private glows: THREE.Sprite[] = [];
  private sky: THREE.CanvasTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.ambient);
    const glowTex = radialTexture();
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthTest: false }));
      g.visible = false;
      g.renderOrder = 10;
      this.glows.push(g);
      this.scene.add(g);
    }
    const resize = () => this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    resize();
    window.addEventListener('resize', resize);
  }

  private texture(img: HTMLImageElement): THREE.Texture {
    let t = this.textures.get(img);
    if (!t) {
      t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      this.textures.set(img, t);
    }
    return t;
  }

  /** Placa com um quadro do atlas, canto de cima à esquerda em (x, y), com y para baixo como no 2D. */
  private quad(name: string, x: number, y: number, w: number, h: number, opts: { flip?: boolean; opacity?: number; lit?: boolean } = {}): THREE.Mesh | null {
    const src = spriteSource(name);
    if (!src) return null;
    const geo = new THREE.PlaneGeometry(w, h);
    const W = src.img.width, H = src.img.height;
    let u0 = src.x / W, u1 = (src.x + src.w) / W;
    if (opts.flip) [u0, u1] = [u1, u0];
    const v0 = 1 - (src.y + src.h) / H, v1 = 1 - src.y / H;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2));
    const params = { map: this.texture(src.img), transparent: true, opacity: opts.opacity ?? 1, depthWrite: false, alphaTest: 0.02 };
    const mat = opts.lit === false ? new THREE.MeshBasicMaterial(params) : new THREE.MeshLambertMaterial(params);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x + w / 2, -(y + h / 2), 0);
    return m;
  }

  /** Nova camada com paralaxe p. As coordenadas dentro dela são de "tela com câmera em 0" (como no 2D). */
  private layer(p: number, drift = 0): THREE.Group {
    const g = new THREE.Group();
    g.position.z = depthOf(p);
    // escala para que o tamanho aparente seja o mesmo do 2D
    g.scale.setScalar(1 / p);
    this.scene.add(g);
    this.layers.push({ group: g, parallax: p, drift });
    return g;
  }

  private build(st: BackdropState): void {
    for (const l of this.layers) {
      this.scene.remove(l.group);
      l.group.traverse((o) => {
        if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
      });
    }
    this.layers = [];
    const sp = st.spec();
    // céu: degradê preso à tela
    const c = document.createElement('canvas');
    c.width = 2; c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, shade(sp.sky[0], -0.12));
    grad.addColorStop(0.55, sp.sky[0]);
    grad.addColorStop(1, sp.sky[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
    this.sky?.dispose();
    this.sky = new THREE.CanvasTexture(c);
    this.sky.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.sky;
    // lua / pôr do sol (quase parado)
    if (sp.moon) {
      const moon = this.layer(0.02);
      const s = spriteSource(sp.moon);
      if (s) {
        const h = sp.moon === 'sunset' ? 54 : 46, w = (s.w / s.h) * h;
        const m = this.quad(sp.moon, VIEW_W * 0.78 - w / 2, sp.panoTop + 235 * 0.42 - h, w, h, { lit: false });
        if (m) moon.add(m);
      }
    }
    // panorama repetido, cópias alternadas espelhadas (paralaxe 0,2)
    const pano = spriteSource(sp.pano);
    if (pano) {
      const p = 0.2, L = this.layer(p);
      const W = pano.w * sp.panoScale, H = pano.h * sp.panoScale;
      for (let k = -2; k * W < st.stageWidth * p + VIEW_W * 2; k++) {
        const m = this.quad(sp.pano, k * W, sp.panoTop, W + 1, H, { flip: k % 2 !== 0 });
        if (m) L.add(m);
      }
      // terra escura abaixo do panorama (aparece pelas frestas do recheio do terreno, como o preto do 2D)
      const span = st.stageWidth * p + VIEW_W * 4;
      const earth = new THREE.Mesh(new THREE.PlaneGeometry(span, 3000), new THREE.MeshBasicMaterial({ color: 0x0b0a10 }));
      earth.position.set(span / 2 - VIEW_W, -(sp.panoTop + H - 2 + 1500), -0.5);
      L.add(earth);
    }
    // nuvens andando com o vento (paralaxe 0,08)
    const cl = spriteSource('layer_clouds');
    if (sp.clouds && cl) {
      const p = 0.08, L = this.layer(p, -8);
      const w = cl.w * 1.6, h = cl.h * 1.6;
      for (let k = -2; k * w < st.stageWidth * p + VIEW_W * 3 + st.time * 8 + 2000; k++) {
        const m = this.quad('layer_clouds', k * w, sp.panoTop + 4, w + 1, h, { opacity: 0.9, lit: false });
        if (m) L.add(m);
      }
    }
    // fileira intermediária (paralaxe 0,6)
    if (sp.row.length) {
      const L = this.layer(sp.rowParallax);
      for (const [name, x, y, h, dir] of sp.row) {
        const s = spriteSource(name);
        if (!s) continue;
        const w = (s.w / s.h) * h;
        const m = this.quad(name, x - w / 2, y - h, w, h, { flip: dir < 0 });
        if (m) L.add(m);
      }
    }
    // névoa (paralaxe 0,7), duas faixas em velocidades diferentes
    const fog = spriteSource('layer_fog');
    if (sp.fog && fog) {
      for (const [speed, alpha, dy, name] of [[10, 0.35, -30, 'layer_fog'], [22, 0.25, -6, 'layer_fog2']] as const) {
        const s = spriteSource(name);
        if (!s) continue;
        const p = 0.7, L = this.layer(p, -speed);
        const w = s.w * 1.8, h = s.h * 1.8;
        for (let k = -3; k * w < st.stageWidth * p + VIEW_W * 3 + 4000; k++) {
          const m = this.quad(name, k * w, 276 + dy - h * 0.5, w + 1, h, { opacity: alpha });
          if (m) L.add(m);
        }
      }
    }
    // clima: noite azulada, entardecer alaranjado (a luz ambiente pinta o cenário)
    const mood = sp.theme === 'cave' || sp.theme === 'village' ? 'day' : sp.mood;
    this.ambient.color.set(mood === 'night' ? '#9aa6d8' : mood === 'dusk' ? '#ffd2b0' : '#ffffff');
  }

  render(st: BackdropState): void {
    if (!spriteSource('layer_clouds')) return; // prancha de cenário ainda carregando
    if (st.stageId !== this.stageId) { this.stageId = st.stageId; this.build(st); }
    const vw = VIEW_W, vh = VIEW_H;
    // câmera: o plano z = 0 coincide com a área visível do mundo (com zoom no celular)
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = 2 * Math.atan((vh / 2) / DIST) * 180 / Math.PI;
    this.camera.updateProjectionMatrix();
    const cx = st.camX + vw / 2 + st.shakeX, cy = st.camY + vh / 2 + st.shakeY;
    this.camera.position.set(cx, -cy, DIST);
    this.camera.lookAt(cx, -cy, 0);
    // camadas: um ponto (X, Y) da camada aparece na tela em X − camX·p (como no 2D) e, com a câmera em repouso, em Y
    const camRestY = CAM_REST + vh / 2;
    for (const l of this.layers) {
      const p = l.parallax;
      l.group.position.x = (vw / 2) * (1 - 1 / p) + (l.drift * st.time) / p;
      l.group.position.y = vh / (2 * p) - camRestY;
    }
    // brilho dos poderes e projéteis no fundo: atrás da fileira intermediária, na direção do efeito,
    // um pouco acima dele (os efeitos ficam no chão, abaixo da base do panorama)
    const zl = depthOf(0.35);
    const k = (DIST - zl) / DIST;
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const g = this.glows[i];
      const src = st.lights[i];
      if (!src) { g.visible = false; continue; }
      g.visible = true;
      g.position.set(cx + (src.x - cx) * k, -(cy + (src.y - 50 - cy) * k), zl);
      const size = (130 + src.power * 22) * k;
      g.scale.set(size * 1.6, size, 1);
      const m = g.material as THREE.SpriteMaterial;
      m.color.set(src.color);
      m.opacity = Math.min(0.85, 0.18 + src.power * 0.16);
    }
    this.renderer.render(this.scene, this.camera);
  }
}

/** Degradê radial branco (centro forte, borda transparente) para os brilhos. */
function radialTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return '#' + c.getHexString();
}
