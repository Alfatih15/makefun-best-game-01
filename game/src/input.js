// Keyboard and pointer input. Held keys give a movement vector and an aim; one-shot
// presses (start, restart, pause, dash, mute, upgrade choices) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost or counted twice.
// The mouse position is converted to playfield coordinates by the renderer-supplied
// toField function, so aiming works at any window size.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;
export const ACTION_CHOICE_1 = 16;
export const ACTION_CHOICE_2 = 32;
export const ACTION_CHOICE_3 = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyJ']);
const MUTE = new Set(['KeyM']);
const CHOICES = new Map([['Digit1', ACTION_CHOICE_1], ['Digit2', ACTION_CHOICE_2], ['Digit3', ACTION_CHOICE_3], ['Numpad1', ACTION_CHOICE_1], ['Numpad2', ACTION_CHOICE_2], ['Numpad3', ACTION_CHOICE_3]]);

export function createInput(target, toField) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let firing = false;
  let actions = 0;
  let mouseX = 640;
  let mouseY = 360;
  let mouseDownAt = null;

  function trackPointer(event) {
    const point = toField(event.clientX, event.clientY);
    mouseX = point.x;
    mouseY = point.y;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CHOICES.has(event.code)) {
      if (!event.repeat) actions |= CHOICES.get(event.code);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    firing = false;
  });
  target.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    firing = true;
    mouseDownAt = { x: mouseX, y: mouseY };
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    firing = false;
    mouseDownAt = null;
  });
  window.addEventListener('pointermove', trackPointer);

  return {
    /** Normalised movement vector (-1..1 on each axis). */
    move() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    aim() {
      return { x: mouseX, y: mouseY };
    },
    isFiring() {
      return firing;
    },
    /** Where the pointer went down, if it is still down (for upgrade-card clicks). */
    clickPoint() {
      return mouseDownAt;
    },
    clearClick() {
      mouseDownAt = null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
