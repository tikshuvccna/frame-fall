/**
 * Door Dash round: 20 runners, five rows of four doors. Each row asks a question; only the door with the right answer
 * opens. Between the rows: soft bumpers and spinning bars. The first 12 across the line qualify.
 */
import * as THREE from 'three';
import { Actor, RADIUS } from './actor';
import { CHAR_TYPES, kit, kitNode } from './models';
import { raceQuestions, type Question } from './questions';
import { sfx } from './sfx';
import { textTexture, toonGradient } from './toon';

const W = 16;                       // course width
const Z0 = 10, ZEND = -128;          // floor from z = 10 down to -128
const ROWS = [-18, -38, -58, -78, -98];
const FINISH = -114;
const DOOR_X = [-6, -2, 2, 6];
export const RUNNERS = 20, QUALIFY = 12;
const TINTS = ['#ff7ac8', '#ffb347', '#6fd3ff', '#8be37d', '#b79cff', '#ff6b6b', '#ffe45c', '#4fd1c5', '#f78fb3', '#9aa5ff', '#ffa94d', '#63e6be'];
const DOOR_COL = ['#5ac8fa', '#ff8fb8', '#ffd23f', '#8be37d'];

interface Door { cx: number; correct: boolean; open: boolean; wrongSeen: boolean; shake: number; fly: number; panel: THREE.Mesh; label: THREE.Mesh; answer: string }
interface Row { i: number; z: number; q: Question; doors: Door[]; sign?: THREE.Mesh; player?: 'right' | 'wrong' | 'followed' }
interface Bumper { x: number; z: number; pulse: number; mesh: THREE.Mesh }
interface Spinner { x: number; z: number; w: number; a: number; bar: THREE.Mesh }
interface Bot { skill: number; pace: number; lane: number; row: number; choice: number; think: number; wrong: Set<number>[]; jumpCool: number }

export type Phase = 'ready' | 'count' | 'race' | 'done';
export interface Result { place: number; qualified: boolean; firstTry: number; rows: { q: Question; player?: string }[] }

export class Game {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.3, 600);
  readonly actors: Actor[] = [];
  player!: Actor;
  phase: Phase = 'ready';
  time = 0; countT = 0;
  finishedCount = 0;
  rows: Row[] = [];
  result: Result | null = null;
  onCount?: (n: number) => void;
  onToast?: (text: string, good: boolean) => void;
  onDone?: (r: Result) => void;

  private bots = new Map<Actor, Bot>();
  private bumpers: Bumper[] = [];
  private spinners: Spinner[] = [];
  private floaters: { o: THREE.Object3D; y: number; ph: number }[] = [];
  private confetti!: THREE.InstancedMesh;
  private cf: { p: THREE.Vector3; v: THREE.Vector3; life: number; rot: number }[] = [];
  private shake = 0;
  private camPos = new THREE.Vector3(0, 7, 20);
  private lastCount = 4;
  private doneT = -1;
  private m4 = new THREE.Matrix4();
  private marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd23f }));

  constructor(playerType: string) {
    this.buildWorld();
    this.buildRows();
    this.buildObstacles();
    this.spawnRunners(playerType);
    const ml = new THREE.Mesh(this.marker.geometry, new THREE.MeshBasicMaterial({ color: 0x2a2036, side: THREE.BackSide }));
    ml.scale.setScalar(1.25);
    this.marker.add(ml);
    this.scene.add(this.marker);
    this.updateCamera(1, true);
  }

  // ------------------------------------------------------------------ world
  private buildWorld(): void {
    const s = this.scene;
    const sky = document.createElement('canvas');
    sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d') as CanvasRenderingContext2D;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#6ec3ff'); gr.addColorStop(0.55, '#bfe8ff'); gr.addColorStop(1, '#ffe3f1');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const st = new THREE.CanvasTexture(sky);
    st.colorSpace = THREE.SRGBColorSpace;
    s.background = st;
    s.fog = new THREE.Fog(0xd8efff, 90, 260);
    s.add(new THREE.HemisphereLight(0xffffff, 0xffc9e2, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4dc, 2.0);
    sun.position.set(-6, 12, 8);
    s.add(sun);

    // floor: checker top, candy skirt
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const c2 = cv.getContext('2d') as CanvasRenderingContext2D;
    c2.fillStyle = '#fff4d6'; c2.fillRect(0, 0, 128, 128);
    c2.fillStyle = '#ffd9ec'; c2.fillRect(0, 0, 64, 64); c2.fillRect(64, 64, 64, 64);
    const ft = new THREE.CanvasTexture(cv);
    ft.colorSpace = THREE.SRGBColorSpace;
    ft.wrapS = ft.wrapT = THREE.RepeatWrapping;
    const L = Z0 - ZEND;
    ft.repeat.set(W / 8, L / 8);
    ft.anisotropy = 8;
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, L).rotateX(-Math.PI / 2), new THREE.MeshToonMaterial({ map: ft, gradientMap: toonGradient() }));
    top.position.set(0, 0, (Z0 + ZEND) / 2);
    s.add(top);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, L), new THREE.MeshToonMaterial({ color: 0xff8fb8, gradientMap: toonGradient() }));
    skirt.position.set(0, -0.61, (Z0 + ZEND) / 2);
    s.add(skirt);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.3, L + 0.5), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: toonGradient() }));
    rim.position.set(0, -0.2, (Z0 + ZEND) / 2);
    s.add(rim);

    const add = (name: string, x: number, y: number, z: number, sc = 1, tint?: string, ry = 0, float = false): THREE.Mesh => {
      const m = kit(name, tint, name === 'cloud' ? 0 : 0.035);
      m.position.set(x, y, z); m.scale.setScalar(sc); m.rotation.y = ry;
      s.add(m);
      if (float) this.floaters.push({ o: m, y, ph: Math.random() * 6 });
      return m;
    };
    add('gate_start', 0, 0, -6);
    add('gate_finish', 0, 0, FINISH);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('מרוץ הדלתות', { w: 1024, h: 192, bg: '#ffffff', fg: '#7b6cf6' }) }));
    banner.position.set(0, 7.2, -5.7);
    s.add(banner);
    for (let k = 0; k < 11; k++) for (const sd of [-1, 1]) add('flag', sd * (W / 2 + 0.6), 0, 4 - k * 12, 1, TINTS[(k + (sd > 0 ? 3 : 0)) % TINTS.length], sd > 0 ? Math.PI : 0);
    const clouds: [number, number, number, number][] = [[-38, 6, -40, 1.8], [40, 14, -80, 2.4], [-30, 22, -150, 3], [30, -6, -20, 1.4], [-44, -8, -100, 1.6], [10, 34, -210, 3.4], [52, 4, -140, 2], [-60, 18, -60, 2.2]];
    for (const [x, y, z, sc] of clouds) add('cloud', x, y, z, sc, undefined, 0, true);
    add('deco_spool', -20, -2, -30, 1, undefined, 0.4, true);
    add('deco_spool', 22, 3, -90, 1.2, undefined, -0.8, true);
    add('deco_plug', 19, -4, -48, 1.2, '#ff7a59', -0.5, true);
    add('deco_plug', -19, -3, -106, 1.3, '#5ac8fa', 0.6, true);
    const bl: [number, number, number, string][] = [[-13, 3, -10, '#ff8fb8'], [13, 5, -26, '#ffd23f'], [-14, 7, -62, '#5ac8fa'], [12, 8, -74, '#b79cff'], [-12, 5, -120, '#8be37d'], [13, 6, -118, '#ff8fb8']];
    for (const [x, y, z, c] of bl) add('balloon', x, y, z, 1, c, 0, true);
    add('trophy', 0, 0, FINISH - 9, 2.2);

    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 220);
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confetti.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < 220; i++) {
      this.confetti.setColorAt(i, col.set(TINTS[i % TINTS.length]));
      this.cf.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0, rot: Math.random() * 6 });
    }
    this.confetti.count = 220;
    s.add(this.confetti);
  }

  private label(text: string, wrong = false): THREE.Texture {
    const latin = /^[\x20-\x7e]+$/.test(text);
    return textTexture(text, { w: 512, h: 288, bg: wrong ? '#ffd0d0' : '#ffffff', fg: wrong ? '#c0392b' : '#2a2036', border: wrong ? '#e74c3c' : undefined, rtl: !latin });
  }

  private buildRows(): void {
    const qs = raceQuestions();
    ROWS.forEach((z, i) => {
      const q = qs[i];
      const row: Row = { i, z, q, doors: [] };
      DOOR_X.forEach((cx, k) => {
        const frame = kit('door_frame');
        frame.position.set(cx, 0, z);
        this.scene.add(frame);
        const panel = kit('door_panel', DOOR_COL[(k + i) % 4]);
        panel.position.set(cx, 0, z);
        this.scene.add(panel);
        const label = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), new THREE.MeshBasicMaterial({ map: this.label(q.answers[k]) }));
        label.position.set(0, 1.75, 0.165);
        panel.add(label);
        row.doors.push({ cx, correct: k === q.right, open: false, wrongSeen: false, shake: 0, fly: 0, panel, label, answer: q.answers[k] });
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.9), new THREE.MeshBasicMaterial({ map: textTexture(q.text, { w: 1400, h: 205, bg: '#7b6cf6', fg: '#ffffff', border: '#ffffff' }) }));
      sign.position.set(0, 5.3, z + 0.3);
      this.scene.add(sign);
      row.sign = sign;
      this.rows.push(row);
    });
  }

  private buildObstacles(): void {
    const bump = (x: number, z: number, c: string) => {
      const mesh = kit('bumper', c);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.bumpers.push({ x, z, pulse: 0, mesh });
    };
    const spin = (x: number, z: number, w: number, c: string) => {
      const hub = kit('spinner');
      hub.position.set(x, 0, z);
      this.scene.add(hub);
      const bar = kitNode('spinner', 'Bar', c);
      bar.position.x += x; bar.position.z += z;
      this.scene.add(bar);
      this.spinners.push({ x, z, w, a: Math.random() * 6, bar });
    };
    [[-5, -25], [-1, -29], [3, -25], [6.3, -31], [-6.4, -32]].forEach(([x, z], i) => bump(x, z, TINTS[i]));
    spin(0, -48, 1.45, '#5ac8fa');
    spin(-4, -66, -1.55, '#ff8fb8');
    spin(4, -71, 1.55, '#ffd23f');
    [[-6, -85], [-3, -90], [0, -84], [3, -90], [6, -85], [-1.5, -87.5], [1.5, -93]].forEach(([x, z], i) => bump(x, z, TINTS[i + 5]));
  }

  private spawnRunners(playerType: string): void {
    for (let i = 0; i < RUNNERS; i++) {
      const isP = i === 0;
      const type = isP ? playerType : CHAR_TYPES[i % CHAR_TYPES.length];
      const a = new Actor(type, isP, isP ? undefined : TINTS[(i * 5) % TINTS.length], isP ? undefined : (i % 3 === 0 ? TINTS[(i * 7 + 3) % TINTS.length] : undefined));
      const slot = isP ? 7 : i <= 7 ? i - 1 : i;          // the player starts in the middle of the second line
      a.x = -5.25 + (slot % 8) * 1.5 + (Math.floor(slot / 8) % 2) * 0.4;
      a.z = 2.2 + Math.floor(slot / 8) * 1.7;
      a.checkpointZ = a.z;
      this.actors.push(a);
      this.scene.add(a.root, a.shadow);
      if (isP) {
        this.player = a;
        a.onJump = sfx.jump;
        a.onLand = (v) => { if (v > 6) sfx.land(); };
      } else {
        this.bots.set(a, { skill: 0.3 + Math.random() * 0.5, pace: 0.72 + Math.random() * 0.2, lane: a.x, row: 0, choice: -1, think: 0, wrong: ROWS.map(() => new Set<number>()), jumpCool: 0 });
      }
      a.animate(0.016);
    }
  }

  start(): void { if (this.phase === 'ready') { this.phase = 'count'; this.countT = 0; } }

  // ------------------------------------------------------------------ step
  step(dt: number): void {
    this.time += dt;
    if (this.phase === 'count') {
      this.countT += dt;
      const n = 3 - Math.floor(this.countT / 0.8);
      if (n !== this.lastCount) { this.lastCount = n; this.onCount?.(Math.max(0, n)); if (n > 0) sfx.count(); else sfx.go(); }
      if (n <= 0) this.phase = 'race';
    }
    const racing = this.phase === 'race' || this.phase === 'done';
    for (const sp of this.spinners) { sp.a += sp.w * dt; sp.bar.rotation.y = sp.a; }
    for (const b of this.bumpers) {
      b.pulse = Math.max(0, b.pulse - dt * 3.5);
      const k = Math.sin(b.pulse * Math.PI) * 0.28;
      b.mesh.scale.set(1 + k, 1 - k * 0.6, 1 + k);
    }
    for (const a of this.actors) {
      if (!racing) { a.ctl.ix = a.ctl.iz = 0; a.ctl.jump = a.ctl.dive = false; }
      else if (!a.isPlayer) this.think(a, dt);
      if (a.finished) this.afterFinish(a);
      const pz = a.z;
      a.groundY = this.groundAt(a);
      a.step(dt);
      this.collideCourse(a, pz);
      if (a.y < -14) this.respawn(a);
      if (!a.finished && a.z < FINISH && racing) this.finish(a);
    }
    this.collidePairs();
    for (const a of this.actors) { a.groundY = this.groundAt(a); a.animate(dt); }
    this.stepDoors(dt);
    for (const row of this.rows) if (row.sign) row.sign.visible = this.player.z > row.z - 1.5;   // never between the camera and the player
    this.marker.position.set(this.player.x, this.player.y + 2.15 + Math.sin(this.time * 6) * 0.12, this.player.z);
    this.marker.rotation.y = this.time * 3;
    this.marker.visible = !this.player.finished;
    this.stepConfetti(dt);
    for (const f of this.floaters) f.o.position.y = f.y + Math.sin(this.time * 0.6 + f.ph) * 0.6;
    this.updateCamera(dt, false);
    if (this.doneT >= 0 && this.phase !== 'done') {
      this.doneT += dt;
      if (this.doneT > 1.6) this.end();
    }
  }

  private groundAt(a: Actor): number | null {
    return Math.abs(a.x) <= W / 2 + 0.15 && a.z <= Z0 + 0.15 && a.z >= ZEND - 0.15 ? 0 : null;
  }

  private respawn(a: Actor): void {
    a.x = (Math.random() - 0.5) * 8; a.z = a.checkpointZ; a.y = 6;
    a.vx = a.vz = 0; a.vy = 0;
    a.mode = 'normal'; a.stun = 0.2; a.grounded = false;
    const b = this.bots.get(a);
    if (b) b.choice = -1;
  }

  // ------------------------------------------------------------------ collisions with the course
  private collideCourse(a: Actor, prevZ: number): void {
    // side of the floor: once below the top, a body cannot slide back under it
    if (a.y < -0.2 && Math.abs(a.x) < W / 2 + RADIUS && a.z < Z0 + RADIUS && a.z > ZEND - RADIUS) {
      const dxE = W / 2 + RADIUS - Math.abs(a.x), dzE = Math.min(Z0 + RADIUS - a.z, a.z - (ZEND - RADIUS));
      if (dxE < dzE) { a.x = Math.sign(a.x || 1) * (W / 2 + RADIUS); a.vx = 0; }
      else { a.z = a.z > (Z0 + ZEND) / 2 ? Z0 + RADIUS : ZEND - RADIUS; a.vz = 0; }
    }
    // door rows
    const band = 0.2 + RADIUS;
    for (const row of this.rows) {
      const crossed = (prevZ - row.z) * (a.z - row.z) < 0;
      if (Math.abs(a.z - row.z) >= band && !crossed) continue;
      if (a.y > 3.2 || a.y < -1) continue;
      const k = Math.floor((a.x + W / 2) / 4), door = row.doors[k];
      let pass = false;
      let hitDoor: Door | null = null;
      if (door && Math.abs(a.x - door.cx) < 1.5 - RADIUS * 0.45) {
        if (!door.open) { hitDoor = door; this.touchDoor(a, row, k); }
        if (door.open) {
          pass = true;
          a.x = THREE.MathUtils.clamp(a.x, door.cx - 1.5 + RADIUS * 0.8, door.cx + 1.5 - RADIUS * 0.8);
          if (a.isPlayer && row.player === undefined) row.player = 'followed';
          if (a.z < row.z) a.checkpointZ = row.z - 2.5;
        }
      }
      if (pass) continue;
      const side = prevZ >= row.z ? 1 : -1;
      const vn = -a.vz * side;
      a.z = row.z + side * band;
      if (vn > 0) {
        if (hitDoor && (a.mode === 'dive' || vn > 9)) a.knock(a.vx * 0.3, 4.5, side * 4.5, 7);
        else {
          a.vz = side * (vn * 0.45 + (hitDoor ? 2.6 : 0.5));
          a.bump(0, side, vn * 0.6);
          if (hitDoor && vn > 5) a.stun = 0.3;
        }
        if (a.isPlayer && hitDoor) this.shake = Math.max(this.shake, 0.25);
      }
    }
    // bumpers
    if (a.y < 1.6) {
      for (const b of this.bumpers) {
        const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz), min = 0.62 + RADIUS;
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        a.x = b.x + nx * min; a.z = b.z + nz * min;
        const vn = a.vx * nx + a.vz * nz;
        if (vn < 0) {
          const out = -vn * 1.05 + 4.2;
          a.vx += nx * (out - vn); a.vz += nz * (out - vn);
          b.pulse = 1;
          if (a.isPlayer) { sfx.boing(); this.shake = Math.max(this.shake, 0.2); }
          if (-vn > 7.8 || a.mode === 'dive') a.knock(a.vx, 6.5, a.vz, 8);
          else { a.vy = Math.max(a.vy, 4.6); a.grounded = false; a.bump(nx, nz, 5); }
        }
      }
    }
    // spinning bars
    for (const sp of this.spinners) {
      const px = a.x - sp.x, pz = a.z - sp.z;
      const hd = Math.hypot(px, pz);
      if (a.y < 0.85 && hd < 0.9 + RADIUS && hd > 1e-4) {     // the hub
        a.x = sp.x + px / hd * (0.9 + RADIUS); a.z = sp.z + pz / hd * (0.9 + RADIUS);
      }
      if (a.y > 0.95 || a.hitCool > 0 || hd > 4.4 + RADIUS + 0.4) continue;
      const dxb = Math.cos(sp.a), dzb = -Math.sin(sp.a);
      const t = THREE.MathUtils.clamp(px * dxb + pz * dzb, -4.3, 4.3);
      const qx = dxb * t, qz = dzb * t;
      const ex = px - qx, ez = pz - qz, d = Math.hypot(ex, ez);
      if (d > 0.34 + RADIUS) continue;
      const bvx = sp.w * qz, bvz = -sp.w * qx;                // speed of the bar at the contact point
      const nx = d > 1e-4 ? ex / d : 0, nz = d > 1e-4 ? ez / d : 1;
      const push = Math.hypot(bvx, bvz);
      if (push < 1.2) { a.x += nx * (0.34 + RADIUS - d); a.z += nz * (0.34 + RADIUS - d); continue; }
      a.knock(bvx * 1.2 + nx * 2.5, 6.5 + push * 0.25, bvz * 1.2 + nz * 2.5, 10);
      a.hitCool = 0.5;
      if (a.isPlayer) { sfx.whack(); this.shake = Math.max(this.shake, 0.45); }
    }
  }

  private touchDoor(a: Actor, row: Row, k: number): void {
    const door = row.doors[k];
    if (door.correct) {
      door.open = true; door.fly = 0.001;
      this.burst(door.cx, 1.6, row.z);
      if (a.isPlayer) {
        if (row.player === undefined) { row.player = 'right'; this.onToast?.('נכון! פתחת את הדלת', true); }
        sfx.right();
      } else if (Math.abs(a.z - this.player.z) < 30) sfx.right();
      return;
    }
    if (a.hitCool > 0) return;
    a.hitCool = 0.35;
    door.shake = 0.45;
    if (!door.wrongSeen) {
      door.wrongSeen = true;
      const mat = door.label.material as THREE.MeshBasicMaterial;
      mat.map = this.label(door.answer, true);
      mat.needsUpdate = true;
    }
    this.bots.get(a)?.wrong[row.i].add(k);
    const b = this.bots.get(a);
    if (b) { b.choice = -1; b.think = 0.25 + Math.random() * 0.5; }
    if (a.isPlayer) {
      if (row.player === undefined) row.player = 'wrong';
      this.onToast?.('לא הדלת הזאת', false);
      sfx.wrong();
    }
  }

  private collidePairs(): void {
    const A = this.actors, min = RADIUS * 2;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        const dx = b.x - a.x, dz = b.z - a.z;
        if (Math.abs(dx) > min || Math.abs(dz) > min || Math.abs(a.y - b.y) > 1.2) continue;
        const d = Math.hypot(dx, dz);
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, pen = (min - d) / 2;
        a.x -= nx * pen; a.z -= nz * pen; b.x += nx * pen; b.z += nz * pen;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel >= 0) continue;
        const pa = a.mode === 'dive' ? 1.6 : 1, pb = b.mode === 'dive' ? 1.6 : 1;   // a diving body shoves harder
        const jimp = -rel * 0.75;
        a.vx -= nx * jimp * pb / (pa + pb) * 2 * 0.5; a.vz -= nz * jimp * pb / (pa + pb) * 2 * 0.5;
        b.vx += nx * jimp * pa / (pa + pb) * 2 * 0.5; b.vz += nz * jimp * pa / (pa + pb) * 2 * 0.5;
        a.bump(-nx, -nz, -rel * 0.5 * pb); b.bump(nx, nz, -rel * 0.5 * pa);
        if (-rel > 9) {
          if (pa > pb && b.mode === 'normal') b.stun = 0.25;
          if (pb > pa && a.mode === 'normal') a.stun = 0.25;
        }
      }
    }
  }

  // ------------------------------------------------------------------ bots
  private think(a: Actor, dt: number): void {
    const b = this.bots.get(a) as Bot, c = a.ctl;
    c.jump = false; c.dive = false; c.jumpHeld = true;
    if (a.finished) return;
    b.jumpCool = Math.max(0, b.jumpCool - dt);
    while (b.row < ROWS.length && a.z < ROWS[b.row] - 0.5) { b.row++; b.choice = -1; b.lane = THREE.MathUtils.clamp(a.x + (Math.random() - 0.5) * 6, -6.5, 6.5); }
    let tx = b.lane, speed = b.pace;
    if (b.row < ROWS.length) {
      const row = this.rows[b.row], dist = a.z - row.z;
      if (dist < 13) {
        const open = row.doors.findIndex((d) => d.open);
        if (open >= 0 && (b.choice < 0 || !row.doors[b.choice].open)) b.choice = open;
        if (b.choice < 0) {
          if (dist < 8) { b.think -= dt; speed = 0.3; }
          if (b.think <= 0 && dist < 8) {
            const options = [0, 1, 2, 3].filter((k) => !b.wrong[b.row].has(k) && !(row.doors[k].wrongSeen && Math.random() < 0.9));
            b.choice = Math.random() < b.skill ? row.q.right : options[Math.floor(Math.random() * options.length)] ?? row.q.right;
          }
        }
        if (b.choice >= 0) tx = row.doors[b.choice].cx + THREE.MathUtils.clamp(b.lane - row.doors[b.choice].cx, -0.7, 0.7);
      } else if (b.think <= 0) b.think = 0.5 + Math.random() * 1.6;
    } else if (a.z - FINISH < 3.5 && a.grounded && Math.random() < 0.02) c.dive = true;
    // steer around bumpers
    for (const bp of this.bumpers) {
      const dz = a.z - bp.z, dx = a.x - bp.x;
      if (dz > 0 && dz < 3.2 && Math.abs(dx) < 1.25) tx += (dx >= 0 ? 1 : -1) * 1.6;
    }
    // jump the spinning bars
    for (const sp of this.spinners) {
      const px = a.x - sp.x, pz = a.z - sp.z;
      if (Math.hypot(px, pz) > 5.2) continue;
      const dxb = Math.cos(sp.a), dzb = -Math.sin(sp.a), t = THREE.MathUtils.clamp(px * dxb + pz * dzb, -4.3, 4.3);
      const d = Math.hypot(px - dxb * t, pz - dzb * t);
      if (d < 1.25 + Math.abs(t) * 0.42 && a.grounded && b.jumpCool <= 0) { b.jumpCool = 0.7; if (Math.random() < 0.45 + b.skill * 0.5) c.jump = true; }
    }
    c.ix = THREE.MathUtils.clamp((tx - a.x) * 0.9, -1, 1) * speed;
    c.iz = -speed;
  }

  // ------------------------------------------------------------------ finish
  private finish(a: Actor): void {
    a.finished = true;
    a.place = ++this.finishedCount;
    if (a.isPlayer) {
      this.burst(a.x, 2, a.z - 2); this.burst(a.x - 3, 3, a.z - 3); this.burst(a.x + 3, 3, a.z - 3);
      if (a.place <= QUALIFY) sfx.win(); else sfx.lose();
      this.doneT = 0;
    } else if (this.finishedCount >= QUALIFY && !this.player.finished && this.doneT < 0) {
      sfx.lose();
      this.doneT = 0.6;
    }
  }

  private afterFinish(a: Actor): void {
    const c = a.ctl;
    c.jump = c.dive = false;
    const tz = FINISH - 4 - (a.place % 4) * 1.6, txx = -6 + ((a.place * 5) % 9) * 1.5;
    const dx = txx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d > 0.6 && a.mode === 'normal' && a.grounded) { a.vx = dx / d * 4; a.vz = dz / d * 4; }
    else if (d <= 0.6) { a.vx *= 0.8; a.vz *= 0.8; if (a.place <= QUALIFY) a.cheer(); }
  }

  private end(): void {
    this.phase = 'done';
    const p = this.player;
    const place = p.finished ? p.place : 1 + this.actors.filter((x) => x !== p && (x.finished || x.z < p.z)).length;
    this.result = {
      place, qualified: p.finished && p.place <= QUALIFY,
      firstTry: this.rows.filter((r) => r.player === 'right').length,
      rows: this.rows.map((r) => ({ q: r.q, player: r.player })),
    };
    this.onDone?.(this.result);
  }

  /** Place of the player right now (1 = first). */
  rank(): number {
    const p = this.player;
    if (p.finished) return p.place;
    return 1 + this.actors.filter((x) => x !== p && (x.finished || x.z < p.z)).length;
  }
  /** The question of the next row in front of the player (or null after the last row). */
  nextQuestion(): Question | null {
    const r = this.rows.find((row) => this.player.z > row.z - 0.4);
    return r ? r.q : null;
  }

  // ------------------------------------------------------------------ effects
  private stepDoors(dt: number): void {
    for (const row of this.rows) for (const d of row.doors) {
      if (d.shake > 0) {
        d.shake = Math.max(0, d.shake - dt);
        d.panel.position.x = d.cx + Math.sin(d.shake * 60) * 0.09 * (d.shake / 0.45);
        d.panel.rotation.x = Math.sin(d.shake * 40) * 0.03;
      }
      if (d.fly > 0 && d.panel.visible) {
        d.fly += dt;
        const t = d.fly;
        d.panel.position.y = t * 14 - t * t * 12;
        d.panel.position.z = row.z - t * 9;
        d.panel.rotation.x = -t * 7;
        d.panel.scale.setScalar(Math.max(0.01, 1 - t * 1.1));
        if (t > 0.9) d.panel.visible = false;
      }
    }
  }

  private burst(x: number, y: number, z: number): void {
    let n = 0;
    for (const p of this.cf) {
      if (p.life > 0) continue;
      p.p.set(x + (Math.random() - 0.5) * 2, y + Math.random() * 1.5, z);
      p.v.set((Math.random() - 0.5) * 9, 4 + Math.random() * 8, (Math.random() - 0.5) * 9);
      p.life = 1.2 + Math.random() * 0.8;
      if (++n >= 45) break;
    }
  }

  private stepConfetti(dt: number): void {
    const e = new THREE.Euler();
    const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    this.cf.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.v.y -= 12 * dt; p.v.multiplyScalar(1 - 1.2 * dt);
        p.p.addScaledVector(p.v, dt);
        p.rot += dt * 9;
        if (p.life <= 0) p.p.set(0, -99, 0);
      }
      q.setFromEuler(e.set(p.rot, p.rot * 0.7, i));
      this.m4.compose(p.p, q, sc);
      this.confetti.setMatrixAt(i, this.m4);
    });
    this.confetti.instanceMatrix.needsUpdate = true;
  }

  private updateCamera(dt: number, snap: boolean): void {
    const p = this.player, cam = this.camera;
    const portrait = cam.aspect < 1;
    const back = portrait ? 13 : 10, up = portrait ? 7.5 : 5.6;
    const py = Math.max(p.y, -3);
    const want = new THREE.Vector3(p.x * 0.72, py + up, p.z + back);
    if (snap) this.camPos.copy(want); else this.camPos.lerp(want, Math.min(1, 6 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const s = this.shake * 0.5;
    cam.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    cam.lookAt(this.camPos.x * 0.92, this.camPos.y - up + 1.6, this.camPos.z - back - 5.5);
  }
}
