import * as THREE from 'three';
import './style.css';
import { initInput, readInput } from './input';
import { LESSONS, type GameLevel, type Lesson } from './learn/content';
import { GAME_LEVELS, quizRun } from './learn/quizrun';
import { runLesson } from './learn/ui';
import { LEVELS } from './levels';
import { CHAR_TYPES, loadModels } from './models';
import { Round, RUNNERS, type LevelDef, type Result } from './round';
import { sfx, unlockAudio } from './sfx';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const NAMES: Record<string, string> = { ch_robo: 'רובו', ch_plug: 'פלאג', ch_bit: 'ביט', ch_wave: 'גלי', ch_fibra: 'סיב', ch_coil: 'סליל' };
const params = new URLSearchParams(location.search);
const ALL = params.has('all');

// ------------------------------------------------------------------ the show: rounds with a lesson before rounds 2, 4, 6, 8, 10
type Item = { kind: 'round'; lv: LevelDef; n: number } | { kind: 'lesson'; ls: Lesson };
const ITEMS: Item[] = [];
LEVELS.forEach((lv, i) => {
  if (i % 2 === 1) ITEMS.push({ kind: 'lesson', ls: LESSONS[(i - 1) / 2] });
  ITEMS.push({ kind: 'round', lv, n: i + 1 });
});

// ------------------------------------------------------------------ saved progress
interface Save { stars: Record<string, number>; lessons: Record<string, { quiz: boolean; medal: number }>; char: string }
const KEY = 'crownrun.save.v1';
function loadSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Save | null;
    if (s && s.stars) { s.lessons ??= {}; return s; }
  } catch { /* no storage */ }
  return { stars: {}, lessons: {}, char: 'ch_robo' };
}
const save = loadSave();
function store(): void { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* no storage */ } }
function lessonState(id: string): { quiz: boolean; medal: number } { return (save.lessons[id] ??= { quiz: false, medal: 0 }); }
function complete(it: Item): boolean { return it.kind === 'round' ? (save.stars[it.lv.id] ?? 0) > 0 : lessonState(it.ls.id).quiz && lessonState(it.ls.id).medal > 0; }
function unlocked(i: number): boolean { return ALL || i === 0 || complete(ITEMS[i - 1]); }

const renderer = new THREE.WebGLRenderer({ canvas: $('view') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
let game: Round | null = null;
let sel = 0;                                                   // selected ticket on the board
let mini: { ls: Lesson; level: number } | null = null;         // the answer-door game being played, if any
let shownRound = -1;

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (game) { game.camera.aspect = window.innerWidth / window.innerHeight; game.camera.fov = game.camera.aspect < 1 ? 68 : 58; game.camera.updateProjectionMatrix(); }
}
window.addEventListener('resize', resize);

let toastT = 0;
function toast(text: string, good: boolean): void {
  const t = $('toast');
  t.textContent = text;
  t.className = 'on ' + (good ? 'good' : 'bad');
  toastT = 1.1;
}

/** Free what the last round put on the graphics card (textures made for it; shared models stay). */
function dispose(old: Round): void {
  old.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mt of Array.isArray(m.material) ? m.material : [m.material]) {
      const map = (mt as THREE.MeshToonMaterial).map;
      if (map && map.userData.round) { map.dispose(); mt.dispose(); }
    }
  });
  (old.scene.background as THREE.Texture | null)?.dispose();
}

function newGame(def: LevelDef): void {
  if (game) dispose(game);
  game = new Round(def, save.char, params.has('auto'));
  game.onToast = toast;
  game.onCount = (n) => {
    const c = $('count');
    c.textContent = n > 0 ? String(n) : 'צאו!';
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    if (n === 0) setTimeout(() => { c.textContent = ''; }, 700);
  };
  game.onDone = showEnd;
  resize();
  (window as unknown as { __ff: unknown }).__ff = { game, LEVELS, LESSONS, ITEMS, save };
}
/** Put the selected round (or the nearest one before a lesson) behind the board. */
function showRoundOf(i: number): void {
  let k = i;
  while (k > 0 && ITEMS[k].kind !== 'round') k--;
  const it = ITEMS[k];
  if (it.kind !== 'round') return;
  if (shownRound === k && game && game.phase === 'ready' && !mini) return;
  shownRound = k; mini = null;
  newGame(it.lv);
}

function stars(n: number): string { return '★'.repeat(n); }
const MEDALS = ['', 'ארד', 'כסף', 'זהב'];

function drawBoard(): void {
  const box = $('levels');
  box.textContent = '';
  ITEMS.forEach((it, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const open = unlocked(i);
    const num = document.createElement('b'), name = document.createElement('span'), s = document.createElement('i');
    if (it.kind === 'round') {
      num.textContent = String(it.n);
      name.textContent = open ? it.lv.title : 'נעול';
      s.textContent = stars(save.stars[it.lv.id] ?? 0);
    } else {
      b.classList.add('lesson');
      num.textContent = 'שיעור';
      name.textContent = open ? it.ls.short : 'נעול';
      const st = lessonState(it.ls.id);
      s.textContent = st.medal > 0 ? MEDALS[st.medal] : st.quiz ? 'בוחן עבר' : '';
    }
    b.append(num, name, s);
    if (!open) b.classList.add('lock');
    if (complete(it)) b.classList.add('done');
    if (i === sel) b.classList.add('sel');
    b.onclick = () => { if (!open || i === sel) return; sel = i; showRoundOf(sel); drawBoard(); };
    box.append(b);
  });
  const it = ITEMS[sel];
  if (it.kind === 'round') {
    $('tip').textContent = it.lv.tip + (it.lv.mode === 'survive' ? ' שורדים עד שנשארים ' + it.lv.qualify + '.' : ' עולים ' + it.lv.qualify + ' הראשונים.');
    $('go').textContent = 'יוצאים לדרך';
  } else {
    const st = lessonState(it.ls.id);
    $('tip').textContent = 'שיעור ' + it.ls.num + ': ' + it.ls.title + '. שיעור קצר, בוחן ומשחק תשובות. אחריו נפתחים הסיבובים הבאים.';
    $('go').textContent = st.quiz ? 'למשחק התשובות' : 'לשיעור';
  }
}

function showBoard(): void {
  document.body.classList.remove('playing');
  for (const id of ['hud', 'end', 'mini', 'lesson']) $(id).classList.add('hide');
  $('card').classList.remove('hide');
  showRoundOf(sel);
  drawBoard();
}

// ------------------------------------------------------------------ lessons and their mini-game
function openLesson(ls: Lesson): void {
  $('card').classList.add('hide');
  $('mini').classList.add('hide');
  runLesson($('lesson'), ls, {
    onPass: () => { lessonState(ls.id).quiz = true; store(); showMini(ls); },
    onExit: showBoard,
  });
}

function showMini(ls: Lesson): void {
  document.body.classList.remove('playing');
  for (const id of ['hud', 'end', 'card', 'lesson']) $(id).classList.add('hide');
  const st = lessonState(ls.id);
  $('miniTitle').textContent = 'משחק התשובות: ' + ls.short;
  const box = $('miniLevels');
  box.textContent = '';
  GAME_LEVELS.forEach((g, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    const open = i === 0 || st.medal >= i || ALL;
    const name = document.createElement('b'), prize = document.createElement('span'), s = document.createElement('i');
    name.textContent = g.name;
    prize.textContent = g.prize;
    s.textContent = st.medal > i ? 'הושג' : open ? g.walls + ' שאלות' : 'נעול';
    b.append(name, prize, s);
    if (!open) b.classList.add('lock');
    if (st.medal > i) b.classList.add('done');
    b.onclick = () => { if (open) startMini(ls, i); };
    box.append(b);
  });
  $('mini').classList.remove('hide');
  $('miniLearn').onclick = () => openLesson(ls);
  $('miniBack').onclick = showBoard;
}

function startMini(ls: Lesson, level: number): void {
  mini = { ls, level };
  shownRound = -1;
  newGame(quizRun(ls, GAME_LEVELS[level].id as GameLevel));
  begin();
}

// ------------------------------------------------------------------ a round starts and ends
function begin(): void {
  unlockAudio();
  for (const id of ['card', 'end', 'mini', 'lesson']) $(id).classList.add('hide');
  $('hud').classList.remove('hide');
  document.body.classList.add('playing');
  game?.start();
}

function showEnd(r: Result): void {
  document.body.classList.remove('playing');
  $('hud').classList.add('hide');
  $('stars').textContent = stars(r.stars);
  $('stars').classList.toggle('hide', r.stars === 0);
  const next = $('next');
  if (mini) {
    const { ls, level } = mini, st = lessonState(ls.id);
    if (r.qualified && st.medal < level + 1) { st.medal = level + 1; store(); }
    $('endTitle').textContent = r.qualified ? GAME_LEVELS[level].prize + '!' : 'עוד לא';
    $('endLine').textContent = r.qualified ? 'עברת את כל הדלתות ב-' + r.time.toFixed(1) + ' שניות' : 'כדי לזכות במדליה: עד 3 טעויות, ולפני שנגמר הזמן.';
    const more = r.qualified && level + 1 < GAME_LEVELS.length;
    next.textContent = more ? 'לרמה הבאה' : 'ממשיכים במופע';
    next.classList.toggle('hide', !r.qualified);
    next.onclick = () => { if (more) startMini(ls, level + 1); else { mini = null; sel = Math.min(ITEMS.length - 1, sel + 1); showBoard(); } };
    $('again').onclick = () => startMini(ls, level);
    $('menu').textContent = 'חזרה';
    $('menu').onclick = () => { mini = null; showMini(ls); };
  } else {
    const it = ITEMS[sel];
    if (it.kind !== 'round') return;
    const lv = it.lv;
    if (r.stars > (save.stars[lv.id] ?? 0)) { save.stars[lv.id] = r.stars; store(); }
    const last = sel === ITEMS.length - 1;
    $('endTitle').textContent = r.qualified ? (last ? 'הכתר שלך!' : 'עלית שלב!') : 'לא הפעם';
    const what = lv.mode === 'survive' ? (r.qualified ? 'שרדת עד הסוף' : 'יצאת במקום ' + r.place + ' מתוך ' + RUNNERS) : 'מקום ' + r.place + ' מתוך ' + RUNNERS;
    $('endLine').textContent = what + ' · ' + r.time.toFixed(1) + ' שניות' + (lv.mode === 'race' ? ' · ' + (r.falls === 0 ? 'בלי אף נפילה' : r.falls + ' נפילות') : '');
    const can = !last && unlocked(sel + 1);
    const nx = can ? ITEMS[sel + 1] : null;
    next.textContent = nx && nx.kind === 'lesson' ? 'לשיעור הבא' : 'לסיבוב הבא';
    next.classList.toggle('hide', !can);
    next.onclick = () => {
      sel++;
      const n = ITEMS[sel];
      if (n.kind === 'round') { showRoundOf(sel); begin(); }
      else if (lessonState(n.ls.id).quiz) showMini(n.ls); else openLesson(n.ls);
    };
    $('again').onclick = () => { shownRound = -1; showRoundOf(sel); begin(); };
    $('menu').textContent = 'כל המופע';
    $('menu').onclick = () => { shownRound = -1; showBoard(); };
  }
  $('end').classList.remove('hide');
}

let last = performance.now(), acc = 0, hudText = '';
const STEP = 1 / 60;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game) return;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 5) {
    readInput(game.player.ctl);
    if (game.player.ctl.dive && game.player.canDive && game.phase === 'race') sfx.dive();
    game.step(STEP);
    acc -= STEP; n++;
  }
  if (n === 5) acc = 0;
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').className = ''; }
  const [c1, c2] = game.chips();
  $('rank').textContent = c1;
  $('qual').textContent = c2;
  const t = game.hud ?? game.title;
  if (t !== hudText) { hudText = t; $('question').textContent = t; $('question').dir = /[֐-׿]/.test(t) ? 'rtl' : 'ltr'; }
  ($('bar').firstElementChild as HTMLElement).style.width = Math.round(game.progress() * 100) + '%';
  renderer.render(game.scene, game.camera);
}

async function boot(): Promise<void> {
  initInput();
  await loadModels((f) => { $('load').textContent = 'טוען... ' + Math.round(f * 100) + '%'; });
  $('load').classList.add('hide');
  $('intro').classList.remove('hide');
  if (!CHAR_TYPES.includes(save.char)) save.char = CHAR_TYPES[0];
  const pick = $('pick');
  for (const t of CHAR_TYPES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = NAMES[t];
    if (t === save.char) b.classList.add('sel');
    b.onclick = () => {
      save.char = t; store();
      pick.querySelectorAll('button').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      shownRound = -1; showRoundOf(sel);
    };
    pick.append(b);
  }
  const want = Number(params.get('lv'));
  const wi = ITEMS.findIndex((it) => it.kind === 'round' && it.n === want);
  if (wi >= 0 && unlocked(wi)) sel = wi;
  else { sel = ITEMS.findIndex((it, i) => unlocked(i) && !complete(it)); if (sel < 0) sel = 0; }
  showBoard();
  $('go').onclick = () => {
    const it = ITEMS[sel];
    if (it.kind === 'round') { showRoundOf(sel); begin(); }
    else if (lessonState(it.ls.id).quiz) showMini(it.ls); else openLesson(it.ls);
  };
  const ml = Number(params.get('lesson'));      // test hooks: ?lesson=9 opens a lesson, ?mini=9 opens its game menu
  const mm = Number(params.get('mini'));
  if (ml) { const ls = LESSONS.find((l) => l.num === ml); if (ls) openLesson(ls); }
  if (mm) { const ls = LESSONS.find((l) => l.num === mm); if (ls) showMini(ls); }
  requestAnimationFrame(frame);
}
boot().catch((e) => { $('load').textContent = 'תקלה בטעינה: ' + String(e?.message ?? e); console.error(e); });
