/**
 * Model library. Every GLB is baked once into flat arrays with vertex colours, so a kit piece is one draw call and a
 * character is six (one per body part). 'Paint' and 'Paint2' vertices are recoloured per instance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { outlineMat, toonVC } from './toon';

interface Baked { pos: THREE.BufferAttribute; nor: THREE.BufferAttribute; col: Float32Array; role: Uint8Array }
const ROLE: Record<string, number> = { Paint: 1, Paint2: 2 };
const WHITE = new THREE.Color(1, 1, 1);

function bake(meshes: THREE.Mesh[], inv: THREE.Matrix4 | null): Baked {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], role: number[] = [];
  const m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const mesh of meshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const r = ROLE[(mat.name ?? '').replace(/\.\d+$/, '')] ?? 0;
    const c = mat.color ? mat.color.clone() : WHITE.clone();
    if (mat.emissive && mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.05) c.lerp(WHITE, 0.25);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const p = g.getAttribute('position'), nr = g.getAttribute('normal');
    m4.copy(mesh.matrixWorld);
    if (inv) m4.premultiply(inv);
    n3.getNormalMatrix(m4);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m4);
      n.fromBufferAttribute(nr, i).applyMatrix3(n3).normalize();
      pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); role.push(r);
    }
  }
  return {
    pos: new THREE.BufferAttribute(new Float32Array(pos), 3), nor: new THREE.BufferAttribute(new Float32Array(nor), 3),
    col: new Float32Array(col), role: new Uint8Array(role),
  };
}

function geometry(b: Baked, tint?: THREE.ColorRepresentation, tint2?: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', b.pos);
  g.setAttribute('normal', b.nor);
  let col = b.col;
  if (tint !== undefined || tint2 !== undefined) {
    col = new Float32Array(b.col);
    const t1 = tint !== undefined ? new THREE.Color(tint) : null, t2 = tint2 !== undefined ? new THREE.Color(tint2) : null;
    for (let i = 0; i < b.role.length; i++) {
      const t = b.role[i] === 1 ? t1 : b.role[i] === 2 ? t2 : null;
      if (t) { col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

function meshOf(geo: THREE.BufferGeometry, outline: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, toonVC());
  if (outline > 0) {
    const ol = new THREE.Mesh(geo, outlineMat(outline));
    ol.raycast = () => {};
    m.add(ol);
  }
  return m;
}

const PARTS = ['Body', 'Head', 'ArmL', 'ArmR', 'LegL', 'LegR'] as const;
export type PartName = typeof PARTS[number];
interface CharTpl { parts: { name: PartName; parent: 'root' | 'Body'; pos: THREE.Vector3; baked: Baked }[] }
const kits = new Map<string, { whole: Baked; nodes: Map<string, { baked: Baked; pos: THREE.Vector3 }> }>();
const chars = new Map<string, CharTpl>();

export const CHAR_TYPES = ['ch_robo', 'ch_plug', 'ch_bit', 'ch_wave', 'ch_fibra', 'ch_coil'];
export const KIT_NAMES = ['door_frame', 'door_panel', 'gate_start', 'gate_finish', 'bumper', 'spinner', 'cloud', 'balloon', 'deco_spool', 'deco_plug', 'flag', 'trophy', 'tile_hex', 'tile_sq'];
/** Kit nodes that move on their own (baked apart from the rest of the model). */
const MOVING: Record<string, string[]> = { spinner: ['Bar'] };

const isMesh = (o: THREE.Object3D): o is THREE.Mesh => (o as THREE.Mesh).isMesh === true;

export async function loadModels(onProgress?: (f: number) => void): Promise<void> {
  const loader = new GLTFLoader();
  const all = [...CHAR_TYPES, ...KIT_NAMES];
  let done = 0;
  await Promise.all(all.map(async (name) => {
    const g = await loader.loadAsync('./assets/models/' + name + '.glb');
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    if (name.startsWith('ch_')) {
      const tpl: CharTpl = { parts: [] };
      for (const pn of PARTS) {
        const node = scene.getObjectByName(pn);
        if (!node) throw new Error(name + ': missing ' + pn);
        const meshes = isMesh(node) ? [node] : node.children.filter((c) => isMesh(c) && !(PARTS as readonly string[]).includes(c.name)) as THREE.Mesh[];
        tpl.parts.push({ name: pn, parent: pn === 'Head' || pn.startsWith('Arm') ? 'Body' : 'root', pos: node.position.clone(), baked: bake(meshes, node.matrixWorld.clone().invert()) });
      }
      chars.set(name, tpl);
    } else {
      const moving = MOVING[name] ?? [];
      const nodes = new Map<string, { baked: Baked; pos: THREE.Vector3 }>();
      const taken = new Set<THREE.Object3D>();
      for (const nn of moving) {
        const node = scene.getObjectByName(nn);
        if (!node) continue;
        const ms: THREE.Mesh[] = [];
        node.traverse((o) => { if (isMesh(o)) { ms.push(o); taken.add(o); } });
        nodes.set(nn, { baked: bake(ms, node.matrixWorld.clone().invert()), pos: node.getWorldPosition(new THREE.Vector3()) });
      }
      const rest: THREE.Mesh[] = [];
      scene.traverse((o) => { if (isMesh(o) && !taken.has(o)) rest.push(o); });
      kits.set(name, { whole: bake(rest, null), nodes });
    }
    done++;
    onProgress?.(done / all.length);
  }));
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

/** A static kit piece as one mesh (plus outline). */
export function kit(name: string, tint?: THREE.ColorRepresentation, outline = 0.035): THREE.Mesh {
  const k = kits.get(name);
  if (!k) throw new Error('kit ' + name + ' not loaded');
  return meshOf(cached(name + '|' + String(tint), () => geometry(k.whole, tint)), outline);
}
/** A moving node of a kit piece, placed at its rest position. */
export function kitNode(name: string, node: string, tint?: THREE.ColorRepresentation, outline = 0.035): THREE.Mesh {
  const n = kits.get(name)?.nodes.get(node);
  if (!n) throw new Error('kit node ' + name + '.' + node + ' not loaded');
  const m = meshOf(cached(name + '.' + node + '|' + String(tint), () => geometry(n.baked, tint)), outline);
  m.position.copy(n.pos);
  return m;
}

export interface CharRig { root: THREE.Group; parts: Record<PartName, THREE.Mesh>; rest: Record<PartName, THREE.Vector3> }
export function charRig(type: string, tint?: THREE.ColorRepresentation, tint2?: THREE.ColorRepresentation): CharRig {
  const tpl = chars.get(type);
  if (!tpl) throw new Error('char ' + type + ' not loaded');
  const root = new THREE.Group();
  const parts = {} as Record<PartName, THREE.Mesh>, rest = {} as Record<PartName, THREE.Vector3>;
  for (const p of tpl.parts) {
    const m = meshOf(cached(type + '.' + p.name + '|' + String(tint) + '|' + String(tint2), () => geometry(p.baked, tint, tint2)), 0.02);
    m.position.copy(p.pos);
    parts[p.name] = m; rest[p.name] = p.pos.clone();
  }
  for (const p of tpl.parts) (p.parent === 'Body' ? parts.Body : root).add(parts[p.name]);
  return { root, parts, rest };
}
