/** Door questions for units 3 and 4 (cables and media, number systems). One right answer, three wrong ones. */
export interface Question { text: string; answers: string[]; right: number; why: string }

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
function shuffleQ(text: string, right: string, wrong: string[], why: string): Question {
  const answers = [right, ...wrong.slice(0, 3)];
  for (let i = answers.length - 1; i > 0; i--) { const j = rnd(0, i); [answers[i], answers[j]] = [answers[j], answers[i]]; }
  return { text, answers, right: answers.indexOf(right), why };
}
function distinct(right: number, pool: number[]): string[] {
  const out: number[] = [];
  for (const p of pool.sort(() => Math.random() - 0.5)) if (p !== right && p >= 0 && !out.includes(p)) out.push(p);
  return out.slice(0, 3).map(String);
}

function binToDec(): Question {
  const n = rnd(5, 15), b = n.toString(2).padStart(4, '0');
  return shuffleQ('כמה זה ' + b + ' בעשרוני?', String(n), distinct(n, [n + 1, n - 1, n + 2, n - 2, n + 4, n - 4]),
    b + ' = ' + [8, 4, 2, 1].filter((_, i) => b[i] === '1').join(' + ') + ' = ' + n);
}
function decToBin(): Question {
  const n = rnd(2, 7), b = (x: number) => x.toString(2).padStart(3, '0');
  const wrong = [1, 2, 3, 4, 5, 6, 7].filter((x) => x !== n).sort(() => Math.random() - 0.5).slice(0, 3).map(b);
  return shuffleQ('איך כותבים ' + n + ' בבינארי?', b(n), wrong, n + ' בבינארי הוא ' + b(n) + ' (המשקלים: 4, 2, 1)');
}
function hexDigit(): Question {
  const d = rnd(10, 15), h = d.toString(16).toUpperCase();
  return shuffleQ('כמה שווה הספרה ' + h + ' בהקסדצימלי?', String(d), distinct(d, [10, 11, 12, 13, 14, 15, 16]),
    'בהקסדצימלי A=10, B=11, C=12, D=13, E=14, F=15');
}
const FIXED: (() => Question)[] = [
  () => shuffleQ('כמה ביטים יש בבייט אחד?', '8', ['4', '10', '16'], 'בייט אחד = 8 ביטים'),
  () => shuffleQ('מחשב למתג: איזה כבל?', 'ישר', ['מוצלב', 'קונסול', 'קואקסיאלי'], 'מכשירים שונים (מחשב ומתג) מחברים בכבל ישר'),
  () => shuffleQ('מתג למתג: איזה כבל?', 'מוצלב', ['ישר', 'קונסול', 'קואקסיאלי'], 'מכשירים זהים (מתג ומתג) מחברים בכבל מוצלב'),
  () => shuffleQ('מה מעביר מידע באור?', 'סיב אופטי', ['נחושת', 'גלי רדיו', 'קואקסיאלי'], 'בסיב אופטי המידע עובר כאור'),
  () => shuffleQ('איזה מחבר יש בכבל רשת?', 'RJ45', ['RJ11', 'USB', 'HDMI'], 'לכבל רשת (UTP) יש מחבר RJ45 עם 8 מגעים'),
];

/** Five questions for one race: an easy opener, then a mix of both units. */
export function raceQuestions(): Question[] {
  const f = [...FIXED].sort(() => Math.random() - 0.5);
  return [f[0](), binToDec(), f[1](), decToBin(), hexDigit()];
}
