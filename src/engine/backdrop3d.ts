// Modo 3D (abra o jogo com ?3d), em Three.js:
// - fundo: céu, panorama, nuvens, fileira de árvores/ruínas e névoa a distâncias reais da câmera (paralaxe pela
//   perspectiva), com o brilho colorido dos poderes;
// - terreno: cada degrau do chão e cada plataforma é um bloco com espessura (frente, topo e laterais);
// - personagens, monstros, NPCs, objetos, escadas e portais: desenhados pelo código 2D numa camada própria, que entra
//   na cena 3D por cima do terreno, iluminada pelos poderes.
// Os efeitos, textos e menus continuam no canvas 2D, por cima de tudo, com o fundo transparente.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BackdropSpec } from '../game/art/scenery';
import { PX_TILES, TILE_W } from '../game/art/ground';
import type { SceneryTheme, TerrainSeg } from '../types';
import { spriteSource } from './sprites';
import { VIEW_H, VIEW_W } from './view';

/** Distância da câmera ao plano do jogo (z = 0), em px lógicos. Com ela, o plano z = 0 coincide com a tela. */
const FOV = 40;
const DIST = (360 / 2) / Math.tan((FOV / 2) * Math.PI / 180);
/** Camada com paralaxe p (0..1, 1 = anda junto com o chão) fica em z = -DIST · (1/p − 1). */
const depthOf = (p: number) => -DIST * (1 / p - 1);
const CAM_REST = 160;
const MAX_LIGHTS = 3;

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
  theme: SceneryTheme;
  terrain: { ground: TerrainSeg[]; platforms: TerrainSeg[] };
}

/** Profundidade do topo dos blocos (para dentro da tela) e fundo do chão. */
const GROUND_D = 90;
const PLAT_D = 56;
const WORLD_BOTTOM = 580;

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
  /** terreno em blocos (coordenadas do mundo, y para baixo vira −y) */
  private terrain = new THREE.Group();
  private tileTex = new Map<string, THREE.Texture>();
  /** camada dos personagens: canvas 2D (desenhado pelo jogo) numa placa iluminada no plano z = 0 */
  private actorCanvas = document.createElement('canvas');
  private actorCtx = this.actorCanvas.getContext('2d')!;
  private actorTex: THREE.CanvasTexture | null = null;
  private actorMesh: THREE.Mesh;
  private actorView = { w: 0, h: 0, r: 1 };
  /** luzes dos poderes no primeiro plano (terreno e personagens) */
  private points: THREE.PointLight[] = [];
  private moodTint = new THREE.Color(0xffffff);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    // o fundo é pixel art ampliado: 1,5× basta e alivia a placa de vídeo do celular
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.ambient);
    const glowTex = radialTexture();
    for (let i = 0; i < MAX_LIGHTS; i++) {
      // atrás do terreno (o terreno, mais perto, esconde o brilho)
      const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      g.visible = false;
      g.renderOrder = 4;
      this.glows.push(g);
      this.scene.add(g);
    }
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 230, 1.2);
      this.points.push(l);
      this.scene.add(l);
    }
    this.scene.add(this.terrain);
    this.actorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ transparent: true, depthTest: false, depthWrite: false }));
    this.actorMesh.renderOrder = 20;
    this.actorMesh.visible = false;
    this.scene.add(this.actorMesh);
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
  /** Placa do fundo (sem iluminação: as luzes dos poderes só valem no primeiro plano; o brilho do fundo é aditivo). */
  private quad(name: string, x: number, y: number, w: number, h: number, opts: { flip?: boolean; opacity?: number; tint?: THREE.Color } = {}): THREE.Mesh | null {
    const src = spriteSource(name);
    if (!src) return null;
    const geo = new THREE.PlaneGeometry(w, h);
    const W = src.img.width, H = src.img.height;
    let u0 = src.x / W, u1 = (src.x + src.w) / W;
    if (opts.flip) [u0, u1] = [u1, u0];
    const v0 = 1 - (src.y + src.h) / H, v1 = 1 - src.y / H;
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2));
    const params = { map: this.texture(src.img), transparent: true, opacity: opts.opacity ?? 1, depthWrite: false, alphaTest: 0.02 };
    const mat = new THREE.MeshBasicMaterial(params);
    if (opts.tint) mat.color.copy(opts.tint);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x + w / 2, -(y + h / 2), 0);
    return m;
  }

  /** Nova camada com paralaxe p. As coordenadas dentro dela são de "tela com câmera em 0" (como no 2D). */
  private layer(p: number, drift = 0, order = 0): THREE.Group {
    const g = new THREE.Group();
    g.userData.order = order;
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
    // clima: noite azulada, entardecer alaranjado (pinta só o fundo; terreno e personagens ficam com a cor real)
    const mood = sp.theme === 'cave' || sp.theme === 'village' ? 'day' : sp.mood;
    this.moodTint.set(mood === 'night' ? '#9aa6d8' : mood === 'dusk' ? '#ffd2b0' : '#ffffff');
    const tint = this.moodTint;
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
        const m = this.quad(sp.moon, VIEW_W * 0.78 - w / 2, sp.panoTop + 235 * 0.42 - h, w, h, {});
        if (m) moon.add(m);
      }
    }
    // panorama repetido, cópias alternadas espelhadas (paralaxe 0,2)
    const pano = spriteSource(sp.pano);
    if (pano) {
      const p = 0.2, L = this.layer(p);
      const W = pano.w * sp.panoScale, H = pano.h * sp.panoScale;
      for (let k = -2; k * W < st.stageWidth * p + VIEW_W * 2; k++) {
        const m = this.quad(sp.pano, k * W, sp.panoTop, W + 1, H, { flip: k % 2 !== 0, tint });
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
      const p = 0.08, L = this.layer(p, -8, 1);
      const w = cl.w * 1.6, h = cl.h * 1.6;
      for (let k = -2; k * w < st.stageWidth * p + VIEW_W * 3 + st.time * 8 + 2000; k++) {
        const m = this.quad('layer_clouds', k * w, sp.panoTop + 4, w + 1, h, { opacity: 0.9 });
        if (m) L.add(m);
      }
    }
    // fileira intermediária (paralaxe 0,6)
    if (sp.row.length) {
      const L = this.layer(sp.rowParallax, 0, 2);
      for (const [name, x, y, h, dir] of sp.row) {
        const s = spriteSource(name);
        if (!s) continue;
        const w = (s.w / s.h) * h;
        const m = this.quad(name, x - w / 2, y - h, w, h, { flip: dir < 0, tint });
        if (m) L.add(m);
      }
    }
    // névoa (paralaxe 0,7), duas faixas em velocidades diferentes
    const fog = spriteSource('layer_fog');
    if (sp.fog && fog) {
      for (const [speed, alpha, dy, name] of [[10, 0.35, -30, 'layer_fog'], [22, 0.25, -6, 'layer_fog2']] as const) {
        const s = spriteSource(name);
        if (!s) continue;
        const p = 0.7, L = this.layer(p, -speed, 3);
        const w = s.w * 1.8, h = s.h * 1.8;
        for (let k = -3; k * w < st.stageWidth * p + VIEW_W * 3 + 4000; k++) {
          const m = this.quad(name, k * w, 276 + dy - h * 0.5, w + 1, h, { opacity: alpha, tint });
          if (m) L.add(m);
        }
      }
    }
    // ordem de desenho igual à do 2D (as camadas transparentes não dependem da distância)
    // (só nas peças: num grupo, o Three usa a ordem do grupo antes de todas as outras)
    for (const l of this.layers) l.group.traverse((o) => { if (o instanceof THREE.Mesh) o.renderOrder = l.group.userData.order ?? 0; });
    this.buildTerrain(st);
  }

  // ───────────────────────── terreno em blocos ─────────────────────────

  /** Textura repetível de um bloco do atlas (mode 'side': o desenho; 'top': superfície feita das cores do topo do bloco). */
  private tile(name: string, mode: 'side' | 'top'): THREE.Texture | null {
    const key = name + ':' + mode;
    const hit = this.tileTex.get(key);
    if (hit) return hit;
    const src = spriteSource(name);
    if (!src) return null;
    const c = document.createElement('canvas');
    c.width = src.w; c.height = src.h;
    const g = c.getContext('2d')!;
    g.drawImage(src.img, src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
    if (mode === 'top') {
      // superfície vista de cima: pixels sorteados das linhas de cima do bloco (grama, neve, areia, pedra...)
      const band = g.getImageData(0, 0, src.w, Math.max(2, Math.round(src.h * 0.4)));
      const solid: number[] = [];
      for (let i = 0; i < band.data.length; i += 4) if (band.data[i + 3] > 200) solid.push(i);
      const out = g.createImageData(src.w, src.w);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < out.data.length; i += 4) {
        const j = solid.length ? solid[Math.floor(rnd() * solid.length)] : 0;
        out.data[i] = band.data[j]; out.data[i + 1] = band.data[j + 1]; out.data[i + 2] = band.data[j + 2]; out.data[i + 3] = 255;
      }
      c.height = src.w;
      g.putImageData(out, 0, 0);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    this.tileTex.set(key, t);
    return t;
  }

  /** Retângulo vertical (frente/lateral) ou horizontal (topo/fundo) com UV em unidades de bloco. */
  private face(tex: THREE.Texture | null, pts: number[][], uv: number[][], shade: [number, number], opts: { cut?: boolean } = {}): { geo: THREE.BufferGeometry; tex: THREE.Texture | null; cut: boolean } {
    const geo = new THREE.BufferGeometry();
    // pts: 4 cantos (cima-esq, cima-dir, baixo-esq, baixo-dir) em coordenadas do mundo [x, y(para baixo), z]
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(([x, y, z]) => [x, -y, z]), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
    // sombreado escrito como no 2D (multiplica a cor na tela): converte para o espaço linear da cena
    const [a, b] = shade.map((v) => Math.pow(v, 2.2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute([a, a, a, a, a, a, b, b, b, b, b, b], 3));
    geo.setIndex([0, 2, 1, 1, 2, 3]);
    geo.computeVertexNormals();
    return { geo, tex, cut: !!opts.cut };
  }

  private buildTerrain(st: BackdropState): void {
    this.terrain.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    this.terrain.clear();
    const tiles = PX_TILES[st.theme];
    const top = this.tile(tiles.top, 'side'), fill = this.tile(tiles.fill, 'side'), surf = this.tile(tiles.top, 'top');
    const plat = this.tile(tiles.plat, 'side'), platSurf = this.tile(tiles.plat, 'top');
    const aspect = (n: string) => { const s2 = spriteSource(n); return s2 ? s2.h / s2.w : 1; };
    const topH = Math.round(TILE_W * aspect(tiles.top)), fillH = Math.round(TILE_W * aspect(tiles.fill));
    const U = (x: number) => x / TILE_W;
    // as faces com a mesma textura viram uma peça só (menos chamadas de desenho)
    const buckets = new Map<string, { tex: THREE.Texture | null; cut: boolean; geos: THREE.BufferGeometry[] }>();
    const add = (f: { geo: THREE.BufferGeometry; tex: THREE.Texture | null; cut: boolean }) => {
      const key = (f.tex?.uuid ?? 'none') + (f.cut ? ':cut' : '');
      const b = buckets.get(key) ?? { tex: f.tex, cut: f.cut, geos: [] };
      b.geos.push(f.geo);
      buckets.set(key, b);
    };
    const g = st.terrain.ground;
    g.forEach((sg, i) => {
      const { x0, x1, y } = sg;
      // topo: a superfície vai para dentro da tela (mais escura no fundo)
      add(this.face(surf, [[x0, y, -GROUND_D], [x1, y, -GROUND_D], [x0, y, 0], [x1, y, 0]],
        [[U(x0), 0], [U(x1), 0], [U(x0), GROUND_D / TILE_W], [U(x1), GROUND_D / TILE_W]], [0.72, 1]));
      // frente: recheio (escurece para baixo) e a faixa do topo por cima, com a borda recortada
      // como no 2D: escurece nos primeiros 128 px e fica escuro daí para baixo
      const fy = y + topH - 10, my = fy + 128;
      const V = (yy: number) => (yy - fy) / fillH;
      add(this.face(fill, [[x0, fy, 0], [x1, fy, 0], [x0, my, 0], [x1, my, 0]],
        [[U(x0), 0], [U(x1), 0], [U(x0), V(my)], [U(x1), V(my)]], [0.85, 0.4]));
      add(this.face(fill, [[x0, my, 0], [x1, my, 0], [x0, WORLD_BOTTOM, 0], [x1, WORLD_BOTTOM, 0]],
        [[U(x0), V(my)], [U(x1), V(my)], [U(x0), V(WORLD_BOTTOM)], [U(x1), V(WORLD_BOTTOM)]], [0.4, 0.4]));
      // a faixa da frente começa na linha dos pés (no 2D sobe 8 px; aqui esconderia o topo do bloco)
      add(this.face(top, [[x0, y - 2, 0.4], [x1, y - 2, 0.4], [x0, y - 2 + topH, 0.4], [x1, y - 2 + topH, 0.4]],
        [[U(x0), 1], [U(x1), 1], [U(x0), 0], [U(x1), 0]], [1, 0.95], { cut: true }));
      // laterais dos degraus (onde o vizinho é mais baixo)
      for (const [nb, x] of [[g[i - 1], x0], [g[i + 1], x1]] as const) {
        if (!nb || nb.y <= y) continue;
        add(this.face(fill, [[x, y, 0], [x, y, -GROUND_D], [x, nb.y, 0], [x, nb.y, -GROUND_D]],
          [[0, 0], [GROUND_D / TILE_W, 0], [0, (nb.y - y) / fillH], [GROUND_D / TILE_W, (nb.y - y) / fillH]], [0.6, 0.45]));
      }
    });
    for (const p of st.terrain.platforms) {
      const { x0, x1, y } = p;
      const th = Math.round(52 * aspect(tiles.plat));
      const by = y - 10 + th;
      add(this.face(platSurf, [[x0, y, -PLAT_D], [x1, y, -PLAT_D], [x0, y, 0], [x1, y, 0]],
        [[U(x0), 0], [U(x1), 0], [U(x0), PLAT_D / TILE_W], [U(x1), PLAT_D / TILE_W]], [0.72, 1]));
      add(this.face(null, [[x0, by - 2, 0], [x1, by - 2, 0], [x0, by - 2, -PLAT_D], [x1, by - 2, -PLAT_D]],
        [[0, 0], [1, 0], [0, 1], [1, 1]], [0.5, 0.3]));
      for (const x of [x0, x1]) {
        add(this.face(plat, [[x, y - 10, 0], [x, y - 10, -PLAT_D], [x, by, 0], [x, by, -PLAT_D]],
          [[0, 1], [PLAT_D / 52, 1], [0, 0], [PLAT_D / 52, 0]], [0.6, 0.6], { cut: true }));
      }
      add(this.face(plat, [[x0, y - 10, 0.4], [x1, y - 10, 0.4], [x0, by, 0.4], [x1, by, 0.4]],
        [[0, 1], [(x1 - x0) / 52, 1], [0, 0], [(x1 - x0) / 52, 0]], [1, 0.9], { cut: true }));
    }
      for (const b of buckets.values()) {
      const geo = mergeGeometries(b.geos);
      b.geos.forEach((g2) => g2.dispose());
      const mat = new THREE.MeshLambertMaterial({ map: b.tex, vertexColors: true, color: b.tex ? 0xffffff : 0x1a1620, side: THREE.DoubleSide,
        transparent: b.cut, alphaTest: b.cut ? 0.5 : 0 });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 5;
      this.terrain.add(m);
    }
  }

  // ───────────────────────── camada dos personagens ─────────────────────────

  /**
   * Começa a camada dos personagens: devolve um contexto 2D já limpo e escalado, em que (0, 0) é o canto de cima
   * da área visível do mundo (vw × vh px lógicos). O jogo desenha nela personagens, monstros, NPCs e objetos.
   */
  beginActors(vw: number, vh: number): CanvasRenderingContext2D {
    const r = Math.min(2.5, (Math.min(window.devicePixelRatio || 1, 2) * window.innerHeight) / vh);
    const W = Math.ceil(vw * r), H = Math.ceil(vh * r);
    if (this.actorCanvas.width !== W || this.actorCanvas.height !== H) {
      this.actorCanvas.width = W;
      this.actorCanvas.height = H;
      this.actorTex?.dispose();
      this.actorTex = null;
    }
    this.actorView = { w: vw, h: vh, r };
    const g = this.actorCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.setTransform(r, 0, 0, r, 0, 0);
    return g;
  }

  /** Pronto para desenhar (prancha de cenário carregada)? */
  ready(): boolean {
    return !!spriteSource('layer_clouds');
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
    // luzes dos poderes no primeiro plano: um pouco à frente do efeito, iluminam terreno e personagens
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const L = this.points[i];
      const src = st.lights[i];
      if (!src) { L.intensity = 0; continue; }
      L.position.set(src.x, -(src.y - 24), 46);
      L.color.set(src.color);
      L.intensity = src.power * Math.PI * 26;
    }
    // camada dos personagens: placa do tamanho da área visível, sem tremer (a câmera é que treme)
    const av = this.actorView;
    if (av.w) {
      if (!this.actorTex) {
        this.actorTex = new THREE.CanvasTexture(this.actorCanvas);
        this.actorTex.colorSpace = THREE.SRGBColorSpace;
        this.actorTex.minFilter = THREE.LinearFilter;
        this.actorTex.generateMipmaps = false;
        const mat = this.actorMesh.material as THREE.MeshLambertMaterial;
        mat.map = this.actorTex;
        mat.needsUpdate = true;
      }
      this.actorTex.needsUpdate = true;
      this.actorMesh.visible = true;
      this.actorMesh.scale.set(av.w, av.h, 1);
      this.actorMesh.position.set(st.camX + av.w / 2, -(st.camY + av.h / 2), 0);
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
