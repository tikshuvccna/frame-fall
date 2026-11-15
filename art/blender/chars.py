"""Characters for the Fall Guys style game (units 3-4). Six original figure types, one shared skeleton.

blender -b --python art/blender/chars.py -- [name ...|all] [noprev]

Skeleton (every character, so one animation code drives all):
  <name> (empty, ground centre)
    Body  (origin = hip centre)      children: Head (origin = neck), ArmL, ArmR (origin = shoulder)
    LegL, LegR (origin = hip joint)
Front = Blender +Y (glTF -Z). L = Blender -X. Materials 'Paint' and 'Paint2' are the recolourable ones.
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


def T(v):
    return Matrix.Translation(Vector(v))


def glyph_bm(ch, size, depth):
    cu = bpy.data.curves.new('_g', 'FONT')
    cu.body = ch
    cu.size = size
    cu.extrude = depth / 2
    cu.resolution_u = 2
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new('_g', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    t = bmesh.new()
    t.from_mesh(me)
    ob.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    bmesh.ops.triangulate(t, faces=t.faces)
    return t


def common():
    M('EyeW', '#ffffff', rough=0.3)
    M('EyeD', '#2a2036', rough=0.3)
    M('Cheek', '#ff9aa8')
    M('Metal', '#8d97a6', rough=0.4, metal=0.4)
    M('Dark', '#3a3550')


def eyes(b, y, z, dx=0.11, r=0.075, ys=None):
    """White eyes with dark pupils. y = surface y at the eye; ys = optional per-part y squash."""
    for s in (-1, 1):
        x = s * dx
        b.sphere(r, loc=(x, y, z), scale=(1, 0.42, 1.18), mat='EyeW', seg=14, rings=9)
        b.sphere(r * 0.6, loc=(x * 0.95, y + r * 0.3, z - r * 0.08), scale=(1, 0.42, 1.12), mat='EyeD', seg=12, rings=8)
        b.sphere(r * 0.2, loc=(x * 0.95 + r * 0.2, y + r * 0.52, z + r * 0.3), scale=(1, 0.5, 1), mat='EyeW', seg=8, rings=5)


def smile(b, y, z, w=0.07, d=0.035, curve=0.0, mat='EyeD', r=0.012):
    pts = []
    for i in range(9):
        t = -1 + i / 4
        pts.append((t * w, y - curve * t * t, z - (1 - t * t) * d))
    b.tube(pts, r, mat, seg=6)


def cheeks(b, y, z, dx=0.19, r=0.04):
    for s in (-1, 1):
        b.sphere(r, loc=(s * dx, y, z), scale=(1, 0.25, 0.7), mat='Cheek', seg=10, rings=6)


def legs(root, leg_mat, foot_mat, dx=0.13, hip=0.30, r=0.065, foot=0.13):
    for s, nm in ((-1, 'LegL'), (1, 'LegR')):
        b = B()
        b.cyl(r, hip - 0.06, loc=(0, 0, -(hip - 0.06) / 2), mat=leg_mat, seg=10)
        b.sphere(foot, loc=(0, 0.045, -hip), scale=(0.82, 1.2, 0.82), mat=foot_mat, seg=14, rings=10, cut=0.0)
        b.obj(nm, root, (s * dx, 0, hip))


def arms(body, arm_mat, hand_mat, sx, sz, length=0.22, r=0.05, hand=0.082, splay=0.09):
    for s, nm in ((-1, 'ArmL'), (1, 'ArmR')):
        b = B()
        b.tube([(0, 0, 0), (s * splay * 0.6, 0, -length * 0.5), (s * splay, 0, -length)], r, arm_mat, seg=8)
        b.sphere(hand, loc=(s * splay, 0, -length - 0.03), mat=hand_mat, seg=12, rings=8)
        b.obj(nm, body, (s * sx, 0, sz))


# ===================================================================== 1. robo
@model
def ch_robo():
    """Round little robot: barrel body, screen face, antenna."""
    common()
    M('Paint', '#4fb6ff', rough=0.45)
    M('Paint2', '#ffffff', rough=0.5)
    M('Face', '#1e2440', rough=0.25)
    M('Glow', '#7dfcff', emit=1.6)
    M('Glow2', '#ff6b6b', emit=1.4)
    M('Glow3', '#ffe45c', emit=1.4)
    root = empty('ch_robo')
    hip = 0.30
    b = B()
    b.lathe([(0.15, 0.0), (0.24, 0.06), (0.27, 0.22), (0.25, 0.37), (0.17, 0.46)], mat='Paint', seg=20, cap0=True, cap1=True)
    b.lathe([(0.262, 0.1), (0.278, 0.13), (0.262, 0.16)], mat='Paint2', seg=20)
    b.box((0.22, 0.04, 0.13), loc=(0, 0.245, 0.29), mat='Face', bevel=0.02, seg=2)
    for i, m in enumerate(('Glow2', 'Glow3', 'Glow')):
        b.sphere(0.022, loc=(-0.06 + i * 0.06, 0.268, 0.29), mat=m, seg=8, rings=6)
    b.cyl(0.07, 0.07, loc=(0, 0, 0.48), mat='Metal', seg=12)
    body = b.obj('Body', root, (0, 0, hip))
    h = B()
    h.box((0.52, 0.42, 0.38), loc=(0, 0, 0.2), mat='Paint', bevel=0.11, seg=5, smooth=True)
    h.box((0.4, 0.05, 0.25), loc=(0, 0.195, 0.2), mat='Face', bevel=0.055, seg=4, smooth=True)
    for s in (-1, 1):
        h.sphere(0.047, loc=(s * 0.095, 0.222, 0.225), scale=(1, 0.35, 1.45), mat='Glow', seg=12, rings=8)
        h.cyl(0.065, 0.05, loc=(s * 0.27, 0, 0.2), rot=(0, PI / 2, 0), mat='Paint2', seg=14)
        h.cyl(0.03, 0.03, loc=(s * 0.3, 0, 0.2), rot=(0, PI / 2, 0), mat='Metal', seg=10)
    smile(h, 0.225, 0.135, w=0.05, d=0.025, mat='Glow', r=0.01)
    h.cyl(0.013, 0.14, loc=(0, 0, 0.45), mat='Metal', seg=8)
    h.sphere(0.047, loc=(0, 0, 0.54), mat='Glow2', seg=12, rings=8)
    h.obj('Head', body, (0, 0, 0.5))
    arms(body, 'Metal', 'Paint2', 0.25, 0.36)
    legs(root, 'Metal', 'Paint2', hip=hip)


# ===================================================================== 2. plug (RJ45)
WIRES = ('#ffd9b0', '#ff8a2a', '#c9f0c4', '#3f7dff', '#cfe0ff', '#3fb84f', '#e6cdb8', '#8a5a3c')   # T568B order


@model
def ch_plug():
    """Network plug: clear RJ45 head with gold contacts and the eight wire colours, cable boot body, cable tail."""
    common()
    M('Paint', '#ff7a59', rough=0.5)
    M('Paint2', '#ffd9cf', rough=0.5)
    M('Crystal', '#e4f3fb', rough=0.2)
    M('Crystal2', '#bfdcee', rough=0.2)
    M('Gold', '#f2c744', rough=0.3, metal=0.7)
    for i, c in enumerate(WIRES):
        M('Wire%d' % i, c)
    root = empty('ch_plug')
    hip = 0.28
    b = B()
    b.lathe([(0.13, 0.0), (0.21, 0.05), (0.23, 0.2), (0.2, 0.36), (0.17, 0.44)], mat='Paint', seg=20, cap0=True, cap1=True)
    for z in (0.1, 0.19, 0.28):
        b.lathe([(0.2, z - 0.025), (0.245, z), (0.2, z + 0.025)], mat='Paint2', seg=20)
    b.tube([(0, -0.16, 0.1), (0, -0.33, 0.05), (0, -0.43, 0.14), (0, -0.38, 0.27), (0, -0.46, 0.38)], 0.036, 'Paint', seg=8)
    body = b.obj('Body', root, (0, 0, hip))
    h = B()
    h.box((0.48, 0.42, 0.44), loc=(0, 0, 0.22), mat='Crystal', bevel=0.06, seg=4, smooth=True)
    for i in range(8):
        x = 0.1575 - i * 0.045   # pin 1 on the viewer's left
        h.box((0.028, 0.2, 0.03), loc=(x, 0.1, 0.44), mat='Gold', bevel=0.006)
        h.box((0.034, 0.02, 0.05), loc=(x, 0.212, 0.375), mat='Wire%d' % i, bevel=0.006)
    h.box((0.18, 0.34, 0.035), loc=(0, -0.09, 0.485), rot=(-0.22, 0, 0), mat='Crystal2', bevel=0.012)   # latch clip
    h.box((0.18, 0.05, 0.07), loc=(0, -0.24, 0.5), mat='Crystal2', bevel=0.012)
    eyes(h, 0.212, 0.22, dx=0.115, r=0.08)
    smile(h, 0.218, 0.12, w=0.06, d=0.03)
    cheeks(h, 0.212, 0.13, dx=0.18)
    h.obj('Head', body, (0, 0, 0.44))
    arms(body, 'Paint', 'Paint2', 0.21, 0.34)
    legs(root, 'Paint', 'Paint2', hip=hip)


# ===================================================================== 3. bit (binary cube)
@model
def ch_bit():
    """Binary cube: a big rounded cube with a face, '1' on one side and '0' on the other, pixel tuft on top."""
    common()
    M('Paint', '#8b6cf6', rough=0.5)
    M('Paint2', '#ffe45c', rough=0.5)
    root = empty('ch_bit')
    hip = 0.26
    b = B()
    b.box((0.64, 0.56, 0.62), loc=(0, 0, 0.33), mat='Paint', bevel=0.1, seg=5, smooth=True)
    eyes(b, 0.282, 0.38, dx=0.14, r=0.09)
    smile(b, 0.288, 0.25, w=0.08, d=0.04)
    cheeks(b, 0.282, 0.27, dx=0.23, r=0.045)
    rx = Matrix.Rotation(PI / 2, 4, 'X')
    b.merge(glyph_bm('1', 0.4, 0.03), 'Paint2', matrix=T((0.322, 0, 0.33)) @ Matrix.Rotation(PI / 2, 4, 'Z') @ rx)
    b.merge(glyph_bm('0', 0.4, 0.03), 'Paint2', matrix=T((-0.322, 0, 0.33)) @ Matrix.Rotation(-PI / 2, 4, 'Z') @ rx)
    body = b.obj('Body', root, (0, 0, hip))
    h = B()   # pixel tuft (the "head" node of this figure)
    for (x, z, s) in ((-0.07, 0.0, 0.07), (0.0, 0.0, 0.07), (0.07, 0.0, 0.07), (0.0, 0.07, 0.07), (0.07, 0.07, 0.07), (0.07, 0.14, 0.07)):
        h.box((s, s, s), loc=(x, 0, z + 0.035), mat='Paint2', bevel=0.01)
    h.obj('Head', body, (0, 0, 0.635))
    arms(body, 'Dark', 'Paint2', 0.33, 0.3, length=0.2)
    legs(root, 'Dark', 'Paint2', dx=0.15, hip=hip)


# ===================================================================== 4. wave (wireless router bunny)
@model
def ch_wave():
    """Wireless: wide soft head with two antenna ears, LED row, signal arcs on the belly."""
    common()
    M('Paint', '#3ed6a3', rough=0.55)
    M('Paint2', '#ffffff', rough=0.5)
    M('Glow', '#b6ff6a', emit=1.5)
    root = empty('ch_wave')
    hip = 0.28
    b = B()
    b.lathe([(0.12, 0.0), (0.22, 0.07), (0.245, 0.2), (0.2, 0.34), (0.12, 0.42)], mat='Paint', seg=20, cap0=True, cap1=True)
    for k, (w, z) in enumerate(((0.03, 0.13), (0.07, 0.17), (0.11, 0.21))):   # signal arcs
        pts = []
        for i in range(9):
            a = PI * (0.25 + 0.5 * i / 8)
            x = math.cos(a) * w * 1.6
            pts.append((x, math.sqrt(max(0.0, 0.25 ** 2 - x * x)) - 0.004, z + math.sin(a) * w * 0.9))
        b.tube(pts, 0.014, 'Paint2', seg=6)
    b.sphere(0.02, loc=(0, 0.245, 0.14), mat='Paint2', seg=8, rings=6)
    b.sphere(0.07, loc=(0, -0.24, 0.12), mat='Paint2', seg=10, rings=7)   # tail
    body = b.obj('Body', root, (0, 0, hip))
    h = B()
    sx, sy, sz, r, cz = 1.14, 0.92, 0.84, 0.3, 0.23
    h.sphere(r, loc=(0, 0, cz), scale=(sx, sy, sz), mat='Paint', seg=22, rings=14)

    def surf(x, z):
        return r * sy * math.sqrt(max(0.0, 1 - (x / (r * sx)) ** 2 - ((z - cz) / (r * sz)) ** 2))
    for s in (-1, 1):
        h.tube([(s * 0.15, -0.02, 0.42), (s * 0.2, -0.03, 0.62), (s * 0.23, -0.03, 0.82)], 0.036, 'Dark', seg=8)
        h.sphere(0.05, loc=(s * 0.235, -0.03, 0.85), mat='Glow', seg=10, rings=7)
        h.cyl(0.055, 0.04, loc=(s * 0.145, -0.02, 0.43), mat='Dark', seg=10)
    for i in range(4):
        x = -0.075 + i * 0.05
        h.sphere(0.017, loc=(x, surf(x, 0.385), 0.385), mat='Glow', seg=8, rings=6)
    eyes(h, surf(0.125, 0.25) - 0.012, 0.25, dx=0.125, r=0.082)
    smile(h, surf(0, 0.14) + 0.016, 0.15, w=0.065, d=0.032, curve=0.012)
    cheeks(h, surf(0.21, 0.15) - 0.006, 0.15, dx=0.21)
    h.obj('Head', body, (0, 0, 0.4))
    arms(body, 'Paint', 'Paint2', 0.22, 0.32)
    legs(root, 'Paint', 'Paint2', hip=hip)


# ===================================================================== 5. fibra (optical fibre)
@model
def ch_fibra():
    """Optical fibre: glass-light head with a fountain of glowing fibre strands, striped slim body."""
    common()
    M('Paint', '#19b8c9', rough=0.5)
    M('Paint2', '#ffd23f', rough=0.5)
    M('Bulb', '#fff3cf', rough=0.25)
    M('Fiber', '#c9f6ff', rough=0.3)
    M('Glow', '#7dfcff', emit=1.8)
    M('Glow2', '#ff8ad8', emit=1.8)
    root = empty('ch_fibra')
    hip = 0.30
    b = B()
    prof = [(0.1, 0.0), (0.17, 0.05), (0.195, 0.13), (0.195, 0.2), (0.185, 0.27), (0.16, 0.36), (0.1, 0.43)]
    b.lathe(prof, mats=['Paint', 'Paint', 'Paint2', 'Paint', 'Paint2', 'Paint'], seg=20, cap0=True, cap1=True)
    body = b.obj('Body', root, (0, 0, hip))
    h = B()
    h.sphere(0.27, loc=(0, 0, 0.25), scale=(1, 0.95, 1), mat='Bulb', seg=22, rings=14)
    h.cyl(0.07, 0.05, loc=(0, 0, 0.515), mat='Paint2', seg=12)
    n = 14
    for k in range(n):
        a = TAU * k / n + 0.2
        tilt = 0.75 if k % 2 else 1.0
        d = Vector((math.cos(a), math.sin(a) * 0.9 - 0.15, 0))
        top = Vector((0, 0, 0.53))
        pts = [top, top + d * 0.06 * tilt + Vector((0, 0, 0.14)), top + d * 0.17 * tilt + Vector((0, 0, 0.2)),
               top + d * 0.29 * tilt + Vector((0, 0, 0.14)), top + d * 0.35 * tilt + Vector((0, 0, 0.03))]
        h.tube(pts, 0.011, 'Fiber', seg=5)
        h.sphere(0.024, loc=pts[-1], mat='Glow' if k % 3 else 'Glow2', seg=8, rings=6)

    def surf(x, z):
        return 0.27 * 0.95 * math.sqrt(max(0.0, 1 - (x / 0.27) ** 2 - ((z - 0.25) / 0.27) ** 2))
    eyes(h, surf(0.11, 0.27) - 0.012, 0.27, dx=0.11, r=0.08)
    smile(h, surf(0, 0.16) + 0.016, 0.17, w=0.06, d=0.03, curve=0.01)
    cheeks(h, surf(0.19, 0.17) - 0.006, 0.17, dx=0.19)
    h.obj('Head', body, (0, 0, 0.42))
    arms(body, 'Paint', 'Bulb', 0.18, 0.34)
    legs(root, 'Paint', 'Paint2', dx=0.11, hip=hip)


# ===================================================================== 6. coil (copper cable spool)
@model
def ch_coil():
    """Copper cable: a cable spool body, round head with a safety helmet."""
    common()
    M('Paint', '#ff9f2e', rough=0.5)
    M('Paint2', '#ffe45c', rough=0.45)
    M('Wood', '#c98f55', rough=0.8)
    M('Cream', '#ffe6c2', rough=0.6)
    M('Copper', '#e2793a', rough=0.3, metal=0.6)
    root = empty('ch_coil')
    hip = 0.28
    b = B()
    b.cyl(0.27, 0.05, loc=(0, 0, 0.025), mat='Wood', seg=22)
    b.cyl(0.27, 0.05, loc=(0, 0, 0.405), mat='Wood', seg=22)
    prof = []
    nz = 7
    for k in range(nz):
        z0 = 0.05 + k * (0.33 / nz)
        prof += [(0.2, z0), (0.232, z0 + 0.33 / nz / 2)]
    prof.append((0.2, 0.38))
    b.lathe(prof, mat='Paint', seg=22)
    b.tube([(0.2, 0.12, 0.36), (0.3, 0.14, 0.33), (0.33, 0.1, 0.22)], 0.028, 'Paint', seg=7)   # loose cable end
    b.cyl(0.016, 0.05, loc=(0.33, 0.1, 0.2), mat='Copper', seg=8)
    body = b.obj('Body', root, (0, 0, hip))
    h = B()
    R, cz = 0.265, 0.25
    h.sphere(R, loc=(0, 0, cz), mat='Cream', seg=22, rings=14)
    h.sphere(R + 0.02, loc=(0, 0, cz), mat='Paint2', seg=22, rings=14, cut=0.28)   # helmet
    h.cyl(R + 0.045, 0.03, loc=(0, 0.05, cz + 0.085), mat='Paint2', seg=22, scale=(1, 1.12, 1))
    h.box((0.07, 0.4, 0.05), loc=(0, 0, cz + R + 0.0), mat='Paint2', bevel=0.02, seg=2)

    def surf(x, z):
        return math.sqrt(max(0.0, R * R - x * x - (z - cz) ** 2))
    eyes(h, surf(0.105, 0.22) - 0.012, 0.215, dx=0.105, r=0.075)
    smile(h, surf(0, 0.11) + 0.016, 0.125, w=0.06, d=0.03, curve=0.01)
    cheeks(h, surf(0.18, 0.12) - 0.006, 0.125, dx=0.18)
    h.obj('Head', body, (0, 0, 0.43))
    arms(body, 'Cream', 'Cream', 0.24, 0.36)
    legs(root, 'Dark', 'Paint2', hip=hip)


def preview_model(name):
    toonify(0.012)
    preview_scene(sky='#ffe9f3', ground='#ffd0e4', ground_size=6)
    bpy.data.objects['_groundplane'].hide_render = False
    frame_cam(res=(520, 620), yaw=24, elev=8, margin=0.8, lens=60)
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
