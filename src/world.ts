/**
 * Course building blocks. Solids are things a runner stands on or bumps into (boxes, ramps, discs, conveyors, moving
 * platforms). Hazards are things that hit a runner (bumpers, spinning bars, hammers, rolling balls).
 * World: Y up, courses run toward -Z.
 */
import * as THREE from 'three';
import { Actor, RADIUS } from './actor';
import { kit, kitNode } from './models';
import { outlineMat, toonGradient } from './toon';

const STEP = 0.42;      // a runner walks up ledges this high
const BODY = 1.15;      // height of a runner for side hits

export interface Ground { y: number; vx: number; vz: number; grip: number; solid: Solid }
export interface Fx { shake(amount: number): void; sound(name: 'boing' | 'whack'): void }
/** What a hazard tells a bot: steer sideways (sx), aim at an x (tx), slow or back off (speed), jump now. */
export interface Advice { sx: number; speed: number; jump: boolean; tx: number | null }

function toonMat(color: THREE.ColorRepresentation, map?: THREE.Texture): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, map: map ?? null, gradientMap: toonGradient() });
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d') as CanvasRenderingContext2D);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.userData.round = true;      // made for one round: freed when the round is replaced
  return t;
}
const checkerCache = new Map<string, THREE.CanvasTexture>();
function checker(a: string, b: string): THREE.CanvasTexture {
  const key = a + b;
  let t = checkerCache.get(key);
  if (!t) {
    t = canvasTex(128, 128, (g) => { g.fillStyle = a; g.fillRect(0, 0, 128, 128); g.fillStyle = b; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); });
    checkerCache.set(key, t);
  }
  return t;
}
function withOutline(m: THREE.Mesh, t = 0.05): THREE.Mesh {
  const ol = new THREE.Mesh(m.geometry, outlineMat(t));
  ol.raycast = () => {};
  m.add(ol);
  return m;
}

export const PALETTES: Record<string, [string, string, number]> = {
  cream: ['#fff4d6', '#ffd9ec', 0xff8fb8],
  mint: ['#e2ffe9', '#b5f0c6', 0x4fd1a5],
  sky: ['#e3f4ff', '#bfe0ff', 0x5ac8fa],
  violet: ['#efe9ff', '#d5c8ff', 0x7b6cf6],
  sun: ['#fff6cc', '#ffe58a', 0xffb347],
};

// ===================================================================== solids
export abstract class Solid {
  readonly mesh = new THREE.Group();
  grip = 1;
  bounce = 0;
  alive = true;
  /** Called while a runner stands on it. */
  stand(_a: Actor): void { /* nothing by default */ }
  refTop(): number { return 0; }
  vx = 0; vz = 0; vy = 0;
  abstract topAt(x: number, z: number): number | null;
  abstract bottom(): number;
  /** Push a runner's circle out of the solid's sides. Returns true when it touched. */
  abstract pushOut(a: Actor): boolean;
  velAt(_x: number, _z: number): [number, number] { return [this.vx, this.vz]; }
  update(_t: number, _dt: number): void { /* static by default */ }
}

export interface BoxOpts { pal?: keyof typeof PALETTES; h?: number; rise?: number; grip?: number; conveyor?: number; plain?: string; bounce?: number; move?: (t: number) => [number, number, number] }

/** A box platform. `rise` makes it a ramp: the top climbs by `rise` metres from its +Z end to its -Z end. */
export class Box extends Solid {
  private h: number; private rise: number; private conveyor: number;
  private tex: THREE.Texture | null = null;
  private move?: (t: number) => [number, number, number];
  private bx: number; private by: number; private bz: number;
  constructor(public cx: number, public top: number, public cz: number, public hx: number, public hz: number, o: BoxOpts = {}) {
    super();
    this.h = o.h ?? 1.2; this.rise = o.rise ?? 0; this.conveyor = o.conveyor ?? 0;
    this.grip = o.grip ?? 1; this.bounce = o.bounce ?? 0; this.move = o.move;
    this.bx = cx; this.by = top; this.bz = cz;
    const pal = PALETTES[o.pal ?? 'cream'];
    const w = hx * 2, d = hz * 2;
    let topMat: THREE.Material;
    if (this.conveyor) {
      this.tex = canvasTex(128, 128, (g) => {
        g.fillStyle = this.conveyor > 0 ? '#d9577f' : '#3f9e7a'; g.fillRect(0, 0, 128, 128);
        g.fillStyle = this.conveyor > 0 ? '#ffe3ec' : '#eaffd9';
        g.beginPath(); g.moveTo(64, 20); g.lineTo(104, 70); g.lineTo(80, 70); g.lineTo(80, 108); g.lineTo(48, 108); g.lineTo(48, 70); g.lineTo(24, 70); g.closePath(); g.fill();
      });
      this.tex.repeat.set(Math.max(1, Math.round(w / 2.2)), Math.max(1, Math.round(d / 2.2)));
      if (this.conveyor > 0) this.tex.rotation = Math.PI;       // arrows point where the belt carries you
      this.tex.center.set(0.5, 0.5);
      topMat = toonMat(0xffffff, this.tex);
    } else if (o.plain) {
      topMat = toonMat(o.plain);
    } else {
      const t = checker(pal[0], pal[1]).clone();
      t.needsUpdate = true;
      t.repeat.set(w / 8, d / 8);
      topMat = toonMat(0xffffff, t);
    }
    const side = toonMat(o.plain ? new THREE.Color(o.plain).multiplyScalar(0.8) : pal[2]);
    const geo = new THREE.BoxGeometry(w, this.h, d);
    if (this.rise) {     // raise the far (-Z) end
      const p = geo.getAttribute('position');
      for (let i = 0; i < p.count; i++) if (p.getZ(i) < 0) p.setY(i, p.getY(i) + this.rise);
      geo.computeVertexNormals();
    }
    const body = new THREE.Mesh(geo, [side, side, topMat, side, side, side]);
    body.position.y = -this.h / 2;
    this.mesh.add(body);
    if (!this.rise) {
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.22, d + 0.3), toonMat(0xffffff));
      rim.position.y = -0.2;
      this.mesh.add(rim);
    }
    this.mesh.position.set(cx, top, cz);
  }
  topAt(x: number, z: number): number | null {
    if (Math.abs(x - this.cx) > this.hx + 0.12 || Math.abs(z - this.cz) > this.hz + 0.12) return null;
    if (!this.rise) return this.top;
    const u = THREE.MathUtils.clamp((this.cz + this.hz - z) / (this.hz * 2), 0, 1);
    return this.top + u * this.rise;
  }
  bottom(): number { return this.top - this.h; }
  refTop(): number { return this.top; }
  pushOut(a: Actor): boolean {
    const dx = a.x - this.cx, dz = a.z - this.cz, ex = this.hx + RADIUS, ez = this.hz + RADIUS;
    if (Math.abs(dx) >= ex || Math.abs(dz) >= ez) return false;
    const px = ex - Math.abs(dx), pz = ez - Math.abs(dz);
    if (px < pz) { a.x = this.cx + Math.sign(dx || 1) * ex; if (a.vx * Math.sign(dx || 1) < this.vx * Math.sign(dx || 1)) a.vx = this.vx; }
    else { a.z = this.cz + Math.sign(dz || 1) * ez; if (a.vz * Math.sign(dz || 1) < this.vz * Math.sign(dz || 1)) a.vz = this.vz; }
    return true;
  }
  velAt(): [number, number] { return [this.vx, this.vz + this.conveyor]; }
  update(t: number, dt: number): void {
    if (this.move) {
      const [ox, oy, oz] = this.move(t);
      const nx = this.bx + ox, ny = this.by + oy, nz = this.bz + oz;
      if (dt > 0) { this.vx = (nx - this.cx) / dt; this.vy = (ny - this.top) / dt; this.vz = (nz - this.cz) / dt; }
      this.cx = nx; this.top = ny; this.cz = nz;
      this.mesh.position.set(nx, ny, nz);
    }
    if (this.tex) this.tex.offset.y += this.conveyor * dt / 2.2;
  }
}

/** A turning disc: whoever stands on it is carried around. */
export class Disc extends Solid {
  private a = 0;
  private top3: THREE.Mesh;
  constructor(public cx: number, public top: number, public cz: number, public r: number, public w: number, colors: [string, string] = ['#ff8fb8', '#ffd23f']) {
    super();
    const tex = canvasTex(256, 256, (g) => {
      for (let k = 0; k < 8; k++) {
        g.fillStyle = colors[k % 2];
        g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 182, k * Math.PI / 4, (k + 1) * Math.PI / 4); g.closePath(); g.fill();
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(128, 128, 22, 0, 7); g.fill();
    });
    const side = toonMat(0x7b6cf6);
    this.top3 = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 40), [side, toonMat(0xffffff, tex), side]);
    this.top3.position.y = -0.3;
    this.mesh.add(this.top3);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.12, 5, 16), toonMat(0xb9a8ff));
    stem.position.y = -3.1;
    this.mesh.add(stem);
    this.mesh.position.set(cx, top, cz);
  }
  topAt(x: number, z: number): number | null { return Math.hypot(x - this.cx, z - this.cz) <= this.r + 0.12 ? this.top : null; }
  bottom(): number { return this.top - 0.6; }
  refTop(): number { return this.top; }
  pushOut(a: Actor): boolean {
    const dx = a.x - this.cx, dz = a.z - this.cz, d = Math.hypot(dx, dz), min = this.r + RADIUS;
    if (d >= min || d < 1e-4) return false;
    a.x = this.cx + dx / d * min; a.z = this.cz + dz / d * min;
    return true;
  }
  velAt(x: number, z: number): [number, number] { return [this.w * (z - this.cz), -this.w * (x - this.cx)]; }
  update(_t: number, dt: number): void { this.a += this.w * dt; this.top3.rotation.y = this.a; }
}

// ===================================================================== hazards
export abstract class Hazard {
  readonly mesh = new THREE.Group();
  abstract update(t: number, dt: number): void;
  abstract hit(a: Actor, fx: Fx): void;
  advise(_a: Actor, _skill: number, _adv: Advice, _t: number): void { /* no advice by default */ }
}

export class Bumper extends Hazard {
  private pulse = 0;
  constructor(public x: number, public y: number, public z: number, color: string) {
    super();
    this.mesh.add(kit('bumper', color));
    this.mesh.position.set(x, y, z);
  }
  update(_t: number, dt: number): void {
    this.pulse = Math.max(0, this.pulse - dt * 3.5);
    const k = Math.sin(this.pulse * Math.PI) * 0.28;
    this.mesh.scale.set(1 + k, 1 - k * 0.6, 1 + k);
  }
  advise(a: Actor, _s: number, adv: Advice): void {
    const dz = a.z - this.z, dx = a.x - this.x;
    if (dz > 0 && dz < 3.2 && Math.abs(dx) < 1.25 && Math.abs(a.y - this.y) < 2) adv.sx += dx >= 0 ? 0.8 : -0.8;
  }
  hit(a: Actor, fx: Fx): void {
    if (a.y > this.y + 1.6 || a.y < this.y - 1) return;
    const dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz), min = 0.62 + RADIUS;
    if (d >= min || d < 1e-4) return;
    const nx = dx / d, nz = dz / d;
    a.x = this.x + nx * min; a.z = this.z + nz * min;
    const vn = a.vx * nx + a.vz * nz;
    if (vn >= 0) return;
    const out = -vn * 1.05 + 4.2;
    a.vx += nx * (out - vn); a.vz += nz * (out - vn);
    this.pulse = 1;
    if (a.isPlayer) { fx.sound('boing'); fx.shake(0.2); }
    if (-vn > 7.8 || a.mode === 'dive') a.knock(a.vx, 6.5, a.vz, 8);
    else { a.vy = Math.max(a.vy, 4.6); a.grounded = false; a.bump(nx, nz, 5); }
  }
}

export class Spinner extends Hazard {
  a = Math.random() * 6;
  /** How hard a hit throws a runner sideways. */
  power = 1.2;
  private bar: THREE.Mesh;
  constructor(public x: number, public y: number, public z: number, public w: number, color: string, public half = 4.3) {
    super();
    this.mesh.add(kit('spinner'));
    this.bar = kitNode('spinner', 'Bar', color);
    this.bar.scale.x = half / 4.3;
    this.mesh.add(this.bar);
    this.mesh.position.set(x, y, z);
  }
  update(_t: number, dt: number): void { this.a += this.w * dt; this.bar.rotation.y = this.a; }
  /** Distance from a point to the bar and the position along it. */
  near(x: number, z: number): { d: number; t: number; ex: number; ez: number } {
    const px = x - this.x, pz = z - this.z, c = Math.cos(this.a), s = -Math.sin(this.a);
    const t = THREE.MathUtils.clamp(px * c + pz * s, -this.half, this.half);
    const ex = px - c * t, ez = pz - s * t;
    return { d: Math.hypot(ex, ez), t, ex, ez };
  }
  advise(a: Actor, _s: number, adv: Advice): void {
    if (!a.grounded || Math.abs(a.y - this.y) > 1) return;
    const n = this.near(a.x, a.z);
    if (n.d > 5 || n.d < 1e-4) return;
    const c = Math.cos(this.a), s = -Math.sin(this.a);
    const bvx = this.w * (s * n.t), bvz = -this.w * (c * n.t);
    const closing = ((bvx - a.vx) * n.ex + (bvz - a.vz) * n.ez) / n.d;      // how fast the bar and the runner approach
    if (closing > 0.5 && n.d / closing < 0.36) adv.jump = true;      // be at the top of the jump when the bar passes
  }
  hit(a: Actor, fx: Fx): void {
    const ry = a.y - this.y;
    if (ry < -1 || ry > 3 || Math.abs(this.w) < 0.05) return;
    const px = a.x - this.x, pz = a.z - this.z, hd = Math.hypot(px, pz);
    if (ry < 0.85 && hd < 0.9 + RADIUS && hd > 1e-4) { a.x = this.x + px / hd * (0.9 + RADIUS); a.z = this.z + pz / hd * (0.9 + RADIUS); }
    if (ry > 0.95 || a.hitCool > 0 || hd > this.half + 1) return;
    const n = this.near(a.x, a.z);
    if (n.d > 0.34 + RADIUS) return;
    const c = Math.cos(this.a), s = -Math.sin(this.a);
    const bvx = this.w * (s * n.t), bvz = -this.w * (c * n.t);
    const nx = n.d > 1e-4 ? n.ex / n.d : 0, nz = n.d > 1e-4 ? n.ez / n.d : 1;
    const push = Math.hypot(bvx, bvz);
    if (push < 1.2) { a.x += nx * (0.34 + RADIUS - n.d); a.z += nz * (0.34 + RADIUS - n.d); return; }
    a.knock(bvx * this.power + nx * 2.5, 6.5 + push * 0.25, bvz * this.power + nz * 2.5, 10);
    a.hitCool = 0.5;
    if (a.isPlayer) { fx.sound('whack'); fx.shake(0.45); }
  }
}

/** A hammer on a pole that swings across the path (in the X direction). */
export class Hammer extends Hazard {
  hx = 0; hy = 0; hv = 0;
  private arm = new THREE.Group();
  private frameMat: THREE.MeshToonMaterial;
  private fadeAlpha = 1;
  constructor(public x: number, public y: number, public z: number, private len: number, private amp: number, private speed: number, private phase: number, color: string) {
    super();
    const post = toonMat(0x7b6cf6);
    post.userData.round = true;
    this.frameMat = post;
    const pivotY = len + 1.4;
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, pivotY + 0.4, 10), post);
      p.position.set(s * 5.4, (pivotY + 0.4) / 2 - 0.4, 0);
      this.mesh.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.4, 0.4), post);
    beam.position.y = pivotY;
    this.mesh.add(beam);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 8), toonMat(0xffffff));
    pole.position.y = -len / 2;
    this.arm.add(pole);
    const head = withOutline(new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.5, 20).rotateZ(Math.PI / 2), toonMat(color)), 0.05);
    head.position.y = -len;
    this.arm.add(head);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.22, 20).rotateZ(Math.PI / 2), toonMat(0xffffff));
      cap.position.set(s * 0.76, -len, 0);
      this.arm.add(cap);
    }
    this.arm.position.y = pivotY;
    this.mesh.add(this.arm);
    this.mesh.position.set(x, y, z);
  }
  /** Fade the overhead frame when it sits between the camera and the player. */
  setFade(alpha: number): void {
    if (Math.abs(alpha - this.fadeAlpha) < 0.005) return;
    this.fadeAlpha = alpha;
    const trans = alpha < 0.99;
    if (this.frameMat.transparent !== trans) { this.frameMat.transparent = trans; this.frameMat.needsUpdate = true; }
    this.frameMat.opacity = alpha;
    this.frameMat.depthWrite = !trans;
  }
  /** Sideways position of the head at time t. */
  headX(t: number): number { return this.x + this.len * Math.sin(this.amp * Math.sin(t * this.speed + this.phase)); }
  update(t: number, dt: number): void {
    const ang = this.amp * Math.sin(t * this.speed + this.phase);
    this.arm.rotation.z = ang;
    const nx = this.x + this.len * Math.sin(ang);
    this.hv = dt > 0 ? (nx - this.hx) / dt : 0;
    this.hx = nx;
    this.hy = this.y + 1.4 + this.len * (1 - Math.cos(ang));
  }
  advise(a: Actor, skill: number, adv: Advice, t: number): void {
    const dz = a.z - this.z;
    if (dz < 0.6 || dz > 3.6 || Math.abs(a.y - this.y) > 2) return;
    const when = t + (dz - 0.6) / Math.max(2, a.speed);
    const danger = Math.abs(this.headX(when) - a.x) < 2.1 || Math.abs(this.headX(when + 0.25) - a.x) < 2.1;
    if (danger && Math.random() < 0.55 + skill * 0.5) adv.speed = dz < 1.6 ? -0.4 : 0.05;
  }
  hit(a: Actor, fx: Fx): void {
    if (a.hitCool > 0 || Math.abs(a.z - this.z) > 0.75 + RADIUS) return;
    const dx = a.x - this.hx, dy = a.y + 0.6 - this.hy;
    if (Math.abs(dx) > 1.0 + RADIUS || Math.abs(dy) > 1.5) return;
    const dir = Math.abs(this.hv) > 1 ? Math.sign(this.hv) : Math.sign(dx || 1);
    a.knock(dir * (Math.abs(this.hv) * 1.15 + 3), 6, a.vz * 0.4, 10);
    a.hitCool = 0.6;
    if (a.isPlayer) { fx.sound('whack'); fx.shake(0.5); }
  }
}

/** Big balls that roll down a ramp toward the runners, one after another. */
export class BallRun extends Hazard {
  balls: { x: number; z: number; y: number; v: number; wait: number; m: THREE.Mesh }[] = [];
  private R = 1.25;
  constructor(private ramp: Box, private zTop: number, private zEnd: number, private lanes: number[], n: number, colors: string[]) {
    super();
    for (let i = 0; i < n; i++) {
      const tex = canvasTex(64, 64, (g) => { g.fillStyle = colors[i % colors.length]; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 14); g.fillRect(0, 32, 64, 14); });
      const m = withOutline(new THREE.Mesh(new THREE.SphereGeometry(this.R, 20, 14), toonMat(0xffffff, tex)), 0.05);
      this.mesh.add(m);
      this.balls.push({ x: 0, z: zTop, y: 0, v: 0, wait: 0.6 + i * 1.5, m });
    }
  }
  update(_t: number, dt: number): void {
    for (const b of this.balls) {
      if (b.wait > 0) {
        b.wait -= dt;
        b.m.visible = false;
        if (b.wait <= 0) { b.x = this.lanes[Math.floor(Math.random() * this.lanes.length)] + (Math.random() - 0.5); b.z = this.zTop; b.v = 5; b.y = 0; b.m.visible = true; }
        continue;
      }
      b.v = Math.min(13, b.v + 5 * dt);
      b.z += b.v * dt;
      const g = this.ramp.topAt(b.x, b.z);
      if (g !== null) b.y = g + this.R; else b.y -= 14 * dt;
      b.m.position.set(b.x, b.y, b.z);
      b.m.rotation.x += b.v * dt / this.R;
      if (b.z > this.zEnd + 6 || b.y < -15) b.wait = 0.4 + Math.random() * 1.2;
    }
  }
  advise(a: Actor, skill: number, adv: Advice): void {
    for (const b of this.balls) {
      const dz = a.z - b.z, dx = a.x - b.x;
      if (b.wait > 0 || dz < -1 || dz > 10 || Math.abs(dx) > 2.1 || Math.abs(a.y + 0.6 - b.y) > 4) continue;
      if (Math.random() < 0.6 + skill * 0.4) adv.sx += dx >= 0 ? 1 : -1;
    }
  }
  hit(a: Actor, fx: Fx): void {
    if (a.hitCool > 0) return;
    for (const b of this.balls) {
      if (b.wait > 0) continue;
      const dx = a.x - b.x, dz = a.z - b.z, dy = a.y + 0.6 - b.y;
      const d = Math.hypot(dx, dy, dz), min = this.R + RADIUS;
      if (d >= min) continue;
      const nx = dx / Math.max(d, 0.01);
      a.knock(nx * 6, 6.5, b.v * 0.7 + 2, 10);
      a.hitCool = 0.6;
      if (a.isPlayer) { fx.sound('whack'); fx.shake(0.5); }
      return;
    }
  }
}

// ===================================================================== the world
export class World {
  solids: Solid[] = [];
  hazards: Hazard[] = [];
  constructor(readonly scene: THREE.Scene) {}
  add<T extends Solid | Hazard>(o: T): T {
    if (o instanceof Solid) this.solids.push(o); else this.hazards.push(o);
    this.scene.add(o.mesh);
    return o;
  }
  update(t: number, dt: number): void {
    for (const s of this.solids) s.update(t, dt);
    for (const h of this.hazards) h.update(t, dt);
  }
  /** The ground under a point: the highest top that is not above knee height. */
  groundAt(x: number, y: number, z: number): Ground | null {
    let best: Ground | null = null;
    for (const s of this.solids) {
      if (!s.alive) continue;
      const top = s.topAt(x, z);
      if (top === null || y < top - STEP) continue;
      if (!best || top > best.y) { const [vx, vz] = s.velAt(x, z); best = { y: top, vx, vz, grip: s.grip, solid: s }; }
    }
    return best;
  }
  /** Sides of solids and all hazards. */
  collide(a: Actor, fx: Fx): void {
    for (const s of this.solids) {
      if (!s.alive) continue;
      const top = s.topAt(a.x, a.z);
      const t = top ?? s.refTop();
      if (a.y >= t - STEP || a.y + BODY <= s.bottom()) continue;
      s.pushOut(a);
    }
    for (const h of this.hazards) h.hit(a, fx);
  }
}
