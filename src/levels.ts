/**
 * The twelve rounds of the show. Each one builds its course on a Round (see round.ts).
 * Courses run toward -Z from the start pad (z 10 to -14). Survival rounds use an arena around the origin.
 */
import { DoorWall, Seesaw, Tile, Wind } from './blocks';
import { TINTS, type LevelDef, type Round } from './round';
import { BallRun, Box, Bumper, Disc, Hammer, Spinner } from './world';

const BALLS = ['#ff8fb8', '#5ac8fa', '#ffd23f', '#b79cff'];

function bumpers(r: Round, y: number, at: [number, number][]): void {
  at.forEach(([x, z], i) => r.add(new Bumper(x, y, z, TINTS[(i * 3 + 1) % TINTS.length])));
}
/** n doors of which k (chosen at random) are real. */
function doors(n: number, k: number): boolean[] {
  const out: boolean[] = Array.from({ length: n }, () => false);
  let left = k;
  while (left > 0) { const i = Math.floor(Math.random() * n); if (!out[i]) { out[i] = true; left--; } }
  return out;
}
function ring(i: number, r0: number, step: number): [number, number, number] {
  if (i === 0) return [0, 0, r0 + step];
  const a = (i / 19) * Math.PI * 2 + 0.16, rr = r0 + (i % 3) * step;
  return [Math.sin(a) * rr, 0, Math.cos(a) * rr];
}

// ------------------------------------------------------------------ 1. Cable Run
const cables: LevelDef = {
  id: 'cables', title: 'מסלול הכבלים', tip: 'רוצו, קפצו וזנקו עד קו הסיום.', mode: 'race', qualify: 12, theme: 'day',
  build(r) {
    r.startPad();
    for (const x of [-5, 0, 5]) r.add(new Box(x, 0, -18.4, 2, 2, { pal: 'mint' }));
    r.add(new Box(-3.6, 0, -24.6, 2.2, 1.8, { pal: 'sun', move: (t) => [Math.sin(t * 1.1) * 2.6, 0, 0] }));
    r.add(new Box(3.6, 0, -24.6, 2.2, 1.8, { pal: 'sun', move: (t) => [-Math.sin(t * 1.1) * 2.6, 0, 0] }));
    r.floor(0, 0, -28.8, -58.5, 8, { pal: 'sky' });
    r.checkpoint(-29.5, 0, 6, 0, -31.5);
    r.add(new Spinner(-3.5, 0, -36.5, 1.5, '#5ac8fa'));
    r.add(new Spinner(3.5, 0, -44.5, -1.6, '#ff8fb8'));
    r.add(new Spinner(0, 0, -53, 1.9, '#ffd23f'));
    bumpers(r, 0, [[4.8, -34.5], [-5.2, -45], [6.2, -52], [-6.2, -54]]);
    r.floor(0, 0, -58.5, -84.5, 3, { pal: 'violet' });
    r.checkpoint(-59.5, 0, 2, 0, -61);
    [-63, -69, -75, -81].forEach((z, i) => r.add(new Hammer(0, 0, z, 5.8, 0.72, 1.9, i * 1.3, TINTS[(i * 3 + 1) % TINTS.length])));
    r.floor(0, 0, -84.5, -88.5, 8);
    r.checkpoint(-85, 0, 6, 0, -86.5);
    r.floor(0, 0, -88.5, -106.5, 2.4, { conveyor: -3.2 });
    for (const s of [-1, 1]) r.floor(s * 5.2, 0, -88.5, -106.5, 2.7, { conveyor: 3.4 });
    bumpers(r, 0, [[-1.1, -92.5], [1.1, -98], [-1.1, -103.5]]);
    r.floor(0, 0, -106.5, -111.5, 8, { pal: 'mint' });
    r.checkpoint(-107, 0, 6, 0, -109);
    r.add(new Disc(0, 0, -117.3, 5.4, 0.9));
    r.add(new Disc(0, 0, -128.5, 5.4, -1.1, ['#5ac8fa', '#8be37d']));
    bumpers(r, 0, [[0, -117.3], [0, -128.5]]);
    r.floor(0, 0, -134.2, -139.8, 8, { pal: 'sky' });
    r.checkpoint(-134.6, 0, 6, 0, -137);
    const ramp = r.floor(0, 0, -139.8, -169.8, 7, { rise: 6, grip: 0.5, plain: '#9be37d' });
    r.add(new BallRun(ramp, -168.5, -145.8, [-4.6, -1.6, 1.6, 4.6], 4, BALLS));
    r.finishPad(-177, 6, 'sun', 7.2);
    r.dress(-190, 6);
  },
};

// ------------------------------------------------------------------ 2. Door or Wall
const doorDash: LevelDef = {
  id: 'doors', title: 'דלת או קיר', tip: 'חלק מהדלתות נפתחות וחלק לא. נסו, או רוצו אחרי מי שעבר.', mode: 'race', qualify: 12, theme: 'candy',
  build(r) {
    r.startPad('sky');
    const pals = ['cream', 'violet', 'mint', 'sun', 'sky'] as const;
    const walls: [number, number][] = [[-24, 4], [-40, 3], [-56, 3], [-72, 2], [-88, 2], [-104, 1]];
    walls.forEach(([z, k], i) => {
      r.floor(0, 0, i === 0 ? -14 : z + 8, z - 8, 8.4, { pal: pals[i % pals.length] });
      r.add(new DoorWall(0, 0, z, doors(5, k), [TINTS[i], TINTS[i + 3], TINTS[i + 5]]));
      if (i % 2 === 1) r.checkpoint(z - 1.5, 0, 6, 0, z - 3);
    });
    bumpers(r, 0, [[-4, -32], [4, -32], [0, -48], [-5.5, -64], [5.5, -64], [-2.5, -80], [2.5, -80], [0, -96]]);
    r.add(new Spinner(0, 0, -112.5, 1.7, '#ffd23f', 6));
    r.floor(0, 0, -112, -118, 8.4, { pal: 'cream' });
    r.finishPad(-128, 0, 'sun', 7.4);
    r.dress(-140);
  },
};

// ------------------------------------------------------------------ 3. Spin Club (survive)
const spin: LevelDef = {
  id: 'spin', title: 'סחרחרת', tip: 'קפצו מעל המוטות המסתובבים. מי שנופל מהבמה יוצא.', mode: 'survive', qualify: 8, theme: 'dusk', time: 70,
  build(r) {
    r.add(new Disc(0, 0, 0, 9.6, 0, ['#b79cff', '#ffe58a']));
    const s1 = r.add(new Spinner(0, 0, 0, 0, '#ff8fb8', 9.2));
    const s2 = r.add(new Spinner(0, 0, 0, 0, '#5ac8fa', 9.2));
    s1.a = 0.4; s2.a = 0.4 + Math.PI / 2;
    s1.power = s2.power = 0.55;
    r.arenaR = 9.6;
    r.tick((t) => { s1.w = 1.0 + t * 0.022; s2.w = -(0.75 + t * 0.02); });
    r.spawn = (i) => ring(i, 3.4, 1.9);
    r.killY = -9; r.camBack = 1.3; r.camUp = 1.5; r.camAhead = 0.5;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      r.deco('balloon', Math.sin(a) * 15, 2 + (k % 3) * 2, Math.cos(a) * 15 - 4, 1, TINTS[k], 0, true);
      r.deco('cloud', Math.sin(a + 0.3) * (34 + (k % 3) * 9), -6 + (k % 4) * 6, Math.cos(a + 0.3) * 34 - 20, 2 + (k % 2), undefined, 0, true);
    }
  },
};

// ------------------------------------------------------------------ 4. Side Wind
const wind: LevelDef = {
  id: 'wind', title: 'רוח צד', tip: 'המאווררים דוחפים הצידה. רוצו נגד הרוח וקפצו על הקפיץ.', mode: 'race', qualify: 10, theme: 'mint',
  build(r) {
    r.startPad('mint');
    for (const s of [-1, 1]) r.floor(s * 3.6, 0, -14, -32, 1.5, { pal: 'sky' });
    r.add(new Wind(-5.4, 5.4, -16, -30, 0, 3.4, 3.4));
    r.floor(0, 0, -32, -39, 8, { pal: 'mint' });
    r.checkpoint(-33, 0, 6, 0, -34.5);
    r.floor(0, 0, -39, -42, 8, { bounce: 17, plain: '#ff8fb8' });
    r.floor(0, 3.2, -43.5, -66, 7, { pal: 'violet' });
    r.checkpoint(-45, 3.2, 5, 0, -47);
    r.add(new Wind(-7, 7, -47, -55, 3.2, 4.2));
    r.add(new Wind(-7, 7, -57, -65, 3.2, -4.2));
    bumpers(r, 3.2, [[-3, -51], [3.4, -53], [-3.4, -60], [2.6, -62]]);
    r.checkpoint(-64.4, 3.2, 5, 0, -65.4);
    r.add(new Disc(0, 1.5, -72.5, 5.2, 1.0));
    r.add(new Disc(0, 0, -84.5, 5.2, -1.2, ['#5ac8fa', '#8be37d']));
    r.add(new Wind(-5.5, 5.5, -79.5, -89.5, 0, 3.2, 3));
    r.finishPad(-100, 0, 'sun', 8.6);
    r.dress(-112, 2);
  },
};

// ------------------------------------------------------------------ 5. Ball Belt
const chute: LevelDef = {
  id: 'chute', title: 'מסוע הכדורים', tip: 'המסוע מושך אחורה והכדורים באים מולכם. אל תעצרו.', mode: 'race', qualify: 10, theme: 'sunset',
  build(r) {
    r.startPad('sun');
    const ramp = r.floor(0, 0, -14, -84, 7.5, { rise: 6, conveyor: 2.4 });
    const h = (z: number) => 6 * (-14 - z) / 70;
    r.add(new BallRun(ramp, -82, -22, [-5.6, -2.8, 0, 2.8, 5.6], 7, BALLS));
    ([[-3, -26], [3, -32], [0, -40], [-4.5, -48], [4.5, -52], [-1.5, -60], [2.5, -68], [-4, -75]] as [number, number][])
      .forEach(([x, z], i) => r.add(new Bumper(x, h(z), z, TINTS[i])));
    r.checkpoint(-49, 3, 6, 0, -50.5);
    r.finishPad(-92, 6, 'mint', 8);
    r.dress(-104, 6);
  },
};

// ------------------------------------------------------------------ 6. Vanishing Floor (survive)
const hex: LevelDef = {
  id: 'hex', title: 'הרצפה נעלמת', tip: 'כל אריח נופל אחרי שדורכים עליו. אל תעמדו במקום.', mode: 'survive', qualify: 8, theme: 'day', time: 100,
  build(r) {
    const R = 1.25, N = 6, cols = ['#ffd23f', '#ff8fb8', '#5ac8fa'];
    [0, -7, -14].forEach((y, layer) => {
      for (let q = -N; q <= N; q++) for (let s = -N; s <= N; s++) {
        if (Math.abs(q + s) > N) continue;
        r.add(new Tile(R * 1.732 * (q + s / 2), y, R * 1.5 * s, R, 'hex', cols[layer], { vanish: true, delay: 1.1 }));
      }
    });
    r.spawn = (i) => ring(i, 3, 3);
    r.killY = -21; r.camBack = 1.35; r.camUp = 1.6; r.camAhead = 0.5;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      r.deco('cloud', Math.sin(a) * (44 + (k % 3) * 9), -10 + (k % 4) * 5, Math.cos(a) * 44 - 30, 2 + (k % 2), undefined, 0, true);
      r.deco(k % 2 ? 'deco_spool' : 'deco_plug', Math.sin(a + 0.4) * 34, -8 + (k % 3) * 4, Math.cos(a + 0.4) * 34 - 22, 1.4, TINTS[k + 2], k, true);
    }
  },
};

// ------------------------------------------------------------------ 7. Hidden Path
function hiddenPath(cols: number, rows: number): Set<string> {
  const real = new Set<string>();
  let c = 1 + Math.floor(Math.random() * (cols - 2));
  for (let row = 0; row < rows; row++) {
    real.add(c + ',' + row);
    if (row > 0 && Math.random() < 0.62) {
      const dir = c <= 0 ? 1 : c >= cols - 1 ? -1 : Math.random() < 0.5 ? -1 : 1;
      const n = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let k = 0; k < n && c + dir >= 0 && c + dir < cols; k++) { c += dir; real.add(c + ',' + row); }
    }
  }
  return real;
}
const tiptoe: LevelDef = {
  id: 'tiptoe', title: 'שביל הסתרים', tip: 'רק חלק מהאריחים אמיתיים. מצאו את השביל, אריח אחרי אריח.', mode: 'race', qualify: 10, theme: 'dusk', assist: 7, time: 200,
  build(r) {
    r.startPad('sky');
    const grid = (z0: number, rows: number, color: string) => {
      const real = hiddenPath(7, rows);
      for (let row = 0; row < rows; row++) for (let c = 0; c < 7; c++)
        r.add(new Tile((c - 3) * 2.3, 0, z0 - row * 2.3, 1.1, 'sq', color, { fake: !real.has(c + ',' + row) }));
    };
    grid(-15.3, 11, '#ffd23f');
    r.floor(0, 0, -39.6, -48, 8.2, { pal: 'mint' });
    r.checkpoint(-40.5, 0, 6, 0, -42.5);
    grid(-49.3, 13, '#ff8fb8');
    r.finishPad(-86, 0, 'sun', 7.8);
    r.dress(-98);
  },
};

// ------------------------------------------------------------------ 8. Noise Tower (climb, rising flood)
const climb: LevelDef = {
  id: 'climb', title: 'מגדל הרעש', tip: 'טפסו מהר. הרעש הוורוד עולה מלמטה, ומי שנתפס יוצא.', mode: 'race', qualify: 10, theme: 'sunset',
  build(r) {
    r.startPad('violet');
    r.floor(0, 0, -14, -30, 6, { rise: 3, plain: '#bfe0ff' });
    r.floor(0, 3, -30, -46, 6, { pal: 'cream' });
    r.checkpoint(-31, 3, 5, 0, -32.5);
    r.add(new Spinner(0, 3, -38.5, 1.7, '#ff8fb8'));
    bumpers(r, 3, [[-4.6, -34], [4.6, -43]]);
    r.add(new Box(-2.5, 3.8, -49.5, 2, 1.6, { pal: 'mint' }));
    r.add(new Box(2.5, 4.6, -54.5, 2, 1.6, { pal: 'mint' }));
    r.add(new Box(-1.5, 5.4, -59.5, 2, 1.6, { pal: 'mint' }));
    r.floor(0, 6, -63, -80, 4, { pal: 'sky' });
    r.checkpoint(-64, 6, 3, 0, -65.2);
    r.add(new Box(0, 7.5, -70, 1.6, 1.2, { h: 1.5, plain: '#ff8fb8', move: (t) => [Math.sin(t * 1.3) * 2.4, 0, 0] }));
    r.add(new Box(0, 7.5, -76, 1.6, 1.2, { h: 1.5, plain: '#ffd23f', move: (t) => [-Math.sin(t * 1.3) * 2.4, 0, 0] }));
    r.floor(0, 6, -80, -96, 5, { rise: 3, grip: 0.55, plain: '#9be37d' });
    r.floor(0, 9, -96, -114, 3, { pal: 'violet' });
    r.checkpoint(-97, 9, 2, 0, -98.2);
    [-101.5, -106.5, -111.5].forEach((z, i) => r.add(new Hammer(0, 9, z, 5.8, 0.72, 2.0, i * 1.5, TINTS[i * 2])));
    r.floor(0, 9, -114, -124, 5, { rise: 2, plain: '#ffe58a' });
    r.finishPad(-131, 11, 'sun', 7);
    r.floodY = -8; r.floodSpeed = 0.3; r.floodDelay = 4;
    r.dress(-144, 11);
  },
};

// ------------------------------------------------------------------ 9. Rush Hour
const rush: LevelDef = {
  id: 'rush', title: 'שעת העומס', tip: 'פטישים, במות זזות וקפיצה ענקית. המסלול הכי קשה.', mode: 'race', qualify: 8, theme: 'candy',
  build(r) {
    r.startPad('violet');
    for (const s of [-1, 1]) r.floor(s * 4.5, 0, -14, -30, 1.3, { pal: 'sun' });
    r.add(new Hammer(0, 0, -19.5, 5.8, 0.92, 1.8, 0, '#ff8fb8'));
    r.add(new Hammer(0, 0, -25.5, 5.8, 0.92, 1.8, 1.6, '#5ac8fa'));
    r.floor(0, 0, -30, -36, 8, { pal: 'mint' });
    r.checkpoint(-31, 0, 6, 0, -32.5);
    r.add(new Box(0, 0, -40.4, 2.2, 2.2, { pal: 'sky', move: (t) => [Math.sin(t * 1.2) * 3.4, 0, 0] }));
    r.add(new Box(0, 0, -47.2, 2.2, 2.2, { pal: 'sky', move: (t) => [Math.sin(t * 1.2 + 2.1) * 3.4, 0, 0] }));
    r.add(new Box(0, 0, -54, 2.2, 2.2, { pal: 'sky', move: (t) => [Math.sin(t * 1.2 + 4.2) * 3.4, 0, 0] }));
    r.floor(0, 0, -58.6, -64, 8, { pal: 'cream' });
    r.checkpoint(-59.4, 0, 6, 0, -61);
    r.floor(0, 0, -64, -66.5, 8, { bounce: 16, plain: '#ff8fb8' });
    r.floor(0, 0, -70, -74, 6, { pal: 'mint' });
    r.checkpoint(-70.6, 0, 4, 0, -72);
    r.floor(0, 0, -74, -98, 3, { conveyor: 2.2 });
    [-79, -85, -91].forEach((z, i) => r.add(new Hammer(0, 0, z, 5.8, 0.72, 2.3, i * 1.4, TINTS[i + 4])));
    r.floor(0, 0, -98, -103.4, 8, { pal: 'sun' });
    r.checkpoint(-98.8, 0, 6, 0, -100.5);
    r.add(new Disc(-2, 0, -108.4, 4.2, 1.2));
    r.add(new Disc(2, 0, -117.6, 4.2, -1.4, ['#5ac8fa', '#8be37d']));
    r.add(new Disc(-1, 0, -126.8, 4.2, 1.6, ['#b79cff', '#ffd23f']));
    r.finishPad(-140, 0, 'sun', 7.6);
    r.dress(-152);
  },
};

// ------------------------------------------------------------------ 10. Crown Mountain (final)
const crown: LevelDef = {
  id: 'crown', title: 'הר הכתר', tip: 'הגמר! רק שלושת הראשונים בפסגה עולים על הפודיום.', mode: 'race', qualify: 3, theme: 'dusk',
  build(r) {
    r.startPad('sun');
    const r1 = r.floor(0, 0, -14, -40, 7.5, { rise: 4.5, plain: '#ffc2dc' });
    r.add(new BallRun(r1, -39, -20, [-5.4, -2.7, 0, 2.7, 5.4], 4, BALLS));
    r.floor(0, 4.5, -40, -58, 7.5, { pal: 'violet' });
    r.checkpoint(-41, 4.5, 6, 0, -42.5);
    r.add(new Spinner(-3.6, 4.5, -46.5, 2.0, '#5ac8fa'));
    r.add(new Spinner(3.6, 4.5, -53, -2.2, '#ff8fb8'));
    bumpers(r, 4.5, [[5.6, -44.5], [-5.6, -55]]);
    const r2 = r.floor(0, 4.5, -58, -82, 6.5, { rise: 4.5, grip: 0.6, plain: '#9be37d' });
    r.add(new BallRun(r2, -81, -63.5, [-4.5, -1.5, 1.5, 4.5], 4, BALLS));
    r.floor(0, 9, -82, -100, 3.2, { pal: 'sky' });
    r.checkpoint(-83, 9, 2.4, 0, -84.3);
    [-87.5, -92.5, -97.5].forEach((z, i) => r.add(new Hammer(0, 9, z, 5.8, 0.72, 2.1, i * 1.5, TINTS[i * 3])));
    r.floor(0, 9, -100, -116, 6, { rise: 3, conveyor: 2.0 });
    r.finishPad(-122, 12, 'sun', 6);
    r.dress(-135, 12);
  },
};

// ------------------------------------------------------------------ Seesaws (race)
const seesaw: LevelDef = {
  id: 'seesaw', title: 'הנדנדות', tip: 'הקרשים נוטים לצד שיש בו יותר רצים. שמרו על איזון!', mode: 'race', qualify: 10, theme: 'sunset',
  build(r) {
    r.startPad('sun');
    const cols = ['#ff8fb8', '#6fd3ff', '#ffd23f', '#8be37d', '#b79cff'];
    [-21, -34, -47].forEach((z, i) => r.add(new Seesaw(0, 0, z, 4.4, 5.6, cols[i])));
    r.checkpoint(-28.6, 0, 4, 0, -31);
    r.checkpoint(-41.6, 0, 4, 0, -44);
    r.floor(0, 0, -53.2, -62.2, 6, { pal: 'mint' });
    r.checkpoint(-54, 0, 5, 0, -57);
    bumpers(r, 0, [[-3, -58], [3, -59.5]]);
    [-69, -82].forEach((z, i) => { for (const sx of [-1, 1]) r.add(new Seesaw(sx * 3.6, 0, z, 3, 5.6, cols[(i * 2 + (sx > 0 ? 1 : 0) + 3) % 5])); });
    r.checkpoint(-76.6, 0, 6, 0, -79.5);
    r.add(new Seesaw(0, 0, -96, 6.5, 6.6, '#ff8fb8', 0.3));
    r.checkpoint(-89.6, 0, 4, 0, -93);
    r.finishPad(-112, 0, 'sun', 9);
    r.dress(-125);
  },
};

// ------------------------------------------------------------------ Coin Hunt (collect)
const hunt: LevelDef = {
  id: 'hunt', title: 'ציד המטבעות', tip: 'אספו כמה שיותר מטבעות בדקה. מי שנופל מאבד 3. קפצו מעל המוט!', mode: 'collect', qualify: 10, theme: 'mint', time: 60,
  build(r) {
    r.add(new Box(0, 0, 0, 11, 11, { pal: 'cream' }));
    for (const [x, z] of [[-7.6, -7.6], [7.6, -7.6], [-7.6, 7.6], [7.6, 7.6]]) r.add(new Box(x, 1.3, z, 2.4, 2.4, { pal: 'violet', h: 1.3 }));
    const bar = r.add(new Spinner(0, 0, 0, 0, '#ff8fb8', 10.8));
    bar.power = 0.6;
    r.tick((t) => { bar.w = Math.min(1.25, 0.55 + t * 0.012); });
    bumpers(r, 0, [[0, -5], [0, 5], [-5, 0], [5, 0]]);
    r.area = [0, 0, 10.4];
    r.arenaR = 11;
    r.spawn = (i) => ring(i, 3.2, 1.9);
    r.killY = -9; r.camBack = 1.3; r.camUp = 1.5; r.camAhead = 0.5;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      r.deco('balloon', Math.sin(a) * 16, 2 + (k % 3) * 2, Math.cos(a) * 16 - 4, 1, TINTS[k], 0, true);
      r.deco('cloud', Math.sin(a + 0.3) * (34 + (k % 3) * 9), -6 + (k % 4) * 6, Math.cos(a + 0.3) * 34 - 20, 2 + (k % 2), undefined, 0, true);
    }
  },
};

export const LEVELS: LevelDef[] = [cables, doorDash, spin, wind, chute, seesaw, hex, tiptoe, climb, hunt, rush, crown];
