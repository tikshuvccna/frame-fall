/**
 * One round of the show: 20 runners on a course built by a level definition (see levels.ts).
 * Two kinds of round: 'race' (reach the finish line, the first N qualify) and 'survive' (do not fall, until N remain).
 * Bots are general: they probe the floor around them, jump gaps and steps, and take advice from every hazard.
 */
import * as THREE from 'three';
import { Actor, RADIUS } from './actor';
import { CHAR_TYPES, kit } from './models';
import { sfx } from './sfx';
import { textTexture } from './toon';
import { Tile } from './blocks';
import { Pickups } from './collect';
import { HATS } from './wear';
import { Ghost, GHOST_HZ, type GhostRun } from './ghost';
import { Box, World, type Advice, type Fx, type Ground, type Hazard, type Solid } from './world';

export const RUNNERS = 20;
export const TINTS = ['#ff7ac8', '#ffb347', '#6fd3ff', '#8be37d', '#b79cff', '#ff6b6b', '#ffe45c', '#4fd1c5', '#f78fb3', '#9aa5ff', '#ffa94d', '#63e6be'];

export interface Theme { sky: [string, string, string]; fog: number; hemi: number; sun: number }
export const THEMES: Record<string, Theme> = {
  day: { sky: ['#6ec3ff', '#bfe8ff', '#ffe3f1'], fog: 0xd8efff, hemi: 0xffc9e2, sun: 0xfff4dc },
  sunset: { sky: ['#ff9a8b', '#ffc3a0', '#fff0c9'], fog: 0xffdcc4, hemi: 0xffb38a, sun: 0xffe0b0 },
  mint: { sky: ['#5fd6c4', '#b8f2e1', '#f4ffd9'], fog: 0xd6f7ea, hemi: 0xc9ffd9, sun: 0xffffe0 },
  dusk: { sky: ['#6a5acd', '#b79cff', '#ffc9ec'], fog: 0xd9c9ff, hemi: 0xe0b8ff, sun: 0xffe6f5 },
  candy: { sky: ['#ff8fb8', '#ffc2dc', '#fff6cc'], fog: 0xffdbe9, hemi: 0xffd0e6, sun: 0xfff2d0 },
};

export interface LevelDef {
  id: string; title: string; tip: string;
  mode: 'race' | 'survive' | 'collect';
  qualify: number;
  theme: keyof typeof THEMES;
  /** survive: seconds until the round ends. race: time limit. */
  time?: number;
  /** How many falls at one checkpoint before a bot is moved on (keeps the round flowing). */
  assist?: number;
  /** How many runners (default 20). The answer-door game runs alone. */
  runners?: number;
  build(r: Round): void;
}

interface Checkpoint { z: number; rz: number; y: number; sx: number; x: number }
interface Bot { skill: number; pace: number; lane: number; jumpCool: number; planT: number; dx: number; dz: number; speed: number; heading: number; falls: number; fallCp: number }

export type Phase = 'ready' | 'count' | 'race' | 'done';
export interface Result { place: number; qualified: boolean; falls: number; time: number; stars: number; coins: number; card: boolean }
/** How the player looks, and whether the round hides a knowledge card. */
export interface Look {
  hat?: string | null; paint?: [string, string] | null; card?: boolean;
  /** The player's celebration at the finish. */
  emote?: string | null;
  /** The best run so far in this round, played back as a ghost (race rounds). */
  ghost?: GhostRun | null;
  /** Less motion: no camera shake and no slow motion. */
  calm?: boolean;
}

/** What the show host says (short lines, picked at random so they do not repeat too much). */
const HOST: Record<string, string[]> = {
  go: ['ויוצאים לדרך!', 'המופע מתחיל!', 'בהצלחה לכולם!'],
  first: ['יש לנו ראשון בקו הסיום!', 'מישהו כבר בסיום!'],
  left5: ['נשארו רק 5 מקומות!', 'רק 5 מקומות אחרונים!'],
  lead: ['אתם במקום הראשון!', 'מובילים! לא לעצור!'],
  fall: ['אאוץ׳! קמים וממשיכים', 'לא נורא, עוד ניסיון', 'הופ! חוזרים למסלול'],
  card: ['קלף ידע! איזו עין חדה!', 'מצאתם את הקלף הנסתר!'],
  few: ['נשארו מעט שחקנים על הבמה!', 'המתח עולה!'],
  ten: ['עוד 10 שניות!', 'עשר שניות אחרונות!'],
  top3: ['אתם בין שלושת האספנים הגדולים!', 'איזה איסוף!'],
  half: ['חצי מהדרך!', 'כבר באמצע המסלול!'],
};

const CANDS = [0, 0.3, -0.3, 0.65, -0.65, 1.05, -1.05, 1.5, -1.5];
const CANDS_S = [...CANDS, 2.2, -2.2, 3.14];

export class Round {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.3, 700);
  readonly world = new World(this.scene);
  readonly actors: Actor[] = [];
  readonly title: string;
  readonly mode: 'race' | 'survive' | 'collect';
  readonly qualify: number;
  player!: Actor;
  phase: Phase = 'ready';
  time = 0; countT = 0; raceT = 0;
  finishedCount = 0;
  alive = RUNNERS;
  /** Set by a level: text for the top card of the HUD, the two chips, and its own star rule. */
  hud: string | null = null;
  chipsFn: (() => [string, string]) | null = null;
  starsFn: (() => number) | null = null;
  readonly count: number;
  pickups!: Pickups;
  falls = 0;
  result: Result | null = null;
  onCount?: (n: number) => void;
  onToast?: (text: string, good: boolean) => void;
  onDone?: (r: Result) => void;
  /** A line from the show host. */
  onHost?: (text: string) => void;
  /** The player's path in this run (x, y, z ten times a second), for the ghost. */
  readonly trail: number[] = [];
  private trailT = 0;
  private ghost: Ghost | null = null;
  private hostT = -9;
  private said = new Set<string>();
  /** Slow motion at the finish: seconds of round time left in slow motion. */
  private slowT = 0;
  private slowAll = 0;

  // set by the level while it builds
  killY = -16;
  /** survive: bots like to stay within this distance of the centre (0 = anywhere). */
  arenaR = 0;
  /** collect rounds: where coins appear [x, z, half size]. */
  area: [number, number, number] = [0, 0, 10];
  camBack = 1; camUp = 1; camAhead = 5.5;
  spawn: ((i: number) => [number, number, number]) | null = null;
  floodY = -999; floodSpeed = 0; floodDelay = 0;

  private limit: number;
  private assist: number;
  private cps: Checkpoint[] = [{ z: 1e9, rz: 3, y: 0, sx: 6, x: 0 }];
  private finishZ = -1e9; private finishY = 0;
  private tickers: ((t: number, dt: number) => void)[] = [];
  private floodMesh: THREE.Mesh | null = null;
  private bots = new Map<Actor, Bot>();
  private cp = new Map<Actor, number>();
  private floaters: { o: THREE.Object3D; y: number; ph: number }[] = [];
  private confetti!: THREE.InstancedMesh;
  private cf: { p: THREE.Vector3; v: THREE.Vector3; life: number; rot: number }[] = [];
  private shakeAmt = 0;
  private camPos = new THREE.Vector3(0, 7, 20);
  private lastCount = 4;
  private doneT = -1;
  private won = false;
  private m4 = new THREE.Matrix4();
  private adv: Advice = { sx: 0, speed: 1, jump: false, tx: null };
  private marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  private fx: Fx = {
    shake: (a) => { if (!this.look.calm) this.shakeAmt = Math.max(this.shakeAmt, a); },
    sound: (n) => { if (n === 'boing') sfx.boing(); else sfx.whack(); },
  };

  constructor(readonly def: LevelDef, playerType: string, private auto = false, private look: Look = {}) {
    this.title = def.title; this.mode = def.mode; this.qualify = def.qualify;
    this.limit = def.time ?? (def.mode === 'race' ? 170 : def.mode === 'collect' ? 60 : 75);
    this.assist = def.assist ?? 3;
    this.count = def.runners ?? RUNNERS;
    this.alive = this.count;
    this.buildSky(THEMES[def.theme]);
    def.build(this);
    if (this.floodSpeed > 0) this.buildFlood();
    this.spawnRunners(playerType);
    this.pickups = new Pickups(this.scene, this.world, this.mode, def.id, this.finishZ, !!look.card, this.area);
    const ml = new THREE.Mesh(this.marker.geometry, new THREE.MeshBasicMaterial({ color: 0x2a2036, side: THREE.BackSide }));
    ml.scale.setScalar(1.25);
    this.marker.add(ml);
    this.scene.add(this.marker);
    if (look.ghost && this.mode === 'race' && !auto) this.ghost = new Ghost(this.scene, look.ghost);
    this.world.update(0, 0);
    this.updateCamera(1, true);
  }

  /** How fast the round runs (slow motion at the finish). */
  get timeScale(): number { return this.slowT > 0 ? 0.3 : 1; }

  /** The host says a line of a kind (each kind once per round unless `again`), at most one line every 2.5 s. */
  say(kind: string, again = false): void {
    if (!this.onHost || (!again && this.said.has(kind)) || this.time - this.hostT < 2.5) return;
    const l = HOST[kind];
    if (!l) return;
    this.said.add(kind); this.hostT = this.time;
    this.onHost(l[Math.floor(Math.random() * l.length)]);
  }
  /** The player's celebration, or the usual cheer. */
  private celebrate(a: Actor): void {
    if (a.isPlayer && this.look.emote) a.emote(this.look.emote); else a.cheer();
  }

  // ------------------------------------------------------------------ helpers for level builders
  add<T extends Solid | Hazard>(o: T): T { return this.world.add(o); }
  /** A box from zNear to zFar (zFar is further along the course, more negative). */
  floor(x: number, y: number, zNear: number, zFar: number, hx: number, o: ConstructorParameters<typeof Box>[5] = {}): Box {
    return this.world.add(new Box(x, y, (zNear + zFar) / 2, hx, (zNear - zFar) / 2, o));
  }
  /** A respawn point: reached when a runner stands beyond z; it drops back at rz. */
  checkpoint(z: number, y = 0, sx = 6, x = 0, rz = z - 1.6): void { this.cps.push({ z, rz, y, sx, x }); }
  tick(fn: (t: number, dt: number) => void): void { this.tickers.push(fn); }
  deco(name: string, x: number, y: number, z: number, sc = 1, tint?: string, ry = 0, float = false): void {
    const m = kit(name, tint, name === 'cloud' ? 0 : 0.035);
    m.position.set(x, y, z); m.scale.setScalar(sc); m.rotation.y = ry;
    this.scene.add(m);
    if (float) this.floaters.push({ o: m, y, ph: Math.random() * 6 });
  }
  /** The usual start: a wide pad from z 10 to -14 with the start gate and flags. */
  startPad(pal: 'cream' | 'mint' | 'sky' | 'violet' | 'sun' = 'cream'): void {
    this.floor(0, 0, 10, -14, 8, { pal });
    this.deco('gate_start', 0, 0, -6);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.2), new THREE.MeshBasicMaterial({ map: textTexture(this.title, { w: 1024, h: 192, bg: '#ffffff', fg: '#7b6cf6' }) }));
    banner.position.set(0, 7.2, -5.7);
    this.scene.add(banner);
    for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) this.deco('flag', sd * 8.5, 0, 6 - k * 4.6, 1, TINTS[(k + (sd > 0 ? 3 : 0)) % TINTS.length], sd > 0 ? Math.PI : 0);
  }
  /** The finish: a pad of 16 m with the gate at z, flags and the trophy. */
  finishPad(z: number, y = 0, pal: 'cream' | 'mint' | 'sky' | 'violet' | 'sun' = 'sun', lead = 3): void {
    this.floor(0, y, z + lead, z - 13, 8, { pal });
    const fin = kit('gate_finish');
    fin.position.set(0, y, z);
    this.scene.add(fin);
    this.deco('trophy', 0, y, z - 8, 2.2);
    for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) this.deco('flag', sd * 7.6, y, z - 1 - k * 4, 1, TINTS[(k + (sd > 0 ? 5 : 1)) % TINTS.length], sd > 0 ? Math.PI : 0);
    this.finishZ = z; this.finishY = y;
    this.checkpoint(z + lead - 0.5, y, 6, 0, z + 1.2);
  }
  /** Clouds, balloons and floating props along the course. */
  dress(zFar: number, yTop = 0): void {
    const n = Math.ceil(-zFar / 22) + 2;
    for (let i = 0; i < n; i++) {
      const z = 10 - i * 24, u = i / n, y = yTop * u;
      this.deco('cloud', (i % 2 ? 1 : -1) * (30 + (i * 7) % 22), y + ((i * 5) % 17) - 6, z - 8, 1.6 + (i % 3) * 0.6, undefined, 0, true);
      this.deco('cloud', (i % 2 ? -1 : 1) * (44 + (i * 11) % 18), y + ((i * 9) % 23) - 4, z - 20, 2 + (i % 2) * 0.8, undefined, 0, true);
      this.deco(i % 2 ? 'deco_spool' : 'deco_plug', (i % 2 ? -1 : 1) * (19 + (i % 3) * 2), y - 2 + (i % 4) * 2, z - 14, 1.2, TINTS[(i * 3) % TINTS.length], i * 0.9, true);
      this.deco('balloon', (i % 2 ? 1 : -1) * (12.5 + (i % 2)), y + 4 + (i % 3) * 2, z - 4, 1, TINTS[(i * 5 + 2) % TINTS.length], 0, true);
    }
    this.deco('cloud', 10, yTop + 34, zFar - 90, 3.4, undefined, 0, true);
    this.deco('cloud', 0, -14, zFar / 2, 2.2, undefined, 0, true);
  }

  // ------------------------------------------------------------------ build
  private buildSky(th: Theme): void {
    const s = this.scene;
    const sky = document.createElement('canvas');
    sky.width = 4; sky.height = 256;
    const g = sky.getContext('2d') as CanvasRenderingContext2D;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.55, th.sky[1]); gr.addColorStop(1, th.sky[2]);
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    const st = new THREE.CanvasTexture(sky);
    st.colorSpace = THREE.SRGBColorSpace;
    s.background = st;
    s.fog = new THREE.Fog(th.fog, 110, 330);
    s.add(new THREE.HemisphereLight(0xffffff, th.hemi, 1.5));
    const sun = new THREE.DirectionalLight(th.sun, 2.0);
    sun.position.set(-6, 12, 8);
    s.add(sun);
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 220);
    this.confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.confetti.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < 220; i++) {
      this.confetti.setColorAt(i, col.set(TINTS[i % TINTS.length]));
      this.cf.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0, rot: Math.random() * 6 });
    }
    s.add(this.confetti);
  }

  private buildFlood(): void {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 500).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5fa2, transparent: true, opacity: 0.82 }));
    m.position.set(0, this.floodY, -120);
    this.scene.add(m);
    this.floodMesh = m;
  }

  private spawnRunners(playerType: string): void {
    for (let i = 0; i < this.count; i++) {
      const isP = i === 0;
      const type = isP ? playerType : CHAR_TYPES[i % CHAR_TYPES.length];
      const pt = isP ? this.look.paint : null;
      const a = new Actor(type, isP, isP ? pt?.[0] : TINTS[(i * 5) % TINTS.length], isP ? pt?.[1] : (i % 3 === 0 ? TINTS[(i * 7 + 3) % TINTS.length] : undefined));
      const hats = Object.keys(HATS).filter((h) => h !== 'crown');
      if (isP) a.wear(this.look.hat, '#ff6b6b');
      else if (i % 5 === 2 || i % 7 === 3) a.wear(hats[(i * 3) % hats.length], TINTS[(i * 11) % TINTS.length]);
      if (this.spawn) { const [x, y, z] = this.spawn(i); a.x = x; a.y = y; a.z = z; }
      else {
        const slot = this.count === 1 ? 3.5 : isP ? 7 : i <= 7 ? i - 1 : i;          // the player starts in the middle of the second line
        a.x = -5.25 + (slot % 8) * 1.5 + (Math.floor(slot / 8) % 2) * 0.4;
        a.z = 2.2 + Math.floor(slot / 8) * 1.7;
      }
      this.actors.push(a);
      this.cp.set(a, 0);
      this.scene.add(a.root, a.shadow);
      if (isP) {
        this.player = a;
        a.onJump = sfx.jump;
        a.onLand = (v) => { if (v > 6) sfx.land(); };
      }
      if (!isP || this.auto) {
        this.bots.set(a, { skill: 0.3 + Math.random() * 0.6, pace: 0.8 + Math.random() * 0.15, lane: a.x, jumpCool: 0, planT: Math.random() * 0.1, dx: 0, dz: -1, speed: 1, heading: Math.random() * 6.28, falls: 0, fallCp: -1 });
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
      if (n <= 0) { this.phase = 'race'; this.say('go'); }
    }
    const racing = this.phase === 'race' || this.phase === 'done';
    if (this.phase === 'race') {
      this.raceT += dt;
      for (const f of this.tickers) f(this.raceT, dt);
      if (this.floodSpeed > 0 && this.raceT > this.floodDelay) this.floodY += this.floodSpeed * dt;
    }
    if (this.floodMesh) this.floodMesh.position.y = this.floodY + Math.sin(this.time * 2) * 0.05;
    if (this.phase === 'race' && this.mode === 'race' && !this.player.finished) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT += 1 / GHOST_HZ; const p = this.player; this.trail.push(+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)); }
    }
    if (this.ghost && racing) this.ghost.place(this.raceT, dt);
    if (this.slowT > 0) this.slowT -= dt;
    if (this.phase === 'race' && this.doneT < 0) this.hostWatch();
    this.world.update(this.time, dt);
    for (const a of this.actors) {
      if (a.eliminated) continue;
      if (!racing) { a.ctl.ix = a.ctl.iz = 0; a.ctl.jump = a.ctl.dive = false; }
      else if (!a.isPlayer || this.auto) this.think(a, dt);
      if (a.finished) this.afterFinish(a);
      this.ground(a, true);
      a.step(dt);
      this.world.collide(a, this.fx);
      this.checkpoint_(a);
      if (a.y < this.killY || a.y < this.floodY - 0.3) this.fell(a);
      if (!a.finished && racing && this.mode === 'race' && a.z < this.finishZ && a.y > this.finishY - 1) this.finish(a);
    }
    this.collidePairs();
    this.pickups.update(this.raceT, dt, this.phase === 'race' && this.doneT < 0, this.player, {
      coin: () => sfx.coin(),
      card: (x, y, z) => { sfx.card(); this.burst(x, y, z); this.onToast?.('מצאת קלף ידע!', true); this.hostT = -9; this.say('card'); },
    }, this.actors);
    for (const a of this.actors) { if (a.eliminated) continue; this.ground(a, false); a.animate(dt); }
    this.stepConfetti(dt);
    for (const f of this.floaters) f.o.position.y = f.y + Math.sin(this.time * 0.6 + f.ph) * 0.6;
    const p = this.player;
    this.marker.position.set(p.x, p.y + 2.15 + Math.sin(this.time * 6) * 0.12, p.z);
    this.marker.rotation.y = this.time * 3;
    this.marker.visible = !p.finished && !p.eliminated;
    this.updateCamera(dt, false);
    if (this.phase === 'race' && this.doneT < 0) this.checkEnd();
    if (this.doneT >= 0 && this.phase !== 'done') {
      this.doneT += dt;
      if (this.doneT > 1.8) this.end();
    }
  }

  /** Watch the round for moments the host comments on. */
  private hostWatch(): void {
    const p = this.player, left = this.limit - this.raceT;
    if (this.count === 1) return;
    if (left < 10.5 && left > 9 && this.mode !== 'race') this.say('ten');
    if (this.mode === 'race') {
      if (this.finishedCount >= 1) this.say('first');
      if (this.qualify - this.finishedCount === 5 && !p.finished) this.say('left5');
      if (this.raceT > 8 && this.rank() === 1) this.say('lead');
      if (this.progress() > 0.5) this.say('half');
    } else if (this.mode === 'survive') {
      if (this.alive <= this.qualify + 3) this.say('few');
    } else if (this.raceT > 20 && this.rank() <= 3) this.say('top3');
  }

  private checkEnd(): void {
    const p = this.player;
    if (this.mode === 'survive') {
      if (p.eliminated) return;      // handled in fell()
      if (this.alive <= this.qualify || this.raceT >= this.limit) {
        this.won = true; this.doneT = 0;
        sfx.win(); this.celebrate(p);
        this.burst(p.x, p.y + 2, p.z); this.burst(p.x - 3, p.y + 3, p.z - 2); this.burst(p.x + 3, p.y + 3, p.z - 2);
        for (const a of this.actors) if (!a.eliminated) a.finished = true;
      }
    } else if (this.mode === 'collect') {
      if (this.raceT >= this.limit) {
        this.won = this.rank() <= this.qualify; this.doneT = 0;
        if (this.won) { sfx.win(); this.celebrate(p); this.burst(p.x, p.y + 2, p.z); } else sfx.lose();
        for (const a of this.actors) a.finished = true;
      }
    } else if (this.raceT >= this.limit && !p.finished) { sfx.lose(); this.doneT = 0.6; }
  }

  /** Tell a runner what it is standing on; bounce pads launch it; tiles feel the step. */
  private ground(a: Actor, act: boolean): void {
    const g = this.world.groundAt(a.x, a.y, a.z);
    if (!g) { a.groundY = null; a.gvx = a.gvz = 0; a.grip = 1; return; }
    a.groundY = g.y; a.gvx = g.vx; a.gvz = g.vz; a.grip = g.grip;
    if (!act || !a.grounded) return;
    if (g.solid.vy !== 0) a.y = g.y;
    if (a.y <= g.y + 0.05) {
      if (this.phase !== 'ready' && this.phase !== 'count') g.solid.stand(a);
      if (g.solid.bounce) { a.launch(g.solid.bounce); if (a.isPlayer) sfx.boing(); }
    }
  }

  private checkpoint_(a: Actor): void {
    const i = this.cp.get(a) ?? 0, next = this.cps[i + 1];
    if (next && a.z < next.z && a.grounded && a.y > next.y - 0.5) this.cp.set(a, i + 1);
  }

  private fell(a: Actor): void {
    if (this.mode === 'survive') { this.eliminate(a); return; }
    let i = this.cp.get(a) ?? 0;
    const b = this.bots.get(a);
    if (b) {
      if (b.fallCp === i) b.falls++; else { b.fallCp = i; b.falls = 1; }
      if (b.falls >= this.assist && i + 1 < this.cps.length) { i++; this.cp.set(a, i); b.falls = 0; }
    }
    const c = this.cps[i];
    if (c.y < this.floodY + 1.2) { this.eliminate(a); return; }
    a.x = c.x + (Math.random() - 0.5) * c.sx; a.z = c.rz + Math.random() * 1.2; a.y = c.y + 6;
    a.vx = a.vz = 0; a.vy = 0;
    a.mode = 'normal'; a.stun = 0.2; a.grounded = false;
    const lost = this.mode === 'collect' ? this.pickups.drop(a, 3) : 0;
    if (a.isPlayer) { this.falls++; sfx.fall(); this.onToast?.(lost ? 'נפלת! איבדת ' + lost + ' מטבעות' : 'נפלת! חוזרים לנקודה האחרונה', false); if (Math.random() < 0.5) this.say('fall', true); }
  }

  private eliminate(a: Actor): void {
    a.eliminated = true;
    a.place = this.alive--;
    a.root.visible = false; a.shadow.visible = false;
    if (a.isPlayer && this.doneT < 0) { this.falls++; sfx.out(); sfx.lose(); this.onToast?.('נפלת מהבמה', false); this.doneT = 0.5; }
  }

  private collidePairs(): void {
    const A = this.actors, min = RADIUS * 2;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (a.eliminated) continue;
      for (let j = i + 1; j < A.length; j++) {
        const b = A[j];
        if (b.eliminated) continue;
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
        a.vx -= nx * jimp * pb / (pa + pb); a.vz -= nz * jimp * pb / (pa + pb);
        b.vx += nx * jimp * pa / (pa + pb); b.vz += nz * jimp * pa / (pa + pb);
        a.bump(-nx, -nz, -rel * 0.5 * pb); b.bump(nx, nz, -rel * 0.5 * pa);
        if (-rel > 9) {
          if (pa > pb && b.mode === 'normal') b.stun = 0.25;
          if (pb > pa && a.mode === 'normal') a.stun = 0.25;
        }
      }
    }
  }

  // ------------------------------------------------------------------ bots
  private okGround(a: Actor, x: number, z: number): Ground | null {
    const g = this.world.groundAt(x, a.y + 1.3, z);
    if (!g || g.y < a.y - 6 || g.y - a.y > 1.4) return null;
    return g;
  }

  /** Choose a direction: probe the floor along a fan of headings and take the best one. */
  private plan(a: Actor, b: Bot): void {
    const surv = this.mode !== 'race';
    if (this.mode === 'collect') {
      let best = 1e9, tx = 0, tz = 0;
      for (const c of this.pickups.coins) {
        if (c.taken || Math.abs(c.y - 1 - a.y) > 2.5) continue;
        const d = Math.hypot(c.x - a.x, c.z - a.z) * (0.8 + Math.random() * (1.2 - b.skill));
        if (d < best) { best = d; tx = c.x; tz = c.z; }
      }
      if (best < 1e9) b.heading = Math.atan2(tx - a.x, -(tz - a.z));
    } else if (surv) {
      b.heading += (Math.random() - 0.5) * 0.8;
      const under = this.world.groundAt(a.x, a.y, a.z)?.solid;      // on a tile that still holds: stay until it is about to drop
      if (under instanceof Tile && (under.state === 0 || under.t < under.delay - 0.4)) { b.speed = 0; return; }
    }
    const base = surv ? b.heading : 0;
    let best = -1e9, bang = base;
    for (const th of surv ? CANDS_S : CANDS) {
      const ang = base + th, ux = Math.sin(ang), uz = -Math.cos(ang);
      let score = (this.mode === 'survive' ? 0.35 : 1) * Math.cos(th) + (Math.random() - 0.5) * 0.25 * (1.1 - b.skill);
      let gap = -1, land = -1;
      for (let k = 1; k <= 6; k++) {
        const d = k * 0.7, g = this.okGround(a, a.x + ux * d, a.z + uz * d);
        if (!g) { if (gap < 0) gap = d; }
        else {
          if (gap >= 0) { land = d; break; }
          if (!surv) score -= THREE.MathUtils.clamp(g.vz, -4, 4) * 0.05 * (0.4 + b.skill);     // belts: prefer the ones that help
          else if (g.solid instanceof Tile && g.solid.state !== 0) score -= 0.5;
        }
      }
      if (gap >= 0) {
        if (land > 0 && land - gap <= 2.9) score -= 0.3;         // a gap that can be jumped
        else if (gap >= 2.8) score -= 0.15;                      // the floor ends far away: look again later
        else score -= 4 - gap * 0.5;                             // the void
      }
      if (!surv) score -= Math.abs(a.x + ux * 2.1 - b.lane) * 0.03;
      else if (this.arenaR > 0) score -= Math.max(0, Math.hypot(a.x + ux * 2.1, a.z + uz * 2.1) - this.arenaR * 0.55) * 0.5;
      if (score > best) { best = score; bang = ang; }
    }
    b.dx = Math.sin(bang); b.dz = -Math.cos(bang);
    if (surv) { b.heading = bang; b.speed = best < -2.5 ? 0.3 : b.pace; }
    else b.speed = best < -2.5 ? 0.04 : b.pace;                  // nowhere to go yet: wait (a platform may come)
  }

  private think(a: Actor, dt: number): void {
    const b = this.bots.get(a) as Bot, c = a.ctl;
    c.jump = false; c.dive = false; c.jumpHeld = true;
    if (a.finished) return;
    b.jumpCool = Math.max(0, b.jumpCool - dt);
    b.planT -= dt;
    if (b.planT <= 0 && a.grounded) { b.planT = 0.1 + Math.random() * 0.06; this.plan(a, b); }
    const adv = this.adv;
    adv.sx = 0; adv.speed = 1; adv.jump = false; adv.tx = null;
    for (const h of this.world.hazards) h.advise(a, b.skill, adv, this.time);
    let dx = b.dx, dz = b.dz;
    const sp = b.speed * adv.speed;
    if (adv.tx !== null) { dx = THREE.MathUtils.clamp((adv.tx - a.x) * 0.9, -1, 1); dz = -1; }
    dx += adv.sx;
    const m = Math.hypot(dx, dz) || 1;
    dx /= m; dz /= m;
    c.ix = dx * Math.max(Math.abs(sp), adv.sx !== 0 || adv.tx !== null ? 0.6 : 0);
    c.iz = dz * sp;
    if (a.grounded && b.jumpCool <= 0) {
      if (sp > 0.3) {
        const px = a.x + dx * 0.75, pz = a.z + dz * 0.75;
        const g = this.world.groundAt(px, a.y + 1.4, pz);
        if (!g || g.y < a.y - 6 || (g.y > a.y + 0.42 && g.y < a.y + 1.5)) { c.jump = true; b.jumpCool = 0.3; }
      }
      if (adv.jump && !c.jump) { b.jumpCool = 0.7; if (Math.random() < 0.45 + b.skill * 0.5) c.jump = true; }
    }
    if (this.mode === 'race' && a.z - this.finishZ < 3.5 && a.z > this.finishZ && a.grounded && Math.random() < 0.02) c.dive = true;
  }

  // ------------------------------------------------------------------ finish
  private finish(a: Actor): void {
    a.finished = true;
    a.place = ++this.finishedCount;
    if (a.isPlayer) {
      const y = this.finishY;
      this.burst(a.x, y + 2, a.z - 2); this.burst(a.x - 3, y + 3, a.z - 3); this.burst(a.x + 3, y + 3, a.z - 3);
      this.won = a.place <= this.qualify;
      if (this.won) sfx.win(); else sfx.lose();
      this.doneT = 0;
      if (!this.look.calm && !this.auto) { this.slowT = 0.42; this.slowAll = 0.42; }
    } else if (this.finishedCount >= this.qualify && !this.player.finished && this.doneT < 0) {
      sfx.lose();
      this.doneT = 0.6;
    }
  }

  private afterFinish(a: Actor): void {
    const c = a.ctl;
    c.ix = c.iz = 0; c.jump = c.dive = false;
    if (this.mode !== 'race') { this.celebrate(a); return; }
    const tz = this.finishZ - 3.5 - (a.place % 4) * 1.6, txx = -6 + ((a.place * 5) % 9) * 1.5;
    const dx = txx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    if (d > 0.6 && a.mode === 'normal' && a.grounded) { a.vx = dx / d * 4; a.vz = dz / d * 4; }
    else if (d <= 0.6) { a.vx *= 0.8; a.vz *= 0.8; if (a.place <= this.qualify) this.celebrate(a); }
  }

  private end(): void {
    this.phase = 'done';
    const place = this.rank();
    let stars = 0;
    if (this.won) {
      if (this.starsFn) { stars = this.starsFn(); if (stars === 0) this.won = false; }
      else if (this.mode !== 'survive') stars = place === 1 ? 3 : place <= Math.ceil(this.qualify / 2) ? 2 : 1;
      else stars = this.alive <= this.qualify ? (this.falls === 0 ? 3 : 2) : 2;
    }
    this.result = { place, qualified: this.won, falls: this.falls, time: this.raceT, stars, coins: this.pickups.got, card: this.pickups.cardGot };
    this.onDone?.(this.result);
  }

  /** Place of the player right now (1 = first). */
  rank(): number {
    const p = this.player;
    if (this.mode === 'survive') return p.eliminated ? p.place : 1;
    if (this.mode === 'collect') { const sc = this.pickups.score, me = sc.get(p) ?? 0; return 1 + this.actors.filter((x) => x !== p && (sc.get(x) ?? 0) > me).length; }
    if (p.finished || p.eliminated) return p.place;
    return 1 + this.actors.filter((x) => x !== p && !x.eliminated && (x.finished || x.z < p.z)).length;
  }
  /** How far along the round the player is, 0 to 1. */
  progress(): number {
    if (this.mode !== 'race') return THREE.MathUtils.clamp(this.raceT / this.limit, 0, 1);
    return THREE.MathUtils.clamp((4 - this.player.z) / (4 - this.finishZ), 0, 1);
  }
  /** Short status texts for the two chips of the HUD. */
  chips(): [string, string] {
    if (this.chipsFn) return this.chipsFn();
    if (this.mode === 'survive') return ['נשארו ' + this.alive, 'עולים ' + this.qualify];
    if (this.mode === 'collect') return ['מקום ' + this.rank(), 'עוד ' + Math.max(0, Math.ceil(this.limit - this.raceT)) + ' שניות · עולים ' + this.qualify];
    return ['מקום ' + this.rank(), 'עלו ' + Math.min(this.finishedCount, this.qualify) + ' מתוך ' + this.qualify];
  }

  // ------------------------------------------------------------------ effects
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
    const e = new THREE.Euler(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
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
    const back = (portrait ? 13 : 10) * this.camBack, up = (portrait ? 7.5 : 5.6) * this.camUp;
    const py = Math.max(p.y, Math.max(this.killY + 10, this.floodY));
    const want = new THREE.Vector3(p.x * 0.72, py + up, p.z + back);
    if (this.slowT > 0) {                                    // slow motion: swing round to the side of the runner
      const u = 1 - this.slowT / this.slowAll, ang = u * 0.9;
      want.set(p.x + Math.sin(ang) * back * 0.8, py + up * 0.7, p.z + Math.cos(ang) * back * 0.8);
    }
    if (snap) this.camPos.copy(want);
    else if (!p.eliminated) { this.camPos.x += (want.x - this.camPos.x) * Math.min(1, 6 * dt); this.camPos.z += (want.z - this.camPos.z) * Math.min(1, 6 * dt); this.camPos.y += (want.y - this.camPos.y) * Math.min(1, 3 * dt); }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.4);
    const s = this.shakeAmt * 0.5;
    cam.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z);
    if (this.slowT > 0) cam.lookAt(p.x, py + 1, p.z);
    else cam.lookAt(this.camPos.x * 0.92, this.camPos.y - up + 1.6, this.camPos.z - back - this.camAhead);
  }
}
