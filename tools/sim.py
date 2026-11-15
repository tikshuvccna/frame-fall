"""Play rounds fast with a bot in the player's seat and report what happened.
usage: python -I tools/sim.py <out_prefix> [levels e.g. 1,2,3] [WxH] [runs]"""
import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
prefix = sys.argv[1]
levels = [int(v) for v in sys.argv[2].split(",")] if len(sys.argv) > 2 else list(range(1, 11))
w, h = [int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else "1200x760").split("x")]
runs = int(sys.argv[4]) if len(sys.argv) > 4 else 1
STEP = """(n) => { const g = window.__ff.game; for (let i = 0; i < n && g.phase !== 'done'; i++) g.step(1 / 60);
  const p = g.player; const bots = g.actors.filter(a => !a.isPlayer);
  return { phase: g.phase, t: +g.raceT.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(1), fin: g.finishedCount, alive: g.alive, falls: g.falls,
    lead: +Math.min(...bots.filter(a => !a.eliminated).map(a => a.z), 0).toFixed(0), res: g.result }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=["--headless=new", "--use-angle=d3d11", "--enable-gpu"])
    pg = b.new_context(viewport={"width": w, "height": h}).new_page()
    logs = []
    pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
    pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type == "error" else None)
    for lv in levels:
        for run in range(runs):
            pg.goto(f"http://localhost:5212/?all&auto&lv={lv}", wait_until="domcontentloaded")
            pg.wait_for_function("() => window.__ff && window.__ff.game", timeout=30000)
            pg.wait_for_timeout(400)
            if run == 0:
                pg.screenshot(path=f"{prefix}_L{lv}_0menu.png")
            pg.click("#go")
            st = None
            trace = []
            for i in range(60):
                st = pg.evaluate(STEP, 240)
                trace.append(f"{st['t']}s z{st['z']} y{st['y']} fin{st['fin']} alive{st['alive']} lead{st['lead']}")
                if run == 0 and i in (1, 3, 6, 10):
                    pg.wait_for_timeout(250)
                    pg.screenshot(path=f"{prefix}_L{lv}_{i}.png")
                if st["phase"] == "done":
                    break
            print(f"L{lv} run{run}:", st["res"], "| fin", st["fin"], "alive", st["alive"])
            if run == 0:
                print("   ", " | ".join(trace[:14]))
    for l in logs[:20]:
        print("LOG", l)
    b.close()
