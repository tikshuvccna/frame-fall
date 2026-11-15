"""Stage kit for the Fall Guys style game: floating candy course pieces with a cable-and-connector theme.

blender -b --python art/blender/stage.py -- [name ...|all] [noprev]
Front = Blender +Y (glTF -Z). Origin = ground centre unless noted. 'Paint' is recoloured by code, 'Label' takes text.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prlib import *   # noqa

REG = {}
PI = math.pi


def model(fn):
    REG[fn.__name__] = fn
    return fn


def mats():
    M('Floor', '#fff4d6', rough=0.6)
    M('Floor2', '#ffd9ec', rough=0.6)
    M('Edge', '#ff8fb8', rough=0.5)
    M('Edge2', '#ffffff', rough=0.5)
    M('Paint', '#5ac8fa', rough=0.5)
    M('Paint2', '#ffffff', rough=0.5)
    M('Label', '#ffffff', rough=0.6)
    M('Pole', '#7b6cf6', rough=0.5)
    M('Gold', '#ffcf3f', rough=0.3, metal=0.5)
    M('Cable', '#3f7dff', rough=0.5)
    M('Crystal', '#e4f3fb', rough=0.2)
    M('Dark', '#3a3550')
    M('Cloud', '#ffffff', rough=0.9)
    M('Glow', '#7dfcff', emit=1.6)


def stripes(b, w, d, z0, h, n, m1='Edge', m2='Edge2'):
    """Striped skirt around a w x d platform."""
    for k in range(n):
        x = -w / 2 + (k + 0.5) * w / n
        m = m1 if k % 2 == 0 else m2
        for y in (d / 2, -d / 2):
            b.box((w / n, 0.06, h), loc=(x, y, z0 + h / 2), mat=m)
    nd = max(1, round(n * d / w))
    for k in range(nd):
        y = -d / 2 + (k + 0.5) * d / nd
        m = m1 if k % 2 == 0 else m2
        for x in (w / 2, -w / 2):
            b.box((0.06, d / nd, h), loc=(x, y, z0 + h / 2), mat=m)


@model
def floor_tile():
    """4 x 4 m platform block, top at y = 0, striped skirt. Tile it for floors."""
    mats()
    b = B()
    b.box((4, 4, 0.2), loc=(0, 0, -0.1), mat='Floor', bevel=0.04)
    b.box((3.9, 3.9, 0.5), loc=(0, 0, -0.45), mat='Edge')
    stripes(b, 4, 4, -0.7, 0.5, 4)
    b.obj('floor_tile')


@model
def floor_tile_b():
    """Same block with the second floor colour (checker floors)."""
    mats()
    b = B()
    b.box((4, 4, 0.2), loc=(0, 0, -0.1), mat='Floor2', bevel=0.04)
    b.box((3.9, 3.9, 0.5), loc=(0, 0, -0.45), mat='Edge')
    stripes(b, 4, 4, -0.7, 0.5, 4)
    b.obj('floor_tile_b')


@model
def door_frame():
    """Door Dash frame: opening 3 m wide, 3 m high. Put door_panel inside."""
    mats()
    b = B()
    for s in (-1, 1):
        b.cyl(0.32, 3.4, loc=(s * 1.85, 0, 1.7), mat='Pole', seg=14)
        for z in (0.5, 1.5, 2.5):
            b.lathe([(0.33, z - 0.12), (0.37, z), (0.33, z + 0.12)], loc=(s * 1.85, 0, 0), mat='Edge2', seg=14)
        b.sphere(0.4, loc=(s * 1.85, 0, 3.5), mat='Gold', seg=12, rings=8)
    b.box((4.3, 0.5, 0.5), loc=(0, 0, 3.25), mat='Pole', bevel=0.12, seg=3, smooth=True)
    b.obj('door_frame')


@model
def door_panel():
    """Door panel 3 x 3 m (origin = bottom centre). 'Paint' body, white 'Label' board toward the runners (-Y) for the answer."""
    mats()
    b = B()
    b.box((3.0, 0.22, 3.0), loc=(0, 0, 1.5), mat='Paint', bevel=0.08, seg=3, smooth=True)
    b.box((2.3, 0.06, 1.3), loc=(0, -0.12, 1.75), mat='Label', bevel=0.06, seg=2)
    for (x, z) in ((-1.25, 0.25), (1.25, 0.25), (-1.25, 2.75), (1.25, 2.75)):
        b.sphere(0.1, loc=(x, -0.11, z), scale=(1, 0.5, 1), mat='Gold', seg=8, rings=6)
    b.obj('door_panel')


@model
def tile_sq():
    """Path tile 2 x 2 m, top at y = 0 ('Paint' top)."""
    mats()
    b = B()
    b.box((1.9, 1.9, 0.16), loc=(0, 0, -0.08), mat='Paint', bevel=0.05, seg=2)
    b.box((1.7, 1.7, 0.2), loc=(0, 0, -0.26), mat='Edge2')
    b.obj('tile_sq')


@model
def tile_hex():
    """Hexagon tile, 1.2 m radius, top at y = 0 ('Paint' top, 'Label' disc for a digit)."""
    mats()
    b = B()
    b.cyl(1.18, 0.18, loc=(0, 0, -0.09), mat='Paint', seg=6, smooth=False)
    b.cyl(1.05, 0.22, loc=(0, 0, -0.29), mat='Edge2', seg=6, smooth=False)
    b.cyl(0.6, 0.02, loc=(0, 0, 0.005), mat='Label', seg=6, smooth=False)
    b.obj('tile_hex')


def arch(b, w, h, r, mat, seg=10, n=16, y=0.0):
    pts = [(-w / 2, y, 0)]
    for i in range(n + 1):
        a = PI * i / n
        pts.append((-math.cos(a) * w / 2, y, h - w / 2 + math.sin(a) * w / 2))
    pts.append((w / 2, y, 0))
    b.tube(pts, r, mat, seg=seg)


@model
def gate_start():
    """Start gate: a giant cable arch, 14 m wide, with a banner ('Label')."""
    mats()
    b = B()
    arch(b, 14, 9, 0.5, 'Cable')
    for s in (-1, 1):
        b.box((1.5, 1.3, 1.6), loc=(s * 7, 0, 0.8), mat='Crystal', bevel=0.15, seg=3, smooth=True)   # connector feet
        for i in range(4):
            b.box((0.16, 0.5, 0.1), loc=(s * 7 - 0.45 + i * 0.3, -0.45, 1.62), mat='Gold')
    b.box((7, 0.25, 1.6), loc=(0, 0, 7.2), mat='Pole', bevel=0.1, seg=2)
    b.box((6.5, 0.08, 1.2), loc=(0, -0.15, 7.2), mat='Label', bevel=0.05)
    b.obj('gate_start')


@model
def gate_finish():
    """Finish gate, 14 m wide: checker banner and two flags."""
    mats()
    b = B()
    for s in (-1, 1):
        b.cyl(0.45, 8, loc=(s * 7, 0, 4), mat='Pole', seg=14)
        for z in (1, 3, 5, 7):
            b.lathe([(0.46, z - 0.3), (0.52, z), (0.46, z + 0.3)], loc=(s * 7, 0, 0), mat='Edge2', seg=14)
        b.sphere(0.6, loc=(s * 7, 0, 8.3), mat='Gold', seg=12, rings=8)
    n = 14
    for i in range(n):
        for j in range(2):
            b.box((1, 0.2, 0.8), loc=(-6.5 + i, 0, 6.2 + j * 0.8), mat='Dark' if (i + j) % 2 else 'Edge2')
    b.box((14.2, 0.3, 0.2), loc=(0, 0, 7.7), mat='Gold')
    b.box((14.2, 0.3, 0.2), loc=(0, 0, 5.7), mat='Gold')
    b.obj('gate_finish')


@model
def bumper():
    """Soft pillar obstacle, 1.2 m wide, 1.8 m high."""
    mats()
    b = B()
    b.lathe([(0.0, 0.0), (0.55, 0.0), (0.62, 0.2), (0.6, 1.4), (0.5, 1.7), (0.0, 1.8)], mat='Paint', seg=16)
    for z in (0.45, 0.95):
        b.lathe([(0.615, z - 0.13), (0.64, z), (0.615, z + 0.13)], mat='Paint2', seg=16)
    b.obj('bumper')


@model
def spinner():
    """Spinning bar obstacle: node 'Bar' (8 m, spin about the up axis) on a hub."""
    mats()
    b = B()
    b.lathe([(0.9, 0.0), (0.9, 0.2), (0.45, 0.5), (0.35, 0.9), (0.0, 0.9)], mat='Pole', seg=16, cap0=True)
    hub = b.obj('spinner')
    r = B()
    r.cyl(0.3, 8, loc=(0, 0, 0), rot=(0, PI / 2, 0), mat='Paint', seg=12)
    for k in range(-3, 4):
        r.cyl(0.31, 0.5, loc=(k * 1.1, 0, 0), rot=(0, PI / 2, 0), mat='Paint2', seg=12)
    for s in (-1, 1):
        r.sphere(0.36, loc=(s * 4, 0, 0), mat='Gold', seg=12, rings=8)
    r.obj('Bar', hub, (0, 0, 0.8))


@model
def cloud():
    """Puffy cloud, about 12 m wide (origin = centre)."""
    mats()
    b = B()
    for (x, y, z, r) in ((0, 0, 0, 2.6), (2.6, 0.3, -0.3, 2.0), (-2.7, -0.2, -0.4, 2.1), (4.6, 0, -0.8, 1.4), (-4.7, 0.2, -0.9, 1.5),
                         (1.0, 0.6, 1.2, 1.7), (-1.3, -0.5, 1.0, 1.6)):
        b.sphere(r, loc=(x, y, z), scale=(1, 0.8, 0.75), mat='Cloud', seg=14, rings=9)
    b.obj('cloud')


@model
def balloon():
    """Balloon with a string, 3.4 m high (tint 'Paint')."""
    mats()
    b = B()
    b.sphere(0.9, loc=(0, 0, 2.5), scale=(1, 1, 1.15), mat='Paint', seg=14, rings=10)
    b.cyl(0.12, 0.14, loc=(0, 0, 1.42), r2=0.04, mat='Paint', seg=8)
    b.tube([(0, 0, 1.4), (0.08, 0, 0.9), (-0.06, 0, 0.45), (0, 0, 0)], 0.015, 'Edge2', seg=5)
    b.obj('balloon')


@model
def deco_spool():
    """Decor: giant cable spool on a small floating island, 7 m wide."""
    mats()
    M('Grass', '#9be37d', rough=0.9)
    M('Rock', '#c9a7e8', rough=0.9)
    M('Wood', '#e0a868', rough=0.8)
    b = B()
    b.lathe([(0.0, -3.2), (1.2, -2.2), (2.8, -0.8), (3.5, -0.2)], mat='Rock', seg=10, smooth=False)
    b.lathe([(3.5, -0.2), (3.55, 0.0), (0.0, 0.05)], mat='Grass', seg=10)
    rot = (PI / 2, 0, 0.5)
    mx = Matrix.Translation((0, 0, 1.75)) @ Euler(rot).to_matrix().to_4x4()
    for z in (-1.0, 1.0):
        b.cyl(1.7, 0.2, mat='Wood', seg=18, matrix=mx @ Matrix.Translation((0, 0, z)))
    prof = []
    for k in range(9):
        z0 = -0.9 + k * 0.2
        prof += [(1.1, z0), (1.22, z0 + 0.1)]
    prof.append((1.1, 0.9))
    b.lathe(prof, mat='Cable', seg=18, matrix=mx)
    b.obj('deco_spool')


@model
def deco_plug():
    """Decor: giant network plug standing as a statue, 5 m high."""
    mats()
    b = B()
    b.box((2.6, 2.0, 3.2), loc=(0, 0, 3.4), mat='Crystal', bevel=0.25, seg=3, smooth=True)
    for i in range(8):
        b.box((0.16, 0.9, 0.14), loc=(-0.875 + i * 0.25, 0.5, 5.0), mat='Gold')
    b.lathe([(0.75, 0.0), (0.95, 0.3), (1.0, 1.2), (0.85, 1.8)], mat='Paint', seg=16, cap0=True)
    for z in (0.5, 0.9, 1.3):
        b.lathe([(0.98, z - 0.1), (1.08, z), (0.98, z + 0.1)], mat='Paint2', seg=16)
    b.obj('deco_plug')


@model
def flag():
    """Small pennant on a pole, 3 m (tint 'Paint')."""
    mats()
    b = B()
    b.cyl(0.05, 3, loc=(0, 0, 1.5), mat='Edge2', seg=8)
    b.sphere(0.1, loc=(0, 0, 3.05), mat='Gold', seg=8, rings=6)
    b.prism([(0, 0), (1.1, 0.3), (0, 0.7)], 0.04, loc=(0.04, 0, 2.2), rot=(PI / 2, 0, 0), mat='Paint')
    b.obj('flag')


@model
def trophy():
    """Prize: golden star on a stand, 1.2 m (origin = bottom centre)."""
    mats()
    b = B()
    b.lathe([(0.32, 0.0), (0.32, 0.1), (0.12, 0.2), (0.07, 0.5), (0.0, 0.5)], mat='Pole', seg=14, cap0=True)
    pts = []
    for i in range(10):
        a = PI / 2 + TAU * i / 10
        r = 0.42 if i % 2 == 0 else 0.19
        pts.append((math.cos(a) * r, math.sin(a) * r))
    b.prism(pts, 0.16, loc=(0, 0, 0.85), rot=(PI / 2, 0, 0), mat='Gold', bevel=0.03)
    b.obj('trophy')


def preview_model(name):
    toonify(0.03)
    preview_scene(sky='#bfe6ff')
    frame_cam(res=(520, 440), yaw=28, elev=20, margin=1.0, lens=50)
    render(os.path.join(PREV, name + '.png'))


def main():
    a = args()
    noprev = 'noprev' in a
    names = [x for x in a if x != 'noprev']
    if not names or names == ['all']:
        names = list(REG)
    for nm in names:
        reset()
        REG[nm]()
        export(nm)
        record(nm)
        if not noprev:
            preview_model(nm)


main()
