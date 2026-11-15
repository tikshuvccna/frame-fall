/**
 * The mini-game of every lesson: a solo run through walls of three doors. The question is on the screen, an answer is
 * written on each door, and only the door with the right answer opens. Three levels: more walls, more obstacles, less time.
 */
import { DoorWall } from '../blocks';
import { TINTS, type LevelDef } from '../round';
import { Bumper, Spinner } from '../world';
import type { GameLevel, Lesson } from './content';

export const GAME_LEVELS: { id: GameLevel; name: string; prize: string; walls: number; time: number }[] = [
  { id: 'easy', name: 'קל', prize: 'מדליית ארד', walls: 5, time: 150 },
  { id: 'medium', name: 'בינוני', prize: 'מדליית כסף', walls: 7, time: 120 },
  { id: 'hard', name: 'קשה', prize: 'מדליית זהב', walls: 9, time: 100 },
];
const GAP = 17, Z0 = -30;

export function quizRun(lesson: Lesson, level: GameLevel): LevelDef {
  const cfg = GAME_LEVELS.find((g) => g.id === level) ?? GAME_LEVELS[0];
  const qs = lesson.game(level, cfg.walls);
  return {
    id: lesson.id + '.' + level, title: 'משחק התשובות', tip: '', mode: 'race', qualify: 1, runners: 1, time: cfg.time,
    theme: level === 'easy' ? 'mint' : level === 'medium' ? 'sunset' : 'dusk',
    build(r) {
      r.startPad('mint');
      let mistakes = 0;
      const pals = ['cream', 'sky', 'violet', 'mint', 'sun'] as const;
      const zLast = Z0 - (qs.length - 1) * GAP;
      qs.forEach((q, i) => {
        const z = Z0 - i * GAP;
        r.floor(0, 0, i === 0 ? -14 : z + GAP - 8, z - 8, 5.2, { pal: pals[i % pals.length] });
        const wall = r.add(new DoorWall(0, 0, z, [0, 1, 2].map((k) => k === q.c), [TINTS[i % 12], TINTS[(i + 4) % 12], TINTS[(i + 8) % 12]], 2.6, 0.6, q.a));
        wall.onPlayer = (ok) => {
          if (ok) r.onToast?.('נכון!', true);
          else { mistakes++; r.onToast?.('לא הדלת הזאת', false); }
        };
        r.checkpoint(z - 1.5, 0, 3, 0, z - 3);
        if (level !== 'easy' && i > 0) r.add(new Bumper(i % 2 ? 2.4 : -2.4, 0, z + 8, TINTS[(i * 5) % 12]));
        if (level === 'hard' && i % 2 === 1) r.add(new Spinner(0, 0, z + 9.5, i % 4 === 1 ? 1.8 : -1.8, TINTS[(i * 3) % 12], 3.6));
      });
      r.finishPad(zLast - 14, 0, 'sun', 6);
      r.dress(zLast - 30);
      const passed = () => qs.filter((_, k) => r.player.z < Z0 - k * GAP - 0.4).length;
      r.tick(() => { const i = passed(); r.hud = i < qs.length ? qs[i].q : 'רוצו לקו הסיום!'; });
      r.hud = qs[0].q;
      r.chipsFn = () => ['שאלה ' + Math.min(passed() + 1, qs.length) + ' מתוך ' + qs.length, 'טעויות ' + mistakes];
      r.starsFn = () => (mistakes === 0 ? 3 : mistakes === 1 ? 2 : mistakes <= 3 ? 1 : 0);      // guessing does not win a medal
    },
  };
}
