import { getEnemy, validateContent } from './data';
import { Input } from './engine/input';
import { setupCanvas } from './engine/view';
import { Game } from './game/game';

validateContent();

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = setupCanvas(canvas);
const input = new Input(canvas, view.toLogical);
const game = new Game(input);

// Para testes/depuração: abra com ?debug e use window.__game no console.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __game: game, __getEnemy: getEnemy });

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  view.begin();
  game.render(view.ctx);
  view.end();
  requestAnimationFrame(frame);
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
