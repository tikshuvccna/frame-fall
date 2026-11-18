/**
 * The player's saved progress and everything that is earned: coins, the locker catalog (characters, hats, paints),
 * prizes won by achievements (never bought, never random), personal records and the album of knowledge cards.
 */
export interface Rec { plays: number; bestPlace: number; bestTime: number; noFall: boolean; coins: number }
export interface Save {
  stars: Record<string, number>;
  lessons: Record<string, { quiz: boolean; medal: number }>;
  char: string;
  coins: number;
  owned: string[];
  hat: string | null;
  paint: string | null;
  cards: string[];
  records: Record<string, Rec>;
  prizes: string[];
  name: string;
  music: number;
  sound: number;
  low: boolean;
  /** Rewards already paid (so a medal or a round pays its coins once). */
  paid: string[];
}
const KEY = 'crownrun.save.v1';

export function loadSave(): Save {
  let s: Partial<Save> | null = null;
  try { s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Save> | null; } catch { /* no storage */ }
  return {
    stars: s?.stars ?? {}, lessons: s?.lessons ?? {}, char: s?.char ?? 'ch_robo', coins: s?.coins ?? 0, owned: s?.owned ?? [],
    hat: s?.hat ?? null, paint: s?.paint ?? null, cards: s?.cards ?? [], records: s?.records ?? {}, prizes: s?.prizes ?? [],
    name: s?.name ?? '', music: s?.music ?? 1, sound: s?.sound ?? 1, low: s?.low ?? false, paid: s?.paid ?? [],
  };
}
export function storeSave(s: Save): void { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* no storage */ } }

// ------------------------------------------------------------------ the locker
export type Kind = 'char' | 'hat' | 'paint';
export interface Item { id: string; kind: Kind; name: string; price?: number; prize?: string; value?: string; paint?: [string, string] }

export const PAINTS: Record<string, [string, string]> = {
  red: ['#ff6b6b', '#ffe45c'], orange: ['#ffa94d', '#6fd3ff'], lime: ['#8be37d', '#ff7ac8'], teal: ['#4fd1c5', '#ffd23f'],
  blue: ['#6f8cff', '#ffb347'], lilac: ['#b79cff', '#8be37d'], pink: ['#ff7ac8', '#6fd3ff'], snow: ['#f4f1ff', '#7b6cf6'],
  gold: ['#ffcc33', '#fff1a0'], night: ['#3b3a6b', '#ffd23f'],
};
export const ITEMS_SHOP: Item[] = [
  { id: 'ch_robo', kind: 'char', name: 'רובו' }, { id: 'ch_plug', kind: 'char', name: 'פלאג' }, { id: 'ch_bit', kind: 'char', name: 'ביט' },
  { id: 'ch_wave', kind: 'char', name: 'גלי', prize: 'l09' }, { id: 'ch_fibra', kind: 'char', name: 'סיב', prize: 'l11' },
  { id: 'ch_coil', kind: 'char', name: 'סליל', prize: 'crown' },
  { id: 'cap', kind: 'hat', name: 'מצחייה', price: 40 }, { id: 'antenna', kind: 'hat', name: 'אנטנה', price: 50 },
  { id: 'party', kind: 'hat', name: 'כובע מסיבה', price: 60 }, { id: 'shades', kind: 'hat', name: 'משקפי שמש', price: 70 },
  { id: 'phones', kind: 'hat', name: 'אוזניות', price: 90 }, { id: 'tophat', kind: 'hat', name: 'מגבעת', price: 130 },
  { id: 'flower', kind: 'hat', name: 'פרח', prize: 'nofall' }, { id: 'propeller', kind: 'hat', name: 'כובע מדחף', prize: 'cards5' },
  { id: 'crown', kind: 'hat', name: 'כתר', prize: 'crown' },
  ...(['red', 'orange', 'lime', 'teal', 'blue', 'lilac', 'pink', 'snow'] as const).map((p, i) => ({ id: 'paint_' + p, kind: 'paint' as Kind, name: ['אדום', 'כתום', 'ירוק', 'טורקיז', 'כחול', 'סגול', 'ורוד', 'שלג'][i], price: 30 + (i % 3) * 10, paint: PAINTS[p] })),
  { id: 'paint_gold', kind: 'paint', name: 'זהב', prize: 'gold3', paint: PAINTS.gold },
  { id: 'paint_night', kind: 'paint', name: 'לילה', prize: 'stars20', paint: PAINTS.night },
];

/** Prizes: earned by playing and learning. Each has a rule that is checked after every round or lesson. */
export interface Prize { id: string; name: string; rule: string; done(s: Save): boolean }
const medals = (s: Save) => Object.values(s.lessons).map((l) => l.medal);
export const PRIZES: Prize[] = [
  { id: 'l09', name: 'הדמות גלי', rule: 'מדליה בשיעור 9', done: (s) => (s.lessons.l09?.medal ?? 0) > 0 },
  { id: 'l11', name: 'הדמות סיב', rule: 'מדליה בשיעור 11', done: (s) => (s.lessons.l11?.medal ?? 0) > 0 },
  { id: 'nofall', name: 'הפרח', rule: '3 מרוצים בלי אף נפילה', done: (s) => Object.values(s.records).filter((r) => r.noFall).length >= 3 },
  { id: 'cards5', name: 'כובע המדחף', rule: 'למצוא 5 קלפי ידע', done: (s) => s.cards.length >= 5 },
  { id: 'gold3', name: 'צבע הזהב', rule: '3 מדליות זהב', done: (s) => medals(s).filter((m) => m >= 3).length >= 3 },
  { id: 'stars20', name: 'צבע הלילה', rule: '20 כוכבים', done: (s) => Object.values(s.stars).reduce((a, b) => a + b, 0) >= 20 },
  { id: 'crown', name: 'הדמות סליל והכתר', rule: 'לנצח בהר הכתר', done: (s) => (s.stars.crown ?? 0) > 0 },
];
/** Returns the prizes that were just won (and records them). */
export function checkPrizes(s: Save): Prize[] {
  const won = PRIZES.filter((p) => !s.prizes.includes(p.id) && p.done(s));
  for (const p of won) s.prizes.push(p.id);
  return won;
}
export function has(s: Save, it: Item): boolean {
  if (it.prize) return s.prizes.includes(it.prize);
  if (!it.price) return true;
  return s.owned.includes(it.id);
}
/** Pay a reward once. */
export function payOnce(s: Save, key: string, coins: number): number {
  if (s.paid.includes(key)) return 0;
  s.paid.push(key); s.coins += coins;
  return coins;
}

// ------------------------------------------------------------------ the album: one knowledge card hidden in each round
export const CARDS: Record<string, { name: string; text: string }> = {
  cables: { name: 'UTP', text: 'בכבל UTP יש 4 זוגות של חוטי נחושת שזורים. השזירה מקטינה הפרעות.' },
  doors: { name: 'RJ-45', text: 'המחבר בקצה כבל הרשת נקרא RJ-45, ויש בו 8 פינים.' },
  spin: { name: '568A ו-568B', text: 'שני תקנים קובעים את סדר הצבעים של החוטים במחבר.' },
  wind: { name: 'Wi-Fi', text: 'רשת Wi-Fi ביתית עובדת בעיקר בתדרים 2.4GHz ו-5GHz.' },
  chute: { name: 'סיב אופטי', text: 'סיב אופטי מעביר מידע בעזרת אור, ולכן הפרעות חשמליות לא משפיעות עליו.' },
  hex: { name: 'Bluetooth', text: 'Bluetooth יוצר רשת אישית קטנה (WPAN) למרחק של מטרים ספורים.' },
  tiptoe: { name: 'ביט ובייט', text: 'ביט הוא 0 או 1. שמונה ביטים הם בייט אחד.' },
  climb: { name: '255', text: 'המספר 11111111 בבינארי הוא 255 בעשרוני: הכי גדול שנכנס בבייט.' },
  rush: { name: 'תו הקסה', text: 'כל תו הקסדצימלי מייצג 4 ביטים. F הוא 1111.' },
  seesaw: { name: 'כבל מוצלב', text: 'כבל מוצלב (Crossover) מחבר שני מכשירים מאותו סוג, למשל מחשב למחשב.' },
  hunt: { name: 'Auto-MDIX', text: 'בזכות Auto-MDIX הכרטיס מזהה לבד את סוג הכבל, וגם כבל ישיר עובד בין מכשירים דומים.' },
  crown: { name: 'כתובת MAC', text: 'כתובת MAC כתובה ב-12 תווים הקסדצימליים, כלומר 48 ביטים.' },
};
