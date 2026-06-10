import * as THREE from 'three';
import { Grid, isWalkable } from './world/grid';
import { worldToTile } from './world/coords';
import { Character } from './character/character';

export function bindTapToMove(
  renderer: THREE.WebGLRenderer, camera: THREE.Camera, ground: THREE.Mesh,
  grid: Grid, ch: Character,
) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = 0;
  renderer.domElement.addEventListener('pointerdown', () => { downAt = performance.now(); });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (performance.now() - downAt > 300) return; // drag/hold, not a tap
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(ground, false)[0];
    if (!hit) return;
    const t = worldToTile(grid.cols, grid.rows, { x: hit.point.x, z: hit.point.z });
    if (isWalkable(grid, t.x, t.y)) ch.walkTo(t);
  });
}
