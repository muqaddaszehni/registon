import * as THREE from 'three';
import { Grid, Pt, hotspotAt } from './world/grid';
import { tileToWorld } from './world/coords';
import { C } from './palette';

export function hotspotForTile(g: Grid, t: Pt): number | undefined {
  return hotspotAt(g, t.x, t.y);
}

/** Glowing star tiles; returns a tick function that pulses them. */
export function addHotspotMarkers(scene: THREE.Scene, grid: Grid): (dt: number) => void {
  const mats: THREE.MeshLambertMaterial[] = [];
  for (const [, tile] of grid.hotspots) {
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
  }
  let t = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const k = 0.35 + 0.3 * (0.5 + Math.sin(t * 2.5) / 2);
    for (const m of mats) m.emissiveIntensity = k;
  };
}
