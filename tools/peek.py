"""Screenshots of course sections: start the race, place the player at given z positions, shoot.
usage: python -I tools/peek.py <out_prefix> <WxH> z1,z2,... [base_url]"""
import os
import sys
from playwright.sync_api import sync_playwright

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME):
    CHROME = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
prefix = sys.argv[1]
w, h = [int(v) for v in sys.argv[2].split("x")]
zs = [float(v) for v in sys.argv[3].split(",")]
base = sys.argv[4] if len(sys.argv) > 4 else "http://localhost:5212/"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, headless=True, args=["--headless=new", "--use-angle=d3d11", "--enable-gpu"])
    pg = b.new_context(viewport={"width": w, "height": h}).new_page()
    logs = []
    pg.on("pageerror", lambda e: logs.append("PAGEERROR: " + str(e)))
    pg.goto(base, wait_until="domcontentloaded")
    pg.wait_for_function("() => window.__ff && window.__ff.game", timeout=30000)
    pg.click("#go")
    pg.wait_for_timeout(9000)
    for z in zs:
        pg.evaluate("(z) => { const p = window.__ff.game.player; const g = window.__ff.game.world.groundAt(0.5, 50, z); p.x = 0.5; p.z = z; p.y = (g ? g.y : 0) + 0.2; p.vx = p.vy = p.vz = 0; p.mode = 'normal'; }", z)
        pg.wait_for_timeout(900)
        pg.screenshot(path=f"{prefix}_z{int(-z)}.png")
    for l in logs:
        print(l)
    b.close()
