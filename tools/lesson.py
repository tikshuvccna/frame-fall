"""Walk through lessons like a student and play the answer-door game with a bot.
usage: python -I tools/lesson.py <out_prefix> [lessons e.g. 9,12] [WxH] [shots: all|few]"""
import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
prefix = sys.argv[1]
lessons = [int(v) for v in sys.argv[2].split(",")] if len(sys.argv) > 2 else [9, 10, 11, 12, 13]
w, h = [int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else "1200x760").split("x")]
few = (sys.argv[4] if len(sys.argv) > 4 else "few") == "few"

# do whatever the widget on the page needs, using the lesson data for the right answers
WIDGET = """(num) => { const L = window.__ff.LESSONS.find(l => l.num === num); const box = document.querySelector('.wg'); if (!box) return 'none';
  const title = document.querySelector('.sheet h2').textContent; const s = L.steps.find(x => x.title === title); const w = s.widget;
  if (w.type === 'cards') box.querySelectorAll('.flip').forEach(b => b.click());
  else if (w.type === 'bits') { const W = [128,64,32,16,8,4,2,1]; const t = w.target === undefined ? 0b10100000 | 1 : w.target; box.querySelectorAll('.bit button').forEach((b, i) => { if (t & W[i]) b.click(); }); }
  else if (w.type === 'pins') { const bs = box.querySelectorAll('.end button'); bs[3].click(); }
  else if (w.type === 'sort') { box.querySelectorAll('.sortrow').forEach((r, i) => { const bs = r.querySelectorAll('.bk button'); bs[(w.items[i].bucket + 1) % bs.length].click(); bs[w.items[i].bucket].click(); }); }
  else { const inp = box.querySelector('input'); inp.value = String(Number(inp.max)); inp.dispatchEvent(new Event('input')); }
  return w.type; }"""
# answer the question on the page: first a wrong option (once), then the right one
ANSWER = """([num, wrongFirst]) => { const L = window.__ff.LESSONS.find(l => l.num === num); const q = document.querySelector('.ask h3'); if (!q) return 'no question';
  const all = [...L.steps.map(s => s.check), ...L.quiz]; const c = all.find(x => x.q === q.textContent); if (!c) return 'unknown question ' + q.textContent;
  const bs = [...document.querySelectorAll('.opts button')];
  if (wrongFirst) bs.find(b => b.textContent !== c.options[c.correct]).click();
  bs.find(b => b.textContent === c.options[c.correct]).click(); return 'ok'; }"""
OVERFLOW = """() => { const bad = []; document.querySelectorAll('.sheet *').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && e.clientWidth > 0) bad.push(e.className + ':' + e.textContent.slice(0, 20)); });
  const sh = document.querySelector('.sheet'); return { wide: sh.scrollWidth > sh.clientWidth + 2, bad: bad.slice(0, 4) }; }"""
STEP = """(n) => { const g = window.__ff.game; for (let i = 0; i < n && g.phase !== 'done'; i++) g.step(1 / 60);
  return { phase: g.phase, t: +g.raceT.toFixed(1), z: +g.player.z.toFixed(1), hud: g.hud, chips: g.chips(), res: g.result }; }"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=["--headless=new", "--use-angle=d3d11", "--enable-gpu"])
    pg = b.new_context(viewport={"width": w, "height": h}, has_touch=(w < 800), is_mobile=(w < 800)).new_page()
    logs = []
    pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" else None)
    for num in lessons:
        pg.goto(f"http://localhost:5212/?all&auto&lesson={num}", wait_until="domcontentloaded")
        pg.wait_for_function("() => window.__ff && window.__ff.game && document.querySelector('.sheet h2')", timeout=30000)
        pg.evaluate("() => localStorage.clear()")
        steps = pg.evaluate("(n) => window.__ff.LESSONS.find(l => l.num === n).steps.length", num)
        for i in range(steps):
            if not few or i == 0:
                pg.screenshot(path=f"{prefix}_L{num}_s{i}a.png")
            kind = pg.evaluate(WIDGET, num)
            pg.wait_for_timeout(150)
            r = pg.evaluate(ANSWER, [num, i == 0])
            pg.wait_for_timeout(150)
            ov = pg.evaluate(OVERFLOW)
            pg.screenshot(path=f"{prefix}_L{num}_s{i}b.png")
            print(f"L{num} step{i} widget={kind} answer={r} overflow={ov}")
            pg.click(".foot .big")
            pg.wait_for_timeout(120)
        for qn in range(6):
            r = pg.evaluate(ANSWER, [num, qn == 0])
            if qn == 0:
                pg.screenshot(path=f"{prefix}_L{num}_quiz.png")
            pg.click(".foot .big")
            pg.wait_for_timeout(100)
        pg.screenshot(path=f"{prefix}_L{num}_result.png")
        print(f"L{num} quiz result:", pg.evaluate("() => document.querySelector('.sheet h2').textContent + ' | ' + document.querySelector('.score').textContent"))
        pg.click(".foot .big")
        pg.wait_for_timeout(300)
        pg.screenshot(path=f"{prefix}_L{num}_mini.png")
        for lv in range(3):
            pg.evaluate("(i) => document.querySelectorAll('#miniLevels button')[i].click()", lv)
            st = None
            for k in range(60):
                st = pg.evaluate(STEP, 180)
                if k in (1, 4):
                    pg.wait_for_timeout(250)
                    pg.screenshot(path=f"{prefix}_L{num}_g{lv}_{k}.png")
                if st["phase"] == "done":
                    break
            pg.wait_for_timeout(200)
            print(f"L{num} game{lv}:", st["res"], st["chips"], "| end:", pg.evaluate("() => document.getElementById('endTitle').textContent"))
            if lv == 2:
                pg.screenshot(path=f"{prefix}_L{num}_gend.png")
            pg.evaluate("() => document.getElementById('menu').click()")
            pg.wait_for_timeout(200)
        print(f"L{num} saved:", pg.evaluate("() => localStorage.getItem('crownrun.save.v1')"))
    for l in logs[:20]:
        print("LOG", l)
    b.close()
