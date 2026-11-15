/**
 * The lesson screen: short steps (text, something to play with, one check question), then a quiz.
 * Every step asks the player to do something before the check appears.
 */
import type { Check, Lesson, Widget } from './content';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function shuffled<T>(a: T[]): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

// ------------------------------------------------------------------ widgets
const WEIGHTS = [128, 64, 32, 16, 8, 4, 2, 1];
const WIRE: Record<string, string> = { g: '#2fae5a', o: '#ff8a2b', b: '#2f7fe0', n: '#8a5a2b' };
const T568A = ['wg', 'g', 'wo', 'b', 'wb', 'o', 'wn', 'n'];
const T568B = ['wo', 'o', 'wg', 'b', 'wb', 'g', 'wn', 'n'];

function mountWidget(w: Widget, host: HTMLElement, done: () => void): void {
  const box = el('div', 'wg wg-' + w.type);
  host.append(box);
  if (w.type === 'cards') {
    let left = w.cards.length;
    for (const c of w.cards) {
      const b = el('button', 'flip');
      b.type = 'button';
      b.append(el('b', '', c.label), el('span', '', c.text));
      b.onclick = () => { if (b.classList.contains('open')) return; b.classList.add('open'); if (--left === 0) done(); };
      box.append(b);
    }
    box.append(el('p', 'hint', 'הקישו על כל הכרטיסים'));
  } else if (w.type === 'bits') {
    const bits = [0, 0, 0, 0, 0, 0, 0, 0];
    const row = el('div', 'bitrow'), out = el('div', 'bitout');
    let touches = 0, fin = false;
    const draw = () => {
      const v = bits.reduce((s, b, i) => s + b * WEIGHTS[i], 0);
      const on = WEIGHTS.filter((_, i) => bits[i]);
      let text: string;
      if (w.mode === 'hex') {
        const hi = (v >> 4).toString(16).toUpperCase(), lo = (v & 15).toString(16).toUpperCase();
        text = bits.slice(0, 4).join('') + ' ' + bits.slice(4).join('') + '  →  ' + hi + lo + '  (' + v + ')';
      } else text = (on.length ? on.join(' + ') : '0') + ' = ' + v;
      out.textContent = text;
      const ok = w.target === undefined ? touches >= 3 : v === w.target;
      out.classList.toggle('ok', w.target !== undefined && ok);
      if (ok && !fin) { fin = true; done(); }
    };
    bits.forEach((_, i) => {
      const cell = el('div', 'bit' + (w.mode === 'hex' && i === 4 ? ' gap' : ''));
      const b = el('button', '', '0');
      b.type = 'button';
      b.onclick = () => { bits[i] = bits[i] ? 0 : 1; b.textContent = String(bits[i]); b.classList.toggle('on', !!bits[i]); touches++; draw(); };
      cell.append(el('small', '', String(w.mode === 'hex' ? WEIGHTS[i % 4 + 4] : WEIGHTS[i])), b);
      row.append(cell);
    });
    if (w.target !== undefined) box.append(el('p', 'goal', 'יעד: ' + (w.mode === 'hex' ? w.target.toString(16).toUpperCase() : String(w.target))));
    box.append(row, out);
    draw();
  } else if (w.type === 'pins') {
    const std = ['A', 'A'], seen = new Set<string>();
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 150');
    const label = el('div', 'pinout');
    const draw = () => {
      svg.textContent = '';
      const L = std[0] === 'A' ? T568A : T568B, R = std[1] === 'A' ? T568A : T568B;
      L.forEach((c, i) => {
        const j = R.indexOf(c), y1 = 14 + i * 17.5, y2 = 14 + j * 17.5, col = WIRE[c[c.length - 1]];
        const d = 'M 40 ' + y1 + ' C 130 ' + y1 + ', 170 ' + y2 + ', 260 ' + y2;
        const mk = (stroke: string, width: number, dash = '') => {
          const p = document.createElementNS(svgNS, 'path');
          p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', String(width));
          if (dash) p.setAttribute('stroke-dasharray', dash);
          svg.append(p);
        };
        mk('#2a2036', 9);
        mk(c.length === 2 ? '#ffffff' : col, 6);
        if (c.length === 2) mk(col, 6, '7 7');
        for (const [x, n] of [[22, i + 1], [278, j + 1]] as [number, number][]) {
          const t = document.createElementNS(svgNS, 'text');
          t.setAttribute('x', String(x)); t.setAttribute('y', String((x === 22 ? y1 : y2) + 4)); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11'); t.setAttribute('font-weight', '800');
          t.textContent = String(n);
          svg.append(t);
        }
      });
      const straight = std[0] === std[1];
      label.textContent = straight ? 'אותו תקן בשני הצדדים: כבל ישיר' : 'תקנים שונים: כבל מוצלב';
      label.classList.toggle('cross', !straight);
      seen.add(straight ? 's' : 'c');
      if (seen.size === 2) done();
    };
    const ends = el('div', 'ends');
    ['קצה שמאלי', 'קצה ימני'].forEach((name, side) => {
      const g = el('div', 'end');
      g.append(el('span', '', name));
      for (const s of ['A', 'B']) {
        const b = el('button', s === 'A' ? 'sel' : '', '568' + s);
        b.type = 'button';
        b.onclick = () => { std[side] = s; g.querySelectorAll('button').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); draw(); };
        g.append(b);
      }
      ends.append(g);
    });
    ends.dir = 'ltr';
    box.append(ends, svg, label, el('p', 'hint', 'צרו כבל ישיר וגם כבל מוצלב'));
    draw();
  } else if (w.type === 'sort') {
    let left = w.items.length;
    for (const it of w.items) {
      const row = el('div', 'sortrow');
      row.append(el('span', '', it.label));
      const btns = el('div', 'bk');
      w.buckets.forEach((name, bi) => {
        const b = el('button', '', name);
        b.type = 'button';
        b.onclick = () => {
          if (row.classList.contains('ok')) return;
          if (bi === it.bucket) { row.classList.add('ok'); b.classList.add('sel'); if (--left === 0) done(); }
          else { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); }
        };
        btns.append(b);
      });
      row.append(btns);
      box.append(row);
    }
  } else if (w.type === 'range' || w.type === 'speed') {
    const isSpeed = w.type === 'speed';
    const cfg = isSpeed ? { label: 'מהירות הקו', min: 10, max: 1000, start: 10, step: 10, unit: 'Mb/s' } : w;
    const head = el('div', 'rhead'), inp = el('input'), rows = el('div', 'rrows');
    inp.type = 'range'; inp.min = String(cfg.min); inp.max = String(cfg.max); inp.step = String(cfg.step); inp.value = String(cfg.start);
    inp.dir = 'ltr';
    let moved = false;
    const draw = () => {
      const v = Number(inp.value);
      head.textContent = cfg.label + ': ' + v.toLocaleString('en') + (cfg.unit ? ' ' + cfg.unit : '');
      rows.textContent = '';
      if (isSpeed) {
        const mb = v / 8, r1 = el('div', 'rrow ok'), r2 = el('div', 'rrow ok');
        const calc = el('span', '', v + ' ÷ 8 = ' + mb);
        calc.dir = 'ltr';
        r1.append(el('b', '', 'MB/s'), calc);
        r2.append(el('b', '', 'סרטון של 100 מגה-בייט'), el('span', '', 'יורד ב-' + (100 / mb).toFixed(1) + ' שניות'));
        rows.append(r1, r2);
      } else if (w.type === 'range') {
        for (const r of w.rows) {
          const band = r.bands.find((b) => v <= b.upTo) ?? r.bands[r.bands.length - 1];
          const row = el('div', 'rrow ' + (band.ok ? 'ok' : 'no'));
          row.append(el('b', '', r.name), el('span', '', band.text));
          rows.append(row);
        }
      }
    };
    inp.oninput = () => { draw(); if (!moved) { moved = true; done(); } };
    box.append(head, inp, rows);
    draw();
  }
}

// ------------------------------------------------------------------ one question (used by checks and by the quiz)
function mountQuestion(c: Check, host: HTMLElement, onAnswer: (firstTry: boolean) => void): void {
  const box = el('div', 'ask');
  box.append(el('h3', '', c.q));
  const opts = el('div', 'opts'), note = el('p', 'explain');
  let tries = 0, solved = false;
  for (const i of shuffled(c.options.map((_, k) => k))) {
    const b = el('button', '', c.options[i]);
    b.type = 'button';
    b.dir = 'auto';
    b.onclick = () => {
      if (solved || b.classList.contains('no')) return;
      tries++;
      if (i === c.correct) {
        solved = true;
        b.classList.add('yes');
        note.textContent = c.explain;
        note.className = 'explain good';
        onAnswer(tries === 1);
      } else {
        b.classList.add('no');
        note.textContent = 'לא בדיוק. נסו שוב.';
        note.className = 'explain bad';
      }
    };
    opts.append(b);
  }
  box.append(opts, note);
  host.append(box);
}

// ------------------------------------------------------------------ the lesson flow
export interface LessonHooks { onPass(score: number, max: number): void; onExit(): void }

export function runLesson(root: HTMLElement, lesson: Lesson, hooks: LessonHooks): void {
  root.textContent = '';
  root.classList.remove('hide');
  const sheet = el('div', 'sheet');
  root.append(sheet);
  const total = lesson.steps.length + 1;

  const header = (i: number, name: string) => {
    const h = el('div', 'lhead');
    const x = el('button', 'x', 'יציאה');
    x.type = 'button';
    x.onclick = () => { root.classList.add('hide'); hooks.onExit(); };
    const dots = el('div', 'dots');
    for (let k = 0; k < total; k++) dots.append(el('i', k < i ? 'done' : k === i ? 'now' : ''));
    h.append(el('span', 'tag', 'שיעור ' + lesson.num + ' · ' + name), dots, x);
    return h;
  };
  const nextBtn = (text: string, go: () => void) => {
    const b = el('button', 'big', text);
    b.type = 'button';
    b.onclick = go;
    return b;
  };

  const showStep = (i: number) => {
    const s = lesson.steps[i];
    sheet.textContent = '';
    sheet.scrollTop = 0;
    sheet.append(header(i, lesson.short), el('h2', '', s.title));
    const body = el('div', 'body');
    body.innerHTML = s.html;        // lesson text is our own content, not user input
    sheet.append(body);
    const checkHost = el('div', 'checkhost');
    const foot = el('div', 'foot');
    mountWidget(s.widget, sheet, () => {
      if (checkHost.childElementCount) return;
      mountQuestion(s.check, checkHost, () => {
        foot.append(nextBtn(i + 1 < lesson.steps.length ? 'הלאה' : 'לבוחן', () => (i + 1 < lesson.steps.length ? showStep(i + 1) : showQuiz())));
        foot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      checkHost.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    sheet.append(checkHost, foot);
  };

  const showQuiz = () => {
    const qs = shuffled(lesson.quiz);
    let n = 0, score = 0;
    const ask = () => {
      sheet.textContent = '';
      sheet.scrollTop = 0;
      sheet.append(header(total - 1, 'בוחן'), el('h2', '', 'שאלה ' + (n + 1) + ' מתוך ' + qs.length));
      const foot = el('div', 'foot');
      mountQuestion(qs[n], sheet, (first) => {
        if (first) score++;
        foot.append(nextBtn(n + 1 < qs.length ? 'הלאה' : 'סיום', () => { n++; if (n < qs.length) ask(); else finish(); }));
        foot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      sheet.append(foot);
    };
    const finish = () => {
      sheet.textContent = '';
      const pass = score >= lesson.pass;
      sheet.append(header(total, 'בוחן'), el('h2', '', pass ? 'עברת את הבוחן!' : 'כמעט'));
      sheet.append(el('p', 'score', score + ' מתוך ' + qs.length + ' בניסיון הראשון'));
      const foot = el('div', 'foot');
      if (pass) {
        sheet.append(el('p', 'body', 'עכשיו משחק התשובות: רוצו אל הדלת עם התשובה הנכונה.'));
        foot.append(nextBtn('למשחק', () => { root.classList.add('hide'); hooks.onPass(score, qs.length); }));
      } else {
        sheet.append(el('p', 'body', 'צריך לפחות ' + lesson.pass + ' תשובות נכונות בניסיון הראשון.'));
        foot.append(nextBtn('בוחן חוזר', showQuiz), nextBtn('לחזור לשיעור', () => showStep(0)));
      }
      sheet.append(foot);
    };
    ask();
  };

  showStep(0);
}
