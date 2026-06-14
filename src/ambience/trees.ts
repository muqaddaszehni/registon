import * as THREE from 'three';
import { C } from '../palette';
import { mat, shadowed } from '../buildings/primitives';

// ---------------------------------------------------------------------------
// Tree placement — blocked ('#') or edge tiles only.
// World formula: worldX = col - 14 + 0.5,  worldZ = row - 11 + 0.5
// (cols=28, rows=22 → origin at col=14, row=11)
//
// Verified blocked positions used:
//   Row 0-2 top edge; row 21 bottom edge; leftmost ####; rightmost ####
//   SW corner cols 0-3; SE corner cols 24-27; etc.
//
// All positions below are on '#' tiles per layout.ts.
// Types: 0=round plane tree, 1=slim dark cypress, 2=pink blossom, 3=tall cypress
// ---------------------------------------------------------------------------

// [worldX, worldZ, type, scale]
const TREE_DEFS: [number, number, number, number][] = [
  // --- NW quadrant (left side, rows 3-9, cols 0-2 = blocked ###) ---
  [-13.0, -7.5,  1, 1.0],   // col 1,  row 3  — slim cypress
  [-13.0, -4.5,  0, 1.1],   // col 1,  row 6  — round plane tree
  [-13.0, -1.5,  1, 1.3],   // col 1,  row 9  — tall cypress

  // --- NE quadrant (right side, rows 3-9, cols 25-27 = blocked) ---
  [ 12.5, -7.5,  1, 0.9],   // col 26, row 3  — slim cypress
  [ 12.5, -5.5,  2, 1.0],   // col 26, row 5  — pink blossom
  [ 12.5, -2.5,  0, 1.2],   // col 26, row 8  — round plane tree

  // --- SW quadrant (bottom-left, rows 18-21, cols 0-4) ---
  [-12.0,  7.5,  0, 1.0],   // col 2,  row 18 — round plane tree
  [-11.5,  9.5,  1, 1.15],  // col 2,  row 20 — cypress
  [ -9.0,  9.5,  2, 0.85],  // col 5,  row 20 — small pink blossom

  // --- SE quadrant (bottom-right, rows 18-21, cols 23-27) ---
  [ 10.5,  7.5,  0, 1.0],   // col 24, row 18 — round plane tree
  [ 11.5,  9.5,  1, 1.1],   // col 25, row 20 — cypress
  [  9.5,  9.5,  2, 0.9],   // col 23, row 20 — pink blossom

  // --- Top edge rows 0-1 (all '#') ---
  [ -6.5, -10.5, 1, 0.8],   // col 7,  row 0  — small cypress
  [  0.5, -10.5, 0, 0.9],   // col 14, row 0  — small round
  [  6.5, -10.5, 1, 0.8],   // col 20, row 0  — small cypress

  // --- Mid-left column (cols 0-2, rows 10-16) ---
  [-13.0,  1.5,  0, 1.0],   // col 1,  row 12 — round plane tree
  [-13.0,  4.5,  1, 1.2],   // col 1,  row 15 — cypress

  // --- Mid-right column (cols 25-27, rows 10-16) ---
  [ 12.5,  1.5,  3, 1.0],   // col 26, row 12 — tall cypress variety
  [ 12.5,  4.5,  0, 1.1],   // col 26, row 15 — round plane tree
];

// Round deciduous / plane tree (medium canopy, lighter green)
function makeRoundTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkH = 1.1 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11 * scale, 0.17 * scale, trunkH, 7),
    mat(C.trunk),
  );
  trunk.position.y = trunkH / 2;
  tree.add(trunk);
  // Three overlapping spheres/cones giving a rounded, airy canopy
  const canopyColor = 0x85b865; // slightly warm green
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry((0.95 - i * 0.2) * scale, 0.85 * scale, 8),
      mat(canopyColor),
    );
    cone.position.y = (trunkH + 0.3 + i * 0.55) * scale;
    tree.add(cone);
  }
  return tree;
}

// Slim dark cypress (pencil shape, very dark green)
function makeCypressTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkH = 1.5 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, trunkH, 6),
    mat(C.trunk),
  );
  trunk.position.y = trunkH / 2;
  tree.add(trunk);
  const darkGreen = 0x2e6030;
  for (let i = 0; i < 6; i++) {
    const r = (0.30 - i * 0.03) * scale;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(r, 0.05 * scale), 0.65 * scale, 6),
      mat(darkGreen),
    );
    cone.position.y = (trunkH + 0.1 + i * 0.58) * scale;
    tree.add(cone);
  }
  return tree;
}

// Pink blossoming tree (lighter trunk, pink/rose canopy)
function makeBlossomTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkH = 0.9 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * scale, 0.14 * scale, trunkH, 6),
    mat(0xb8886e), // lighter, pinkish bark
  );
  trunk.position.y = trunkH / 2;
  tree.add(trunk);
  // Two-tier airy blossom canopy — softer spherical puffs
  const pinkLight = 0xe8a0b0;
  const pinkMid   = 0xd0607a;
  for (let i = 0; i < 4; i++) {
    const r = (0.5 + (i % 2) * 0.15) * scale;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(r, 7, 5),
      mat(i < 2 ? pinkLight : pinkMid),
    );
    // Scatter the puffs around slightly
    const angle = i * Math.PI * 0.7;
    sphere.position.set(
      Math.cos(angle) * 0.25 * scale,
      (trunkH + 0.55 + (i % 2) * 0.4) * scale,
      Math.sin(angle) * 0.25 * scale,
    );
    tree.add(sphere);
  }
  return tree;
}

// Tall broad cypress (slightly different from slim — wider, stouter)
function makeTallCypress(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkH = 1.8 * scale;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10 * scale, 0.16 * scale, trunkH, 7),
    mat(C.trunk),
  );
  trunk.position.y = trunkH / 2;
  tree.add(trunk);
  const darkGreen = 0x2a5a2c;
  for (let i = 0; i < 7; i++) {
    const r = (0.42 - i * 0.04) * scale;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(r, 0.06 * scale), 0.70 * scale, 7),
      mat(darkGreen),
    );
    cone.position.y = (trunkH + 0.05 + i * 0.60) * scale;
    tree.add(cone);
  }
  return tree;
}

function makeTree(type: number, scale: number): THREE.Group {
  if (type === 1) return makeCypressTree(scale);
  if (type === 2) return makeBlossomTree(scale);
  if (type === 3) return makeTallCypress(scale);
  return makeRoundTree(scale);
}

export function addTrees(scene: THREE.Scene): (dt: number) => void {
  for (let i = 0; i < TREE_DEFS.length; i++) {
    const [x, z, type, scale] = TREE_DEFS[i];
    const tree = makeTree(type, scale);
    tree.position.set(x, 0, z);
    // Slight deterministic rotation for variety (no Math.random)
    tree.rotation.y = i * 1.3;
    scene.add(shadowed(tree));
  }

  // Leaf particle scatter — float near tree positions
  const N = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const [tx, tz] = TREE_DEFS[i % TREE_DEFS.length];
    // Scatter particles in a small radius around each tree
    const angle = i * 2.39996;
    const r = 0.5 + (i % 4) * 0.3;
    pos.set([
      tx + Math.cos(angle) * r,
      0.8 + (i % 5) * 0.5,
      tz + Math.sin(angle) * r,
    ], i * 3);
    seed[i] = i * 0.61;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ color: C.leaf, size: 0.18 }),
  );
  scene.add(pts);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  return (dt: number) => {
    if (reduced) return;
    t += dt;
    const a = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const base = i * 3;
      const [tx, tz] = TREE_DEFS[i % TREE_DEFS.length];
      // Gentle drift then reset back near the tree
      pos[base]     += Math.sin(t * 0.8 + seed[i]) * dt * 0.3 + dt * 0.1;
      pos[base + 1]  = 0.8 + Math.sin(t * 0.6 + seed[i]) * 0.7;
      pos[base + 2] += Math.cos(t * 0.5 + seed[i] * 1.3) * dt * 0.2;
      // Wrap back near source tree if drifted too far
      if (Math.abs(pos[base] - tx) > 3.0) pos[base] = tx + (i % 3) * 0.4 - 0.4;
      if (Math.abs(pos[base + 2] - tz) > 3.0) pos[base + 2] = tz + (i % 3) * 0.3 - 0.3;
    }
    a.needsUpdate = true;
  };
}
