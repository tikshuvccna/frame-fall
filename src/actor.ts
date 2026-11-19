/**
 * One runner (the player or a bot): physics state, controls and the code-driven animation of the six body parts.
 * World: Y up, the course runs toward -Z. The game owns collisions with the course; this file owns how a body moves.
 */
import * as THREE from 'three';
import { charRig, type CharRig } from './models';
import { makeHat } from './wear';

export const RADIUS = 0.42;
/** Where the skull ends, for heads whose model reaches higher (antennae, fibres). */
const HAT_TOP: Record<string, number> = { ch_wave: 0.5, ch_fibra: 0.47, ch_robo: 0.45 };
const RUN = 7.2;          // top run speed, m/s
const ACC = 36;           // ground acceleration
const AIR_ACC = 11;
const GRAV = 26;
const JUMP_V = 9.4;
const DIVE_SPEED = 10.5;
const COM = 0.62;         // height of the pivot used for tilting and tumbling

export type Mode = 'normal' | 'dive' | 'tumble' | 'getup';
export interface Controls { ix: number; iz: number; jump: boolean; jumpHeld: boolean; dive: boolean }

/** A damped spring (for wobble and squash). */
class Spring {
  x = 0; v = 0;
  constructor(public k: number, public c: number, public rest = 0) { this.x = rest; }
  step(dt: number, target = this.rest): number {
    this.v += ((target - this.x) * this.k - this.v * this.c) * dt;
    this.x += this.v * dt;
    return this.x;
  }
}

let shadowGeo: THREE.CircleGeometry | null = null, shadowMat: THREE.MeshBasicMaterial | null = null;

export class Actor {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  yaw = 0;
  grounded = true;
  mode: Mode = 'normal';
  modeT = 0;
  stun = 0;               // seconds without control (after a hard bump)
  coyote = 0; jumpBuf = 0;
  canDive = true;
  hitCool = 0;
  finished = false; place = 0;
  checkpointZ = 0;
  ctl: Controls = { ix: 0, iz: 0, jump: false, jumpHeld: false, dive: false };
  /** Set by the game each frame: ground height under the actor, or null over the void. */
  groundY: number | null = 0;
  /** Set by the game: velocity of the ground under the actor (conveyors, discs, moving platforms) and its grip (1 = normal). */
  gvx = 0; gvz = 0; grip = 1;
  eliminated = false;
  onLand?: (impact: number) => void;
  onJump?: () => void;

  readonly root = new THREE.Group();
  readonly shadow: THREE.Mesh;
  private pivot = new THREE.Group();
  private rig: CharRig;
  private phase = Math.random() * 6;
  private pitch = new Spring(110, 9);
  private roll = new Spring(110, 9);
  private squash = new Spring(260, 13, 1);
  private spinX = 0; private spinRate = 0;
  private bodyPitch = 0;
  private pvx = 0; private pvz = 0;
  private cheerT = 0;
  /** Extra turn, flip and lift of a celebration (applied one frame late; it is smooth enough). */
  private yawNow = 0; private pitchNow = 0; private liftNow = 0;

  constructor(public type: string, public isPlayer: boolean, tint?: THREE.ColorRepresentation, tint2?: THREE.ColorRepresentation) {
    this.rig = charRig(type, tint, tint2);
    this.pivot.position.y = COM;
    this.rig.root.position.y = -COM;
    this.pivot.add(this.rig.root);
    this.root.add(this.pivot);
    shadowGeo ??= new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
    shadowMat ??= new THREE.MeshBasicMaterial({ color: 0x4a3566, transparent: true, opacity: 0.28, depthWrite: false });
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.renderOrder = 1;
  }

  get speed(): number { return Math.hypot(this.vx, this.vz); }

  /** Throw the runner: it loses control and tumbles until it lands and gets up. */
  knock(vx: number, vy: number, vz: number, spin = 9): void {
    this.vx = vx; this.vy = vy; this.vz = vz;
    this.grounded = false;
    this.mode = 'tumble'; this.modeT = 0;
    this.spinRate = spin * (Math.random() < 0.5 ? -1 : 1);
    this.squash.v += 4;
  }

  /** A shove that keeps the runner on its feet but makes it wobble. */
  bump(nx: number, nz: number, strength: number): void {
    // local frame: forward = (-sin yaw, -cos yaw), right = (cos yaw, -sin yaw)
    const f = -(nx * Math.sin(this.yaw) + nz * Math.cos(this.yaw)), r = nx * Math.cos(this.yaw) - nz * Math.sin(this.yaw);
    this.pitch.v += -f * strength * 1.6;
    this.roll.v += -r * strength * 1.6;
  }

  cheer(): void { this.cheerT = 0.001; }

  private emoteId: string | null = null;
  private emoteT = 0;
  /** Play a celebration (see EMOTES in profile.ts) in a loop; null stops it. */
  emote(id: string | null): void {
    if (id === this.emoteId) return;
    this.emoteId = id; this.emoteT = 0;
    if (!id) this.cheerT = 0;
  }

  /** Make this runner a see-through ghost (a replay of the player's best run). */
  ghostify(color = '#9fe3ff'): void {
    const gm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false });
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mt = m.material as THREE.Material;
      if (mt.side === THREE.BackSide) m.visible = false;      // the toon outline shell
      else m.material = gm;
    });
    this.shadow.visible = false;
  }

  private hatSpin: THREE.Object3D | null = null;
  /** Put a hat on the head (see wear.ts). */
  wear(id: string | null | undefined, tint?: string): void {
    if (!id) return;
    const H = this.rig.parts.Head, B = this.rig.parts.Body;
    if (!H.geometry.boundingBox) H.geometry.computeBoundingBox();
    const hb = H.geometry.boundingBox as THREE.Box3;
    const small = hb.max.x - hb.min.x < 0.3;            // a tuft, not a head (the binary cube): wear it on the body
    const h = makeHat(id, small ? B : H, tint, HAT_TOP[this.type]);
    if (small && h && id !== 'shades') H.visible = false;
    this.hatSpin = (h?.userData.spin as THREE.Object3D | undefined) ?? null;
  }

  /** Shoot the runner upward (bounce pads). It keeps control. */
  launch(vy: number): void {
    this.vy = vy; this.grounded = false; this.coyote = 0;
    this.squash.v += 7;
  }

  // ------------------------------------------------------------------ physics
  step(dt: number): void {
    const c = this.ctl;
    this.modeT += dt;
    this.hitCool = Math.max(0, this.hitCool - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.jumpBuf = c.jump ? 0.13 : Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    let ix = c.ix, iz = c.iz;
    const im = Math.hypot(ix, iz);
    if (im > 1) { ix /= im; iz /= im; }
    const control = this.mode === 'normal' && this.stun <= 0 && !this.finished;
    const rel = this.grounded;          // on the ground, speeds are measured against the ground under the feet
    if (rel) { this.vx -= this.gvx; this.vz -= this.gvz; }
    const grip = this.grip;

    if (this.mode === 'normal') {
      if (control) {
        const acc = this.grounded ? ACC * grip : AIR_ACC;
        const tx = ix * RUN, tz = iz * RUN;
        const dx = tx - this.vx, dz = tz - this.vz, d = Math.hypot(dx, dz);
        if (d > 1e-4) {
          const s = Math.min(d, acc * dt) / d;
          this.vx += dx * s; this.vz += dz * s;
        }
        if (this.jumpBuf > 0 && this.coyote > 0) {
          this.vy = JUMP_V; this.grounded = false; this.coyote = 0; this.jumpBuf = 0;
          this.squash.v += 5;
          this.onJump?.();
        } else if (c.dive && this.canDive) {
          this.startDive(ix, iz);
        }
        if (!this.grounded && !c.jumpHeld && this.vy > 4) this.vy -= 30 * dt;   // short hop when the button is released
      } else if (this.grounded) {
        this.friction(14 * grip, dt);
      }
    } else if (this.mode === 'dive') {
      if (this.grounded) {
        this.friction(11 * grip, dt);
        if (this.speed < 1.6 || this.modeT > 0.9) { this.mode = 'getup'; this.modeT = 0; }
      }
    } else if (this.mode === 'tumble') {
      if (this.grounded) {
        this.friction(9 * grip, dt);
        this.spinRate *= Math.max(0, 1 - 6 * dt);
        if (this.modeT > 0.55 && this.speed < 2.2) { this.mode = 'getup'; this.modeT = 0; }
      }
    } else if (this.mode === 'getup') {
      this.friction(16 * grip, dt);
      if (this.modeT > 0.4) { this.mode = 'normal'; this.modeT = 0; this.canDive = true; }
    }

    if (rel) { this.vx += this.gvx; this.vz += this.gvz; }

    // gravity (falls a little faster than it rises: a snappy arc)
    if (!this.grounded) this.vy -= GRAV * (this.vy < 0 ? 1.25 : 1) * dt;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;

    // ground
    const g = this.groundY;
    if (g !== null && this.y <= g && this.vy <= 0 && this.y > g - 0.7) {
      const impact = -this.vy;
      this.y = g;
      if (!this.grounded) {
        if (this.mode === 'tumble' && impact > 5) {
          this.vy = impact * 0.38;                      // a tumbling body bounces once or twice
          this.squash.v -= impact * 0.5;
        } else {
          this.vy = 0; this.grounded = true;
          this.squash.v -= Math.min(9, impact * 0.55);
          if (this.mode === 'normal') this.canDive = true;
          this.onLand?.(impact);
        }
      } else this.vy = 0;
    } else if (this.grounded && g !== null && this.vy <= 0 && this.y - g < 0.4) {
      this.y = g;                                       // stay glued to a down slope or a sinking platform
    } else if (g === null || this.y > g + 0.02) {
      this.grounded = false;
    }
  }

  private startDive(ix: number, iz: number): void {
    let dx = ix, dz = iz;
    if (Math.hypot(dx, dz) < 0.2) { dx = -Math.sin(this.yaw); dz = -Math.cos(this.yaw); }
    const d = Math.hypot(dx, dz);
    const sp = Math.max(this.speed + 2.5, DIVE_SPEED);
    this.vx = dx / d * sp; this.vz = dz / d * sp;
    this.vy = Math.max(this.vy, this.grounded ? 5.2 : 3.2);
    this.grounded = false;
    this.mode = 'dive'; this.modeT = 0; this.canDive = false;
    this.squash.v += 3;
  }

  private friction(f: number, dt: number): void {
    const s = this.speed;
    if (s < 1e-4) return;
    const k = Math.max(0, s - f * dt) / s;
    this.vx *= k; this.vz *= k;
  }

  // ------------------------------------------------------------------ animation
  animate(dt: number): void {
    const sp = this.speed, P = this.rig.parts;
    // face the way it moves
    if (sp > 0.6 && (this.mode === 'normal' || this.mode === 'dive')) {
      const want = Math.atan2(-this.vx, -this.vz);
      let d = want - this.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.yaw += d * Math.min(1, 14 * dt);
    }
    // acceleration in the body frame drives the wobble springs
    const ax = (this.vx - this.pvx) / Math.max(dt, 1e-3), az = (this.vz - this.pvz) / Math.max(dt, 1e-3);
    this.pvx = this.vx; this.pvz = this.vz;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fAcc = -(ax * sy + az * cy), rAcc = ax * cy - az * sy;
    const k = Math.min(1, sp / RUN);
    const pitch = this.pitch.step(dt, this.mode === 'normal' ? -0.16 * k - THREE.MathUtils.clamp(fAcc, -40, 40) * 0.006 : 0);
    const roll = this.roll.step(dt, this.mode === 'normal' ? -THREE.MathUtils.clamp(rAcc, -40, 40) * 0.008 : 0);
    const sq = THREE.MathUtils.clamp(this.squash.step(dt), 0.6, 1.45);

    let targetPitch = 0;
    if (this.mode === 'dive') targetPitch = -1.38;
    else if (this.mode === 'getup') targetPitch = -1.38 * Math.max(0, 1 - this.modeT / 0.3);
    if (this.mode === 'tumble') {
      this.spinX += this.spinRate * dt;
      if (this.grounded) {   // settle flat on the belly or the back
        const flat = Math.round((this.spinX - Math.PI / 2) / Math.PI) * Math.PI + Math.PI / 2;
        this.spinX += (flat - this.spinX) * Math.min(1, 10 * dt);
      }
      this.bodyPitch = this.spinX;
    } else {
      if (this.spinX !== 0) {   // leave the tumble: carry the angle into the get-up
        this.bodyPitch = ((this.spinX + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        this.spinX = 0;
      }
      this.bodyPitch += (targetPitch - this.bodyPitch) * Math.min(1, (this.mode === 'dive' ? 16 : 11) * dt);
    }
    const lying = Math.abs(Math.sin(this.bodyPitch));
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
    this.pivot.position.y = COM - lying * (COM - 0.3) * (this.grounded ? 1 : 0.3) + this.liftNow;
    this.pivot.rotation.set(this.bodyPitch + pitch + this.pitchNow, this.yawNow, roll);
    this.pivot.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

    // limbs
    let legL = 0, legR = 0, armLx = 0, armRx = 0, armOut = 0.12, bob = 0, headTilt = 0, armOutR = -1;
    let eYaw = 0, ePitch = 0, eLift = 0;
    if (this.emoteId && this.mode === 'normal') {
      this.emoteT += dt;
      const t = this.emoteT % 2.4, w = this.emoteT * 9;
      switch (this.emoteId) {
        case 'wave':
          armOut = 0.2; armOutR = 2.55 + Math.sin(this.emoteT * 13) * 0.4; headTilt = Math.sin(this.emoteT * 3) * 0.15;
          bob = Math.abs(Math.sin(this.emoteT * 3)) * 0.05;
          break;
        case 'dance':
          legL = Math.sin(w) * 0.5; legR = -Math.sin(w) * 0.5; armLx = Math.sin(w) * 1.6; armRx = -Math.sin(w) * 1.6; armOut = 1.1;
          eYaw = Math.sin(this.emoteT * 4.5) * 0.6; bob = Math.abs(Math.sin(w)) * 0.18; headTilt = Math.sin(w) * 0.15;
          break;
        case 'spin': {
          const u = Math.min(1, t / 1.0), e = 1 - (1 - u) * (1 - u);
          eYaw = e * Math.PI * 4; armOut = u < 1 ? 1.5 : 2.6; bob = u < 1 ? 0.05 : Math.abs(Math.sin(w)) * 0.15;
          break;
        }
        case 'flip': {
          const u = Math.min(1, t / 0.85), e = u * u * (3 - 2 * u);
          ePitch = e * Math.PI * 2; eLift = Math.sin(u * Math.PI) * 1.3; armOut = 2.6;
          if (u > 0.15 && u < 0.85) { legL = legR = 1.3; armLx = armRx = 1.2; armOut = 0.6; }
          break;
        }
        case 'bow': {
          const u = Math.min(1, t / 0.5), back = t > 1.5 ? Math.min(1, (t - 1.5) / 0.5) : 0;
          ePitch = -0.85 * Math.sin(u * Math.PI / 2) * (1 - back); armRx = 1.4 * (1 - back); armOut = 0.15; armOutR = 0.15;
          break;
        }
        case 'robot': {
          const q = (v: number, k: number) => Math.round(v * k) / k;
          armLx = armRx = 1.57; armOut = 0.1; legL = Math.sign(Math.sin(this.emoteT * 5)) * 0.35; legR = -legL;
          eYaw = q(Math.sin(this.emoteT * 1.6), 2) * 0.7; headTilt = q(Math.sin(this.emoteT * 3.2), 1) * 0.25;
          armLx += q(Math.sin(this.emoteT * 5), 1) * 0.5; armRx -= q(Math.sin(this.emoteT * 5), 1) * 0.5;
          break;
        }
        default: armOut = 2.5 + Math.sin(w) * 0.3; bob = Math.abs(Math.sin(w * 0.5)) * 0.22;
      }
    } else if (this.cheerT > 0) {
      this.cheerT += dt;
      const t = this.cheerT * 9;
      armOut = 2.5 + Math.sin(t) * 0.3;
      bob = Math.abs(Math.sin(t * 0.5)) * 0.22;
      headTilt = Math.sin(t * 0.5) * 0.12;
    } else if (this.mode === 'tumble') {
      const t = this.modeT * 17;
      legL = Math.sin(t) * 0.9; legR = Math.cos(t * 1.2) * 0.9;
      armLx = Math.cos(t * 0.9) * 1.6; armRx = Math.sin(t * 1.1) * 1.6; armOut = 1.2;
    } else if (this.mode === 'dive') {
      armLx = armRx = 2.9; armOut = 0.25; legL = 0.25; legR = 0.1;
    } else if (this.mode === 'getup') {
      const u = Math.max(0, 1 - this.modeT / 0.3);
      armLx = armRx = 2.9 * u; legL = legR = -0.6 * u;
    } else if (!this.grounded) {
      const up = this.vy > 0 ? 1 : 0.6;
      armOut = 2.3 * up + 0.3; legL = 0.55; legR = -0.45;
      armLx = armRx = -0.2;
    } else {
      this.phase += sp * dt * 2.5;
      const s = Math.sin(this.phase);
      legL = s * 0.95 * k; legR = -s * 0.95 * k;
      armLx = -s * 1.15 * k; armRx = s * 1.15 * k;
      armOut = 0.12 + 0.3 * k;
      bob = Math.abs(Math.cos(this.phase)) * 0.07 * k + (k < 0.1 ? Math.sin(performance.now() * 0.004 + this.phase) * 0.012 : 0);
      headTilt = s * 0.07 * k;
    }
    this.yawNow = eYaw; this.pitchNow = ePitch; this.liftNow = eLift;
    if (armOutR < 0) armOutR = armOut;
    const e = Math.min(1, 22 * dt), R = this.rig.rest;
    P.LegL.rotation.x += (legL - P.LegL.rotation.x) * e;
    P.LegR.rotation.x += (legR - P.LegR.rotation.x) * e;
    P.ArmL.rotation.x += (armLx - P.ArmL.rotation.x) * e;
    P.ArmR.rotation.x += (armRx - P.ArmR.rotation.x) * e;
    P.ArmL.rotation.z += (-armOut - P.ArmL.rotation.z) * e;
    P.ArmR.rotation.z += (armOutR - P.ArmR.rotation.z) * e;
    P.Body.position.y = R.Body.y + bob;
    P.Head.rotation.z = headTilt - roll * 0.6;
    P.Head.rotation.x = -pitch * 0.5;

    if (this.hatSpin) this.hatSpin.rotation.y += dt * (6 + sp * 3);

    // blob shadow
    const gy = this.groundY;
    this.shadow.visible = gy !== null && this.y > gy - 0.2;
    if (gy !== null) {
      const h = Math.max(0, this.y - gy), s = Math.max(0.35, 1 - h * 0.18) * (1 + lying * 0.5);
      this.shadow.position.set(this.x, gy + 0.03, this.z);
      this.shadow.scale.set(s, 1, s);
    }
  }
}
