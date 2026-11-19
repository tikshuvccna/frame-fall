/**
 * Things to pick up during a round: coins along the course (spent in the locker) and one hidden knowledge card per
 * round (collected in the album). Only the player collects. Places are fixed per round (seeded by the round id),
 * so a hidden card is always in the same spot and can be hunted for.
 */
import * as THREE from 'three';
import type { Actor } from './actor';
import { Tile } from './blocks';
import { outlineMat, textTexture, toonGradient } from './toon';
import type { World } from './world';

interface Thing { m: THREE.Object3D; x: number; y: number; z: number; taken: boolean; ph: number; pop: number }

export function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

let coinGeo: THREE.CylinderGeometry | null = null, coinMat: THREE.MeshToonMaterial | null = null;
function coinMesh(): THREE.Mesh {
  coinGeo ??= new THREE.CylinderGeometry(0.34, 0.34, 0.09, 20).rotateX(Math.PI / 2);
  coinMat ??= new THREE.MeshToonMaterial({ color: '#ffcc33', emissive: '#7a5200', emissiveIntensity: 0.35, gradientMap: toonGradient() });
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.add(new THREE.Mesh(coinGeo, outlineMat(0.03)));
  return m;
}
let cardTex: THREE.CanvasTexture | null = null;
function cardMesh(): THREE.Group {
  const g = new THREE.Group();
  cardTex ??= textTexture('?', { w: 192, h: 256, bg: '#7b6cf6', fg: '#ffffff', border: '#ffd23f' });
  const geo = new THREE.BoxGeometry(0.7, 0.95, 0.07);
  const side = new THREE.MeshToonMaterial({ color: '#ffd23f', gradientMap: toonGradient() });
  const face = new THREE.MeshBasicMaterial({ map: cardTex });
  const c = new THREE.Mesh(geo, [side, side, side, side, face, face]);
  c.add(new THREE.Mesh(geo, outlineMat(0.035)));
  g.add(c);
  const sp = new THREE.OctahedronGeometry(0.08);
  const sm = new THREE.MeshBasicMaterial({ color: '#fff3a0' });
  for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(sp, sm); s.userData.k = k; g.add(s); }
  return g;
}

export interface PickupEvents { coin(x: number, y: number, z: number): void; card(x: number, y: number, z: number): void }

export class Pickups {
  readonly coins: Thing[] = [];
  card: Thing | null = null;
  got = 0;
  cardGot = false;
  private survive: boolean;
  /** collect rounds: every runner picks up coins; this is the score. */
  readonly score = new Map<Actor, number>();
  private collect: boolean;
  private rand: () => number;
  private spawnT = 0;
  private cardAt = -1;

  constructor(private scene: THREE.Scene, private world: World, mode: 'race' | 'survive' | 'collect', seed: string, finishZ: number, withCard: boolean,
    private area: [number, number, number] = [0, 0, 10]) {
    this.survive = mode === 'survive';
    this.collect = mode === 'collect';
    this.rand = rng(seed);
    if (this.survive || this.collect) { if (withCard) this.cardAt = 15 + this.rand() * 15; return; }
    this.placeRace(finishZ, withCard);
  }

  /** A solid floor top at (x, z), or null (no tiles: coins must not give away hidden paths). */
  private floorAt(x: number, z: number): number | null {
    const g = this.world.groundAt(x, 400, z);
    if (!g || g.solid instanceof Tile) return null;
    return g.y;
  }

  private placeRace(finishZ: number, withCard: boolean): void {
    const r = this.rand;
    for (let z = -18; z > finishZ + 6; z -= 9 + r() * 5) {
      const x0 = (r() - 0.5) * 7;
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const x = x0 + (r() - 0.5) * 0.6, zz = z - k * 1.5;
        const y = this.floorAt(x, zz);
        if (y !== null) this.addCoin(x, y + 1.0, zz);
      }
    }
    if (!withCard) return;
    // the card: off the main line, near an edge, somewhere in the middle of the course
    for (let tries = 0; tries < 40; tries++) {
      const z = finishZ * (0.3 + r() * 0.45);
      const side = r() < 0.5 ? -1 : 1;
      for (let x = 7.5; x >= 2.5; x -= 0.5) {
        const y = this.floorAt(side * x, z);
        if (y !== null) { this.card = this.thing(cardMesh(), side * (x - 0.6), y + 2.3, z); return; }
      }
    }
  }

  private thing(m: THREE.Object3D, x: number, y: number, z: number): Thing {
    m.position.set(x, y, z);
    this.scene.add(m);
    return { m, x, y, z, taken: false, ph: this.rand() * 6, pop: 0 };
  }
  private addCoin(x: number, y: number, z: number): void { this.coins.push(this.thing(coinMesh(), x, y, z)); }

  /** survive rounds: drop a coin on some floor near the player now and then. */
  private spawnNear(p: Actor): void {
    for (let tries = 0; tries < 12; tries++) {
      const x = p.x + (this.rand() - 0.5) * 16, z = p.z + (this.rand() - 0.5) * 16;
      const g = this.world.groundAt(x, p.y + 3, z);
      if (g && Math.abs(g.y - p.y) < 3) { this.addCoin(x, g.y + 1.0, z); return; }
    }
  }

  /** collect rounds: keep the arena full of coins. */
  private fill(): void {
    const [cx, cz, R] = this.area;
    let live = this.coins.filter((c) => !c.taken).length;
    for (let tries = 0; tries < 30 && live < 16; tries++) {
      const x = cx + (this.rand() - 0.5) * 2 * R, z = cz + (this.rand() - 0.5) * 2 * R;
      const g = this.world.groundAt(x, 60, z);
      if (g && !(g.solid instanceof Tile)) { this.addCoin(x, g.y + 1.0, z); live++; }
    }
  }
  /** A runner fell: it loses up to n coins (collect rounds). */
  drop(a: Actor, n: number): number {
    const have = this.score.get(a) ?? 0, k = Math.min(have, n);
    this.score.set(a, have - k);
    if (a.isPlayer) this.got = have - k;
    return k;
  }

  update(t: number, dt: number, racing: boolean, p: Actor, ev: PickupEvents, all: Actor[] = []): void {
    if (this.collect) { this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = 0.5; this.fill(); } }
    if ((this.survive || this.collect) && racing && !p.eliminated) {
      this.spawnT -= dt;
      const live = this.coins.filter((c) => !c.taken).length;
      if (this.survive && this.spawnT <= 0 && live < 5) { this.spawnT = 2.5; this.spawnNear(p); }
      if (this.cardAt > 0 && t > this.cardAt && !this.card) {
        for (let tries = 0; tries < 20 && !this.card; tries++) {
          const x = p.x + (this.rand() - 0.5) * 14, z = p.z + (this.rand() - 0.5) * 14;
          const g = this.world.groundAt(x, p.y + 3, z);
          if (g && Math.abs(g.y - p.y) < 2) this.card = this.thing(cardMesh(), x, g.y + 1.5, z);
        }
      }
    }
    const py = p.y + 0.6;
    for (const c of this.coins) {
      if (c.taken) {
        if (c.pop > 0) { c.pop -= dt; c.m.position.y += dt * 4; c.m.scale.setScalar(Math.max(0.01, c.pop * 3)); if (c.pop <= 0) c.m.visible = false; }
        continue;
      }
      c.m.rotation.y = t * 3 + c.ph;
      c.m.position.y = c.y + Math.sin(t * 3 + c.ph) * 0.12;
      if (!racing) continue;
      const who = this.collect ? all : [p];
      for (const a of who) {
        if (a.eliminated || Math.abs(a.x - c.x) >= 0.85 || Math.abs(a.z - c.z) >= 0.85 || Math.abs(a.y + 0.6 - c.y) >= 1.1) continue;
        c.taken = true; c.pop = 0.3;
        this.score.set(a, (this.score.get(a) ?? 0) + 1);
        if (a === p) { this.got++; ev.coin(c.x, c.y, c.z); }
        break;
      }
    }
    const k = this.card;
    if (k && !k.taken) {
      k.m.rotation.y = t * 1.6;
      k.m.position.y = k.y + Math.sin(t * 2) * 0.18;
      k.m.children.forEach((s) => { const i = s.userData.k as number | undefined; if (i !== undefined) { const a = t * 2.5 + i * Math.PI / 2; s.position.set(Math.cos(a) * 0.65, Math.sin(a * 1.3) * 0.4, Math.sin(a) * 0.3); } });
      if (racing && !p.eliminated && Math.abs(p.x - k.x) < 1 && Math.abs(p.z - k.z) < 1 && Math.abs(py - k.y) < 1.5) {
        k.taken = true; this.cardGot = true; k.m.visible = false; ev.card(k.x, k.y, k.z);
      }
    }
  }
}
