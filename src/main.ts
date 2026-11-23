import { getEnemy, validateContent } from './data';
import { Input } from './engine/input';
import { loadSprites } from './engine/sprites';
import { setupCanvas, worldView } from './engine/view';
import type { Backdrop3D } from './engine/backdrop3d';
import { setBackdrop3D } from './game/art/scenery';
import { Game } from './game/game';

validateContent();
void loadSprites();

const canvas = document.getElementById('game') as HTMLCanvasElement;
// modo 3D (protótipo): ?3d no endereço. O fundo em profundidade é do Three.js; o jogo é desenhado por cima.
const use3d = new URLSearchParams(location.search).has('3d');
const bgCanvas = document.getElementById('bg3d') as HTMLCanvasElement;
let backdrop: Backdrop3D | null = null;
const view = setupCanvas(canvas, use3d);
if (use3d) {
  // o Three.js só é baixado no modo 3D
  import('./engine/backdrop3d').then(({ Backdrop3D }) => {
    backdrop = new Backdrop3D(bgCanvas);
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
    if (backdrop) {
      worldView(true);
      try { backdrop.render(game.world.backdropState()); } finally { worldView(false); }
    }
    view.begin();
    game.render(view.ctx);
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
