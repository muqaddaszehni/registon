import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat } from '../buildings/primitives';
import { Grid, isWalkable } from '../world/grid';
import { worldToTile } from '../world/coords';

// Stylized low-poly trees framing the south forecourt axis. The old "trees fall
// inside footprints" note no longer holds: the south forecourt (world x∈[-9,9],
// z∈[+1,+8]) is open '.' tiles. Two archetypes — tall cypress sentinels along
// the flanking edge and rounded deciduous blobs near the entrance. All foliage
// and trunks are merged so the whole grove is a handful of draw calls.

type Kind = 'cypress' | 'decid';
// [worldX, worldZ, kind] — validated against grid.walk before placement.
const TREES: [number, number, Kind][] = [
  [-8.5, 1.5, 'cypress'], [8.5, 1.5, 'cypress'],
  [-8.5, 4.5, 'decid'],   [8.5, 4.5, 'decid'],
  [-8.5, 7.0, 'cypress'], [8.5, 7.0, 'cypress'],
  [-3.0, 8.5, 'decid'],   [3.0, 8.5, 'decid'],
];

// Leaf / wood colours.
const CYPRESS_LEAF = 0x4a6b3a;
const DECID_LEAF_A = 0x6f9050;
const DECID_LEAF_B = 0x5f8044;
const TRUNK        = 0x8a6147;

// Deterministic deciduous blob cluster: [dx, dy, dz, radius, useColorB].
const DECID_BLOBS: [number, number, number, number, boolean][] = [
  [0.0,  1.70, 0.0,  0.85, false],
  [0.55, 1.45, 0.15, 0.70, true],
  [-0.45, 1.50, -0.20, 0.65, false],
];

export function addTrees(scene: THREE.Scene, grid: Grid): (dt: number) => void {
  const cypressFoliage: THREE.BufferGeometry[] = [];
  const decidFoliageA: THREE.BufferGeometry[] = [];
  const decidFoliageB: THREE.BufferGeometry[] = [];
  const trunks: THREE.BufferGeometry[] = [];

  for (const [x, z, kind] of TREES) {
    const t = worldToTile(grid.cols, grid.rows, { x, z });
    if (!isWalkable(grid, t.x, t.y)) continue; // mirror the doves.ts placement guard

    if (kind === 'cypress') {
      // Short trunk stub + a single tall tapered cone of foliage.
      trunks.push(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 8).translate(x, 0.25, z));
      cypressFoliage.push(new THREE.ConeGeometry(0.55, 3.0, 7).translate(x, 1.9, z));
    } else {
      // Slim trunk + 2–3 overlapping icosahedron blobs (two-tone).
      trunks.push(new THREE.CylinderGeometry(0.18, 0.18, 1.3, 8).translate(x, 0.65, z));
      for (const [dx, dy, dz, r, useB] of DECID_BLOBS) {
        const blob = new THREE.IcosahedronGeometry(r, 0).translate(x + dx, dy, z + dz);
        (useB ? decidFoliageB : decidFoliageA).push(blob);
      }
    }
  }

  // Merge per colour → at most 4 draw calls for the whole grove. One shadow
  // caster set (foliage); trunks skip the shadow pass (thin, negligible).
  const addMerged = (geos: THREE.BufferGeometry[], color: number, cast: boolean) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos), mat(color));
    m.castShadow = cast;
    scene.add(m);
  };
  addMerged(cypressFoliage, CYPRESS_LEAF, true);
  addMerged(decidFoliageA, DECID_LEAF_A, true);
  addMerged(decidFoliageB, DECID_LEAF_B, true);
  addMerged(trunks, TRUNK, false);

  return () => {};
}
