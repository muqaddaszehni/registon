import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// Garden beds at deterministic blocked-tile positions near south entrance,
// visible from the player's starting view. Positions checked against LAYOUT
// (row 19, cols 6-8 = SW; cols 20-22 = SE — blocked tiles adjacent to plaza).

// World coords: tile col c → worldX = c - 14 + 0.5, tile row r → worldZ = r - 11 + 0.5
// SW: col 7, row 19 → world (-6.5, 8.5); SE: col 21, row 19 → world (7.5, 8.5)
const BED_SPOTS: [number, number, number, number][] = [
  // [worldX, worldZ, widthX, depthZ]
  [-6.5, 8.5, 2.0, 1.0], // SW garden bed
  [ 7.5, 8.5, 2.0, 1.0], // SE garden bed
  // A third smaller bed near north-ish: row 3, col 3 and col 22 (blocked corners)
  [-10.5, -7.5, 1.0, 1.0], // NW corner bed (blocked near UB north wall)
];

// Flower positions relative to bed center [dx, dz] — deterministic
const FLOWER_OFFSETS: [number, number][] = [
  [-0.6, -0.2], [0.0, 0.1], [0.6, -0.15],
  [-0.3, 0.3],  [0.35, 0.3],
];

const FLOWER_COLORS = [C.terracotta, 0xe87050, 0xd94f80, C.terracotta, 0xe87050];

// Bench spots: [worldX, worldZ] — walkable tiles adjacent to garden beds
// SW bench: near (-6.5, 8.5) garden, on walkable side row 18 col 7 → world (-6.5, 7.5)
// SE bench: near (7.5, 8.5) garden, on walkable side row 18 col 21 → world (7.5, 7.5)
const BENCH_SPOTS: [number, number][] = [
  [-6.5, 7.5],
  [ 7.5, 7.5],
];

export function addGardens(scene: THREE.Scene): void {
  const borderMat = mat(C.marble);
  const soilMat   = mat(0x8aaf6a); // leaf-green top
  const flowerMat = FLOWER_COLORS.map(c => mat(c));

  for (const [bx, bz, bw, bd] of BED_SPOTS) {
    const group = new THREE.Group();

    // Outer border (marble lip)
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(bw + 0.2, 0.18, bd + 0.2),
      borderMat,
    );
    border.position.y = 0.09;
    group.add(border);

    // Inner soil/green top
    const soil = new THREE.Mesh(
      new THREE.BoxGeometry(bw - 0.1, 0.05, bd - 0.1),
      soilMat,
    );
    soil.position.y = 0.175;
    group.add(soil);

    // Flowers — tiny cones on top
    for (let i = 0; i < FLOWER_OFFSETS.length; i++) {
      const [dx, dz] = FLOWER_OFFSETS[i];
      if (Math.abs(dx) < bw / 2 - 0.05 && Math.abs(dz) < bd / 2 - 0.05) {
        const flower = new THREE.Mesh(
          new THREE.ConeGeometry(0.08, 0.14, 5),
          flowerMat[i % flowerMat.length],
        );
        flower.position.set(dx, 0.25, dz);
        group.add(flower);
      }
    }

    group.position.set(bx, 0, bz);
    scene.add(shadowed(group));
  }

  // Benches — small marble box seats near garden beds
  const benchMat = mat(C.marble);
  for (const [bx, bz] of BENCH_SPOTS) {
    const bench = new THREE.Group();
    // Seat slab
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), benchMat);
    seat.position.y = 0.35;
    bench.add(seat);
    // Two legs
    for (const lx of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.35), benchMat);
      leg.position.set(lx, 0.175, 0);
      bench.add(leg);
    }
    bench.position.set(bx, 0, bz);
    scene.add(shadowed(bench));
  }
}
