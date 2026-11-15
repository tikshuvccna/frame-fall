/**
 * The five lessons between the rounds: units 4 and 5 (physical layer, cables, wireless, number systems).
 * Facts follow the book "שער לרשת" 2.3 (pp. 37-45, 52-55, 109-112, 161, 165) as used in the quiz-games lessons 09-13.
 */
export interface Check { q: string; options: string[]; correct: number; explain: string }
export interface Band { upTo: number; text: string; ok: boolean }
export type Widget =
  | { type: 'cards'; cards: { label: string; text: string }[] }
  | { type: 'bits'; mode: 'bin' | 'hex'; target?: number }
  | { type: 'pins' }
  | { type: 'sort'; buckets: string[]; items: { label: string; bucket: number }[] }
  | { type: 'range'; label: string; min: number; max: number; start: number; step: number; unit: string; rows: { name: string; bands: Band[] }[] }
  | { type: 'speed' };
export interface Step { title: string; html: string; widget: Widget; check: Check }
export interface GameQ { q: string; a: [string, string, string]; c: number }
export type GameLevel = 'easy' | 'medium' | 'hard';
export interface Lesson {
  id: string; num: number; title: string; short: string;
  steps: Step[]; quiz: Check[]; pass: number;
  game(level: GameLevel, n: number): GameQ[];
}

// ------------------------------------------------------------------ helpers for the answer-door game
function shuffle<T>(a: T[]): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
/** Build a question from the right answer and two wrong ones (shuffled). */
function gq(q: string, right: string, w1: string, w2: string): GameQ {
  const a = shuffle([right, w1, w2]) as [string, string, string];
  return { q, a, c: a.indexOf(right) };
}
function fromPool(pool: [string, string, string, string][], n: number): GameQ[] {
  return shuffle(pool).slice(0, n).map(([q, r, w1, w2]) => gq(q, r, w1, w2));
}
function rnd(lo: number, hi: number): number { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
function bin(v: number, bits: number): string { return v.toString(2).padStart(bits, '0'); }
function hex(v: number): string { return v.toString(16).toUpperCase(); }
/** Two wrong numbers near the right one, all different. */
function near(v: number, lo: number, hi: number): [number, number] {
  const out = new Set<number>();
  while (out.size < 2) { const w = v + rnd(-6, 6); if (w !== v && w >= lo && w <= hi) out.add(w); }
  const [a, b] = [...out];
  return [a, b];
}
function many(n: number, make: () => GameQ): GameQ[] {
  const out: GameQ[] = [], seen = new Set<string>();
  let guard = 0;
  while (out.length < n && guard++ < 200) { const g = make(); if (!seen.has(g.q)) { seen.add(g.q); out.push(g); } }
  return out;
}

// ------------------------------------------------------------------ lesson 09
const L09: Lesson = {
  id: 'l09', num: 9, title: 'כבלי נחושת והשכבה הפיזית', short: 'כבלי נחושת',
  steps: [
    {
      title: 'ביטים הופכים לאותות',
      html: '<p>השכבה הפיזית מעבירה את הביטים במדיה. <b>קידוד</b> הופך את ההודעה לסדרת ביטים.</p><p>בכל מדיה הביט נראה אחרת.</p>',
      widget: { type: 'cards', cards: [
        { label: 'כבל נחושת', text: 'הביטים עוברים כפולסים חשמליים.' },
        { label: 'סיב אופטי', text: 'הביטים עוברים כהבזקי אור.' },
        { label: 'אלחוט', text: 'הביטים עוברים כגלי רדיו באוויר.' },
      ] },
      check: { q: 'איך עוברים ביטים בכבל נחושת?', options: ['כפולסים חשמליים', 'כהבזקי אור', 'כגלי קול', 'כגלי רדיו'], correct: 0, explain: 'כבל נחושת מוליך חשמל, ולכן הביטים עוברים בו כפולסים חשמליים.' },
    },
    {
      title: 'כבל UTP',
      html: '<p><b>UTP</b> הוא הכבל הנפוץ ברשת: זול, קל להתקנה ומחבר מחשבים ואביזרי רשת.</p><p>הקישו על כל חלק.</p>',
      widget: { type: 'cards', cards: [
        { label: '4 זוגות', text: 'שמונה חוטים ב-4 זוגות, כל זוג בצבע אחר.' },
        { label: 'שזירה', text: 'כל זוג שזור, כדי להפחית הפרעות חיצוניות.' },
        { label: 'RJ-45', text: 'המחבר בקצה הכבל. נכנס לשקע של כרטיס הרשת.' },
        { label: '100 מטר', text: 'המרחק המקסימלי לשימוש תקין.' },
      ] },
      check: { q: 'למה החוטים בכבל UTP שזורים בזוגות?', options: ['כדי להפחית הפרעות', 'כדי שהכבל יהיה יפה', 'כדי לחסוך נחושת', 'כדי להאריך את הכבל'], correct: 0, explain: 'השזירה מפחיתה הפרעות חיצוניות.' },
    },
    {
      title: 'הפרעות וכבל STP',
      html: '<p>הפרעות אלקטרו-מגנטיות (<b>EMI</b>) הורסות מידע, ואז משדרים שוב והקצב יורד.</p><p><b>STP</b> הוא כבל עם סיכוך: יקר, קשיח וקשה לעבודה, ומתאים לסביבה "רועשת".</p>',
      widget: { type: 'sort', buckets: ['UTP', 'STP'], items: [
        { label: 'כיתת מחשבים', bucket: 0 }, { label: 'מפעל עם מנועים גדולים', bucket: 1 },
        { label: 'משרד קטן', bucket: 0 }, { label: 'ליד מכונות ריתוך', bucket: 1 },
      ] },
      check: { q: 'באיזה מקום כדאי להתקין STP?', options: ['במפעל עם רעש חשמלי', 'בחדר בבית', 'בכיתה', 'בספרייה'], correct: 0, explain: 'הסיכוך של STP מגן מפני הפרעות בסביבה חשמלית רועשת.' },
    },
    {
      title: 'אורך הכבל וניחות',
      html: '<p>ככל שהכבל ארוך יותר, האות נחלש. לזה קוראים <b>ניחות</b>.</p><p>הזיזו את המחוון וראו מה קורה לאות.</p>',
      widget: { type: 'range', label: 'אורך הכבל', min: 10, max: 150, start: 40, step: 10, unit: 'מ\'', rows: [
        { name: 'UTP', bands: [{ upTo: 100, text: 'האות מגיע תקין', ok: true }, { upTo: 1e9, text: 'האות חלש מדי. צריך מגבר או מתג בדרך', ok: false }] },
      ] },
      check: { q: 'מה המרחק המקסימלי של כבל UTP?', options: ['100 מטר', '10 מטר', '1,000 מטר', '2,000 מטר'], correct: 0, explain: 'עד 100 מטר בדרך כלל. מעבר לזה האות נחלש מדי.' },
    },
    {
      title: 'קטגוריות, רוחב פס ו-COAX',
      html: '<p>תקני הכבלים קובעים סוג כבל, מחברים, מספור פינים ואורך. <b>רוחב פס</b> הוא כמה ביטים עוברים בשנייה.</p>',
      widget: { type: 'cards', cards: [
        { label: 'CAT5', text: 'עד 100Mbps.' },
        { label: 'CAT5e', text: 'עד 1000Mbps.' },
        { label: 'CAT6A', text: 'כבל STP. כל זוג עטוף בסיכוך.' },
        { label: 'CAT8', text: 'עד 40Gb/s, אבל רק עד 30 מטר.' },
        { label: 'COAX', text: 'מוליך נחושת במרכז, מבודד, סיכוך ושרוול. משמש בחברות הכבלים ולאנטנות.' },
      ] },
      check: { q: 'איזו קטגוריה תומכת ב-1000Mbps?', options: ['CAT5e', 'CAT5', 'COAX', 'RJ-45'], correct: 0, explain: 'CAT5 תומך ב-100Mbps ו-CAT5e ב-1000Mbps.' },
    },
  ],
  quiz: [
    { q: 'איזה מחבר נמצא בקצה כבל UTP?', options: ['RJ-45', 'USB', 'HDMI', 'SC'], correct: 0, explain: 'כל הקטגוריות של UTP מסתיימות בדרך כלל ב-RJ-45.' },
    { q: 'כמה זוגות חוטים יש בכבל UTP נפוץ?', options: ['4', '2', '8', '6'], correct: 0, explain: '4 זוגות, כלומר 8 חוטים.' },
    { q: 'מה גורמות הפרעות EMI?', options: ['הרס מידע ושידור חוזר', 'קצב מהיר יותר', 'כבל ארוך יותר', 'שום דבר'], correct: 0, explain: 'המידע נהרס, משדרים שוב, והקצב יורד.' },
    { q: 'מה נכון לגבי STP?', options: ['יקר וקשיח, עם סיכוך', 'זול וגמיש', 'עשוי מזכוכית', 'בלי חוטים'], correct: 0, explain: 'הסיכוך מגן, אבל הכבל יקר וקשה לעבודה.' },
    { q: 'איזה כבל משמש בחברות הכבלים?', options: ['COAX', 'UTP', 'CAT8', 'STP'], correct: 0, explain: 'כבל קואקסיאלי, עם מוליך נחושת במרכז.' },
    { q: 'CAT8 מגיע ל-40Gb/s. עד איזה מרחק?', options: ['30 מטר', '100 מטר', '2,000 מטר', '1 מטר'], correct: 0, explain: 'קצב גבוה מאוד, אבל רק עד 30 מטר.' },
  ],
  pass: 4,
  game: (_lv, n) => fromPool([
    ['מרחק מקסימלי של UTP', '100 מ\'', '30 מ\'', '2000 מ\''], ['המחבר של UTP', 'RJ-45', 'USB', 'COAX'], ['זוגות ב-UTP', '4', '2', '8'],
    ['ביטים בנחושת', 'חשמל', 'אור', 'רדיו'], ['כבל למפעל רועש', 'STP', 'UTP', 'חוט רגיל'], ['CAT5e תומך ב-', '1000Mbps', '100Mbps', '10Mbps'],
    ['CAT5 תומך ב-', '100Mbps', '1000Mbps', '40Gb/s'], ['CAT8: עד כמה מטר?', '30', '100', '500'], ['כבל של חברות הכבלים', 'COAX', 'UTP', 'STP'],
    ['שזירה מפחיתה', 'הפרעות', 'מחיר', 'אורך'], ['היחלשות האות', 'ניחות', 'קידוד', 'שזירה'], ['הכבל הזול והנפוץ', 'UTP', 'STP', 'COAX'],
    ['CAT6A הוא כבל', 'STP', 'UTP', 'COAX'], ['הפרעה אלקטרו-מגנטית', 'EMI', 'RJ', 'CAT'],
  ], n),
};

// ------------------------------------------------------------------ lesson 10
const L10: Lesson = {
  id: 'l10', num: 10, title: 'כבל ישיר, כבל מוצלב וסיב אופטי', short: 'ישיר, מוצלב, סיב',
  steps: [
    {
      title: 'שני תקנים: 568A ו-568B',
      html: '<p>לסידור החוטים במחבר יש שני תקנים: <b>568A</b> ו-<b>568B</b>.</p><p>בחרו תקן לכל קצה וראו איזה כבל יצא.</p>',
      widget: { type: 'pins' },
      check: { q: 'צד אחד 568A וצד שני 568B. איזה כבל זה?', options: ['מוצלב', 'ישיר', 'סיב אופטי', 'COAX'], correct: 0, explain: 'אותו תקן בשני הצדדים נותן כבל ישיר. תקנים שונים נותנים כבל מוצלב.' },
    },
    {
      title: 'מתי ישיר ומתי מוצלב',
      html: '<p><b>התקנים דומים</b> משדרים וקולטים באותם פינים, ולכן צריכים כבל <b>מוצלב</b>.</p><p>התקנים שונים מתחברים בכבל <b>ישיר</b>.</p>',
      widget: { type: 'sort', buckets: ['ישיר', 'מוצלב'], items: [
        { label: 'מחשב למתג', bucket: 0 }, { label: 'מחשב למחשב', bucket: 1 }, { label: 'מתג לראוטר', bucket: 0 },
        { label: 'מתג למתג', bucket: 1 }, { label: 'ראוטר לראוטר', bucket: 1 }, { label: 'מחשב לראוטר', bucket: 1 },
      ] },
      check: { q: 'איזה כבל מחבר מחשב למתג?', options: ['ישיר', 'מוצלב', 'אין הבדל אף פעם', 'COAX'], correct: 0, explain: 'מחשב ומתג הם התקנים שונים, ולכן כבל ישיר.' },
    },
    {
      title: 'Auto-MDIX',
      html: '<p>בציוד חדש יש תכונה בשם <b>Auto-MDIX</b>.</p>',
      widget: { type: 'cards', cards: [
        { label: 'מה היא עושה?', text: 'מזהה אם צריך להפוך את החוטים, ועושה את זה לבד.' },
        { label: 'מה יוצא מזה?', text: 'אין צורך בכבל מוצלב. כל כבל יעבוד.' },
        { label: 'ובמבחן?', text: 'עדיין צריך לדעת מתי ישיר ומתי מוצלב.' },
      ] },
      check: { q: 'מה Auto-MDIX עושה?', options: ['הופכת את החוטים לבד כשצריך', 'מאריכה את הכבל', 'מצפינה מידע', 'מחליפה סיב בנחושת'], correct: 0, explain: 'התכונה מזהה את הצורך בהיפוך ומבצעת אותו לבד.' },
    },
    {
      title: 'סיב אופטי',
      html: '<p><b>סיב אופטי</b> הוא גליל זכוכית או פלסטיק בעובי שערה. המידע עובר בו כ<b>אור</b>, מהר ולמרחקים גדולים.</p>',
      widget: { type: 'cards', cards: [
        { label: 'ליבה', text: 'בה עובר האור.' },
        { label: 'חיפוי', text: 'משמש כמראה שמחזירה את האור לליבה.' },
        { label: 'הפרעות', text: 'אור לא מושפע מהפרעות חשמליות.' },
        { label: 'ברקים', text: 'סיב לא מעביר חשמל, ולכן מתאים בין בניינים.' },
        { label: 'בין מדינות', text: 'כבלים תת-ימיים הם סיבים אופטיים.' },
      ] },
      check: { q: 'למה הפרעות חשמליות לא משפיעות על סיב?', options: ['כי המידע עובר כאור', 'כי הסיב עבה', 'כי הוא קצר', 'כי הוא מנחושת'], correct: 0, explain: 'המידע עובר באמצעות אור, לא באמצעות חשמל.' },
    },
    {
      title: 'Single Mode ו-Multi-Mode',
      html: '<p><b>Multi-Mode</b>: כמה קרני אור, מקור LED, זול ונפוץ, עד 2000 מטר.</p><p><b>Single Mode</b>: נתיב אור אחד, לייזר, קצב גבוה ומרחק גדול.</p>',
      widget: { type: 'range', label: 'מרחק', min: 50, max: 5000, start: 50, step: 50, unit: 'מ\'', rows: [
        { name: 'UTP', bands: [{ upTo: 100, text: 'עובד', ok: true }, { upTo: 1e9, text: 'רחוק מדי', ok: false }] },
        { name: 'Multi-Mode', bands: [{ upTo: 2000, text: 'עובד', ok: true }, { upTo: 1e9, text: 'רחוק מדי', ok: false }] },
        { name: 'Single Mode', bands: [{ upTo: 1e9, text: 'עובד', ok: true }] },
      ] },
      check: { q: 'איזה סיב מתאים למרחק הגדול ביותר?', options: ['Single Mode', 'Multi-Mode', 'UTP', 'STP'], correct: 0, explain: 'ב-Single Mode האור עובר בנתיב אחד, עם לייזר, ולכן מגיע רחוק יותר.' },
    },
  ],
  quiz: [
    { q: 'שני הצדדים בתקן 568B. איזה כבל זה?', options: ['ישיר', 'מוצלב', 'סיב', 'COAX'], correct: 0, explain: 'אותו תקן בשני הצדדים נותן כבל ישיר.' },
    { q: 'איזה כבל מחבר מתג למתג?', options: ['מוצלב', 'ישיר', 'סיב בלבד', 'אי אפשר'], correct: 0, explain: 'שני מתגים הם התקנים דומים, ולכן כבל מוצלב.' },
    { q: 'איזה כבל מחבר מחשב לראוטר?', options: ['מוצלב', 'ישיר', 'COAX', 'אלחוטי'], correct: 0, explain: 'לפי הספר, מחשב וראוטר מתחברים בכבל מוצלב.' },
    { q: 'מה תפקיד החיפוי בסיב?', options: ['להחזיר את האור לליבה', 'להוליך חשמל', 'לחזק את הכבל', 'לצבוע אותו'], correct: 0, explain: 'החיפוי פועל כמראה ומחזיר את האור לליבה.' },
    { q: 'מה מקור האור ב-Multi-Mode?', options: ['LED', 'לייזר', 'נורה רגילה', 'השמש'], correct: 0, explain: 'ב-Multi-Mode בדרך כלל LED. ב-Single Mode לייזר.' },
    { q: 'איזה כבל מחבר בין מדינות מתחת לים?', options: ['סיב אופטי', 'UTP', 'STP', 'COAX'], correct: 0, explain: 'למרחקים גדולים מאוד משתמשים בסיב אופטי.' },
  ],
  pass: 4,
  game: (_lv, n) => fromPool([
    ['מחשב למתג', 'ישיר', 'מוצלב', 'COAX'], ['מחשב למחשב', 'מוצלב', 'ישיר', 'COAX'], ['מתג למתג', 'מוצלב', 'ישיר', 'סיב בלבד'],
    ['מתג לראוטר', 'ישיר', 'מוצלב', 'COAX'], ['ראוטר לראוטר', 'מוצלב', 'ישיר', 'COAX'], ['568A + 568A', 'ישיר', 'מוצלב', 'שבור'],
    ['568A + 568B', 'מוצלב', 'ישיר', 'שבור'], ['בסיב עובר', 'אור', 'חשמל', 'מים'], ['בליבה של הסיב', 'האור', 'החשמל', 'הסיכוך'],
    ['מקור אור ב-Single', 'לייזר', 'LED', 'נורה'], ['מקור אור ב-Multi', 'LED', 'לייזר', 'נורה'], ['Multi-Mode: עד', '2000 מ\'', '100 מ\'', '30 מ\''],
    ['הופכת חוטים לבד', 'Auto-MDIX', 'RJ-45', 'CAT5'], ['כבל תת-ימי', 'סיב', 'UTP', 'COAX'], ['התקנים דומים', 'מוצלב', 'ישיר', 'COAX'],
  ], n),
};

// ------------------------------------------------------------------ lesson 11
const L11: Lesson = {
  id: 'l11', num: 11, title: 'מדיה אלחוטית', short: 'אלחוט',
  steps: [
    {
      title: 'בלי חוטים',
      html: '<p>טכנולוגיות אלחוט מעבירות מידע ב<b>גלים אלקטרומגנטיים</b> דרך האוויר.</p>',
      widget: { type: 'cards', cards: [
        { label: 'יתרון: ניידות', text: 'זזים עם המכשיר ונשארים מחוברים.' },
        { label: 'יתרון: התקנה', text: 'קל וזול להתקין. אין צורך למשוך כבלים.' },
        { label: 'חיסרון: מהירות', text: 'מהירות ואמינות נמוכות יחסית לחוטים, אבל משתפרות.' },
        { label: 'חיסרון: הפרעות', text: 'טלפון אלחוטי ותנור מיקרוגל עלולים להפריע.' },
        { label: 'חיסרון: אבטחה', text: 'השידור חשוף לכל. אפשר להאזין ולהפריע.' },
      ] },
      check: { q: 'מה יתרון של רשת אלחוטית?', options: ['ניידות', 'אבטחה מושלמת', 'אין הפרעות', 'תמיד מהירה מכבל'], correct: 0, explain: 'אלחוט נותן ניידות והתקנה קלה וזולה.' },
    },
    {
      title: 'גלי רדיו ואינפרא-אדום',
      html: '<p><b>RF</b> (גלי רדיו) חודרים דרך קירות ומגיעים רחוק.</p><p><b>IR</b> (אינפרא-אדום) לא עובר מכשולים, כמו שלט של טלוויזיה.</p>',
      widget: { type: 'range', label: 'קירות בדרך', min: 0, max: 3, start: 0, step: 1, unit: '', rows: [
        { name: 'IR', bands: [{ upTo: 0, text: 'עובד, יש קו ראייה', ok: true }, { upTo: 9, text: 'נחסם. לא עובר קיר', ok: false }] },
        { name: 'RF', bands: [{ upTo: 1, text: 'עובד היטב', ok: true }, { upTo: 9, text: 'עובד, האות נחלש', ok: true }] },
      ] },
      check: { q: 'איזה אות עובר דרך קיר?', options: ['RF', 'IR', 'שניהם לא', 'רק אור'], correct: 0, explain: 'גלי RF חודרים מכשולים וקירות. IR לא.' },
    },
    {
      title: 'תדרים ו-Bluetooth',
      html: '<p>תדר נמדד ב-<b>Hz</b>: כמה גלים יש בשנייה אחת.</p><p>רשתות אלחוטיות פועלות בתחומים בלי רישוי: 900MHz, 2.4GHz ו-5GHz.</p>',
      widget: { type: 'cards', cards: [
        { label: 'Bluetooth', text: 'גלי רדיו ב-2.4GHz. מהירות נמוכה וטווח קצר, לכמה אביזרים בו-זמנית.' },
        { label: '2.4GHz', text: 'תחום עמוס. גם מיקרוגל וטלפון אלחוטי משדרים בו.' },
        { label: '5GHz', text: 'תחום פנוי יותר, עם פחות הפרעות.' },
      ] },
      check: { q: 'מה מודדת היחידה Hz?', options: ['כמה גלים בשנייה', 'מרחק במטרים', 'מספר מחשבים', 'גודל קובץ'], correct: 0, explain: 'הרץ = כמה גלים יש בשנייה אחת.' },
    },
    {
      title: 'WPAN, WLAN, WWAN',
      html: '<p>שלושה גדלים של רשת אלחוטית: <b>WPAN</b> אישית וקטנה, <b>WLAN</b> מקומית (Wi-Fi), <b>WWAN</b> על שטח רחב.</p>',
      widget: { type: 'sort', buckets: ['WPAN', 'WLAN', 'WWAN'], items: [
        { label: 'אוזניות Bluetooth', bucket: 0 }, { label: 'Wi-Fi בבית הספר', bucket: 1 }, { label: 'רשת סלולרית', bucket: 2 },
        { label: 'עכבר אלחוטי', bucket: 0 }, { label: 'Wi-Fi בבית', bucket: 1 },
      ] },
      check: { q: 'רשת טלפונים סלולרית היא דוגמה ל-', options: ['WWAN', 'WPAN', 'WLAN', 'UTP'], correct: 0, explain: 'WWAN מכסה שטח רחב, כמו רשת סלולרית.' },
    },
    {
      title: 'החלקים של Wi-Fi',
      html: '<p>רשת Wi-Fi פועלת לפי התקן <b>IEEE 802.11</b>.</p>',
      widget: { type: 'cards', cards: [
        { label: 'AP', text: 'נקודת גישה. דרכה המארחים מתקשרים, גם עם הרשת הקווית.' },
        { label: 'SSID', text: 'שם הרשת, עד 32 תווים. מזהה את הרשת לכל המארחים.' },
        { label: 'אנטנה רב-כיוונית', text: 'קולטת 360 מעלות מסביב.' },
        { label: 'WiMAX', text: 'דומה ל-Wi-Fi, אבל בקצב גבוה ולטווח של מעל 10 ק"מ.' },
      ] },
      check: { q: 'מה זה SSID?', options: ['שם הרשת האלחוטית', 'סוג של כבל', 'סיסמה', 'אנטנה'], correct: 0, explain: 'SSID הוא שם של עד 32 תווים שמזהה את הרשת.' },
    },
  ],
  quiz: [
    { q: 'איזה תקן עוסק ברשתות WLAN?', options: ['IEEE 802.11', 'RJ-45', '568B', 'CAT6'], correct: 0, explain: 'ארגון IEEE יצר את תקן 802.11 לרשתות אלחוטיות.' },
    { q: 'באיזה תחום פועל Bluetooth?', options: ['2.4GHz', '5GHz', '900Hz', '60GHz'], correct: 0, explain: 'Bluetooth משתמש בתחום 2.4GHz.' },
    { q: 'איזה מכשיר ביתי עלול להפריע ל-Wi-Fi?', options: ['תנור מיקרוגל', 'מקרר', 'מנורת שולחן', 'מאוורר'], correct: 0, explain: 'מיקרוגל פועל באותו תחום בלי רישוי.' },
    { q: 'מקלדת ועכבר אלחוטיים הם רשת מסוג', options: ['WPAN', 'WLAN', 'WWAN', 'LAN קווי'], correct: 0, explain: 'WPAN מחברת ציוד היקפי קרוב.' },
    { q: 'מה תפקיד נקודת הגישה (AP)?', options: ['לחבר מארחים אלחוטיים לרשת', 'להאריך כבל', 'להדפיס', 'לאחסן קבצים'], correct: 0, explain: 'דרך ה-AP המארחים מתקשרים ביניהם ועם הרשת הקווית.' },
    { q: 'איזו טכנולוגיה מגיעה ליותר מ-10 ק"מ?', options: ['WiMAX', 'Bluetooth', 'IR', 'UTP'], correct: 0, explain: 'WiMAX דומה ל-Wi-Fi, אבל לטווחים גדולים בהרבה.' },
  ],
  pass: 4,
  game: (_lv, n) => fromPool([
    ['עובר דרך קיר', 'RF', 'IR', 'אור'], ['נחסם בקיר', 'IR', 'RF', 'Wi-Fi'], ['שם הרשת', 'SSID', 'AP', 'Hz'],
    ['נקודת גישה', 'AP', 'SSID', 'IR'], ['רשת סלולרית', 'WWAN', 'WLAN', 'WPAN'], ['Wi-Fi בבית', 'WLAN', 'WWAN', 'WPAN'],
    ['אוזניות Bluetooth', 'WPAN', 'WLAN', 'WWAN'], ['התקן של Wi-Fi', '802.11', '568A', 'CAT5'], ['גלים בשנייה', 'Hz', 'Mb', 'SSID'],
    ['Bluetooth פועל ב-', '2.4GHz', '5GHz', '900MHz'], ['מעל 10 ק"מ', 'WiMAX', 'Bluetooth', 'IR'], ['SSID: עד כמה תווים', '32', '8', '100'],
    ['אנטנה רב-כיוונית', '360°', '90°', '45°'], ['מפריע ל-Wi-Fi', 'מיקרוגל', 'מקרר', 'מנורה'], ['יתרון של אלחוט', 'ניידות', 'אבטחה', 'מהירות'],
  ], n),
};

// ------------------------------------------------------------------ lesson 12
const L12: Lesson = {
  id: 'l12', num: 12, title: 'בינארי ועשרוני', short: 'בינארי',
  steps: [
    {
      title: 'שתי שיטות ספירה',
      html: '<p>אנחנו סופרים ב<b>עשרוני</b>: עשר ספרות, 0 עד 9.</p><p>מחשב סופר ב<b>בינארי</b>: רק שתי ספרות, 0 ו-1.</p>',
      widget: { type: 'cards', cards: [
        { label: '0', text: 'אין זרם.' },
        { label: '1', text: 'יש זרם.' },
        { label: 'סימון', text: 'כותבים את הבסיס בקטן ליד המספר: 101 בבסיס 2 הוא 5 בבסיס 10.' },
      ] },
      check: { q: 'כמה ספרות יש בשיטה הבינארית?', options: ['2', '10', '8', '16'], correct: 0, explain: 'רק 0 ו-1.' },
    },
    {
      title: 'ביט, בייט ואוקטטה',
      html: '<p>כל ספרה בינארית היא <b>ביט</b> (סיבית).</p><p>8 ביטים הם <b>בייט</b>, שנקרא גם <b>אוקטטה</b>. בכתובת IPv4 יש 4 אוקטטות.</p>',
      widget: { type: 'cards', cards: [
        { label: 'ביט', text: 'ספרה אחת: 0 או 1.' },
        { label: 'בייט', text: '8 ביטים.' },
        { label: 'אוקטטה', text: 'שם נוסף לבייט. כך נקרא כל חלק בכתובת IP.' },
        { label: '192.168.1.7', text: '4 אוקטטות, כלומר 32 ביטים.' },
      ] },
      check: { q: 'כמה ביטים יש באוקטטה?', options: ['8', '4', '2', '16'], correct: 0, explain: 'אוקטטה היא בייט: 8 ביטים.' },
    },
    {
      title: 'טבלת המשקלים',
      html: '<p>לכל ביט יש <b>משקל</b>. מתחילים ב-1 מימין ומכפילים פי 2 בכל צעד, עד 128.</p><p>הדליקו ביטים וראו את הסכום.</p>',
      widget: { type: 'bits', mode: 'bin' },
      check: { q: 'מה המשקל של הביט השמאלי ביותר באוקטטה?', options: ['128', '8', '100', '255'], correct: 0, explain: 'המשקלים הם 128, 64, 32, 16, 8, 4, 2, 1.' },
    },
    {
      title: 'מבינארי לעשרוני',
      html: '<p>מחברים את המשקלים של הביטים הדלוקים.</p><p>לדוגמה 10101001 הוא 128+32+8+1.</p><p><b>משימה:</b> הדליקו ביטים כך שהסכום יהיה 169.</p>',
      widget: { type: 'bits', mode: 'bin', target: 169 },
      check: { q: 'כמה זה 00001010 בעשרוני?', options: ['10', '5', '12', '1010'], correct: 0, explain: '8 + 2 = 10.' },
    },
    {
      title: 'מעשרוני לבינארי',
      html: '<p>שואלים מהמשקל הגדול לקטן: "האם 128 נכנס במספר?" אם כן רושמים 1 ומפחיתים. אם לא רושמים 0.</p><p><b>משימה:</b> בנו את 158.</p>',
      widget: { type: 'bits', mode: 'bin', target: 158 },
      check: { q: 'מה הערך הגדול ביותר של אוקטטה?', options: ['255', '256', '128', '999'], correct: 0, explain: 'כל 8 הביטים דלוקים: 128+64+32+16+8+4+2+1 = 255. לכן 256 אינו אוקטטה חוקית.' },
    },
  ],
  quiz: [
    { q: 'כמה זה 00000101 בעשרוני?', options: ['5', '3', '101', '6'], correct: 0, explain: '4 + 1 = 5.' },
    { q: 'כמה זה 10000000 בעשרוני?', options: ['128', '1', '8', '100'], correct: 0, explain: 'רק הביט של 128 דלוק.' },
    { q: 'איך כותבים 6 בבינארי?', options: ['00000110', '00000101', '00000011', '00001100'], correct: 0, explain: '4 + 2 = 6.' },
    { q: 'איך כותבים 158 בבינארי?', options: ['10011110', '10101001', '11111111', '10000001'], correct: 0, explain: '128 + 16 + 8 + 4 + 2 = 158.' },
    { q: 'כמה ערכים שונים יש לאוקטטה?', options: ['256', '255', '8', '128'], correct: 0, explain: 'מ-0 עד 255, כלומר 256 ערכים.' },
    { q: 'כמה ביטים יש בכתובת IPv4?', options: ['32', '8', '4', '48'], correct: 0, explain: '4 אוקטטות של 8 ביטים.' },
  ],
  pass: 4,
  game: (lv, n) => many(n, () => {
    if (lv === 'easy') { const v = rnd(1, 15), [a, b] = near(v, 0, 20); return gq(bin(v, 4) + ' = ?', String(v), String(a), String(b)); }
    if (lv === 'medium') { const v = rnd(16, 255), [a, b] = near(v, 0, 255); return gq(bin(v, 8) + ' = ?', String(v), String(a), String(b)); }
    const v = rnd(16, 255), [a, b] = near(v, 0, 255);
    return gq(v + ' בבינארי', bin(v, 8), bin(a, 8), bin(b, 8));
  }),
};

// ------------------------------------------------------------------ lesson 13
const L13: Lesson = {
  id: 'l13', num: 13, title: 'הקסדצימלי ויחידות מידע', short: 'הקסה ויחידות',
  steps: [
    {
      title: 'בסיס 16',
      html: '<p><b>הקסדצימלי</b> הוא ספירה בבסיס 16: הספרות 0 עד 9, ואחריהן האותיות A עד F.</p><p>מסמנים מספר כזה בקידומת <b>0x</b>, למשל 0x4C.</p>',
      widget: { type: 'cards', cards: [
        { label: 'A', text: '10' }, { label: 'B', text: '11' }, { label: 'C', text: '12' },
        { label: 'D', text: '13' }, { label: 'E', text: '14' }, { label: 'F', text: '15' },
      ] },
      check: { q: 'כמה שווה F?', options: ['15', '16', '6', '10'], correct: 0, explain: 'A=10, B=11, C=12, D=13, E=14, F=15.' },
    },
    {
      title: 'תו אחד = 4 ביטים',
      html: '<p>כל תו הקסדצימלי הוא <b>4 ביטים</b>. שני תווים הם בייט שלם.</p><p>מחלקים את 8 הביטים לשני חלקים וממירים כל חלק בנפרד. הדליקו ביטים וראו.</p>',
      widget: { type: 'bits', mode: 'hex' },
      check: { q: 'כמה זה 1001 1110 בהקסה?', options: ['9E', 'E9', '9F', '8E'], correct: 0, explain: '1001 הוא 9, ו-1110 הוא 14, כלומר E.' },
    },
    {
      title: 'מהקסה לבינארי',
      html: '<p>הולכים בכיוון ההפוך: כל תו הופך ל-4 ביטים.</p><p><b>משימה:</b> בנו את F5.</p>',
      widget: { type: 'bits', mode: 'hex', target: 0xf5 },
      check: { q: 'כמה זה 0xF5 בבינארי?', options: ['11110101', '11111010', '01011111', '11110011'], correct: 0, explain: 'F הוא 1111 ו-5 הוא 0101.' },
    },
    {
      title: 'איפה פוגשים הקסה',
      html: '<p>הקסה כותב מספרים גדולים במעט תווים.</p>',
      widget: { type: 'cards', cards: [
        { label: 'כתובת MAC', text: '48 ביטים, נרשמת בהקסה: 00-0E-A6-A7-63-F7.' },
        { label: 'כתובת IPv6', text: '128 ביטים, נרשמת בהקסה.' },
        { label: '12 תווים', text: 'כתובת MAC: 12 תווים כפול 4 ביטים הם 48 ביטים.' },
      ] },
      check: { q: 'כמה ביטים יש בכתובת MAC?', options: ['48', '32', '128', '12'], correct: 0, explain: '48 ביטים, שנכתבים כ-12 תווי הקסה.' },
    },
    {
      title: 'ביטים ובייטים: יחידות מידע',
      html: '<p>בייט אחד = 8 ביטים. מהירות רשת נמדדת ב-<b>Mb/s</b> (מגה-ביט לשנייה), לא במגה-בייט.</p><p>כדי לעבור מ-Mb/s ל-MB/s מחלקים ב-8.</p>',
      widget: { type: 'speed' },
      check: { q: 'קו של 100Mb/s. כמה מגה-בייט בשנייה?', options: ['12.5', '100', '800', '8'], correct: 0, explain: '100 חלקי 8 הם 12.5MB/s.' },
    },
  ],
  quiz: [
    { q: 'כמה שווה C בהקסה?', options: ['12', '13', '11', '3'], correct: 0, explain: 'A=10, B=11, C=12.' },
    { q: 'כמה ביטים יש בתו הקסה אחד?', options: ['4', '8', '2', '16'], correct: 0, explain: 'כל תו הוא 4 ביטים.' },
    { q: 'כמה זה 0xFF בעשרוני?', options: ['255', '256', '15', '1515'], correct: 0, explain: '1111 1111, כל הביטים דלוקים: 255.' },
    { q: 'מה הקידומת של מספר הקסדצימלי?', options: ['0x', '0b', '#', 'h:'], correct: 0, explain: 'למשל 0x4C.' },
    { q: 'כמה ביטים יש בבייט?', options: ['8', '4', '10', '1,000'], correct: 0, explain: 'בייט אחד = 8 ביטים.' },
    { q: 'באיזו יחידה נמדדת מהירות רשת?', options: ['Mb/s', 'MB', 'Hz', 'מטר'], correct: 0, explain: 'מגה-ביט לשנייה. טעות נפוצה היא לחשוב שזה מגה-בייט.' },
  ],
  pass: 4,
  game: (lv, n) => many(n, () => {
    if (lv === 'easy') { const v = rnd(10, 15), [a, b] = near(v, 8, 17); return gq(hex(v) + ' = ?', String(v), String(a), String(b)); }
    if (lv === 'medium') {
      const v = rnd(1, 15); let a = rnd(0, 15), b = rnd(0, 15);
      while (a === v) a = rnd(0, 15);
      while (b === v || b === a) b = rnd(0, 15);
      return gq(bin(v, 4) + ' בהקסה', hex(v), hex(a), hex(b));
    }
    const v = rnd(16, 255), [a, b] = near(v, 16, 255);
    return gq('0x' + hex(v) + ' = ?', String(v), String(a), String(b));
  }),
};

export const LESSONS: Lesson[] = [L09, L10, L11, L12, L13];
