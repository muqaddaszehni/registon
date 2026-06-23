import * as THREE from 'three';
import { Grid, Pt, hotspotAt } from './world/grid';
import { tileToWorld } from './world/coords';
import { C } from './palette';

export function hotspotForTile(g: Grid, t: Pt): number | undefined {
  return hotspotAt(g, t.x, t.y);
}

/** Radial-gradient sprite (white centre → transparent edge) for a soft glow. */
function makeGlowTexture(): THREE.CanvasTexture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Glowing star tiles; returns a tick function that pulses them. */
export function addHotspotMarkers(scene: THREE.Scene, grid: Grid): (dt: number) => void {
  const mats: THREE.MeshLambertMaterial[] = [];
  // Soft "tap here" halo on THE REGISTAN hotspot (id 7) — a turquoise additive
  // glow pool that breathes, signalling the scene is interactive.
  let glowMat: THREE.MeshBasicMaterial | null = null;
  const GLOW_TURQUOISE = 0x37d2e0;
  for (const [id, tile] of grid.hotspots) {
    const w = tileToWorld(grid.cols, grid.rows, tile);
    const m = new THREE.MeshLambertMaterial({
      color: C.gold, emissive: C.gold, emissiveIntensity: 0.5,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const marker = new THREE.Mesh(new THREE.CircleGeometry(0.42, 8), m); // 8-gon ~ star tile
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(w.x, 0.08, w.z);
    scene.add(marker);
    mats.push(m);

    if (id === 7) {
      // Soft radial-gradient glow pool (bright centre → transparent edge).
      const glowTex = makeGlowTexture();
      glowMat = new THREE.MeshBasicMaterial({
        map: glowTex, color: GLOW_TURQUOISE, transparent: true, opacity: 0.0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(w.x, 0.065, w.z); // soft pool of light around the marker
      glow.renderOrder = -1;
      scene.add(glow);
    }
  }
  let t = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (dt: number) => {
    if (reduced) { if (glowMat) glowMat.opacity = 0.4; return; }
    t += dt;
    const k = 0.35 + 0.3 * (0.5 + Math.sin(t * 2.5) / 2);
    for (const m of mats) m.emissiveIntensity = k;
    // First-tile halo: slow soft breathing (~2.6 s), opacity 0.22–0.62.
    if (glowMat) glowMat.opacity = 0.22 + 0.20 * (1 + Math.sin(t * 2.4));
  };
}
