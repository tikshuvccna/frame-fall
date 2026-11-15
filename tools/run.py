"""Drive one race in real Chrome and take screenshots.
usage: python -I tools/run.py <out_prefix> [WxH] [base_url] [mode]
mode: 'smart' (default) steers the player to the right door of every row; 'dumb' runs straight ahead.
"""
import os
import sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

STATE = """() => { const g = window.__ff.game, p = g.player; return { phase: g.phase, t: +g.time.toFixed(1), x: +p.x.toFixed(1), y: +p.y.toFixed(1),
  z: +p.z.toFixed(1), mode: p.mode, rank: g.rank(), fin: g.finishedCount, falls: g.falls, res: g.result && { place: g.result.place, q: g.result.qualified } }; }"""
# autopilot: run forward, jump gaps and bars, dodge bumpers and balls, wait for hammers
PILOT = """() => { const g = window.__ff.game, p = g.player, w = g.world; window.__pilot = setInterval(() => {
  const k = (c, on) => window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: c }));
  let tx = 0, go = true, z = p.z;
  if (z > -15.5) tx = 0; else if (z > -26.6 && z < -15.5) { const m = g.movers.reduce((a, b) => Math.abs(b.cx - p.x) < Math.abs(a.cx - p.x) ? b : a); tx = m.cx; if (p.grounded && z < -19.2 && z > -20.6 && Math.abs(m.cx - p.x) > 1.3) go = false; }
  else if (z > -58.5) tx = p.x; else if (z > -84.5) { tx = 0; for (const h of g.hammers) { const dz = z - h.z; if (dz > 0.6 && dz < 3.4) { const t = g.time + (dz - 0.6) / 7; if (Math.abs(h.headX(t) - p.x) < 2.3 || Math.abs(h.headX(t + 0.3) - p.x) < 2.3) go = false; } } }
  else if (z > -106.5) tx = 0; else if (z > -134.2) tx = 2.4; else if (z > -169.8) { tx = p.x; for (const b of g.balls.balls) { const dz = z - b.z, dx = p.x - b.x; if (b.wait <= 0 && dz > -1 && dz < 10 && Math.abs(dx) < 2.2) tx = p.x + (dx >= 0 ? 3 : -3); } tx = Math.max(-5.5, Math.min(5.5, tx)); }
  for (const b of g.bumpers) { const dz = z - b.z, dx = p.x - b.x; if (dz > 0 && dz < 3.5 && Math.abs(dx) < 1.3) tx = p.x + (dx >= 0 ? 2 : -2); }
  k('ArrowLeft', tx < p.x - 0.3); k('ArrowRight', tx > p.x + 0.3); k('ArrowUp', go);
  let jump = p.grounded && go && !w.groundAt(p.x, p.y, p.z - 0.8);
  for (const s of g.spinners) { const n = s.near(p.x, p.z); if (n.d < 1.3 + Math.abs(n.t) * 0.45 && p.grounded) jump = true; }
  if (jump) { k('Space', true); setTimeout(() => k('Space', false), 300); }
}, 40); }"""


def main():
    prefix = sys.argv[1]
    w, h = [int(v) for v in (sys.argv[2] if len(sys.argv) > 2 else "1200x760").split("x")]
    base = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:5212/"
    mode = sys.argv[4] if len(sys.argv) > 4 else "smart"
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, headless=True, args=["--headless=new", "--use-angle=d3d11", "--enable-gpu"])
        ctx = b.new_context(viewport={"width": w, "height": h}, has_touch=(w < 800), is_mobile=(w < 800))
        pg = ctx.new_page()
        logs = []
        pg.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
        pg.goto(base, wait_until="domcontentloaded")
        pg.wait_for_function("() => window.__ff && window.__ff.game", timeout=30000)
        pg.wait_for_timeout(800)
        pg.screenshot(path=f"{prefix}_0_start.png")
        pg.click("#go")
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f"{prefix}_1_count.png")
        pg.wait_for_timeout(1300)
        if mode == "smart":
            pg.evaluate(PILOT)
        else:
            pg.keyboard.down("ArrowUp")
        n = 2
        for i in range(240):
            pg.wait_for_timeout(500)
            st = pg.evaluate(STATE)
            if i in (1, 3, 6, 10, 15, 20) or st["phase"] == "done" or (st["mode"] != "normal" and n < 12):
                pg.screenshot(path=f"{prefix}_{n}_t{i}.png")
                n += 1
            if i % 3 == 0 or st["phase"] == "done":
                print(st)
            if st["phase"] == "done":
                break
        fps = pg.evaluate("() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1000) r(n); else requestAnimationFrame(f); }; requestAnimationFrame(f); })")
        print("fps", fps, "calls", pg.evaluate("() => 0"))
        for l in logs[:15]:
            print("LOG", l)
        b.close()


main()
