import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// Four sunken garden beds flanking the south axis, each rimmed by a clipped low
// boxwood hedge with shrub blobs + flower clusters — the clipped-box silhouette
// is what sells them at default zoom (the old flat lime mats read as blank
// rectangles from above). All like-coloured parts are merged into one geometry.

// [worldX, worldZ, widthX, depthZ] — symmetric front + back pairs about the axis.
const BED_SPOTS: [number, number, number, number][] = [
  [-6.0, 8.0, 2.6, 1.5], // SW front
  [ 6.0, 8.0, 2.6, 1.5], // SE front
  [-6.0, 1.0, 2.6, 1.5], // NW back
  [ 6.0, 1.0, 2.6, 1.5], // NE back
];

// Shrub blob offsets inside each bed [dx, dz] (kept clear of the hedge rim).
const SHRUB_OFFSETS: [number, number][] = [
  [-0.7, -0.2], [0.0, 0.15], [0.7, -0.1],
];
// A couple of slightly larger flower clusters per bed [dx, dz].
const FLOWER_TERRA: [number, number] = [-0.35, 0.30];
const FLOWER_ROSE:  [number, number] = [ 0.4,  0.30];

const SOIL    = 0x6f9050; // deeper leaf-green soil top
const HEDGE   = 0x4f7038; // clipped boxwood
const SHRUB   = 0x5f8044; // shrub blob green
const ROSE    = 0xd94f80;

// Bench spots — moved just south of the fountains, clear of the enlarged beds.
const BENCH_SPOTS: [number, number][] = [
  [-6.5, 6.3],
  [ 6.5, 6.3],
];

export function addGardens(scene: THREE.Scene): void {
  const borderGeos: THREE.BufferGeometry[] = [];
  const soilGeos:   THREE.BufferGeometry[] = [];
  const hedgeGeos:  THREE.BufferGeometry[] = [];
  const shrubGeos:  THREE.BufferGeometry[] = [];
  const terraGeos:  THREE.BufferGeometry[] = [];
  const roseGeos:   THREE.BufferGeometry[] = [];

  for (const [bx, bz, bw, bd] of BED_SPOTS) {
    // Marble lip + recolored soil top.
    borderGeos.push(new THREE.BoxGeometry(bw + 0.2, 0.18, bd + 0.2).translate(bx, 0.09, bz));
    soilGeos.push(new THREE.BoxGeometry(bw - 0.1, 0.05, bd - 0.1).translate(bx, 0.175, bz));

    // Clipped-hedge rim: four thin walls framing the bed (real silhouette from iso).
    const hx = bw / 2 + 0.03, hz = bd / 2 + 0.03;
    hedgeGeos.push(new THREE.BoxGeometry(bw + 0.2, 0.34, 0.14).translate(bx, 0.35, bz - hz));
    hedgeGeos.push(new THREE.BoxGeometry(bw + 0.2, 0.34, 0.14).translate(bx, 0.35, bz + hz));
    hedgeGeos.push(new THREE.BoxGeometry(0.14, 0.34, bd + 0.2).translate(bx - hx, 0.35, bz));
    hedgeGeos.push(new THREE.BoxGeometry(0.14, 0.34, bd + 0.2).translate(bx + hx, 0.35, bz));

    // Shrub blobs (survive at default zoom where the old 0.08 cones were sub-pixel).
    for (const [dx, dz] of SHRUB_OFFSETS) {
      shrubGeos.push(new THREE.IcosahedronGeometry(0.22, 0).translate(bx + dx, 0.30, bz + dz));
    }
    // Flower clusters — terracotta + rose, slightly larger.
    terraGeos.push(new THREE.IcosahedronGeometry(0.26, 0).translate(bx + FLOWER_TERRA[0], 0.33, bz + FLOWER_TERRA[1]));
    roseGeos.push(new THREE.IcosahedronGeometry(0.24, 0).translate(bx + FLOWER_ROSE[0], 0.33, bz + FLOWER_ROSE[1]));
  }

  const beds = new THREE.Group();
  const addMerged = (geos: THREE.BufferGeometry[], color: number) => {
    beds.add(new THREE.Mesh(mergeGeometries(geos), mat(color)));
  };
  addMerged(borderGeos, C.marble);
  addMerged(soilGeos, SOIL);
  addMerged(hedgeGeos, HEDGE);
  addMerged(shrubGeos, SHRUB);
  addMerged(terraGeos, C.terracotta);
  addMerged(roseGeos, ROSE);
  scene.add(shadowed(beds));

  // Benches — small marble box seats near garden beds.
  const benchMat = mat(C.marble);
  for (const [bx, bz] of BENCH_SPOTS) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), benchMat);
    seat.position.y = 0.35;
    bench.add(seat);
    for (const lx of [-0.45, 0.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.35, 0.35), benchMat);
      leg.position.set(lx, 0.175, 0);
      bench.add(leg);
    }
    bench.position.set(bx, 0, bz);
    scene.add(shadowed(bench));
  }
}
