"""Check the board, the backstage screens and a round with pickups.
usage: python -I tools/screens.py <out_prefix> [WxH,...] [round numbers e.g. 1,3]"""
import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
prefix = sys.argv[1]
sizes = [tuple(int(v) for v in s.split("x")) for s in (sys.argv[2] if len(sys.argv) > 2 else "1200x760").split(",")]
rounds = [int(v) for v in sys.argv[3].split(",")] if len(sys.argv) > 3 and sys.argv[3] else []
SCREENS = ["locker", "prizes", "album", "records", "settings", "credits"]
OVER = """() => { const bad = []; document.querySelectorAll('#panel *, #card *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1)) bad.push(e.tagName + '.' + e.className + ':' + e.textContent.slice(0, 16)); }); return bad.slice(0, 5); }"""
STEP = """(n) => { const g = window.__ff.game; for (let i = 0; i < n && g.phase !== 'done'; i++) g.step(1 / 60);
  return { phase: g.phase, t: +g.raceT.toFixed(1), coins: g.pickups.got, placed: g.pickups.coins.length, card: !!g.pickups.card, cardGot: g.pickups.cardGot, res: g.result }; }"""

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=["--headless=new", "--use-angle=d3d11", "--enable-gpu"])
    logs = []
    for (w, h) in sizes:
        pg = b.new_context(viewport={"width": w, "height": h}, has_touch=(w < 800), is_mobile=(w < 800)).new_page()
        pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
        pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" else None)
        pg.goto("http://localhost:5212/?all", wait_until="domcontentloaded")
        pg.wait_for_function("() => window.__ff && !document.getElementById('intro').classList.contains('hide')", timeout=30000)
        pg.evaluate("() => { const s = window.__ff.save; s.coins = 120; s.cards = ['cables','spin']; s.prizes = ['l09']; s.hat = 'propeller'; s.records.cables = {plays:3,bestPlace:2,bestTime:41.3,noFall:true,coins:14}; s.stars.cables = 2; }")
        pg.wait_for_timeout(500)
        pg.screenshot(path=f"{prefix}_{w}x{h}_board.png")
        print(w, h, "board overflow:", pg.evaluate(OVER))
        for sc in SCREENS:
            pg.evaluate("(id) => window.__ff.openScreen(id)", sc)
            pg.wait_for_timeout(350)
            pg.screenshot(path=f"{prefix}_{w}x{h}_{sc}.png")
            print(w, h, sc, "overflow:", pg.evaluate(OVER))
        pg.close()
    for n in rounds:
        pg = b.new_context(viewport={"width": 1200, "height": 760}).new_page()
        pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
        pg.goto(f"http://localhost:5212/?all&auto&lv={n}", wait_until="domcontentloaded")
        pg.wait_for_function("() => window.__ff && window.__ff.game && !document.getElementById('intro').classList.contains('hide')", timeout=30000)
        pg.evaluate("() => { window.__ff.save.hat = 'crown'; }")
        pg.click("#go")
        st = None
        for k in range(80):
            st = pg.evaluate(STEP, 120)
            if k == 6:
                pg.wait_for_timeout(200)
                pg.screenshot(path=f"{prefix}_r{n}_play.png")
            if st["phase"] == "done":
                break
        pg.wait_for_timeout(400)
        pg.screenshot(path=f"{prefix}_r{n}_end.png")
        print(f"round {n}:", st, "| end:", pg.evaluate("() => document.getElementById('endGain').textContent + ' | ' + document.getElementById('endPurse').textContent"))
        pg.close()
    for l in logs[:20]:
        print("LOG", l)
    b.close()
