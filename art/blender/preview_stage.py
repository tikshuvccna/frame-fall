"""Composed preview: a Door Dash course in the sky with the six characters running.
blender -b --python art/blender/preview_stage.py"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from prlib import *   # noqa

reset()
random.seed(4)


def G(n, loc, rz=0.0, tint=None, scale=None):
    new = import_glb(os.path.join(MODELS, n + '.glb'), loc=loc, rotz=rz)
    for o in new:
        if scale and o.parent is None:
            o.scale = (scale, scale, scale)
        if tint and o.type == 'MESH':
            for sl in o.material_slots:
                if sl.material and sl.material.name.split('.')[0] == 'Paint':
                    m = sl.material.copy()
                    m['hex'] = tint
                    sl.material = m
    return new


# floor: 5 tiles wide (20 m), 15 long
for j in range(-2, 14):
    for i in range(-2, 3):
        G('floor_tile' if (i + j) % 2 == 0 else 'floor_tile_b', (i * 4, j * 4, 0))
DOOR = ['#5ac8fa', '#ff8fb8', '#ffd23f', '#8be37d', '#b79cff']
for row, y in enumerate((14, 30)):
    for k in range(5):
        x = (k - 2) * 4
        G('door_frame', (x, y, 0))
        if not (row == 0 and k == 3):
            G('door_panel', (x, y, 0), tint=DOOR[(k + row) % 5])
G('gate_start', (0, -7, 0))
G('gate_finish', (0, 50, 0))
G('spinner', (0, 22, 0))
for (x, y, c) in ((-6, 21, '#ff8fb8'), (6, 23, '#ffd23f'), (-3, 38, '#8be37d'), (4, 40, '#5ac8fa')):
    G('bumper', (x, y, 0), tint=c)
for s in (-1, 1):
    for k in range(5):
        G('flag', (s * 10.4, -4 + k * 12, 0), tint=DOOR[k])
G('deco_spool', (-22, 26, -1))
G('deco_plug', (21, 34, -3))
G('deco_spool', (26, 70, 6))
for (x, y, z, s) in ((-30, 60, 4, 1.6), (34, 90, 14, 2.2), (-12, 120, 22, 2.6), (-40, 20, -8, 1.3), (30, 8, -10, 1.2), (8, 150, 30, 3.0)):
    G('cloud', (x, y, z), scale=s)
for (x, y, z, c) in ((-14, 12, 3, '#ff8fb8'), (15, 18, 5, '#ffd23f'), (-17, 44, 8, '#5ac8fa'), (13, 52, 10, '#b79cff')):
    G('balloon', (x, y, z), tint=c)
runners = [('ch_robo', -1.2, 3.0), ('ch_plug', 1.6, 4.6), ('ch_bit', -4.4, 5.6), ('ch_wave', 4.6, 2.6), ('ch_fibra', -2.6, 8.0),
           ('ch_coil', 2.2, 8.6), ('ch_robo', 6.2, 7.4), ('ch_wave', -6.6, 9.4), ('ch_plug', 0.2, 11.0)]
TINT = [None, None, None, None, None, None, '#ff7ac8', '#ffb347', '#6fd3ff']
for k, (n, x, y) in enumerate(runners):
    new = G(n, (x, y, 0), rz=random.uniform(-0.25, 0.25), tint=TINT[k])
    ph = random.uniform(0, 6.28)
    for o in new:   # a running pose
        base = o.name.split('.')[0]
        if base == 'LegL':
            o.rotation_euler.x = math.sin(ph) * 0.8
        elif base == 'LegR':
            o.rotation_euler.x = -math.sin(ph) * 0.8
        elif base == 'ArmL':
            o.rotation_euler.x = -math.sin(ph) * 1.0
            o.rotation_euler.y = -0.5
        elif base == 'ArmR':
            o.rotation_euler.x = math.sin(ph) * 1.0
            o.rotation_euler.y = 0.5
        elif base == 'Body':
            o.rotation_euler.x = -0.16
            o.location.z += abs(math.cos(ph)) * 0.08
toonify(0.022)
preview_scene(sky='#aee0ff', energy=3.4)
camera((3.5, -4.5, 4.2), (0, 14, 1.6), lens=24, res=(1280, 720))
render(os.path.join(ROOT, 'art', 'preview_stage.png'))
camera((1.4, 13.4, 1.5), (-0.6, 7.0, 0.85), lens=30, res=(1280, 720))
render(os.path.join(ROOT, 'art', 'preview_close.png'))
