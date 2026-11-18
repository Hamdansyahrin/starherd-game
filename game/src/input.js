// Pointer and keyboard state for STARHERD.
// The Wisp seeks a target point: the mouse sets it directly, and the
// arrow keys / WASD nudge the same point, so mouse-only and keyboard-only
// play both work. Discrete presses are queued as named events for main.js.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.targetX = 640;
    this.targetY = 360;
    this.hasPointer = false;
    this.keys = new Set();
    this.events = [];
    this.clicks = [];

    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerdown', (e) => {
      this.onMove(e);
      this.clicks.push({ x: this.targetX, y: this.targetY });
      this.events.push('press');
    });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    this.targetX = (e.clientX - rect.left) * sx;
    this.targetY = (e.clientY - rect.top) * sy;
    this.hasPointer = true;
  }

  onKey(e, down) {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
      e.preventDefault();
    }
    if (down) {
      if (!this.keys.has(code)) {
        this.keys.add(code);
        if (code === 'Enter' || code === 'Space') this.events.push('press');
        if (code === 'KeyP' || code === 'Escape') this.events.push('pause');
        if (code === 'KeyM') this.events.push('mute');
        if (code === 'Digit1') this.events.push('pick0');
        if (code === 'Digit2') this.events.push('pick1');
        if (code === 'Digit3') this.events.push('pick2');
      }
    } else {
      this.keys.delete(code);
    }
  }

  // Keyboard steering nudges the target point at a steady rate.
  steer(dt) {
    const step = 560 * dt;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.targetX -= step;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.targetX += step;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) this.targetY -= step;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) this.targetY += step;
    this.targetX = Math.max(16, Math.min(1264, this.targetX));
    this.targetY = Math.max(16, Math.min(704, this.targetY));
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  drainClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }
}
