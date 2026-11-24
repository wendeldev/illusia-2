import { getEnemy, validateContent } from './data';
import { Input } from './engine/input';
import { loadSprites } from './engine/sprites';
import { setupCanvas, worldView } from './engine/view';
import type { Backdrop3D } from './engine/backdrop3d';
import { setBackdrop3D } from './game/art/scenery';
import { doll3d } from './game/art/layers';
import { Game } from './game/game';

validateContent();
void loadSprites();

const canvas = document.getElementById('game') as HTMLCanvasElement;
// 3D é o padrão; ?2d no endereço força o modo 2D (mais leve). Sem WebGL, o jogo fica em 2D.
const webgl = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // só o teste: libera o contexto
    return !!gl;
  } catch { return false; }
})();
const use3d = webgl && !new URLSearchParams(location.search).has('2d');
const bgCanvas = document.getElementById('bg3d') as HTMLCanvasElement;
let backdrop: Backdrop3D | null = null;
const view = setupCanvas(canvas, use3d);
if (use3d) {
  // o Three.js só é baixado no modo 3D
  import('./engine/backdrop3d').then(({ Backdrop3D, HeroPortrait }) => {
    backdrop = new Backdrop3D(bgCanvas);
    // telas (inventário, classes, eventos): o mesmo boneco 3D
    const portrait = new HeroPortrait();
    doll3d.draw = (ctx, cls, eq, x, y, facing, k, time) => portrait.draw(ctx, cls, eq, x, y, facing, k, time);
    bgCanvas.style.display = 'block';
    setBackdrop3D(true);
  }).catch((err) => console.error('Modo 3D indisponível (sem WebGL?)', err));
}
const input = new Input(canvas, view.toLogical);
const game = new Game(input);

// Para testes/depuração: abra com ?debug e use window.__game no console.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __game: game, __getEnemy: getEnemy });

let last = performance.now();
function frame(now: number) {
  // o primeiro carimbo de tempo pode vir antes de `last`: nunca deixa o passo ser negativo
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  // um erro num quadro não pode congelar o jogo: registra e segue para o próximo
  try {
    game.update(dt);
    // modo 3D: o jogo desenha personagens e objetos na camada do Three.js, e a cena 3D vem logo depois
    const bd = backdrop && backdrop.ready() ? backdrop : null;
    game.world.layer3d = bd;
    view.begin();
    game.render(view.ctx);
    if (bd) {
      worldView(true);
      try { bd.render(game.world.backdropState()); } finally { worldView(false); }
    }
  } catch (err) {
    console.error(err);
  } finally {
    view.end();
    requestAnimationFrame(frame);
  }
}
requestAnimationFrame(frame);

// Tela cheia no celular ao primeiro toque (quando o navegador permite).
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}, { once: true });

// PWA: permite instalar na tela inicial e jogar offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
