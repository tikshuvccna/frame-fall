/** Toon shading helpers: 3-step gradient, inverted-hull outline, text textures. */
import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([150, 140, 170, 255, 215, 210, 225, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

let vcMat: THREE.MeshToonMaterial | null = null;
/** The one shared material: toon with vertex colours. */
export function toonVC(): THREE.MeshToonMaterial {
  if (!vcMat) vcMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  return vcMat;
}

const outlineCache = new Map<number, THREE.MeshBasicMaterial>();
export function outlineMat(thickness = 0.03): THREE.MeshBasicMaterial {
  let m = outlineCache.get(thickness);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: 0x2a2036, side: THREE.BackSide });
  const t = thickness;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * ' + t.toFixed(4) + ';');
  };
  m.customProgramCacheKey = () => 'outline_' + t;
  outlineCache.set(thickness, m);
  return m;
}

export function textTexture(text: string, o: { w?: number; h?: number; bg?: string; fg?: string; border?: string; rtl?: boolean } = {}): THREE.CanvasTexture {
  const w = o.w ?? 512, h = o.h ?? 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = o.bg ?? '#ffffff';
  g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, h * 0.16); g.fill();
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 10; g.stroke(); }
  g.fillStyle = o.fg ?? '#2a2036';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.direction = o.rtl === false ? 'ltr' : 'rtl';
  let size = Math.round(h * 0.6);
  const font = (s: number) => '800 ' + s + 'px "Rubik", "Segoe UI", Arial, sans-serif';
  g.font = font(size);
  while (g.measureText(text).width > w - 50 && size > 14) { size -= 3; g.font = font(size); }
  g.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
