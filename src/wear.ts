/**
 * Things a runner can wear on its head, built from simple shapes in the same toon style as the models.
 * The face of every character looks toward -Z (Blender +Y), so glasses sit on the -Z side of the head.
 */
import * as THREE from 'three';
import { outlineMat, toonGradient } from './toon';

const mats = new Map<string, THREE.MeshToonMaterial>();
function mat(c: string): THREE.MeshToonMaterial {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonGradient() }); mats.set(c, m); }
  return m;
}
function part(g: THREE.BufferGeometry, c: string, x = 0, y = 0, z = 0, ol = 0.02): THREE.Mesh {
  const m = new THREE.Mesh(g, mat(c));
  m.position.set(x, y, z);
  if (ol > 0) m.add(new THREE.Mesh(g, outlineMat(ol)));
  return m;
}

export const HATS: Record<string, string> = {
  cap: 'מצחייה', party: 'כובע מסיבה', phones: 'אוזניות', antenna: 'אנטנה', shades: 'משקפי שמש',
  tophat: 'מגבעת', propeller: 'כובע מדחף', flower: 'פרח', crown: 'כתר', halo: 'הילה', star: 'כוכב',
};

/** Build a hat for a head mesh. The returned group is already placed on the head. */
/** `topY` overrides the top of the head (for heads with antennae or fibres above the skull). */
export function makeHat(id: string, head: THREE.Mesh, tint = '#ff6b6b', topY?: number): THREE.Group | null {
  const g = head.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox as THREE.Box3;
  const w = bb.max.x - bb.min.x, top = topY ?? bb.max.y, cx = (bb.max.x + bb.min.x) / 2, cz = (bb.max.z + bb.min.z) / 2;
  const s = THREE.MathUtils.clamp(w / 0.5, 0.6, 1.6);          // hats are drawn for a head 0.5 m wide
  const o = new THREE.Group();
  o.position.set(cx, top - 0.02 * s, cz);
  o.scale.setScalar(s);
  const front = bb.min.z - cz;                                  // the face side (negative)
  switch (id) {
    case 'cap': {
      o.add(part(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), tint, 0, -0.02, 0));
      const v = part(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 18, 1, false, Math.PI / 2, Math.PI), tint, 0, -0.01, -0.06);
      v.scale.set(1, 1, 1.2);
      o.add(v);
      o.add(part(new THREE.SphereGeometry(0.035, 8, 6), '#ffffff', 0, 0.18, 0, 0.012));
      break;
    }
    case 'party': {
      const c = part(new THREE.ConeGeometry(0.13, 0.36, 16), tint, 0, 0.16, 0);
      c.rotation.z = 0.15;
      o.add(c);
      o.add(part(new THREE.SphereGeometry(0.05, 10, 8), '#ffd23f', -0.03, 0.35, 0, 0.012));
      o.add(part(new THREE.TorusGeometry(0.1, 0.02, 6, 16).rotateX(Math.PI / 2), '#ffffff', 0, 0.06, 0, 0));
      break;
    }
    case 'phones': {
      o.add(part(new THREE.TorusGeometry(0.27, 0.03, 8, 20, Math.PI), '#2a2036', 0, -0.14, 0, 0.012));
      for (const sx of [-1, 1]) o.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 16).rotateZ(Math.PI / 2), tint, sx * 0.28, -0.16, 0));
      o.position.y -= 0.06 * s;
      break;
    }
    case 'antenna': {
      o.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), '#2a2036', 0.06, 0.13, 0, 0.008));
      o.add(part(new THREE.SphereGeometry(0.065, 12, 8), tint, 0.06, 0.3, 0, 0.015));
      o.add(part(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c8c3d6', 0.06, -0.01, 0, 0.012));
      break;
    }
    case 'shades': {
      o.position.y = (top + bb.min.y) / 2 + (top - bb.min.y) * 0.12;
      o.position.z = cz + front - 0.01;
      for (const sx of [-1, 1]) o.add(part(new THREE.BoxGeometry(0.15, 0.09, 0.03), '#2a2036', sx * 0.1, 0, 0, 0.01));
      o.add(part(new THREE.BoxGeometry(0.06, 0.02, 0.02), '#2a2036', 0, 0.02, 0, 0));
      for (const sx of [-1, 1]) o.add(part(new THREE.BoxGeometry(0.04, 0.025, 0.03), tint, sx * 0.13, 0.025, -0.02, 0));
      break;
    }
    case 'tophat': {
      o.add(part(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 20), '#2a2036', 0, 0, 0, 0.012));
      o.add(part(new THREE.CylinderGeometry(0.17, 0.18, 0.3, 20), '#3a3150', 0, 0.16, 0));
      o.add(part(new THREE.CylinderGeometry(0.185, 0.185, 0.06, 20), tint, 0, 0.05, 0, 0));
      break;
    }
    case 'propeller': {
      o.add(part(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#ffd23f', 0, -0.03, 0));
      o.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6), '#2a2036', 0, 0.21, 0, 0));
      const p = new THREE.Group();
      p.position.y = 0.27;
      p.add(part(new THREE.BoxGeometry(0.42, 0.015, 0.06), tint, 0, 0, 0, 0.01));
      p.add(part(new THREE.BoxGeometry(0.06, 0.015, 0.42), '#6fd3ff', 0, 0, 0, 0.01));
      o.add(p);
      o.userData.spin = p;
      break;
    }
    case 'flower': {
      const f = new THREE.Group();
      f.position.set(0.14, 0.04, 0);
      f.rotation.z = -0.5;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const pe = part(new THREE.SphereGeometry(0.06, 10, 8), tint, Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07, 0.01);
        pe.scale.set(1, 0.5, 1);
        f.add(pe);
      }
      f.add(part(new THREE.SphereGeometry(0.045, 10, 8), '#ffd23f', 0, 0.05, 0, 0.01));
      o.add(f);
      break;
    }
    case 'crown': {
      o.add(part(new THREE.CylinderGeometry(0.17, 0.16, 0.1, 16, 1, true), '#ffcc33', 0, 0.04, 0));
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        o.add(part(new THREE.ConeGeometry(0.05, 0.12, 6), '#ffcc33', Math.cos(a) * 0.15, 0.14, Math.sin(a) * 0.15, 0.01));
        o.add(part(new THREE.SphereGeometry(0.025, 8, 6), k % 2 ? '#ff6b9d' : '#6fd3ff', Math.cos(a) * 0.17, 0.05, Math.sin(a) * 0.17, 0));
      }
      break;
    }
    case 'halo': {
      const h = part(new THREE.TorusGeometry(0.17, 0.035, 8, 28).rotateX(Math.PI / 2), '#fff1a0', 0, 0.16, 0, 0.012);
      (h.material as THREE.MeshToonMaterial).emissive = new THREE.Color('#ffcc33');
      o.add(h);
      o.userData.bob = h;
      break;
    }
    case 'star': {
      o.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), '#2a2036', 0, 0.1, 0, 0));
      const shape = new THREE.Shape();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? 0.05 : 0.12;
        if (k === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const st = part(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025), tint === '#ff6b6b' ? '#ffd23f' : tint, 0, 0.27, 0, 0.012);
      o.add(st);
      o.userData.spin = st;
      break;
    }
    default: return null;
  }
  head.add(o);
  return o;
}
