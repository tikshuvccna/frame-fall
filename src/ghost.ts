/**
 * The ghost: a see-through replay of the player's best run in a race round, so there is always someone to beat.
 * A run is the player's position ten times a second. Runs are kept in their own storage key (they are bigger than the save).
 */
import * as THREE from 'three';
import { Actor } from './actor';
import { textTexture } from './toon';

export interface GhostRun { t: number; char: string; hat: string | null; p: number[] }
const KEY = 'crownrun.ghost.v1';
export const GHOST_HZ = 10;

function all(): Record<string, GhostRun> {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, GhostRun>) ?? {}; } catch { return {}; }
}
export function loadGhost(id: string): GhostRun | null { return all()[id] ?? null; }
export function saveGhost(id: string, run: GhostRun): void {
  const a = all();
  a[id] = run;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage full or blocked: no ghost, the game goes on */ }
}
export function clearGhosts(): void { try { localStorage.removeItem(KEY); } catch { /* no storage */ } }

let label: THREE.SpriteMaterial | null = null;

/** Plays a recorded run back on a ghost runner. */
export class Ghost {
  readonly actor: Actor;
  private px = 0; private py = 0; private pz = 0;
  constructor(scene: THREE.Scene, private run: GhostRun) {
    const a = new Actor(run.char, false);
    a.wear(run.hat, '#9fe3ff');
    a.ghostify();
    label ??= new THREE.SpriteMaterial({ map: textTexture('השיא שלך', { w: 512, h: 128, bg: '#ffffff', fg: '#3aa0d8', border: '#3aa0d8', rtl: true }), transparent: true, opacity: 0.85, depthWrite: false });
    const sp = new THREE.Sprite(label);
    sp.scale.set(1.5, 0.375, 1);
    sp.position.y = 2.35;
    a.root.add(sp);
    this.actor = a;
    scene.add(a.root);
    this.place(0, 0.016);
  }
  /** Put the ghost where the best run was at race time t. */
  place(t: number, dt: number): void {
    const p = this.run.p, n = p.length / 3;
    if (n === 0) return;
    const f = t * GHOST_HZ, i = Math.min(n - 1, Math.floor(f)), j = Math.min(n - 1, i + 1), u = Math.min(1, f - i);
    const x = p[i * 3] + (p[j * 3] - p[i * 3]) * u, y = p[i * 3 + 1] + (p[j * 3 + 1] - p[i * 3 + 1]) * u, z = p[i * 3 + 2] + (p[j * 3 + 2] - p[i * 3 + 2]) * u;
    const a = this.actor;
    const d = Math.max(dt, 1e-3);
    a.vx = (x - this.px) / d; a.vz = (z - this.pz) / d;
    const vy = (y - this.py) / d;
    a.x = x; a.y = y; a.z = z;
    a.grounded = Math.abs(vy) < 1.2; a.groundY = y;
    this.px = x; this.py = y; this.pz = z;
    a.root.visible = t < this.run.t + 1.5;
    a.animate(dt);
  }
}
