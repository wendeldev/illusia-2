import { Input } from './engine/input.js';
import { initAudio } from './engine/audio.js';
import { Game } from './game/game.js';
import { VIEW_W, VIEW_H } from './game/render.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const input = new Input();
const ui = new UI();
const game = new Game(canvas, input, ui);
ui.bind(game);
input.bindTouch(document.getElementById('touch'));
window.__game = game; // útil para depurar no console

function resize() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  canvas.width = Math.round(VIEW_W * scale * dpr);
  canvas.height = Math.round(VIEW_H * scale * dpr);
  game.pixelScale = scale * dpr;
}
window.addEventListener('resize', resize);
resize();

['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, initAudio, { passive: true }));

// Passo fixo de 60 atualizações por segundo, desenho a cada quadro do navegador.
const STEP = 1000 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP) { game.update(); acc -= STEP; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(game.pixelScale, 0, 0, game.pixelScale, 0, 0);
  ctx.lineJoin = 'round';
  if (game.running) game.draw();
  else { ctx.fillStyle = '#141a33'; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

ui.showTitle();
