// Teclado + botões de toque unificados em "ações".
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyK: 'jump', KeyJ: 'attack', KeyX: 'attack', KeyL: 'dash', KeyC: 'dash', ShiftLeft: 'dash',
  KeyU: 'skill1', Digit1: 'skill1', KeyI: 'skill2', Digit2: 'skill2', KeyO: 'skill3', Digit3: 'skill3',
  KeyQ: 'potion', KeyE: 'potion2', Tab: 'menu', Escape: 'menu', KeyM: 'menu',
};

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    window.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      e.preventDefault();
      if (!e.repeat) this.press(a);
    });
    window.addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this.release(a); });
    window.addEventListener('blur', () => this.down.clear());
  }
  press(a) { if (!this.down.has(a)) this.pressed.add(a); this.down.add(a); }
  release(a) { this.down.delete(a); }
  isDown(a) { return this.down.has(a); }
  wasPressed(a) { return this.pressed.has(a); }
  endFrame() { this.pressed.clear(); }
  clear() { this.down.clear(); this.pressed.clear(); }

  bindTouch(root) {
    root.querySelectorAll('[data-action]').forEach((el) => {
      const a = el.dataset.action;
      const on = (e) => { e.preventDefault(); el.classList.add('on'); this.press(a); };
      const off = (e) => { e.preventDefault(); el.classList.remove('on'); this.release(a); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    });
  }
}
