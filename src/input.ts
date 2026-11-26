/** Player input: keyboard (arrows or WASD, Space = jump, Shift or X = dive) and touch (stick on the left, two buttons on the right). */
import type { Controls } from './actor';

const keys = new Set<string>();
let jumpEdge = false, diveEdge = false, jumpHeld = false;
let stickX = 0, stickZ = 0, stickId = -1, sx0 = 0, sy0 = 0;

export function initInput(): void {
  const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', (e) => {
    if (isTyping(e.target) || !document.body.classList.contains('playing')) return;
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') { jumpEdge = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') diveEdge = true;
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  const pad = document.getElementById('pad') as HTMLElement, knob = document.getElementById('knob') as HTMLElement;
  const base = document.getElementById('stick') as HTMLElement;
  const R = 46;
  pad.addEventListener('pointerdown', (e) => {
    if (stickId !== -1) return;
    stickId = e.pointerId; sx0 = e.clientX; sy0 = e.clientY;
    pad.setPointerCapture(e.pointerId);
    base.style.left = sx0 + 'px'; base.style.top = sy0 + 'px'; base.classList.add('on');
    knob.style.transform = 'translate(-50%, -50%)';
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - sx0, dy = e.clientY - sy0;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    stickX = dx / R; stickZ = dy / R;
    knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1; stickX = stickZ = 0; base.classList.remove('on');
  };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);

  const jb = document.getElementById('btnJump') as HTMLElement, db = document.getElementById('btnDive') as HTMLElement;
  jb.addEventListener('pointerdown', (e) => { jumpEdge = true; jumpHeld = true; e.preventDefault(); });
  jb.addEventListener('pointerup', () => { jumpHeld = false; });
  jb.addEventListener('pointercancel', () => { jumpHeld = false; });
  db.addEventListener('pointerdown', (e) => { diveEdge = true; e.preventDefault(); });
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
}

/** Fill the player's controls for one physics step (jump and dive are reported once per press). */
export function readInput(c: Controls): void {
  let ix = stickX, iz = stickZ;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) ix -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) ix += 1;
  if (keys.has('ArrowUp') || keys.has('KeyW')) iz -= 1;
  if (keys.has('ArrowDown') || keys.has('KeyS')) iz += 1;
  if (Math.hypot(ix, iz) < 0.18) { ix = 0; iz = 0; }
  c.ix = ix; c.iz = iz;
  c.jump = jumpEdge; c.dive = diveEdge;
  c.jumpHeld = jumpHeld || keys.has('Space');
  jumpEdge = false; diveEdge = false;
}
