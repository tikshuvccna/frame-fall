/**
 * More course blocks: tiles that drop away, walls of doors (some real, some fake), wind zones.
 */
import * as THREE from 'three';
import { Actor, RADIUS } from './actor';
import { textTexture, toonGradient } from './toon';
import { Hazard, Solid, type Advice, type Fx } from './world';

const mats = new Map<string, THREE.MeshToonMaterial>();
function mat(color: string): THREE.MeshToonMaterial {
  let m = mats.get(color);
  if (!m) { m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() }); mats.set(color, m); }
  return m;
}
const geos = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g;
}

export interface TileOpts { fake?: boolean; vanish?: boolean; delay?: number }

/** A thin tile. `vanish` tiles drop a moment after someone steps on them; `fake` tiles drop almost at once. */
export class Tile extends Solid {
  state = 0;            // 0 solid, 1 shaking, 2 falling, 3 gone
  t = 0; delay: number;
  private vyFall = 0;
  private fake: boolean; private vanish: boolean;
  private body: THREE.Mesh;
  constructor(public cx: number, public top: number, public cz: number, public r: number, public shape: 'hex' | 'sq', color: string, o: TileOpts = {}) {
    super();
    this.fake = !!o.fake; this.vanish = !!o.vanish; this.delay = o.delay ?? (this.fake ? 0.14 : 0.6);
    const g = shape === 'hex'
      ? geo('hex' + r, () => new THREE.CylinderGeometry(r * 0.97, r * 0.9, 0.5, 6))
      : geo('sq' + r, () => new THREE.BoxGeometry(r * 1.94, 0.5, r * 1.94));
    this.body = new THREE.Mesh(g, [mat('#ffffff'), mat(color), mat('#ffffff')]);
    if (shape === 'sq') this.body.material = [mat('#ffffff'), mat('#ffffff'), mat(color), mat('#ffffff'), mat('#ffffff'), mat('#ffffff')];
    this.body.position.y = -0.25;
    this.mesh.add(this.body);
    this.mesh.position.set(cx, top, cz);
  }
  topAt(x: number, z: number): number | null {
    const dx = Math.abs(x - this.cx), dz = Math.abs(z - this.cz), r = this.r + 0.06;
    if (this.shape === 'sq') return dx <= r && dz <= r ? this.top : null;
    return dx <= r * 0.866 && dz + dx * 0.5774 <= r ? this.top : null;
  }
  bottom(): number { return this.top - 0.5; }
  refTop(): number { return this.top; }
  pushOut(): boolean { return false; }
  stand(a: Actor): void {
    if (this.fake) a.stun = Math.max(a.stun, 0.35);      // no hopping off a fake tile
    if (this.state === 0 && (this.fake || this.vanish)) { this.state = 1; this.t = 0; }
  }
  update(_t: number, dt: number): void {
    if (this.state === 1) {
      this.t += dt;
      this.mesh.position.y = this.top + Math.sin(this.t * 55) * 0.05 - this.t * 0.12;
      if (this.t >= this.delay) { this.state = 2; this.alive = false; }
    } else if (this.state === 2) {
      this.vyFall += 22 * dt;
      this.mesh.position.y -= this.vyFall * dt;
      this.mesh.rotation.x += dt * 2.2;
      if (this.mesh.position.y < this.top - 14) { this.state = 3; this.mesh.visible = false; }
    }
  }
}

/** A wall of doors across the course. Real doors burst open when a runner hits them; fake doors only wobble. */
export class DoorWall extends Hazard {
  readonly open: boolean[];
  private panels: THREE.Mesh[] = [];
  private fly: { m: THREE.Mesh; vx: number; vy: number; vz: number; t: number }[] = [];
  private wob: number[];
  private tried = new Map<Actor, Set<number>>();
  private choice = new Map<Actor, number>();
  private half: number;
  private T = 0.3;
  /** Called when the player opens a real door (true) or bumps a fake one for the first time (false). */
  onPlayer?: (ok: boolean) => void;
  constructor(public x: number, public y: number, public z: number, public real: boolean[], colors: string[], private doorW = 2.6, private postW = 0.6, labels?: string[]) {
    super();
    const n = real.length;
    this.open = real.map(() => false);
    this.wob = real.map(() => 0);
    this.half = (n * doorW + (n + 1) * postW) / 2;
    const post = mat('#7b6cf6');
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(geo('post' + postW, () => new THREE.BoxGeometry(postW, 3.6, 0.7)), post);
      p.position.set(-this.half + postW / 2 + i * (doorW + postW), 1.8, 0);
      this.mesh.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(this.half * 2 + 0.4, 0.7, 0.9), mat('#ffffff'));
    beam.position.y = 3.75;
    this.mesh.add(beam);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo('door' + doorW, () => new THREE.BoxGeometry(doorW, 3.3, 0.28)), mat(colors[i % colors.length]));
      m.position.set(this.cx(i), 1.72, 0);
      const knob = new THREE.Mesh(geo('knob', () => new THREE.SphereGeometry(0.16, 10, 8)), mat('#ffffff'));
      knob.position.set(doorW * 0.32, -0.1, 0.2);
      m.add(knob);
      if (labels) {
        const tex = textTexture(labels[i], { w: 512, h: 256, bg: '#ffffff', fg: '#2a2036', border: '#2a2036', rtl: /[֐-׿]/.test(labels[i]) });
        tex.userData.round = true;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 0.9, doorW * 0.45), new THREE.MeshBasicMaterial({ map: tex }));
        sign.position.set(0, 0.45, 0.16);
        m.add(sign);
        knob.visible = false;
      }
      this.mesh.add(m);
      this.panels.push(m);
    }
    this.mesh.position.set(x, y, z);
  }
  /** Centre of door i, relative to the wall centre. */
  private cx(i: number): number { return -this.half + this.postW + this.doorW / 2 + i * (this.doorW + this.postW); }
  private doorAt(rx: number): number {
    for (let i = 0; i < this.real.length; i++) if (Math.abs(rx - this.cx(i)) < this.doorW / 2 - RADIUS * 0.45) return i;
    return -1;
  }
  update(_t: number, dt: number): void {
    for (let i = 0; i < this.wob.length; i++) {
      if (this.wob[i] > 0) { this.wob[i] = Math.max(0, this.wob[i] - dt * 2.5); this.panels[i].rotation.x = Math.sin(this.wob[i] * 22) * 0.07 * this.wob[i]; }
    }
    for (const f of this.fly) {
      f.t += dt;
      f.vy -= 20 * dt;
      f.m.position.x += f.vx * dt; f.m.position.y += f.vy * dt; f.m.position.z += f.vz * dt;
      f.m.rotation.x -= dt * 7; f.m.rotation.z += dt * 2 * Math.sign(f.vx || 1);
      if (f.t > 2.2) f.m.visible = false;
    }
    this.fly = this.fly.filter((f) => f.t <= 2.2);
  }
  advise(a: Actor, skill: number, adv: Advice): void {
    const dz = a.z - this.z;
    if (dz < -0.4 || dz > 11 || Math.abs(a.y - this.y) > 2.5) return;
    const n = this.real.length, rx = a.x - this.x;
    const tried = this.tried.get(a);
    let pick = -1, bd = 1e9;
    if (skill > 0.25) for (let i = 0; i < n; i++) if (this.open[i] && Math.abs(this.cx(i) - rx) < bd) { bd = Math.abs(this.cx(i) - rx); pick = i; }
    if (pick < 0) {
      let c = this.choice.get(a);
      if (c === undefined) { c = Math.floor(Math.random() * n); this.choice.set(a, c); }
      if (tried?.has(c)) {
        c = -1; bd = 1e9;
        for (let i = 0; i < n; i++) if (!tried.has(i) && Math.abs(this.cx(i) - rx) < bd) { bd = Math.abs(this.cx(i) - rx); c = i; }
        if (c < 0) return;
        this.choice.set(a, c);
      }
      pick = c;
    }
    adv.tx = this.x + this.cx(pick);
    if (dz < 1.8 && Math.abs(adv.tx - a.x) > 0.7) adv.speed = 0.12;      // slide along the wall to the door
  }
  hit(a: Actor, fx: Fx): void {
    if (a.y > this.y + 3.3 || a.y < this.y - 1.2) return;
    const dz = a.z - this.z;
    if (Math.abs(dz) >= this.T + RADIUS) return;
    const rx = a.x - this.x;
    if (Math.abs(rx) > this.half + RADIUS) return;
    const i = this.doorAt(rx);
    if (i >= 0 && this.open[i]) return;
    const side = dz >= 0 ? 1 : -1;
    if (i >= 0 && this.real[i]) {      // a real door opens at any touch
      this.open[i] = true;
      const m = this.panels[i];
      this.fly.push({ m, vx: (Math.random() - 0.5) * 5, vy: 6, vz: -side * (6 + Math.abs(a.vz) * 0.6), t: 0 });
      a.vz *= 0.6;
      a.bump(0, side, 4);
      if (a.isPlayer) { fx.sound('whack'); fx.shake(0.3); this.onPlayer?.(true); }
      return;
    }
    a.z = this.z + side * (this.T + RADIUS);
    if (a.vz * side < 0) {
      const hard = Math.abs(a.vz);
      a.vz = side * Math.min(3.2, hard * 0.4);
      a.bump(0, side, hard * 0.7);
      if (i >= 0) {
        this.wob[i] = 1;
        let s = this.tried.get(a);
        if (!s) { s = new Set(); this.tried.set(a, s); }
        if (a.isPlayer && !s.has(i)) this.onPlayer?.(false);
        s.add(i);
      }
      if (hard > 8.5 || a.mode === 'dive') a.knock(a.vx * 0.3, 4.5, side * 4, 7);
      if (a.isPlayer && hard > 3) { fx.sound('boing'); fx.shake(0.25); }
    }
  }
}

/** A wind zone: a fan on one side blows runners sideways. With `period` it blows in gusts. */
export class Wind extends Hazard {
  private streaks: THREE.Mesh[] = [];
  private blades = new THREE.Group();
  private dt = 0; private on = true;
  constructor(public x0: number, public x1: number, public zNear: number, public zFar: number, public y: number, public v: number, private period = 0, private phase = 0) {
    super();
    const sm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(geo('streak', () => new THREE.BoxGeometry(1.7, 0.05, 0.05)), sm);
      s.position.set(x0 + Math.random() * (x1 - x0), y + 0.4 + Math.random() * 1.8, zFar + Math.random() * (zNear - zFar));
      this.streaks.push(s);
      this.mesh.add(s);
    }
    // the fan stands on the side the wind comes from
    const fx = v > 0 ? x0 - 1.6 : x1 + 1.6, zc = (zNear + zFar) / 2;
    const fan = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 8, 24), mat('#7b6cf6'));
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), mat('#ffd23f'));
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(geo('blade', () => new THREE.BoxGeometry(0.5, 1.3, 0.08)), mat('#ffffff'));
      b.position.set(Math.sin(k * Math.PI / 2) * 0.7, Math.cos(k * Math.PI / 2) * 0.7, 0);
      b.rotation.z = -k * Math.PI / 2;
      this.blades.add(b);
    }
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 8, 8), mat('#b9a8ff'));
    stem.position.y = -5.6;
    fan.add(ring, hub, this.blades, stem);
    fan.rotation.y = Math.PI / 2;
    fan.position.set(fx, y + 1.9, zc);
    this.mesh.add(fan);
  }
  private inside(a: Actor): boolean {
    return a.x > this.x0 - 0.5 && a.x < this.x1 + 0.5 && a.z < this.zNear && a.z > this.zFar && a.y > this.y - 1 && a.y < this.y + 5;
  }
  update(t: number, dt: number): void {
    this.dt = dt;
    this.on = this.period <= 0 || ((t + this.phase) % this.period) < this.period * 0.6;
    this.blades.rotation.z += (this.on ? 14 : 2) * dt;
    for (const s of this.streaks) {
      s.visible = this.on;
      s.position.x += this.v * 3.2 * dt;
      if (s.position.x > this.x1 + 1) s.position.x = this.x0 - 1;
      if (s.position.x < this.x0 - 1) s.position.x = this.x1 + 1;
    }
  }
  advise(a: Actor, skill: number, adv: Advice): void {
    if (this.on && this.inside(a) && skill > 0.35) adv.sx -= Math.sign(this.v) * 0.45;
  }
  hit(a: Actor): void {
    if (!this.on || !this.inside(a) || a.finished) return;
    a.x += this.v * this.dt * (a.grounded ? 1 : 1.3);
    a.bump(Math.sign(this.v), 0, 0.3);
  }
}

/**
 * A seesaw plank that tips side to side under the weight of the runners on it (pivot along Z).
 * The tilt carries runners downhill, so a crowd on one side throws everyone toward that edge.
 */
export class Seesaw extends Solid {
  ang = 0;
  private w = 0;
  private load = 0;
  private plank: THREE.Group;
  constructor(public cx: number, public top: number, public cz: number, public hx: number, public hz: number, color: string, private maxAng = 0.36) {
    super();
    this.grip = 0.85;
    this.plank = new THREE.Group();
    const stripes = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 0.5, hz * 2), [mat('#ffffff'), mat('#ffffff'), mat(color), mat('#ffffff'), mat('#ffffff'), mat('#ffffff')]);
    body.position.y = -0.25;
    stripes.add(body);
    for (let k = -2; k <= 2; k++) {            // painted lines across the plank show the tilt
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, hz * 2 - 0.4), mat('#ffffff'));
      s.position.set(k * hx * 0.4, 0.01, 0);
      stripes.add(s);
    }
    this.plank.add(stripes);
    this.mesh.add(this.plank);
    const prop = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, hz * 1.2, 3).rotateX(Math.PI / 2).rotateZ(Math.PI), mat('#7b6cf6'));
    prop.position.y = -1.75;
    this.mesh.add(prop);
    this.mesh.position.set(cx, top, cz);
  }
  topAt(x: number, z: number): number | null {
    if (Math.abs(x - this.cx) > this.hx * Math.cos(this.ang) + 0.1 || Math.abs(z - this.cz) > this.hz + 0.1) return null;
    return this.top + Math.tan(this.ang) * (x - this.cx);
  }
  bottom(): number { return this.top - 0.5 - Math.abs(Math.sin(this.ang)) * this.hx; }
  refTop(): number { return this.top; }
  pushOut(a: Actor): boolean {
    const dx = a.x - this.cx, dz = a.z - this.cz, ex = this.hx + RADIUS, ez = this.hz + RADIUS;
    if (Math.abs(dx) >= ex || Math.abs(dz) >= ez) return false;
    if (ez - Math.abs(dz) < ex - Math.abs(dx)) a.z = this.cz + Math.sign(dz || 1) * ez;
    else a.x = this.cx + Math.sign(dx || 1) * ex;
    return true;
  }
  /** Each runner standing on it pushes its side down. */
  stand(a: Actor): void { this.load += (a.x - this.cx) / this.hx; }
  velAt(): [number, number] { return [-Math.sin(this.ang) * 9.5, 0]; }
  update(_t: number, dt: number): void {
    if (dt <= 0) return;
    const torque = -this.load * 1.1 - this.ang * 5.5 - this.w * 1.6;
    this.load = 0;
    this.w += torque * dt;
    this.ang += this.w * dt;
    if (Math.abs(this.ang) > this.maxAng) { this.ang = Math.sign(this.ang) * this.maxAng; this.w *= -0.2; }
    this.plank.rotation.z = this.ang;
  }
}

/**
 * A pusher: a block that waits inside a side wall, then punches out across the path and slowly pulls back.
 * `side` is the wall it lives in (-1 left, +1 right); `edge` is the x of that edge of the floor.
 */
export class Pusher extends Hazard {
  off = 0;                       // how far out the block is now (0 = hidden in the wall)
  private v = 0;
  private block: THREE.Group;
  private hx = 1.1; private hz = 1.0; private H = 1.5;
  constructor(public edge: number, public y: number, public z: number, public side: number, public reach: number, private period = 3, private phase = 0, color = '#ff8fb8') {
    super();
    const house = new THREE.Mesh(geo('pushHouse', () => new THREE.BoxGeometry(1.4, 2.6, 2.8)), mat('#7b6cf6'));
    house.position.set(edge + side * 1.6, 1.3, 0);
    this.mesh.add(house);
    this.block = new THREE.Group();
    const face = new THREE.Mesh(geo('pushBlock', () => new THREE.BoxGeometry(this.hx * 2, this.H, this.hz * 2)), mat(color));
    face.position.y = this.H / 2;
    const plate = new THREE.Mesh(geo('pushPlate', () => new THREE.BoxGeometry(0.12, this.H * 0.8, this.hz * 1.6)), mat('#ffffff'));
    plate.position.set(-side * (this.hx + 0.04), this.H / 2, 0);
    const rod = new THREE.Mesh(geo('pushRod', () => new THREE.CylinderGeometry(0.16, 0.16, 6, 8).rotateZ(Math.PI / 2)), mat('#c8c3d6'));
    rod.position.set(side * (this.hx + 3), this.H / 2, 0);
    this.block.add(face, plate, rod);
    this.mesh.add(this.block);
    this.mesh.position.set(0, y, z);
    this.place();
  }
  /** Centre x of the block. */
  bx(): number { return this.edge + this.side * (this.hx - this.off); }
  private place(): void { this.block.position.x = this.bx(); }
  /** Out distance as a function of time: rest, a fast punch, hold, slow pull back. */
  private outAt(t: number): number {
    const u = (((t + this.phase) % this.period) + this.period) % this.period / this.period;
    if (u < 0.45) return 0;
    if (u < 0.53) return this.reach * ((u - 0.45) / 0.08);
    if (u < 0.68) return this.reach;
    return this.reach * (1 - (u - 0.68) / 0.32);
  }
  update(t: number, dt: number): void {
    const n = this.outAt(t);
    this.v = dt > 0 ? (n - this.off) / dt : 0;
    this.off = n;
    this.place();
  }
  advise(a: Actor, skill: number, adv: Advice, t: number): void {
    const dz = a.z - this.z;
    if (dz < -0.5 || dz > 3.4 || Math.abs(a.y - this.y) > 2) return;
    const when = t + Math.max(0, dz - 0.4) / Math.max(2, a.speed);
    const lane = Math.abs(a.x - this.edge) < this.reach + 0.6;
    if (lane && (this.outAt(when) > 0.4 || this.outAt(when + 0.3) > 0.4) && Math.random() < 0.5 + skill * 0.5) adv.speed = dz < 1.4 ? -0.3 : 0.05;
  }
  hit(a: Actor, fx: Fx): void {
    if (a.y > this.y + this.H || a.y < this.y - 1) return;
    const cx = this.bx(), dx = a.x - cx, dz = a.z - this.z;
    const ex = this.hx + RADIUS, ez = this.hz + RADIUS;
    if (Math.abs(dx) >= ex || Math.abs(dz) >= ez) return;
    const out = -this.side;                                  // the direction the block punches
    if (this.v * out > 2 && a.hitCool <= 0) {                 // punching: throw the runner across
      a.x = cx + out * ex;
      a.knock(out * (Math.abs(this.v) * 0.9 + 3), 6, a.vz * 0.3, 9);
      a.hitCool = 0.5;
      if (a.isPlayer) { fx.sound('whack'); fx.shake(0.4); }
      return;
    }
    if (ex - Math.abs(dx) < ez - Math.abs(dz)) a.x = cx + Math.sign(dx || out) * ex;
    else a.z = this.z + Math.sign(dz || 1) * ez;
  }
}

/** A platform that comes and goes in a steady beat. It blinks before it goes, so the beat can be learned. */
export class Blinker extends Solid {
  private body: THREE.Mesh;
  private vis = true;
  constructor(public cx: number, public top: number, public cz: number, public r: number, color: string, private period = 4, private phase = 0, private onPart = 0.62) {
    super();
    this.body = new THREE.Mesh(geo('blink' + r, () => new THREE.BoxGeometry(r * 2, 0.5, r * 2)), [mat('#ffffff'), mat('#ffffff'), mat(color), mat('#ffffff'), mat('#ffffff'), mat('#ffffff')]);
    this.body.position.y = -0.25;
    this.mesh.add(this.body);
    this.mesh.position.set(cx, top, cz);
  }
  /** 0..1 position inside the beat. */
  private u(t: number): number { return (((t + this.phase) % this.period) + this.period) % this.period / this.period; }
  topAt(x: number, z: number): number | null { return Math.abs(x - this.cx) <= this.r + 0.08 && Math.abs(z - this.cz) <= this.r + 0.08 ? this.top : null; }
  bottom(): number { return this.top - 0.5; }
  refTop(): number { return this.top; }
  pushOut(): boolean { return false; }
  update(t: number): void {
    const u = this.u(t);
    this.alive = u < this.onPart;
    const warn = u > this.onPart - 0.22 && u < this.onPart;
    const show = this.alive && (!warn || Math.sin(t * 28) > -0.2);
    if (show !== this.vis) { this.vis = show; this.mesh.visible = show; }
    this.mesh.position.y = this.top + (warn ? Math.sin(t * 50) * 0.04 : 0);
  }
}
