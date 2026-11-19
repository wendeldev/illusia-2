import { VIEW_W, type Point } from './view';

export type Action = 'attack' | 'jump' | 'skill1' | 'skill2' | 'skill3' | 'interact' | 'menu';

export interface TouchButton {
  action: Action;
  x: number;
  y: number;
  r: number;
  label: string;
}

const KEY_ACTIONS: Record<string, Action> = {
  KeyJ: 'attack', KeyZ: 'attack',
  KeyK: 'skill1', KeyX: 'skill1',
  KeyL: 'skill2', KeyC: 'skill2',
  KeyI: 'skill3', KeyV: 'skill3',
  KeyE: 'interact', Enter: 'interact', Space: 'jump',
  Escape: 'menu', KeyM: 'menu', Tab: 'menu',
};

const JOY_RADIUS = 40;

/** Junta teclado, mouse e toque (direcional virtual + botões) numa interface só. */
export class Input {
  axis: Point = { x: 0, y: 0 };
  touchMode = false;
  buttons: TouchButton[] = [];
  buttonsEnabled = true;
  joystick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  /** toques/cliques deste quadro (coordenadas lógicas), usados pelos menus */
  taps: Point[] = [];

  private keys = new Set<string>();
  private pressed = new Set<Action>();
  private pointerButtons = new Map<number, Action>();

  constructor(canvas: HTMLCanvasElement, private toLogical: (x: number, y: number) => Point) {
    window.addEventListener('keydown', (e) => {
      const action = KEY_ACTIONS[e.code];
      if (action || e.code.startsWith('Arrow')) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (action) this.pressed.add(action);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.joystick = null; });

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.pointerType === 'touch') this.touchMode = true;
      const p = this.toLogical(e.clientX, e.clientY);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (this.touchMode && this.buttonsEnabled) {
        const b = this.buttons.find((b) => (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= (b.r + 6) ** 2);
        if (b) {
          this.pointerButtons.set(e.pointerId, b.action);
          this.pressed.add(b.action);
          return;
        }
        if (p.x < VIEW_W / 2 && !this.joystick) {
          this.joystick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
          return;
        }
      }
      this.taps.push(p);
    });
    canvas.addEventListener('pointermove', (e) => {
      const j = this.joystick;
      if (!j || j.id !== e.pointerId) return;
      const p = this.toLogical(e.clientX, e.clientY);
      j.x = p.x;
      j.y = p.y;
      // a base do direcional acompanha o dedo se ele passar do raio
      const dx = j.x - j.ox, dy = j.y - j.oy, len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        j.ox = j.x - (dx / len) * JOY_RADIUS;
        j.oy = j.y - (dy / len) * JOY_RADIUS;
      }
    });
    const release = (e: PointerEvent) => {
      this.pointerButtons.delete(e.pointerId);
      if (this.joystick?.id === e.pointerId) this.joystick = null;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(): void {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('ArrowLeft') || k.has('KeyA')) x -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) x += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y -= 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y += 1;
    const j = this.joystick;
    if (j) {
      const dx = j.x - j.ox, dy = j.y - j.oy, len = Math.hypot(dx, dy);
      if (len > 6) {
        const m = Math.min(1, len / JOY_RADIUS);
        x += (dx / len) * m;
        y += (dy / len) * m;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.axis = { x, y };
  }

  /** true uma vez por aperto */
  consume(action: Action): boolean {
    return this.pressed.delete(action);
  }

  endFrame(): void {
    this.pressed.clear();
    this.taps = [];
  }
}
