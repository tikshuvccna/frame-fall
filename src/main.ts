import * as THREE from 'three';
import './style.css';
import { Actor } from './actor';
import { initInput, readInput } from './input';
import { LESSONS, type GameLevel, type Lesson } from './learn/content';
import { GAME_LEVELS, quizRun } from './learn/quizrun';
import { runLesson } from './learn/ui';
import { LEVELS } from './levels';
import { CHAR_TYPES, loadModels } from './models';
import { playMusic, resumeMusic } from './music';
import { checkPrizes, ITEMS_SHOP, loadSave, PAINTS, payOnce, storeSave, type Prize } from './profile';
import { Round, RUNNERS, type LevelDef, type Result } from './round';
import { coinify, openScreen, type ScreenCtx, type ScreenId } from './screens';
import { setVolumes, sfx, unlockAudio } from './sfx';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const params = new URLSearchParams(location.search);
const ALL = params.has('all');
const charName = (t: string) => ITEMS_SHOP.find((i) => i.id === t)?.name ?? t;

// ------------------------------------------------------------------ the show: rounds with a lesson every two or three rounds
type Item = { kind: 'round'; lv: LevelDef; n: number } | { kind: 'lesson'; ls: Lesson };
const ITEMS: Item[] = [];
const LESSON_BEFORE = [1, 3, 6, 8, 10];            // a lesson comes before these rounds (by index)
LEVELS.forEach((lv, i) => {
  const k = LESSON_BEFORE.indexOf(i);
  if (k >= 0 && LESSONS[k]) ITEMS.push({ kind: 'lesson', ls: LESSONS[k] });
  ITEMS.push({ kind: 'round', lv, n: i + 1 });
});

// ------------------------------------------------------------------ saved progress
const save = loadSave();
function store(): void { storeSave(save); }
function lessonState(id: string): { quiz: boolean; medal: number } { return (save.lessons[id] ??= { quiz: false, medal: 0 }); }
function complete(it: Item): boolean { return it.kind === 'round' ? (save.stars[it.lv.id] ?? 0) > 0 : lessonState(it.ls.id).quiz && lessonState(it.ls.id).medal > 0; }
function unlocked(i: number): boolean { return ALL || i === 0 || complete(ITEMS[i - 1]); }
function look(card: boolean) {
  return { hat: save.hat, paint: save.paint ? PAINTS[save.paint.replace('paint_', '')] ?? null : null, card };
}

const renderer = new THREE.WebGLRenderer({ canvas: $('view') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
function applySettings(): void {
  renderer.setPixelRatio(save.low ? 1 : Math.min(window.devicePixelRatio, 2));
  setVolumes(save.music, save.sound);
  resize();
}
let game: Round | null = null;
let sel = 0;                                                   // selected ticket on the board
let mini: { ls: Lesson; level: number } | null = null;         // the answer-door game being played, if any
let shownRound = -1;

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (game) { game.camera.aspect = w / h; game.camera.fov = game.camera.aspect < 1 ? 68 : 58; game.camera.updateProjectionMatrix(); }
  if (pv) placePreviewCam();
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

function newGame(def: LevelDef, card: boolean): void {
  if (game) dispose(game);
  game = new Round(def, save.char, params.has('auto'), look(card && !save.cards.includes(def.id)));
  game.onToast = toast;
  game.onCount = (n) => {
    const c = $('count');
    c.textContent = n > 0 ? String(n) : 'צאו!';
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
    if (n === 0) setTimeout(() => { c.textContent = ''; }, 700);
  };
  game.onDone = showEnd;
  resize();
  (window as unknown as { __ff: unknown }).__ff = { game, LEVELS, LESSONS, ITEMS, save, openScreen: (id: ScreenId) => openPanel(id) };
}
/** Put the selected round (or the nearest one before a lesson) behind the board. */
function showRoundOf(i: number, force = false): void {
  let k = i;
  while (k > 0 && ITEMS[k].kind !== 'round') k--;
  const it = ITEMS[k];
  if (it.kind !== 'round') return;
  if (!force && shownRound === k && game && game.phase === 'ready' && !mini) return;
  shownRound = k; mini = null;
  newGame(it.lv, true);
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
      if (save.cards.includes(it.lv.id)) b.classList.add('hascard');
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
    b.onclick = () => { if (!open || i === sel) return; sfx.click(); sel = i; showRoundOf(sel); drawBoard(); };
    box.append(b);
  });
  const it = ITEMS[sel];
  if (it.kind === 'round') {
    $('tip').textContent = it.lv.tip + (it.lv.mode === 'survive' ? ' שורדים עד שנשארים ' + it.lv.qualify + '.' : it.lv.mode === 'collect' ? ' עולים ' + it.lv.qualify + ' האספנים הגדולים.' : ' עולים ' + it.lv.qualify + ' הראשונים.');
    $('go').textContent = 'יוצאים לדרך';
  } else {
    const st = lessonState(it.ls.id);
    $('tip').textContent = 'שיעור ' + it.ls.num + ': ' + it.ls.title + '. שיעור קצר, בוחן ומשחק תשובות. אחריו נפתחים הסיבובים הבאים.';
    $('go').textContent = st.quiz ? 'למשחק התשובות' : 'לשיעור';
  }
  $('purse').textContent = '🪙 ' + save.coins;
  coinify($('purse'));
  $('who').textContent = (save.name ? save.name + ' · ' : '') + charName(save.char);
}

function showBoard(): void {
  document.body.classList.remove('playing');
  for (const id of ['hud', 'end', 'mini', 'lesson', 'panel', 'prize']) $(id).classList.add('hide');
  document.body.classList.remove('preview');
  $('card').classList.remove('hide');
  showRoundOf(sel);
  drawBoard();
  playMusic('menu');
}

// ------------------------------------------------------------------ backstage screens, with a turning preview of the player in the locker
let pv: { scene: THREE.Scene; cam: THREE.PerspectiveCamera; actor: Actor | null } | null = null;
function placePreviewCam(): void {
  if (!pv) return;
  const w = window.innerWidth, h = window.innerHeight, cam = pv.cam;
  cam.aspect = w / h;
  cam.clearViewOffset();
  cam.position.set(0, 1.7, w > h ? -5.4 : -8.5);
  cam.lookAt(0, 0.75, 0);
  if (w > h) cam.setViewOffset(w, h, w * 0.24, 0, w, h);      // the panel covers the right side: show the runner on the left
  else cam.setViewOffset(w, h, 0, h * 0.27, w, h);             // the panel covers the bottom: show the runner on top
  cam.updateProjectionMatrix();
}
function buildPreview(): void {
  if (!pv) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#ffd6ea');
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffc9e2, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4dc, 2);
    sun.position.set(-3, 6, -6);
    scene.add(sun);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.4, 32), new THREE.MeshToonMaterial({ color: '#7b6cf6' }));
    ped.position.y = -0.2;
    scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.06, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f' }));
    scene.add(ring);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    cam.position.set(0, 1.6, -5.2);
    cam.lookAt(0, 0.75, 0);
    pv = { scene, cam, actor: null };
  }
  if (pv.actor) { pv.scene.remove(pv.actor.root); }
  const L = look(false);
  const a = new Actor(save.char, true, L.paint?.[0], L.paint?.[1]);
  a.wear(L.hat, '#ff6b6b');
  a.yaw = 0;                                                   // face the camera
  a.animate(0.016);
  pv.scene.add(a.root);
  pv.actor = a;
  placePreviewCam();
}
const screenCtx: ScreenCtx = {
  save, store,
  rounds: LEVELS.map((l, i) => ({ id: l.id, n: i + 1, title: l.title, mode: l.mode })),
  lessons: LESSONS.map((l) => ({ id: l.id, short: l.short })),
  onLook: () => { buildPreview(); shownRound = -1; },
  onSettings: applySettings,
  onReset: () => { try { localStorage.removeItem('crownrun.save.v1'); } catch { /* no storage */ } location.reload(); },
  onClose: () => { showRoundOf(sel, shownRound === -1); drawBoard(); $('card').classList.remove('hide'); },
};
function openPanel(id: ScreenId): void {
  unlockAudio(); resumeMusic();
  $('card').classList.add('hide');
  $('panel').classList.remove('hide');
  buildPreview();
  openScreen(id, screenCtx);
}

/** Show the prizes that were just won (if any), then go on. */
function announce(won: Prize[], then?: () => void): void {
  if (!won.length) { then?.(); return; }
  sfx.prize();
  $('prizeList').textContent = won.map((p) => p.name).join(' · ');
  $('prize').classList.remove('hide');
  $('prizeGo').onclick = () => { $('prize').classList.add('hide'); $('end').classList.add('hide'); openPanel('locker'); };
  $('prizeOk').onclick = () => { $('prize').classList.add('hide'); then?.(); };
}

// ------------------------------------------------------------------ lessons and their mini-game
function openLesson(ls: Lesson): void {
  unlockAudio();
  $('card').classList.add('hide');
  $('mini').classList.add('hide');
  playMusic('lesson');
  runLesson($('lesson'), ls, {
    onPass: () => { lessonState(ls.id).quiz = true; store(); showMini(ls); },
    onExit: showBoard,
  });
}

function showMini(ls: Lesson): void {
  document.body.classList.remove('playing');
  for (const id of ['hud', 'end', 'card', 'lesson']) $(id).classList.add('hide');
  playMusic('lesson');
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
    prize.textContent = g.prize + ' · 🪙 ' + MEDAL_COINS[i];
    s.textContent = st.medal > i ? 'הושג' : open ? g.walls + ' שאלות' : 'נעול';
    b.append(name, prize, s);
    if (!open) b.classList.add('lock');
    if (st.medal > i) b.classList.add('done');
    b.onclick = () => { if (open) startMini(ls, i); };
    box.append(b);
  });
  coinify(box);
  $('mini').classList.remove('hide');
  $('miniLearn').onclick = () => openLesson(ls);
  $('miniBack').onclick = showBoard;
}
const MEDAL_COINS = [30, 50, 80];

function startMini(ls: Lesson, level: number): void {
  mini = { ls, level };
  shownRound = -1;
  newGame(quizRun(ls, GAME_LEVELS[level].id as GameLevel), false);
  begin();
}

// ------------------------------------------------------------------ a round starts and ends
function begin(): void {
  unlockAudio();
  for (const id of ['card', 'end', 'mini', 'lesson', 'panel', 'prize']) $(id).classList.add('hide');
  $('hud').classList.remove('hide');
  document.body.classList.add('playing');
  const d = game?.def;
  playMusic(mini ? 'race' : d?.id === 'crown' ? 'final' : d?.mode !== 'race' ? 'survive' : 'race');
  game?.start();
}

function showEnd(r: Result): void {
  document.body.classList.remove('playing');
  $('hud').classList.add('hide');
  playMusic('menu');
  $('stars').textContent = stars(r.stars);
  $('stars').classList.toggle('hide', r.stars === 0);
  const next = $('next');
  const parts: string[] = [];
  if (r.coins) parts.push('🪙 ' + r.coins + ' נאספו');
  if (mini) {
    const { ls, level } = mini, st = lessonState(ls.id);
    if (r.qualified && st.medal < level + 1) { st.medal = level + 1; }
    if (r.qualified) { const b = payOnce(save, ls.id + '.m' + level, MEDAL_COINS[level]); if (b) { parts.push('🪙 ' + b + ' על המדליה'); } }
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
    if (r.stars > (save.stars[lv.id] ?? 0)) save.stars[lv.id] = r.stars;
    const rec = (save.records[lv.id] ??= { plays: 0, bestPlace: 99, bestTime: 1e9, noFall: false, coins: 0 });
    const newBest = r.qualified && lv.mode === 'race' && r.time < rec.bestTime && rec.plays > 0;
    rec.plays++;
    rec.bestPlace = Math.min(rec.bestPlace, r.place);
    if (r.qualified && lv.mode === 'race') rec.bestTime = Math.min(rec.bestTime, r.time);
    if (r.qualified && lv.mode === 'race' && r.falls === 0) rec.noFall = true;
    rec.coins = Math.max(rec.coins, r.coins);
    if (r.card && !save.cards.includes(lv.id)) { save.cards.push(lv.id); payOnce(save, lv.id + '.card', 25); parts.push('קלף ידע חדש באלבום!'); }
    if (r.qualified) {
      let b = payOnce(save, lv.id + '.q', 30);
      if (!b) { b = 10; save.coins += 10; }
      parts.push('🪙 ' + b + ' על העלייה');
    }
    if (newBest) parts.push('שיא אישי חדש!');
    const last = sel === ITEMS.length - 1;
    $('endTitle').textContent = r.qualified ? (last ? 'הכתר שלך!' : 'עלית שלב!') : 'לא הפעם';
    const what = lv.mode === 'survive' ? (r.qualified ? 'שרדת עד הסוף' : 'יצאת במקום ' + r.place + ' מתוך ' + RUNNERS) : lv.mode === 'collect' ? 'מקום ' + r.place + ' מתוך ' + RUNNERS + ' · ' + r.coins + ' מטבעות' : 'מקום ' + r.place + ' מתוך ' + RUNNERS;
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
  save.coins += r.coins;
  $('endGain').textContent = parts.join(' · ');
  $('endGain').classList.toggle('hide', parts.length === 0);
  $('endPurse').textContent = '🪙 ' + save.coins;
  coinify($('endPurse')); coinify($('endGain'));
  const won = checkPrizes(save);
  store();
  $('end').classList.remove('hide');
  if (won.length) setTimeout(() => announce(won), 900);
}

let last = performance.now(), acc = 0, hudText = '', shownCoins = -1;
const STEP = 1 / 60;
function frame(now: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (pv && document.body.classList.contains('preview')) {
    const a = pv.actor;
    if (a) { a.yaw += dt * 0.8; a.animate(dt); }
    renderer.render(pv.scene, pv.cam);
    return;
  }
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
  if (game.pickups.got !== shownCoins) { shownCoins = game.pickups.got; $('coinChip').textContent = '🪙 ' + shownCoins; coinify($('coinChip')); }
  const t = game.hud ?? game.title;
  if (t !== hudText) { hudText = t; $('question').textContent = t; $('question').dir = /[֐-׿]/.test(t) ? 'rtl' : 'ltr'; }
  ($('bar').firstElementChild as HTMLElement).style.width = Math.round(game.progress() * 100) + '%';
  renderer.render(game.scene, game.camera);
}

async function boot(): Promise<void> {
  initInput();
  applySettings();
  await loadModels((f) => { $('load').textContent = 'טוען... ' + Math.round(f * 100) + '%'; });
  $('load').classList.add('hide');
  $('intro').classList.remove('hide');
  if (!CHAR_TYPES.includes(save.char)) save.char = CHAR_TYPES[0];
  const it = ITEMS_SHOP.find((i) => i.id === save.char);
  if (it?.prize && !save.prizes.includes(it.prize)) save.char = 'ch_robo';        // a prize character that was not won yet
  checkPrizes(save);
  store();
  document.querySelectorAll<HTMLButtonElement>('#nav button').forEach((b) => { b.onclick = () => { sfx.click(); openPanel(b.dataset.s as ScreenId); }; });
  const want = Number(params.get('lv'));
  const wi = ITEMS.findIndex((x) => x.kind === 'round' && x.n === want);
  if (wi >= 0 && unlocked(wi)) sel = wi;
  else { sel = ITEMS.findIndex((x, i) => unlocked(i) && !complete(x)); if (sel < 0) sel = 0; }
  showBoard();
  $('go').onclick = () => {
    const x = ITEMS[sel];
    if (x.kind === 'round') { showRoundOf(sel); begin(); }
    else if (lessonState(x.ls.id).quiz) showMini(x.ls); else openLesson(x.ls);
  };
  // the first touch anywhere unlocks sound (browsers require a gesture)
  const first = () => { unlockAudio(); applySettings(); resumeMusic(); window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', first); };
  window.addEventListener('pointerdown', first);
  window.addEventListener('keydown', first);
  const ml = Number(params.get('lesson'));      // test hooks: ?lesson=9 opens a lesson, ?mini=9 opens its game menu, ?screen=locker a backstage screen
  const mm = Number(params.get('mini'));
  if (ml) { const ls = LESSONS.find((l) => l.num === ml); if (ls) openLesson(ls); }
  if (mm) { const ls = LESSONS.find((l) => l.num === mm); if (ls) showMini(ls); }
  const sc = params.get('screen') as ScreenId | null;
  if (sc) openPanel(sc);
  requestAnimationFrame(frame);
}
boot().catch((e) => { $('load').textContent = 'תקלה בטעינה: ' + String(e?.message ?? e); console.error(e); });
