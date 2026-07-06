import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../palette';

// ── HANGING HUJRA LANTERNS ─────────────────────────────────────────────
// Small Central-Asian brass lanterns hung in the dark hujra (student-cell)
// niches. The warm amber "glass" core is a full-bright basic material so the
// UnrealBloomPass (threshold 0.90) makes each one glow; the niche back wall
// behind it carries a soft emissive light-pool so the recess reads as LIT, not
// a black void. All parts are merged per facade → ~3 cheap draw calls total.

// Shared radial-gradient glow sprite (built once at module load, 128×128):
// white-hot center → saturated amber → transparent edge. Used as `map` on the
// additive POOL/HALO planes so the glow reads as a round, feathered lamp-light
// with no rectangular edges from any orbit angle.
function makeGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,    'rgba(255,244,214,1)');
  grad.addColorStop(0.25, 'rgba(255,200,110,0.85)');
  grad.addColorStop(0.6,  'rgba(255,150,60,0.35)');
  grad.addColorStop(1,    'rgba(255,120,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const GLOW = makeGlowTexture();

const GLASS = new THREE.MeshBasicMaterial({ color: 0xfff2d8 });        // small hot core → blooms; amber comes from GLOW halo
const FRAME = new THREE.MeshLambertMaterial({ color: 0x8a6a2e });      // dark brass cage
const POOL  = new THREE.MeshBasicMaterial({                            // warm glow pool washing the back wall
  map: GLOW, transparent: true, opacity: 0.6,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const POOL2 = new THREE.MeshBasicMaterial({                            // faint tall wash bleeding up into the soffit
  map: GLOW, transparent: true, opacity: 0.28,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const HALO  = new THREE.MeshBasicMaterial({                            // round face-on glow around each lamp
  map: GLOW, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});

export interface LanternSite { x: number; y: number; z: number; }

/**
 * Build a merged group of hanging lanterns at the given niche sites.
 * `back` is the z of the niche back wall (light-pool is pinned a hair proud of it).
 * `scale` lets each facade size lanterns to its bay width.
 */
export function lanternRow(sites: LanternSite[], back: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  if (!sites.length) return g;

  const frameGeos: THREE.BufferGeometry[] = [];
  const glassGeos: THREE.BufferGeometry[] = [];
  const poolGeos:  THREE.BufferGeometry[] = [];
  const pool2Geos: THREE.BufferGeometry[] = [];
  const haloGeos:  THREE.BufferGeometry[] = [];
  const _m = new THREE.Matrix4();

  const bodyR = 0.085 * scale;
  const bodyH = 0.20 * scale;
  const rodH  = 0.34 * scale;   // hangs down from arch crown

  for (const s of sites) {
    // Suspension rod (brass)
    const rod = new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, rodH, 4);
    rod.applyMatrix4(_m.makeTranslation(s.x, s.y + bodyH / 2 + rodH / 2, s.z));
    frameGeos.push(rod);

    // Cage cap + base rings (brass)
    const cap = new THREE.CylinderGeometry(bodyR * 1.15, bodyR * 0.5, 0.06 * scale, 8);
    cap.applyMatrix4(_m.makeTranslation(s.x, s.y + bodyH / 2 + 0.02 * scale, s.z));
    frameGeos.push(cap);
    const base = new THREE.CylinderGeometry(bodyR * 0.55, bodyR * 1.05, 0.05 * scale, 8);
    base.applyMatrix4(_m.makeTranslation(s.x, s.y - bodyH / 2, s.z));
    frameGeos.push(base);
    // Bottom finial drop
    const finial = new THREE.SphereGeometry(0.03 * scale, 6, 4);
    finial.applyMatrix4(_m.makeTranslation(s.x, s.y - bodyH / 2 - 0.05 * scale, s.z));
    frameGeos.push(finial);

    // Amber glass body — small hot near-white core (8-sided, full-bright → blooms);
    // the surrounding GLOW halo carries the warm amber colour.
    const glass = new THREE.CylinderGeometry(bodyR * 0.6, bodyR * 0.6, bodyH, 8);
    glass.applyMatrix4(_m.makeTranslation(s.x, s.y, s.z));
    glassGeos.push(glass);

    // Warm light-pool washing most of the lower niche back wall (lifted toward
    // the lamp so the radial gradient bleeds up into the arch crown).
    const pool = new THREE.PlaneGeometry(bodyR * 16, bodyH * 10);
    pool.applyMatrix4(_m.makeTranslation(s.x, s.y - bodyH * 0.15, back + 0.012));
    poolGeos.push(pool);

    // Faint tall wash so the arch soffit/return catches a warm rim
    const pool2 = new THREE.PlaneGeometry(bodyR * 6, bodyH * 9);
    pool2.applyMatrix4(_m.makeTranslation(s.x, s.y + bodyH * 1.2, back + 0.013));
    pool2Geos.push(pool2);

    // Round face-on halo hugging the lamp (reads as glow from any orbit angle)
    const halo = new THREE.PlaneGeometry(bodyR * 7, bodyR * 7);
    halo.applyMatrix4(_m.makeTranslation(s.x, s.y, s.z + 0.02));
    haloGeos.push(halo);
  }

  const addBin = (bin: THREE.BufferGeometry[], material: THREE.Material) => {
    const merged = mergeGeometries(bin, false);
    bin.forEach(b => b.dispose());
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = false; mesh.receiveShadow = false;
    g.add(mesh);
  };
  addBin(poolGeos,  POOL);   // draw pool first (additive, no depth write)
  addBin(pool2Geos, POOL2);
  addBin(haloGeos,  HALO);
  addBin(frameGeos, FRAME);
  addBin(glassGeos, GLASS);

  return g;
}

void C; // palette kept in scope for future tuning
