/**
 * The backstage screens opened from the board: locker, prizes, album, records, settings and credits.
 * They share one panel (#panel) with a row of tabs on top.
 */
import { CARDS, has, ITEMS_SHOP, PRIZES, SEASON, SEASON_STEP, xp, type Item, type Kind, type Save } from './profile';
import { sfx } from './sfx';

export type ScreenId = 'locker' | 'season' | 'prizes' | 'album' | 'records' | 'settings' | 'credits';
export interface ScreenCtx {
  save: Save;
  store(): void;
  rounds: { id: string; n: number; title: string; mode: 'race' | 'survive' | 'collect' }[];
  lessons: { id: string; short: string }[];
  /** The look changed: redraw the preview. */
  onLook(): void;
  onSettings(): void;
  onReset(): void;
  onClose(): void;
}
const TABS: [ScreenId, string][] = [['locker', 'ארונית'], ['season', 'עונה'], ['prizes', 'פרסים'], ['album', 'אלבום'], ['records', 'שיאים'], ['settings', 'הגדרות'], ['credits', 'קרדיטים']];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

let lockerKind: Kind = 'char';

export function openScreen(id: ScreenId, ctx: ScreenCtx): void {
  const root = document.getElementById('panel') as HTMLElement;
  root.textContent = '';
  root.className = 'scr-' + id;
  document.body.classList.toggle('preview', id === 'locker');
  const head = el('div', 'phead');
  const tabs = el('div', 'tabs');
  for (const [t, name] of TABS) {
    const b = el('button', t === id ? 'on' : '', name);
    b.type = 'button';
    b.onclick = () => { sfx.click(); openScreen(t, ctx); };
    tabs.append(b);
  }
  const x = el('button', 'x', 'חזרה');
  x.type = 'button';
  x.onclick = () => { sfx.click(); root.classList.add('hide'); document.body.classList.remove('preview'); ctx.onClose(); };
  head.append(tabs, x);
  const body = el('div', 'pbody');
  root.append(head, body);
  ({ locker, season, prizes, album, records, settings, credits })[id](body, ctx);
  coinify(body);
}
/** Windows 10 has no coin emoji: draw the coin in CSS instead. */
export function coinify(e: HTMLElement): void {
  const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT), hits: Text[] = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if ((n as Text).data.includes('🪙')) hits.push(n as Text);
  for (const t of hits) {                                   // swap only the text, so buttons keep their handlers
    const frag = document.createDocumentFragment();
    t.data.split('🪙').forEach((part, i) => {
      if (i > 0) { const c = document.createElement('i'); c.className = 'cn'; frag.append(c); }
      if (part) frag.append(part);
    });
    t.replaceWith(frag);
  }
}

function coinsLine(s: Save): HTMLElement { return el('p', 'purse', '🪙 ' + s.coins + ' מטבעות'); }

// ------------------------------------------------------------------ locker
function locker(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save;
  body.append(coinsLine(s));
  const kinds = el('div', 'kinds');
  for (const [k, name] of [['char', 'דמויות'], ['hat', 'כובעים'], ['paint', 'צבעים'], ['emote', 'חגיגות']] as [Kind, string][]) {
    const b = el('button', k === lockerKind ? 'on' : '', name);
    b.type = 'button';
    b.onclick = () => { lockerKind = k; sfx.click(); locker((body.textContent = '', body), ctx); coinify(body); };
    kinds.append(b);
  }
  body.append(kinds);
  const grid = el('div', 'shop');
  const list: Item[] = ITEMS_SHOP.filter((i) => i.kind === lockerKind);
  if (lockerKind !== 'char') list.unshift({ id: 'none', kind: lockerKind, name: lockerKind === 'hat' ? 'בלי כובע' : lockerKind === 'emote' ? 'שמחה רגילה' : 'צבע רגיל' });
  for (const it of list) {
    const b = el('button');
    b.type = 'button';
    const own = it.id === 'none' || has(s, it);
    const worn = lockerKind === 'char' ? s.char === it.id : lockerKind === 'hat' ? (s.hat ?? 'none') === it.id : lockerKind === 'emote' ? (s.emote ?? 'none') === it.id : (s.paint ?? 'none') === it.id;
    if (it.paint) { const sw = el('i', 'sw'); sw.style.background = 'linear-gradient(135deg,' + it.paint[0] + ' 55%,' + it.paint[1] + ' 55%)'; b.append(sw); }
    b.append(el('b', '', it.name));
    const prize = it.prize ? PRIZES.find((p) => p.id === it.prize) : undefined;
    b.append(el('span', '', worn ? 'בשימוש' : own ? 'לבחור' : prize ? 'פרס: ' + prize.rule : '🪙 ' + it.price));
    if (worn) b.classList.add('worn');
    if (!own) b.classList.add(prize ? 'prize' : 'buy');
    b.onclick = () => {
      if (!own) {
        if (prize) { sfx.nope(); flash(b); return; }
        if (s.coins < (it.price ?? 0)) { sfx.nope(); flash(b); return; }
        s.coins -= it.price ?? 0; s.owned.push(it.id); sfx.buy();
      } else sfx.click();
      if (lockerKind === 'char') s.char = it.id;
      else if (lockerKind === 'hat') s.hat = it.id === 'none' ? null : it.id;
      else if (lockerKind === 'emote') s.emote = it.id === 'none' ? null : it.id;
      else s.paint = it.id === 'none' ? null : it.id;
      ctx.store(); ctx.onLook();
      body.textContent = ''; locker(body, ctx); coinify(body);
    };
    grid.append(b);
  }
  body.append(grid);
  body.append(el('p', 'note', lockerKind === 'emote' ? 'החגיגה מופיעה כשעוברים סיבוב.' : 'מטבעות אוספים בסיבובים. פרסים מקבלים על הישגים בלבד.'));
}

// ------------------------------------------------------------------ season track
function season(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save, x = xp(s), lvl = Math.min(SEASON.length, Math.floor(x / SEASON_STEP));
  body.append(el('p', 'purse', 'שלב ' + lvl + ' מתוך ' + SEASON.length + ' · ' + x + ' נקודות'));
  const bar = el('div', 'sbar'), fill = el('i');
  fill.style.width = (lvl >= SEASON.length ? 100 : Math.round((x % SEASON_STEP) / SEASON_STEP * 100)) + '%';
  bar.append(fill);
  body.append(bar);
  if (lvl < SEASON.length) body.append(el('p', 'note', 'עוד ' + ((lvl + 1) * SEASON_STEP - x) + ' נקודות לשלב הבא'));
  const ul = el('div', 'steps');
  for (const st of SEASON) {
    const got = x >= st.n * SEASON_STEP;
    const d = el('div', got ? 'got' : '');
    const pr = st.prize ? PRIZES.find((p) => p.id === st.prize) : undefined;
    d.append(el('b', '', String(st.n)), el('span', '', pr ? pr.name : '🪙 ' + st.coins), el('i', '', got ? '✓' : '🔒'));
    ul.append(d);
  }
  body.append(ul);
  const how = el('div', 'how');
  how.append(el('b', '', 'איך מקבלים נקודות?'));
  for (const t of ['כוכב בסיבוב: 10', 'בוחן שעבר: 10', 'מדליה במשחק התשובות: 15 לכל דרגה', 'קלף ידע: 15', 'מופע יומי שלם: 20', 'האימון: 10'])
    how.append(el('span', '', t));
  body.append(how);
  body.append(el('p', 'note', 'אין כאן קניות ואין הגרלות: כל שלב מגיע מלמידה ומשחק.'));
}
function flash(b: HTMLElement): void { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); }

// ------------------------------------------------------------------ prizes
function prizes(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save;
  body.append(el('p', 'note', 'פרסים לא קונים: זוכים בהם בלמידה ובמשחק.'));
  const ul = el('div', 'prizes');
  for (const p of PRIZES) {
    const got = s.prizes.includes(p.id);
    const row = el('div', got ? 'got' : '');
    row.append(el('i', '', got ? '🏆' : '🔒'), el('b', '', p.name), el('span', '', p.rule));
    ul.append(row);
  }
  body.append(ul);
}

// ------------------------------------------------------------------ album
function album(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save;
  body.append(el('p', 'purse', 'קלפי ידע: ' + s.cards.length + ' מתוך ' + ctx.rounds.length));
  body.append(el('p', 'note', 'בכל סיבוב מוסתר קלף אחד, בצד המסלול. לפעמים צריך לקפוץ כדי להגיע אליו.'));
  const grid = el('div', 'album');
  for (const r of ctx.rounds) {
    const c = CARDS[r.id], got = s.cards.includes(r.id);
    const d = el('div', got ? 'kcard got' : 'kcard');
    d.append(el('small', '', 'סיבוב ' + r.n));
    if (got && c) { d.append(el('b', '', c.name), el('span', '', c.text)); d.querySelector('b')!.dir = /[֐-׿]/.test(c.name) ? 'rtl' : 'ltr'; }
    else d.append(el('b', '', '?'), el('span', '', 'מוסתר ב' + r.title));
    grid.append(d);
  }
  body.append(grid);
}

// ------------------------------------------------------------------ records
function records(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save;
  const stars = Object.values(s.stars).reduce((a, b) => a + b, 0);
  const medals = Object.values(s.lessons).filter((l) => l.medal > 0).length;
  const sum = el('div', 'sum');
  for (const [v, k] of [[stars + '/' + ctx.rounds.length * 3, 'כוכבים'], [medals + '/' + ctx.lessons.length, 'מדליות'], [s.cards.length + '/' + ctx.rounds.length, 'קלפים'], [String(s.coins), 'מטבעות']]) {
    const d = el('div');
    d.append(el('b', '', v), el('span', '', k));
    sum.append(d);
  }
  body.append(sum);
  const t = el('table', 'rec');
  const hr = el('tr');
  for (const h of ['סיבוב', 'מקום', 'זמן', 'כוכבים', 'מטבעות']) hr.append(el('th', '', h));
  t.append(hr);
  for (const r of ctx.rounds) {
    const rc = s.records[r.id], tr = el('tr');
    tr.append(el('td', '', r.n + '. ' + r.title));
    tr.append(el('td', '', rc ? String(rc.bestPlace) + (rc.noFall ? ' ✓' : '') : '-'));
    tr.append(el('td', '', rc && rc.bestTime < 1e8 && r.mode === 'race' ? rc.bestTime.toFixed(1) : '-'));
    tr.append(el('td', 'st', '★'.repeat(s.stars[r.id] ?? 0) || '-'));
    tr.append(el('td', '', rc ? String(rc.coins) : '-'));
    t.append(tr);
  }
  body.append(t);
  const dl = s.daily;
  body.append(el('p', 'note', '📅 מופעים יומיים שהושלמו: ' + dl.done + (dl.streak > 1 ? ' · רצף: ' + dl.streak + ' ימים' : '')));
  body.append(el('p', 'note', 'שיאים אישיים במכשיר הזה. ✓ = מרוץ בלי אף נפילה. נסו לשבור את השיא של עצמכם!'));
}

// ------------------------------------------------------------------ settings
function settings(body: HTMLElement, ctx: ScreenCtx): void {
  const s = ctx.save;
  const slider = (label: string, get: () => number, set: (v: number) => void) => {
    const row = el('label', 'set');
    const r = el('input');
    r.type = 'range'; r.min = '0'; r.max = '1'; r.step = '0.1'; r.value = String(get());
    r.oninput = () => { set(Number(r.value)); ctx.store(); ctx.onSettings(); };
    row.append(el('span', '', label), r);
    return row;
  };
  body.append(slider('מוזיקה', () => s.music, (v) => { s.music = v; }));
  body.append(slider('צלילים', () => s.sound, (v) => { s.sound = v; sfx.coin(); }));
  const low = el('label', 'set');
  const cb = el('input');
  cb.type = 'checkbox'; cb.checked = s.low;
  cb.onchange = () => { s.low = cb.checked; ctx.store(); ctx.onSettings(); };
  low.append(el('span', '', 'גרפיקה חסכונית (למחשב איטי)'), cb);
  body.append(low);
  const check = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const row = el('label', 'set'), c = el('input');
    c.type = 'checkbox'; c.checked = get();
    c.onchange = () => { set(c.checked); ctx.store(); ctx.onSettings(); };
    row.append(el('span', '', label), c);
    body.append(row);
  };
  check('פחות תנועה (בלי רעידות והילוך איטי)', () => s.calm, (v) => { s.calm = v; });
  check('טקסט גדול', () => s.big, (v) => { s.big = v; });
  const nm = el('label', 'set');
  const inp = el('input');
  inp.type = 'text'; inp.maxLength = 14; inp.value = s.name; inp.placeholder = 'כינוי';
  inp.oninput = () => { s.name = inp.value.trim(); ctx.store(); };
  nm.append(el('span', '', 'הכינוי שלי'), inp);
  body.append(nm);
  const reset = el('button', 'big alt danger', 'למחוק את כל ההתקדמות');
  reset.type = 'button';
  let armed = false;
  reset.onclick = () => {
    if (!armed) { armed = true; reset.textContent = 'בטוח? ללחוץ שוב כדי למחוק'; return; }
    ctx.onReset();
  };
  body.append(reset);
}

// ------------------------------------------------------------------ credits
function credits(body: HTMLElement): void {
  const c = el('div', 'credits');
  const p = (t: string, cls = '') => c.append(el('p', cls, t));
  const a = (href: string) => { const l = el('a', '', href); l.href = href; l.target = '_blank'; l.rel = 'noopener'; l.dir = 'ltr'; const q = el('p'); q.append(l); c.append(q); };
  p('המרוץ לכתר', 'ctitle');
  p('משחק זה פותח ונבנה על ידי מיכאל תקשוב מאתר מגמת תקשוב.');
  a('https://tikshuv-ccna.com');
  p('לפיתוח משחקים, סרטונים שיווקיים, תוכנות וייעוץ פנו:');
  const m = el('p'); const ml = el('a', '', 'tikshuvccna@gmail.com'); ml.href = 'mailto:tikshuvccna@gmail.com'; ml.dir = 'ltr'; m.append(ml); c.append(m);
  p('לפניות בנושא בניית חדרי בריחה דיגיטליים ופיזיים בהתאמה אישית:');
  a('https://escapebuilder.com');
  p('תודה לכל המסייעים, בטא טסטרים ומייעצים.', 'thanks');
  p('דמויות ומסלולים: נבנו במיוחד למשחק ב-Blender. מוזיקה וצלילים: נוצרו בקוד במיוחד למשחק.', 'small');
  body.append(c);
}
